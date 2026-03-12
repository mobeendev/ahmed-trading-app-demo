'use strict';

// ─────────────────────────────────────────────
//  Express + Socket.IO server
//  Bridges Angular GUI ↔ RabbitMQ exchange
// ─────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const rabbitmq = require('./services/rabbitmq');
const state = require('./state');
const ordersRouter = require('./routes/orders');

const PORT = process.env.PORT || 3000;
const AMQP_ENDPOINT = process.argv[2] || process.env.AMQP_URL || 'amqp://localhost';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', ordersRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// ── Socket.IO ────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  // Send full snapshot on connect
  socket.emit('snapshot', state.getSnapshot());

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Start ────────────────────────────────────
async function main() {
  try {
    await rabbitmq.connect(AMQP_ENDPOINT);
  } catch (err) {
    console.error('Failed to connect to RabbitMQ. Is it running?');
    console.error('  docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management');
    process.exit(1);
  }

  // Subscribe to trades — update state and broadcast to all clients
  await rabbitmq.onTrade((trade) => {
    state.addTrade(trade);
    io.emit('trade', trade);
    io.emit('price', state.getPrice(trade.stock || 'XYZ'));
  });

  // Subscribe to orderbook snapshots
  await rabbitmq.onOrderBook((snapshot) => {
    state.updateOrderBook(snapshot);
    io.emit('orderbook', snapshot);
  });

  server.listen(PORT, () => {
    console.log(`[Server] HTTP + WebSocket listening on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down…');
    await rabbitmq.close();
    server.close();
    process.exit(0);
  });
}

main();
