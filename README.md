# Цифровая визитка

GraphQL API профиля. Sandbox: [https://hh-test-1-api.onrender.com/graphql](https://hh-test-1-api.onrender.com/graphql) (прод на Render) или [http://localhost:3000/graphql](http://localhost:3000/graphql) (локально).

## Запуск

Нужны Docker и Docker Compose.

```bash
docker compose up --build
```

Контейнер `db` поднимает PostgreSQL 16. Контейнер `app` ждёт healthy-базу, применяет миграции (`prisma migrate deploy`) и запускает NestJS. Сид в старт контейнера не входит — он очищает таблицы, поэтому запускается отдельно: `docker compose run --rm app npx prisma db seed`.

Проверка процесса: `GET /health` → `{ "status": "ok" }`.

Локально без сборки образа API: поднять только базу (`docker compose up db`), скопировать `.env.example` в `.env`, затем `npm install`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run start:dev`.

## Продакшн (Linux + Docker)

- Образ собирается из `Dockerfile`: Node 24, запуск от пользователя `node`, healthcheck на `/health`.
- Миграции применяет `docker/entrypoint.sh` при старте; сид — отдельной командой
  `npx prisma db seed` (он очищает таблицы, в автозапуск не входит).
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

## Архитектура

Слои разделены так, чтобы GraphQL, правила чтения и доступ к базе не смешивались.

- **Resolver** (`ProfileResolver`, `ExperienceResolver`) описывает схему и вызывает сервис или DataLoader. Он не импортирует Prisma.
- **Service** (`ProfileService`) читает сам профиль. Он не знает про GraphQL.
- **PrismaService** — единственная точка доступа к базе. Модуль глобальный, клиент один на процесс.
- **ProfileLoaders** — request-scoped DataLoader. На один GraphQL-запрос создаётся один набор батчеров.

GraphQL собран code-first (`@nestjs/graphql` + Apollo Driver, схема в памяти). Классы `@ObjectType` совпадают по полям с моделями Prisma, но живут отдельно: схема не генерируется из таблиц и не тянет служебные колонки вроде `sortOrder`.

Связи не подгружаются в корневом `profile`. Поля `links`, `skills`, `experience`, `projects` и `achievements` — отдельные `@ResolveField`. DataLoader собирает id за тик event loop и делает один `findMany` с `IN (...)` на каждую запрошенную связь. Поле, которого нет в запросе клиента, резолвер не вызывает, и таблица не читается. Достижения нескольких мест работы уходят одним запросом по `experienceId`.

База — PostgreSQL. Prisma хранит схему, SQL-миграцию и seed. На пустой базе `migrate deploy` создаёт таблицы, seed кладёт одну строку профиля и связанные записи. API только на чтение: мутации визитке не нужны.

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
docker/entrypoint.sh   миграции + запуск (без сида)
deploy/docker/         инструкция по деплою на Render, env-шаблон
Dockerfile             прод-образ (Node 24, non-root, healthcheck)
docker-compose.yml     dev-стек (без volume, порты открыты наружу)
render.yaml            Render Blueprint: web + PostgreSQL
```
