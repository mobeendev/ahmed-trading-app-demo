'use strict';

// ─────────────────────────────────────────────
//  RabbitMQ service — connects to the broker,
//  publishes orders to 'orders' queue, and
//  subscribes to 'trades' and 'orderbook'
//  fanout exchanges with exclusive queues.
// ─────────────────────────────────────────────

const amqp = require('amqplib');

let connection = null;
let channel = null;

async function connect(endpoint = 'amqp://localhost') {
  try {
    console.log(`[RabbitMQ] Connecting to ${endpoint} …`);
    connection = await amqp.connect(endpoint);
    channel = await connection.createChannel();

    // Orders queue (point-to-point — shared with exchange.js)
    await channel.assertQueue('orders', { durable: false });

    // Fanout exchanges (declared by exchange.js, we just assert to be safe)
    await channel.assertExchange('trades', 'fanout', { durable: false });
    await channel.assertExchange('orderbook', 'fanout', { durable: false });

    console.log('[RabbitMQ] Connected and queues/exchanges asserted');
    return channel;
  } catch (err) {
    console.error(`[RabbitMQ] Connection failed: ${err.message}`);
    throw err;
  }
}

// Publish an order to the orders queue
async function publishOrder(order) {
  if (!channel) throw new Error('RabbitMQ channel not initialised');
  channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)));
}

// Subscribe to trades fanout exchange with an exclusive queue
async function onTrade(handler) {
  if (!channel) throw new Error('RabbitMQ channel not initialised');
  const q = await channel.assertQueue('', { exclusive: true, durable: false });
  await channel.bindQueue(q.queue, 'trades', '');

  await channel.consume(q.queue, (msg) => {
    if (!msg) return;
    try {
      handler(JSON.parse(msg.content.toString()));
    } catch (err) {
      console.error('[RabbitMQ] Failed to parse trade:', err.message);
    }
    channel.ack(msg);
  });
}

// Subscribe to orderbook fanout exchange with an exclusive queue
async function onOrderBook(handler) {
  if (!channel) throw new Error('RabbitMQ channel not initialised');
  const q = await channel.assertQueue('', { exclusive: true, durable: false });
  await channel.bindQueue(q.queue, 'orderbook', '');

  await channel.consume(q.queue, (msg) => {
    if (!msg) return;
    try {
      handler(JSON.parse(msg.content.toString()));
    } catch (err) {
      console.error('[RabbitMQ] Failed to parse orderbook:', err.message);
    }
    channel.ack(msg);
  });
}

async function close() {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('[RabbitMQ] Connection closed');
  } catch (err) {
    console.error('[RabbitMQ] Error closing:', err.message);
  }
}

module.exports = { connect, publishOrder, onTrade, onOrderBook, close };
