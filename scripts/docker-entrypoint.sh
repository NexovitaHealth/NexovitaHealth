#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  node node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"