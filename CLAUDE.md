# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

University assessment (PBT205 Task 2) — a stock exchange simulator for a single stock (XYZ Corp). Currently a self-contained TUI prototype; the target architecture splits into three RabbitMQ-connected apps.

## Commands

```bash
# Install dependencies and run
cd files
npm install
node index.js
```

No test framework or linter is configured. No build step required.

## Architecture

### Current State (Prototype)
Single file `files/index.js` (~441 lines) containing everything: matching engine, TUI dashboard (blessed library), and simulated market feed. All state is in-memory.

### Target Architecture (per `req.md.txt`)
Three separate Node.js applications communicating via RabbitMQ (AMQP):

1. **`exchange.js`** — Matching engine. Subscribes to `orders` queue, publishes trades to `trades` queue. Single instance.
2. **`sendOrder.js`** — CLI tool for submitting orders. Uses minimist for args (`--user`, `--side`, `--price`, `--qty`, `--endpoint`). Publishes to `orders` queue, then exits.
3. **`gui.js`** — Blessed TUI dashboard. Subscribes to `trades` queue. Displays 6-panel layout.

### Message Schemas
```javascript
// Order: { id, user, side, price, qty, timestamp }
// Trade: { buyer, seller, price, qty, timestamp }
```

### Order Matching Logic
- BUY orders match against the cheapest SELL at or below the buyer's price
- SELL orders match against the highest BUY at or above the seller's price
- Price discovery uses the **resting order's price** (the order already in the book)

### TUI Layout (6 panels)
Header (live price) → Ticker strip (recent trades) → [BUY book | SELL book | Trade feed] → [Order form + Activity log]

## Code Quality Requirements (from spec)
- Use async/await throughout (no callbacks)
- Graceful connection error handling
- Comments explaining matching logic
- Validate start-up arguments and print usage on missing args

## Dependencies
- `blessed` (^0.1.81) — terminal UI
- Planned: `amqplib` (RabbitMQ), `minimist` (CLI args)

## Key Files
- `files/index.js` — main application
- `files/package.json` — dependencies
- `files/README.md` — setup and usage
- `req.md.txt` — full project requirements specification
