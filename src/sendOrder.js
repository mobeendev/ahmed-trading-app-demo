#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────
//  sendOrder.js — CLI tool to submit a single
//  order to the exchange via RabbitMQ.
// ─────────────────────────────────────────────

const amqp     = require('amqplib');
const minimist = require('minimist');

// ── Parse CLI arguments ──────────────────────
const args = minimist(process.argv.slice(2), {
  string:  ['user', 'endpoint', 'side', 'stock'],
  default: { endpoint: 'amqp://localhost', qty: 100, stock: 'XYZ' },
});

// ── Validate arguments ───────────────────────
function printUsage() {
  console.log('Usage: node sendOrder.js --user <name> --side <BUY|SELL> --price <float> [options]');
  console.log('');
  console.log('Required:');
  console.log('  --user      Username / trader ID');
  console.log('  --side      BUY or SELL');
  console.log('  --price     Desired price (positive number)');
  console.log('');
  console.log('Optional:');
  console.log('  --qty       Quantity (integer, default: 100)');
  console.log('  --stock     Stock symbol (default: XYZ)');
  console.log('  --endpoint  RabbitMQ endpoint (default: amqp://localhost)');
  console.log('');
  console.log('Example:');
  console.log('  node sendOrder.js --user alice --side BUY --price 142.50 --endpoint amqp://localhost');
}

if (!args.user || !args.side || args.price === undefined) {
  console.error('❌ Missing required arguments.\n');
  printUsage();
  process.exit(1);
}

const side = args.side.toUpperCase();
if (side !== 'BUY' && side !== 'SELL') {
  console.error(`❌ Invalid side: "${args.side}". Must be BUY or SELL.`);
  process.exit(1);
}

const price = parseFloat(args.price);
if (isNaN(price) || price <= 0) {
  console.error(`❌ Invalid price: "${args.price}". Must be a positive number.`);
  process.exit(1);
}

const qty = parseInt(args.qty, 10);
if (isNaN(qty) || qty <= 0) {
  console.error(`❌ Invalid qty: "${args.qty}". Must be a positive integer.`);
  process.exit(1);
}

// ── Build order message ──────────────────────
const stock = args.stock.toUpperCase();

const order = {
  id: `${args.user}-${Date.now()}`,
  user: args.user,
  side: side,
  price: price,
  qty: qty,
  stock: stock,
  timestamp: new Date().toISOString(),
};

// ── Publish to RabbitMQ and exit ─────────────
async function main() {
  let connection;
  try {
    connection = await amqp.connect(args.endpoint);
  } catch (err) {
    console.error(`❌ Failed to connect to RabbitMQ at ${args.endpoint}`);
    console.error(`   ${err.message}`);
    console.error('   Make sure RabbitMQ is running:');
    console.error('   docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management');
    process.exit(1);
  }

  const channel = await connection.createChannel();
  await channel.assertQueue('orders', { durable: false });
  channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)));

  console.log(`✅ Order sent: ${side} $${price.toFixed(2)} ×${qty} by ${args.user}`);
  console.log(`   ${JSON.stringify(order)}`);

  // Give RabbitMQ a moment to flush, then exit
  await channel.close();
  await connection.close();
}

main();
