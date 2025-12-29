FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 git build-base
COPY package*.json ./
RUN npm ci --prefer-offline

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline

FROM prod-deps AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh \
  && apk add --no-cache curl postgresql-client

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
