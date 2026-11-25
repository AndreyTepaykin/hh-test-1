# Цифровая визитка

GraphQL API профиля. Sandbox: [https://hh-test-1-api.onrender.com/graphql](https://hh-test-1-api.onrender.com/graphql) (прод на Render) или [http://localhost:3000/graphql](http://localhost:3000/graphql) (локально).

## Запуск

Нужны Docker и Docker Compose.

```bash
docker compose up --build
```

Контейнер `db` поднимает PostgreSQL 16. Контейнер `app` ждёт healthy-базу, применяет миграции, заливает данные в пустую базу и запускает NestJS. Отдельного шага с сидом нет: после `docker compose up` запрос `query { profile { name } }` сразу возвращает данные.

Проверка процесса: `GET /health` → `{ "status": "ok" }`.

Локально без сборки образа API:
- поднять базу: `docker compose up db` (или любой PostgreSQL — см. `.env.example`);
- скопировать `.env.example` в `.env` и проверить `DATABASE_URL`;
- `npm install`;
- `npm run start:dev` — хуки `prestart`/`prestart:dev` сами выполнят `prisma generate`, `migrate deploy` и сид.

База должна существовать: `migrate deploy` создаёт таблицы, но не саму базу. В compose её создаёт `POSTGRES_DB`, локально — `createdb`.

## Переменные окружения

Конфигурацию загружает само приложение на старте (`ConfigModule` в `src/app.module.ts`) и проверяет
схемой `src/config/env.validation.ts`. Неверное или отсутствующее обязательное значение роняет процесс
при бутстрапе с понятным сообщением, а не на первом запросе; `PORT` приводится к числу.

| Переменная     | Обязательна | По умолчанию  | Проверка                          |
| -------------- | ----------- | ------------- | --------------------------------- |
| `DATABASE_URL` | да          | —             | непустая строка (PostgreSQL)      |
| `PORT`         | нет         | `3000`        | целое число от 1 до 65535         |
| `NODE_ENV`     | нет         | `development` | `development` / `test` / `production` |

Приоритет: реальное окружение → `.env.local` → `.env` (файлы ищутся в корне проекта; отсутствие `.env`
не ошибка — в Docker и на Render переменные приходят из окружения сервиса). Prisma CLI по-прежнему
читает `.env` через `prisma.config.ts`.

## Продакшн (Linux + Docker)

- Образ собирается из `Dockerfile`: Node 24, запуск от пользователя `node`, healthcheck на `/health`.
- Миграции и сид данных выполняет `docker/entrypoint.sh` при старте контейнера:
  `migrate deploy` → `db seed` → `node dist/main.js`. Сид идемпотентен — на заполненной
  базе он не делает ни одной записи.
- **Render**: Blueprint `render.yaml` в корне — web-сервис + managed PostgreSQL,
  `healthCheckPath: /health`, миграции при старте контейнера (pre-deploy command — опционально).
  Рабочий деплой: [https://hh-test-1-api.onrender.com](https://hh-test-1-api.onrender.com) —
  `/health` и `/graphql`. Free-тариф засыпает после ~15 минут без запросов, первый запрос
  после паузы — до минуты; free PostgreSQL живёт 30 дней.

Инструкция по шагам, переменные окружения, настройки health-check и чек-лист сдачи —
[deploy/docker/README.md](deploy/docker/README.md).

Обязательная зависимость для прод-сборки: `@as-integrations/express5` (Apollo Server 5 + Express 5). Без неё процесс падает с `The "@as-integrations/express5" package is missing`.

## Пример запроса

```graphql
query {
  profile {
    name
    description
    links {
      label
      url
    }
    skills {
      name
    }
    experience {
      company
      position
      startDate
      endDate
      achievements {
        text
      }
    }
    projects {
      name
      url
    }
  }
}
```

## Инициализация базы

База приводится в рабочее состояние при каждом старте приложения — и в Docker, и локально:

- `prisma migrate deploy` применяет миграции (идемпотентно, версия схемы хранится в `_prisma_migrations`);
- `prisma db seed` заливает профиль, скиллы, опыт и проекты, **только если профиля в базе ещё нет**.

Сид не удаляет и не перезаписывает существующие строки, потому что выполняется на каждом старте контейнера, а Render перезапускает сервис при деплое и после засыпания. Проверка «есть ли профиль» идёт в той же транзакции под `pg_advisory_xact_lock`, поэтому два одновременно стартующих контейнера не создадут два профиля: второй дождётся коммита первого и увидит заполненную базу.

Полная перезаливка — только осознанно, когда данные в `prisma/seed.ts` изменились:

```bash
npm run db:reseed   # tsx prisma/seed.ts --force: очистить таблицы и залить заново
```

В контейнере то же самое: `docker compose run --rm app npx tsx prisma/seed.ts --force`.

## Архитектура

Слои разделены так, чтобы GraphQL, правила чтения и доступ к базе не смешивались.

- **Resolver** (`ProfileResolver`, `ExperienceResolver`) описывает схему и вызывает сервис или DataLoader. Он не импортирует Prisma.
- **Service** (`ProfileService`) читает сам профиль. Он не знает про GraphQL.
- **PrismaService** — единственная точка доступа к базе. Модуль глобальный, клиент один на процесс.
- **ProfileLoaders** — request-scoped DataLoader. На один GraphQL-запрос создаётся один набор батчеров.

GraphQL собран code-first (`@nestjs/graphql` + Apollo Driver, схема в памяти). Классы `@ObjectType` совпадают по полям с моделями Prisma, но живут отдельно: схема не генерируется из таблиц и не тянет служебные колонки вроде `sortOrder`.

Связи не подгружаются в корневом `profile`. Поля `links`, `skills`, `experience`, `projects` и `achievements` — отдельные `@ResolveField`. DataLoader собирает id за тик event loop и делает один `findMany` с `IN (...)` на каждую запрошенную связь. Поле, которого нет в запросе клиента, резолвер не вызывает, и таблица не читается. Достижения нескольких мест работы уходят одним запросом по `experienceId`.

База — PostgreSQL. Prisma хранит схему, SQL-миграцию и seed. На пустой базе `migrate deploy` создаёт таблицы, seed кладёт одну строку профиля и связанные записи; на заполненной базе сид выходит после проверки `count`, поэтому старт ничего не меняет. API только на чтение: мутации визитке не нужны.

## Структура

```
src/
  main.ts
  app.module.ts
  prisma/            PrismaService
  common/dataloaders DataLoader на запрос
  profile/           модели, сервис, резолверы
  health/            GET /health
prisma/
  schema.prisma
  migrations/
  seed.ts
docker/entrypoint.sh   миграции + сид + запуск
deploy/docker/         инструкция по деплою на Render, env-шаблон
Dockerfile             прод-образ (Node 24, non-root, healthcheck)
docker-compose.yml     dev-стек (без volume, порты открыты наружу)
render.yaml            Render Blueprint: web + PostgreSQL
```
