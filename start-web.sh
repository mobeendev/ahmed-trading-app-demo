#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  start-web.sh — Launch the full web trading system
#  1. RabbitMQ (Docker)
#  2. exchange.js (matching engine)
#  3. Express server (web gateway)
#  4. Angular dev server (GUI)
# ─────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "Shutting down…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "All services stopped."
}

trap cleanup EXIT INT TERM

# 1. Start RabbitMQ if not running
if ! docker ps --format '{{.Names}}' | grep -q '^rabbitmq$'; then
  echo "Starting RabbitMQ…"
  docker run -d --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management > /dev/null
  echo "Waiting for RabbitMQ to be ready…"
  sleep 8
else
  echo "RabbitMQ already running."
fi

# 2. Start exchange
echo "Starting exchange…"
node "$SCRIPT_DIR/src/exchange.js" amqp://localhost &
PIDS+=($!)
sleep 1

# 3. Start Express server
echo "Starting web server on port 3000…"
node "$SCRIPT_DIR/server/src/index.js" amqp://localhost &
PIDS+=($!)
sleep 1

# 4. Start Angular dev server (foreground)
echo "Starting Angular on port 4200…"
cd "$SCRIPT_DIR/web"
npx ng serve --port 4200 --open
