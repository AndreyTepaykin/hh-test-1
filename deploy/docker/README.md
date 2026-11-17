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
Миграции применяет entrypoint при старте контейнера; если тариф поддерживает pre-deploy command,
включить в `render.yaml` строку `preDeployCommand: npx prisma migrate deploy` — миграции пройдут
до переключения трафика.

1. Запушить репозиторий в GitHub.
2. Render Dashboard → **New → Blueprint** → выбрать репозиторий. Render прочитает `render.yaml`
   (он обязан лежать в корне репозитория, поэтому не в `deploy/docker`).
3. Дождаться сборки. Первый деплой создаст пустую базу — миграции применит entrypoint при старте
   (в логах видно `prisma migrate deploy`); при необходимости повторить вручную из **Shell**:
   `npx prisma migrate deploy`.
4. Залить демо-данные **один раз** из Shell: `npx prisma db seed`.
5. Проверить: `https://<service>.onrender.com/health` → `{"status":"ok"}`,
   `https://<service>.onrender.com/graphql` открывает Apollo Sandbox.

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

- [ ] `GET /health` на публичном HTTPS-адресе возвращает 200.
- [ ] `POST /graphql` с `{ profile { name } }` возвращает данные (не пустой объект).
- [ ] `GET /graphql` в браузере открывает Sandbox.
- [ ] В README репозитория указан рабочий URL и пример запроса.
- [ ] Секреты только в переменных хостинга, в git их нет.
