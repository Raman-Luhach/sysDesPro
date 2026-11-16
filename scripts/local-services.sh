#!/bin/sh
# Run Postgres + Redis natively (Homebrew), without Docker.
#   sh scripts/local-services.sh start | stop | status
# Nothing is registered to auto-start at login: services run only while you need them.
set -e
# Postgres on macOS refuses to start without a valid locale ("postmaster became multithreaded").
export LC_ALL="en_US.UTF-8"
export LANG="en_US.UTF-8"

BREW_PREFIX="$(brew --prefix 2>/dev/null || echo /opt/homebrew)"
PG_BIN="$BREW_PREFIX/opt/postgresql@16/bin"
PGDATA="$BREW_PREFIX/var/postgresql@16"
PG_LOG="$PGDATA/flashslot-server.log"
REDIS_BIN="$BREW_PREFIX/opt/redis/bin"
REDIS_PORT=6379

need() {
  if [ ! -x "$PG_BIN/pg_ctl" ] || [ ! -x "$REDIS_BIN/redis-server" ]; then
    echo "Postgres 16 / Redis not found. Install them once with:"
    echo "  brew install postgresql@16 redis"
    exit 1
  fi
}

pg_running() { "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; }
redis_running() { "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" ping >/dev/null 2>&1; }

start() {
  need
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initialising Postgres data directory..."
    "$PG_BIN/initdb" -D "$PGDATA" -U "$(whoami)" --auth=trust >/dev/null
  fi
  if pg_running; then echo "✓ Postgres already running (port 5434)"; else
    "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PG_LOG" -o "-p 5434" -w start >/dev/null
    echo "✓ Postgres started (port 5434)"
  fi
  if redis_running; then echo "✓ Redis already running (port $REDIS_PORT)"; else
    "$REDIS_BIN/redis-server" --port "$REDIS_PORT" --daemonize yes --save "" --appendonly no --dir "$BREW_PREFIX/var" >/dev/null
    sleep 0.3
    echo "✓ Redis started (port $REDIS_PORT)"
  fi

  # Create the app's database user + database the first time.
  PSQL="$PG_BIN/psql -h localhost -p 5434 -d postgres -tAq"
  if ! $PSQL -c "SELECT 1 FROM pg_roles WHERE rolname='flashslot'" | grep -q 1; then
    $PSQL -c "CREATE ROLE flashslot LOGIN PASSWORD 'flashslot' CREATEDB"
    echo "✓ Created database user 'flashslot'"
  fi
  if ! $PSQL -c "SELECT 1 FROM pg_database WHERE datname='flashslot'" | grep -q 1; then
    $PSQL -c "CREATE DATABASE flashslot OWNER flashslot"
    echo "✓ Created database 'flashslot'"
  fi
}

stop() {
  need
  if pg_running; then "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null && echo "✓ Postgres stopped"; else echo "Postgres not running"; fi
  if redis_running; then "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true; echo "✓ Redis stopped"; else echo "Redis not running"; fi
}

status() {
  need
  if pg_running; then echo "Postgres: running (5434)"; else echo "Postgres: stopped"; fi
  if redis_running; then echo "Redis:    running ($REDIS_PORT)"; else echo "Redis:    stopped"; fi
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "usage: sh scripts/local-services.sh start|stop|status"; exit 1 ;;
esac
