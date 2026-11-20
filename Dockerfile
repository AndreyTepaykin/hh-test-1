# syntax=docker/dockerfile:1

# Digital Card API (hh-test-1). Прод-образ: Node 24 (совпадает с engines.node >=24),
# multi-stage, запуск от непривилегированного пользователя node.
#
# Сборка:  docker build -t hh-test-1 .
# Запуск:  docker run --rm -p 3000:3000 -e DATABASE_URL=... hh-test-1
# Миграции и сид выполняет entrypoint при старте контейнера (см. deploy/docker/README.md).

FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# prisma.config.ts задаёт команду сида (tsx prisma/seed.ts) и путь к схеме.
# Без него `npx prisma db seed` в контейнере молча завершается с кодом 0 и ничего не делает.
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && chown -R node:node /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
