#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────
//  exchange.js — Multi-Stock Matching Engine
//  Connects to RabbitMQ, subscribes to 'orders'
//  queue, publishes trades via 'trades' fanout
//  exchange, and orderbook snapshots via
//  'orderbook' fanout exchange.
// ─────────────────────────────────────────────

const amqp = require('amqplib');

// ── Validate start-up arguments ──────────────
const endpoint = process.argv[2];

if (!endpoint) {
  console.error('Usage: node exchange.js <amqp-endpoint>');
  console.error('Example: node exchange.js amqp://localhost');
  process.exit(1);
}

// ── In-memory order books (per stock) ────────
// Each stock gets its own { buys: [], sells: [] }
const orderBooks = {};

function getBook(stock) {
  if (!orderBooks[stock]) {
    orderBooks[stock] = { buys: [], sells: [] };
  }
  return orderBooks[stock];
}

// ── Publish order book snapshot ──────────────
function publishSnapshot(stock, channel) {
  const book = getBook(stock);
  const snapshot = {
    stock,
    buys: book.buys.map(o => ({ id: o.id, user: o.user, price: o.price, qty: o.qty })),
    sells: book.sells.map(o => ({ id: o.id, user: o.user, price: o.price, qty: o.qty })),
    timestamp: new Date().toISOString(),
  };
  channel.publish('orderbook', '', Buffer.from(JSON.stringify(snapshot)));
}

// ── Matching logic ───────────────────────────
//
// When a new order arrives:
//   BUY order  → look for the cheapest SELL whose price <= buyer's price
//   SELL order → look for the highest BUY whose price >= seller's price
//
// If a match is found:
//   - The trade executes at the *resting* order's price (price discovery).
//     The resting order is the one already sitting in the book.
//   - Both orders are removed from the book.
//   - A trade message is published via the 'trades' fanout exchange.
//
// If no match is found the incoming order is added to the book to rest.
//
function matchOrder(order, channel) {
  const stock = order.stock || 'XYZ';
  const book = getBook(stock);

  console.log(`\n📥 ORDER  [${stock}] ${order.side} $${order.price.toFixed(2)} ×${order.qty} by ${order.user} (id: ${order.id})`);

  if (order.side === 'BUY') {
    // Find the cheapest sell at or below the buyer's price
    const candidates = book.sells
      .filter(s => s.price <= order.price)
      .sort((a, b) => a.price - b.price);

    if (candidates.length > 0) {
      const match = candidates[0];
      // Trade price = resting order's price (the sell that was already in the book)
      const tradePrice = match.price;

      // Remove matched sell from the book
      book.sells = book.sells.filter(s => s.id !== match.id);

      const trade = {
        buyer: order.user,
        seller: match.user,
        price: tradePrice,
        qty: order.qty,
        stock,
        timestamp: new Date().toISOString(),
      };

      // Publish trade via fanout exchange
      channel.publish('trades', '', Buffer.from(JSON.stringify(trade)));
      console.log(`✅ TRADE  [${stock}] $${tradePrice.toFixed(2)} ×${trade.qty}  ${trade.buyer} ↔ ${trade.seller}`);
    } else {
      // No matching sell — add buy to the book
      book.buys.push(order);
      console.log(`⏳ QUEUED BUY [${stock}] $${order.price.toFixed(2)} — no matching sell`);
    }
  } else {
    // SELL order: find the highest buy at or above the seller's price
    const candidates = book.buys
      .filter(b => b.price >= order.price)
      .sort((a, b) => b.price - a.price);

    if (candidates.length > 0) {
      const match = candidates[0];
      // Trade price = resting order's price (the buy that was already in the book)
      const tradePrice = match.price;

      // Remove matched buy from the book
      book.buys = book.buys.filter(b => b.id !== match.id);

      const trade = {
        buyer: match.user,
        seller: order.user,
        price: tradePrice,
        qty: order.qty,
        stock,
        timestamp: new Date().toISOString(),
      };

      channel.publish('trades', '', Buffer.from(JSON.stringify(trade)));
      console.log(`✅ TRADE  [${stock}] $${tradePrice.toFixed(2)} ×${trade.qty}  ${trade.buyer} ↔ ${trade.seller}`);
    } else {
      // No matching buy — add sell to the book
      book.sells.push(order);
      console.log(`⏳ QUEUED SELL [${stock}] $${order.price.toFixed(2)} — no matching buy`);
    }
  }

  // Print current book state
  console.log(`📊 BOOK   [${stock}] buys: ${book.buys.length}  sells: ${book.sells.length}`);

  // Publish updated order book snapshot via fanout exchange
  publishSnapshot(stock, channel);
}

// ── Main ─────────────────────────────────────
async function main() {
  let connection;
  try {
    console.log(`🔌 Connecting to RabbitMQ at ${endpoint} …`);
    connection = await amqp.connect(endpoint);
    console.log('✅ Connected to RabbitMQ');
  } catch (err) {
    console.error(`❌ Failed to connect to RabbitMQ at ${endpoint}`);
    console.error(`   ${err.message}`);
    console.error('   Make sure RabbitMQ is running:');
    console.error('   docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management');
    process.exit(1);
  }

  const channel = await connection.createChannel();

  // Assert the orders queue (point-to-point: only exchange consumes)
  await channel.assertQueue('orders', { durable: false });

  // Assert fanout exchanges for trades and orderbook
  // Fanout = every bound queue gets a copy of every message
  await channel.assertExchange('trades', 'fanout', { durable: false });
  await channel.assertExchange('orderbook', 'fanout', { durable: false });

  console.log(`📡 Listening on queue: 'orders'`);
  console.log(`📡 Publishing trades to exchange: 'trades' (fanout)`);
  console.log(`📡 Publishing snapshots to exchange: 'orderbook' (fanout)`);
  console.log('─'.repeat(50));

  // Subscribe to the orders queue
  await channel.consume('orders', (msg) => {
    if (!msg) return;
    try {
      const order = JSON.parse(msg.content.toString());
      matchOrder(order, channel);
    } catch (err) {
      console.error('⚠️  Failed to parse order message:', err.message);
    }
    channel.ack(msg);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down exchange…');
    await channel.close();
    await connection.close();
    process.exit(0);
  });
}

main();
