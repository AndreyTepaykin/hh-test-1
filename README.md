# Цифровая визитка

GraphQL API профиля Андрея Тепайкина. Apollo Sandbox: [http://localhost:3000/graphql](http://localhost:3000/graphql).

## Запуск

Нужны Docker и Docker Compose.

```bash
docker compose up --build
```

Контейнер `db` поднимает PostgreSQL 16. Контейнер `app` ждёт healthy-базу, применяет миграции (`prisma migrate deploy`), заполняет данные (`prisma db seed`) и запускает NestJS. Повторный старт не создаёт дубликаты: seed в одной транзакции очищает таблицы и записывает профиль заново.

Проверка процесса: `GET /health` → `{ "status": "ok" }`.

Локально без сборки образа API: поднять только базу (`docker compose up db`), скопировать `.env.example` в `.env`, затем `npm install`, `npx prisma generate`, `npm run db:migrate`, `npm run db:seed`, `npm run start:dev`.

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
docker/entrypoint.sh
Dockerfile
docker-compose.yml
```
