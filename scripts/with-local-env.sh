#!/bin/sh
# Runs a command against the NATIVE (Homebrew) Postgres + Redis instead of the Docker ones.
# Environment variables take priority over apps/api/.env, so nothing else needs changing.
export DATABASE_URL="postgresql://flashslot:flashslot@localhost:5434/flashslot?connection_limit=20"
export REDIS_URL="redis://localhost:6379"
exec "$@"
