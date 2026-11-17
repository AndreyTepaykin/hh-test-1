#!/bin/sh
set -eu

# Миграции — на каждом старте: они идемпотентны и должны опережать приложение.
npx prisma migrate deploy

# Сид сюда НЕ входит: prisma/seed.ts очищает таблицы в транзакции, то есть на каждом
# рестарте контейнера обнулял бы прод-базу. Запускать отдельно и осознанно:
#     docker compose run --rm app npx prisma db seed
#     (Render: Shell на free-тарифе недоступен, поэтому сид запускается снаружи против
#      External Database URL — см. deploy/docker/README.md)
exec node dist/main.js
