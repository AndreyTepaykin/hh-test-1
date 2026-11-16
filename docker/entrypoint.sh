#!/bin/sh
set -eu

# Миграции — на каждом старте: они идемпотентны и должны опережать приложение.
npx prisma migrate deploy

# Сид сюда НЕ входит: prisma/seed.ts очищает таблицы в транзакции, то есть на каждом
# рестарте контейнера обнулял бы прод-базу. Запускать отдельно и осознанно:
#     docker compose run --rm app npx prisma db seed
#     (Render: preDeployCommand уже применён к migrate; сид — вручную из Shell)
exec node dist/main.js
