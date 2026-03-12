# XYZ Corp — Trading Terminal TUI
PBT205 Assessment 1 — Task 2: Trading System (GUI Prototype)

## Prerequisites
- Node.js 16+
- Docker (for RabbitMQ in the full implementation)

## Quick Start

```bash
npm install
node index.js
```

## Controls
| Key / Action        | Effect                        |
|---------------------|-------------------------------|
| `Tab`               | Cycle focus between fields    |
| `Enter`             | Activate focused button       |
| Click **BUY/SELL**  | Toggle order side             |
| Click **SUBMIT**    | Send order to exchange        |
| Click **CLEAR**     | Reset form fields             |
| `q` or `Ctrl+C`     | Quit                          |

## Layout
```
┌─────────────────────────────────────────┐
│  HEADER  — XYZ Corp price + change      │
├─────────────────────────────────────────┤
│  TICKER STRIP — recent trades           │
├──────────────┬──────────────┬───────────┤
│  BID/BUY     │  ASK/SELL    │  TRADE    │
│  ORDER BOOK  │  ORDER BOOK  │  FEED     │
├──────────────┴──────────────┴───────────┤
│  SEND ORDER form   │  Activity Log      │
└────────────────────┴────────────────────┘
│  Status Bar                             │
```

## Connecting to RabbitMQ (full implementation)

Replace the simulated `submitOrder()` call in `index.js` with:

```js
const amqp = require('amqplib');

async function publishOrder(order) {
  const conn    = await amqp.connect('amqp://localhost');
  const channel = await conn.createChannel();
  await channel.assertQueue('orders', { durable: false });
  channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)));
}

async function subscribeToTrades(onTrade) {
  const conn    = await amqp.connect('amqp://localhost');
  const channel = await conn.createChannel();
  await channel.assertQueue('trades', { durable: false });
  channel.consume('trades', msg => {
    if (msg) onTrade(JSON.parse(msg.content.toString()));
  }, { noAck: true });
}
```

## Files
- `index.js`   — TUI prototype (self-contained, no RabbitMQ needed to run)
- `README.md`  — this file
