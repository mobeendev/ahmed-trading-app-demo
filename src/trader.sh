#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  trader.sh — Interactive trader session
#
#  Usage:
#    ./trader.sh mobeena
#    ./trader.sh friend1
#
#  Each person runs this in their own terminal.
#  Type orders interactively — they go straight
#  to the exchange via RabbitMQ.
# ─────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENDPOINT="amqp://localhost"
USER=${1:-trader}

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   XYZ Corp — Trader Terminal             ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo -e "  Logged in as: ${GREEN}${USER}${NC}"
echo -e "  Endpoint:     ${CYAN}${ENDPOINT}${NC}"
echo ""
echo -e "  Type ${YELLOW}buy <price>${NC} or ${YELLOW}sell <price>${NC}"
echo -e "  Optional qty: ${YELLOW}buy <price> <qty>${NC}"
echo -e "  Type ${YELLOW}quit${NC} to exit"
echo -e "────────────────────────────────────────────"
echo ""

while true; do
  read -rp "$USER> " INPUT

  # Skip empty input
  [[ -z "$INPUT" ]] && continue

  # Quit
  [[ "$INPUT" == "quit" || "$INPUT" == "exit" || "$INPUT" == "q" ]] && echo "Bye!" && break

  # Parse: buy/sell price [qty]
  SIDE=$(echo "$INPUT" | awk '{print toupper($1)}')
  PRICE=$(echo "$INPUT" | awk '{print $2}')
  QTY=$(echo "$INPUT" | awk '{print $3}')
  QTY=${QTY:-100}

  if [[ "$SIDE" != "BUY" && "$SIDE" != "SELL" ]]; then
    echo -e "${RED}  ✖ Invalid command. Use: buy <price> or sell <price>${NC}"
    continue
  fi

  if [[ -z "$PRICE" ]] || ! echo "$PRICE" | grep -qE '^[0-9]+\.?[0-9]*$'; then
    echo -e "${RED}  ✖ Invalid price. Example: buy 142.50${NC}"
    continue
  fi

  node "$SCRIPT_DIR/sendOrder.js" --user "$USER" --side "$SIDE" --price "$PRICE" --qty "$QTY" --endpoint "$ENDPOINT"
  echo ""
done
