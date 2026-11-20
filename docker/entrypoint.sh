#!/bin/sh
set -eu

# Миграции — на каждом старте: они идемпотентны и должны опережать приложение.
npx prisma migrate deploy

# Сид — тоже на каждом старте, но он сам решает, нужен ли: prisma/seed.ts заливает
# данные только в пустую базу (одна проверка count под advisory-локом), поэтому
# рестарты контейнера и пробуждения Render ничего не перезаписывают.
# Осознанная перезаливка — отдельно: npx tsx prisma/seed.ts --force.
npx prisma db seed

exec node dist/main.js
