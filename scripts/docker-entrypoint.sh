#!/bin/sh

set -euo pipefail

DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

export PGPASSWORD=$DB_PASSWORD

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}…"
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; do
  printf '.'
  sleep 1
done

printf '\nPostgres is available, running Prisma commands\n'
npm run prisma:gen
npm run prisma:migrate:deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "RUN_SEED=true: seeding subscription plans"
  node dist/scripts/seed-subscription-plans.js
fi

echo "Starting application process"
exec "$@"
