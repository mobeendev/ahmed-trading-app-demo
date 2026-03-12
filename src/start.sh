#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  start.sh — Launch the XYZ Corp Trading System
#
#  Usage:
#    ./start.sh          # default 3 simulated users
#    ./start.sh 5        # 5 simulated users
#    ./start.sh 10       # 10 simulated users
# ─────────────────────────────────────────────

set -e

NUM_USERS=${1:-3}
ENDPOINT="amqp://localhost"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Predefined trader names
TRADERS=(alice bob charlie dave eve frank grace hank iris jake kate leo mia nick olivia)

# Colours for terminal output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No colour

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   XYZ Corp Trading System — Launcher     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Docker & start RabbitMQ ─────────
echo -e "${YELLOW}[1/4]${NC} Checking RabbitMQ..."

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^rabbitmq$'; then
  echo -e "${GREEN}  ✔ RabbitMQ already running${NC}"
else
  echo -e "  Starting RabbitMQ via Docker..."
  docker run -d --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management > /dev/null 2>&1
  echo -e "${GREEN}  ✔ RabbitMQ started${NC}"
  echo -e "  Waiting for RabbitMQ to be ready..."
  for i in $(seq 1 30); do
    if node -e "require('amqplib').connect('$ENDPOINT').then(c => { c.close(); process.exit(0); }).catch(() => process.exit(1))" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  echo -e "${GREEN}  ✔ RabbitMQ is ready${NC}"
fi

# ── 2. Start the Exchange (background) ───────
echo -e "${YELLOW}[2/4]${NC} Starting exchange..."
node "$SCRIPT_DIR/exchange.js" "$ENDPOINT" > /tmp/exchange.log 2>&1 &
EXCHANGE_PID=$!
echo -e "${GREEN}  ✔ Exchange started (PID $EXCHANGE_PID)${NC}"
sleep 1

# ── 3. Send orders from simulated users ──────
echo -e "${YELLOW}[3/4]${NC} Sending orders from ${NUM_USERS} users..."

for i in $(seq 0 $(( NUM_USERS - 1 ))); do
  TRADER="${TRADERS[$i]:-user$i}"

  if (( i % 2 == 0 )); then
    SIDE="BUY"
    PRICE=$(node -e "console.log((142.50 + (Math.random() * 1.0 - 0.3)).toFixed(2))")
  else
    SIDE="SELL"
    PRICE=$(node -e "console.log((142.50 - (Math.random() * 1.0 - 0.3)).toFixed(2))")
  fi

  node "$SCRIPT_DIR/sendOrder.js" --user "$TRADER" --side "$SIDE" --price "$PRICE" --endpoint "$ENDPOINT"
done

# ── 4. Launch GUI in FOREGROUND ───────────────
echo ""
echo -e "${YELLOW}[4/4]${NC} Launching GUI (interactive)..."
echo -e "  Exchange log: ${CYAN}cat /tmp/exchange.log${NC}"
echo -e "  Send orders from another terminal:"
echo -e "    ${CYAN}cd src && ./trader.sh mobeena${NC}"
echo -e "    ${CYAN}cd src && node sendOrder.js --user myname --side BUY --price 142.50${NC}"
echo ""
echo -e "  Press ${YELLOW}q${NC} or ${YELLOW}Ctrl+C${NC} in the GUI to quit."
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
sleep 1

# Cleanup function — kill exchange when GUI exits
cleanup() {
  kill $EXCHANGE_PID 2>/dev/null
  echo ""
  echo -e "${YELLOW}GUI closed. Exchange stopped.${NC}"
  echo -e "Exchange log saved to /tmp/exchange.log"
}
trap cleanup EXIT

# Run GUI in foreground so it owns the terminal (keyboard input works)
node "$SCRIPT_DIR/gui.js" "$ENDPOINT"
