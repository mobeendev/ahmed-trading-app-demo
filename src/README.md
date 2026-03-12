# XYZ Corp — Trading System
PBT205 Assessment 1 — Task 2

A command-line trading system using Node.js and RabbitMQ middleware, modelling a simple stock exchange for XYZ Corp.

## Prerequisites
- Node.js 16+
- Docker (for RabbitMQ)

## Setup

### 1. Start RabbitMQ
```bash
docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```
Management UI will be available at http://localhost:15672 (guest/guest).

### 2. Install Dependencies
```bash
npm install
```

## Running the System

### Start the Exchange (matching engine)
```bash
node exchange.js amqp://localhost
```
Must be running before sending orders. Prints all matching activity to the console.

### Send Orders via CLI
```bash
node sendOrder.js --user alice --side BUY --price 142.50 --endpoint amqp://localhost
node sendOrder.js --user bob --side SELL --price 142.00 --endpoint amqp://localhost
node sendOrder.js --user charlie --side BUY --price 143.00 --qty 200
```

Arguments:
| Flag         | Required | Default            | Description              |
|--------------|----------|--------------------|--------------------------|
| `--user`     | Yes      |                    | Username / trader ID     |
| `--side`     | Yes      |                    | BUY or SELL              |
| `--price`    | Yes      |                    | Desired price (float)    |
| `--qty`      | No       | 100                | Quantity (integer)       |
| `--endpoint` | No       | amqp://localhost   | RabbitMQ endpoint        |

### Start the GUI Dashboard
```bash
node gui.js amqp://localhost
```

Controls:
| Key / Action        | Effect                        |
|---------------------|-------------------------------|
| `Tab`               | Cycle focus between fields    |
| `Enter`             | Activate focused button       |
| Click **BUY/SELL**  | Toggle order side             |
| Click **SUBMIT**    | Send order to exchange        |
| Click **CLEAR**     | Reset form fields             |
| `q` or `Ctrl+C`     | Quit                          |

## Architecture

Three separate Node.js applications communicate via RabbitMQ:

```
  sendOrder.js ──→ [orders queue] ──→ exchange.js ──→ [trades queue] ──→ gui.js
  gui.js ────────→ [orders queue] ──↗
```

- **exchange.js** — Matching engine. Subscribes to `orders` queue, publishes matched trades to `trades` queue.
- **sendOrder.js** — CLI tool. Publishes a single order to the `orders` queue and exits.
- **gui.js** — Terminal UI dashboard. Subscribes to `trades` queue for live updates. Also publishes orders via its built-in form.

## Order Matching Logic

When a new order arrives at the exchange:
1. **BUY order** — find the cheapest SELL in the book whose price ≤ buyer's price
2. **SELL order** — find the highest BUY in the book whose price ≥ seller's price
3. If a match is found, the trade executes at the **resting order's price** (price discovery — the order already in the book determines the trade price)
4. If no match is found, the order is added to the book

## JSON Message Schemas

### Order
```json
{
  "id": "alice-1710000000000",
  "user": "alice",
  "side": "BUY",
  "price": 142.50,
  "qty": 100,
  "timestamp": "2026-03-12T10:00:00.000Z"
}
```

### Trade
```json
{
  "buyer": "alice",
  "seller": "bob",
  "price": 142.50,
  "qty": 100,
  "timestamp": "2026-03-12T10:00:01.000Z"
}
```

## Files
- `exchange.js` — Matching engine (connects to RabbitMQ)
- `sendOrder.js` — CLI order sender
- `gui.js` — Blessed TUI dashboard
- `package.json` — Dependencies: amqplib, blessed, minimist
