FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential git \
  && rm -rf /var/lib/apt/lists/*
RUN npm config set registry https://registry.npmmirror.com/
COPY package*.json ./
RUN npm ci --prefer-offline

FROM deps AS builder
COPY . .
RUN npm run build

FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY . .

FROM base AS prod-deps
RUN npm config set registry https://registry.npmmirror.com/
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
  && apt-get update \
  && apt-get install -y --no-install-recommends curl postgresql-client gosu \
  && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
