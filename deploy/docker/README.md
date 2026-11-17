# Продакшн-деплой: Linux + Docker

Образ собирается из `Dockerfile` в корне репозитория,
миграции применяются при старте контейнера, сид запускается отдельной командой.

## Что внутри образа

- **Node 24 alpine** — совпадает с `engines.node: ">=24"` в `package.json`.
- Multi-stage: сборка (`npm ci` → `prisma generate` → `nest build` → `npm prune --omit=dev`),
  затем runtime только с `node_modules`, `dist`, `prisma`, `prisma.config.ts`.
- Процесс работает от пользователя `node`, а не от root.
- `HEALTHCHECK` бьёт в `GET /health` (порт из `PORT`, по умолчанию 3000).
- `docker/entrypoint.sh` делает `npx prisma migrate deploy` и запускает `node dist/main.js`.
  **Сида в entrypoint нет**: `prisma/seed.ts` очищает таблицы в транзакции, на каждом рестарте
  контейнера это обнуляло бы прод-базу.

`prisma.config.ts` копируется в образ намеренно: без него `npx prisma db seed` завершается
с кодом 0, ничего не делая (проверено на Prisma 6.16), а миграции теряют путь к схеме.

## Переменные окружения

| Переменная | Обязательна | Значение |
| --- | --- | --- |
| `DATABASE_URL` | да | `postgresql://user:pass@host:5432/db?schema=public&sslmode=require` для managed-Postgres |
| `PORT` | нет | `3000`; хостинг может подставить свой — приложение читает `process.env.PORT` |
| `NODE_ENV` | нет | `production` (уже задан в образе) |

Шаблон — [.env.example](.env.example). Файл `.env` в образ не попадает (`.dockerignore`),
в production переменные приходят из панели хостинга.

## Render

Файл [`render.yaml`](../../render.yaml) в корне — Blueprint: web-сервис (Docker) + managed PostgreSQL,
`healthCheckPath: /health`, `DATABASE_URL` подставляется из базы через `fromDatabase`.
Миграции применяет entrypoint при старте контейнера. Pre-deploy command (`preDeployCommand`)
доступен только на платных тарифах: на free Render не даст его сохранить, а на платном —
раскомментировать строку `preDeployCommand: npx prisma migrate deploy` в `render.yaml`,
чтобы миграции проходили до переключения трафика.

1. Запушить репозиторий в GitHub.
2. Render Dashboard → **New → Blueprint** → выбрать репозиторий. Render прочитает `render.yaml`
   (он обязан лежать в корне репозитория, поэтому не в `deploy/docker`).
3. Дождаться сборки. Первый деплой создаст пустую базу — миграции применит entrypoint при старте
   (в логах видно `prisma migrate deploy`). Если контейнер стартовал раньше базы, деплой упадёт:
   на free Shell нет, поэтому либо **Manual Deploy → Deploy latest commit**, либо тот же
   `migrate deploy` снаружи по External Database URL (см. ниже).
4. Залить демо-данные **один раз** — см. [«Сид демо-данных на free-тарифе»](#сид-демо-данных-на-free-тарифе):
   Shell и SSH на free-плане недоступны, поэтому сид идёт снаружи.
5. Проверить: `https://<service>.onrender.com/health` → `{"status":"ok"}`,
   `https://<service>.onrender.com/graphql` открывает Apollo Sandbox.

### Сид демо-данных на free-тарифе

У free web service нет ни Shell в дашборде, ни SSH
([Render: SSH and Shell Access](https://render.com/docs/ssh)), поэтому `npx prisma db seed`
выполняется с локальной машины против External Database URL.

1. Render Dashboard → база `hh-test-1-db` → вкладка **Connect** → **External Database URL**.
2. Дописать в конец `?sslmode=require` — внешние подключения к Render Postgres идут только по TLS.
3. Дождаться успешного деплоя `hh-test-1-api`: миграции применяет entrypoint при старте контейнера.
4. Проверить схему и засеять одной сессией:

```bash
cd repo
URL='postgresql://hh_test_1:<пароль>@dpg-xxxx-a.frankfurt-postgres.render.com/hh_test_1?sslmode=require'
DATABASE_URL="$URL" npx prisma migrate status   # ожидаем "Database schema is up to date!"
DATABASE_URL="$URL" npx prisma db seed
```

- URL с паролем не класть в `.env`: `prisma.config.ts` подхватывает `.env`, и тогда локальные
  `prisma migrate dev` пойдут в прод-базу.
- Сид идемпотентен по результату: в одной транзакции чистит таблицы и вставляет демо-данные.
  Повторный запуск безопасен, но перезаписывает данные.
- Таймаут транзакции в `prisma/seed.ts` поднят до 60 с (`maxWait` 15 с): дефолтных 5 с не хватает
  на ~40 round-trip'ов до внешней базы (`P2028: Transaction already closed`).

Без Blueprint то же самое вручную: **New → Web Service → Docker**, health check path `/health`,
переменная `DATABASE_URL` из созданной базы (**New → PostgreSQL**), миграции — автоматически
при старте контейнера.

Особенности free-тарифа: сервис засыпает после ~15 минут без запросов (первый запрос после
паузы — 30–60 с), free PostgreSQL удаляется через 30 дней. Для сдачи задания этого хватает,
для постоянного продакшна — нет.

## Health-check

| Параметр | Значение |
| --- | --- |
| Путь | `/health` |
| Ожидание | HTTP 200, тело `{"status":"ok"}` |
| `start-period` / grace | 20 с (столько нужно Nest + Prisma на первый коннект) |
| Интервал / таймаут / retries | 30 с / 5 с / 3 |

## Чек-лист перед сдачей

- [x] `GET /health` на публичном HTTPS-адресе возвращает 200.
- [x] `POST /graphql` с `{ profile { name } }` возвращает данные (не пустой объект).
- [x] `GET /graphql` в браузере открывает Sandbox.
- [x] В README репозитория указан рабочий URL — <https://hh-test-1-api.onrender.com> — и пример запроса.
- [x] Секреты только в переменных хостинга, в git их нет.
