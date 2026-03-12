#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────
//  gui.js — XYZ Corp Trading Terminal TUI
//  Connects to RabbitMQ, subscribes to 'trades',
//  and publishes orders to 'orders' queue.
// ─────────────────────────────────────────────

const blessed = require('blessed');
const amqp    = require('amqplib');

// ── Validate start-up arguments ──────────────
const endpoint = process.argv[2];

if (!endpoint) {
  console.error('Usage: node gui.js <amqp-endpoint>');
  console.error('Example: node gui.js amqp://localhost');
  process.exit(1);
}

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let lastPrice    = 142.50;
let priceChange  = 0;
let tradeHistory = [];
let orderIdSeq   = 1000;
let channel      = null;  // RabbitMQ channel (set after connect)

// ─────────────────────────────────────────────
//  SCREEN SETUP
// ─────────────────────────────────────────────
const screen = blessed.screen({
  smartCSR: true,
  title: 'XYZ Corp — Trading Terminal',
  fullUnicode: true,
  dockBorders: true,
});

// ── Colour palette ───────────────────────────
const C = {
  bg:     '#0a0e1a',
  panel:  '#0d1321',
  border: '#1e2d45',
  accent: '#00d4ff',
  green:  '#00ff9d',
  red:    '#ff4560',
  yellow: '#ffd60a',
  dim:    '#3a4a5c',
  text:   '#c8d6e5',
  white:  '#ffffff',
};

// ─────────────────────────────────────────────
//  LAYOUT BOXES
// ─────────────────────────────────────────────

// ── HEADER BAR ───────────────────────────────
const header = blessed.box({
  top: 0, left: 0, width: '100%', height: 3,
  content: '', tags: true,
  style: { bg: C.bg, fg: C.accent },
});
screen.append(header);

// ── TICKER STRIP ─────────────────────────────
const ticker = blessed.box({
  top: 3, left: 0, width: '100%', height: 3,
  content: '', tags: true,
  style: { bg: C.panel, fg: C.text },
  border: { type: 'line', fg: C.border },
});
screen.append(ticker);

// ── ORDER BOOK — BUY SIDE ────────────────────
const buyBox = blessed.box({
  top: 6, left: 0, width: '34%', height: '55%-6',
  label: ' {bold}{green-fg}▲ BID / BUY ORDERS{/green-fg}{/bold} ',
  tags: true, scrollable: true, alwaysScroll: true, mouse: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.green }, label: { fg: C.green } },
  border: { type: 'line' },
  padding: { left: 1, right: 1 },
});
screen.append(buyBox);

// ── ORDER BOOK — SELL SIDE ───────────────────
const sellBox = blessed.box({
  top: 6, left: '34%', width: '34%', height: '55%-6',
  label: ' {bold}{red-fg}▼ ASK / SELL ORDERS{/red-fg}{/bold} ',
  tags: true, scrollable: true, alwaysScroll: true, mouse: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.red }, label: { fg: C.red } },
  border: { type: 'line' },
  padding: { left: 1, right: 1 },
});
screen.append(sellBox);

// ── TRADE FEED ───────────────────────────────
const tradeBox = blessed.box({
  top: 6, left: '68%', width: '32%', height: '55%-6',
  label: ' {bold}{yellow-fg}⚡ TRADE FEED{/yellow-fg}{/bold} ',
  tags: true, scrollable: true, alwaysScroll: true, mouse: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.yellow }, label: { fg: C.yellow } },
  border: { type: 'line' },
  padding: { left: 1, right: 1 },
});
screen.append(tradeBox);

// ── ORDER INPUT PANEL ────────────────────────
const formBox = blessed.box({
  top: '55%', left: 0, width: '100%', height: '45%-1',
  label: ' {bold}{cyan-fg}📋 SEND ORDER{/cyan-fg}{/bold} ',
  tags: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.accent } },
  border: { type: 'line' },
  padding: { left: 2, top: 1 },
});
screen.append(formBox);

// ── STATUS BAR ───────────────────────────────
const statusBar = blessed.box({
  bottom: 0, left: 0, width: '100%', height: 1,
  content: '', tags: true,
  style: { bg: C.dim, fg: C.text },
});
screen.append(statusBar);

// ─────────────────────────────────────────────
//  FORM WIDGETS
// ─────────────────────────────────────────────
blessed.text({ parent: formBox, top: 0, left: 0, content: 'Username :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 2, left: 0, content: 'Side     :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 4, left: 0, content: 'Price    :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 6, left: 0, content: 'Qty      :', tags: true, style: { fg: C.dim } });

const inUser = blessed.textbox({
  parent: formBox, top: 0, left: 12, width: 20, height: 1,
  inputOnFocus: true, mouse: true,
  style: { fg: C.white, bg: C.border, focus: { bg: C.accent, fg: C.bg } },
  value: 'trader1',
});

let currentSide = 'BUY';
const sideBtn = blessed.button({
  parent: formBox, top: 2, left: 12, width: 12, height: 1,
  content: ' ▲  BUY  ', mouse: true, keys: true, tags: true,
  style: { fg: C.bg, bg: C.green, focus: { bg: C.green }, hover: { bg: '#00cc80' } },
});

const inPrice = blessed.textbox({
  parent: formBox, top: 4, left: 12, width: 20, height: 1,
  inputOnFocus: true, mouse: true,
  style: { fg: C.white, bg: C.border, focus: { bg: C.accent, fg: C.bg } },
  value: '142.50',
});

blessed.text({
  parent: formBox, top: 6, left: 12, width: 20,
  content: '100 shares  {gray-fg}(fixed){/gray-fg}',
  tags: true, style: { fg: C.text },
});

const submitBtn = blessed.button({
  parent: formBox, top: 9, left: 12, width: 22, height: 1,
  content: '  ⬆  SUBMIT ORDER  ', mouse: true, keys: true, shrink: true,
  style: { fg: C.bg, bg: C.accent, focus: { bg: '#00aad4' }, hover: { bg: '#00aad4' } },
});

const clearBtn = blessed.button({
  parent: formBox, top: 9, left: 36, width: 14, height: 1,
  content: '  ✖  CLEAR  ', mouse: true, keys: true,
  style: { fg: C.text, bg: C.dim, focus: { bg: C.border }, hover: { bg: C.border } },
});

// Log area inside form panel
const logBox = blessed.box({
  parent: formBox, top: 1, left: '55%', width: '44%', height: '100%-3',
  label: ' {gray-fg}activity log{/gray-fg} ',
  tags: true, scrollable: true, alwaysScroll: true,
  style: { bg: C.bg, fg: C.dim, border: { fg: C.dim } },
  border: { type: 'line' },
  padding: { left: 1 },
});

// ─────────────────────────────────────────────
//  RENDER HELPERS
// ─────────────────────────────────────────────

function renderHeader() {
  const dir  = priceChange >= 0 ? '{green-fg}▲' : '{red-fg}▼';
  const col  = priceChange >= 0 ? '{green-fg}' : '{red-fg}';
  const sign = priceChange >= 0 ? '+' : '';
  const base = lastPrice - priceChange;
  const pct  = base !== 0 ? ((priceChange / base) * 100).toFixed(2) : '0.00';
  header.setContent(
    `{center}{bold}{cyan-fg}◈  XYZ CORP TRADING TERMINAL  ◈{/cyan-fg}{/bold}   ` +
    `${dir} {/}${col}$${lastPrice.toFixed(2)}{/}  ` +
    `${col}${sign}${priceChange.toFixed(2)}  (${sign}${pct}%){/}   ` +
    `{gray-fg}${new Date().toLocaleTimeString()}{/gray-fg}{/center}`
  );
}

function renderTicker() {
  const recentTrades = tradeHistory.slice(-6);
  const parts = recentTrades.map(t => {
    const isBuy = t.buyer !== undefined;
    const col = isBuy ? C.green : C.red;
    return `{${col}-fg}$${t.price.toFixed(2)} ×${t.qty}{/}`;
  });
  ticker.setContent('  {gray-fg}RECENT:{/gray-fg}  ' + (parts.join('   ') || '{gray-fg}— awaiting trades —{/gray-fg}'));
}

function renderTrades() {
  const lines = [...tradeHistory].reverse().slice(0, 20).map(t => {
    return `{bold}$${t.price.toFixed(2)}{/bold}  {gray-fg}×${t.qty}  ${t.buyer}↔${t.seller}\n  {gray-fg}${t.timestamp}{/gray-fg}`;
  });
  tradeBox.setContent(lines.join('\n') || '{gray-fg} (no trades yet){/gray-fg}');
}

function setStatus(msg, colour) {
  statusBar.setContent(
    `{${colour || 'cyan'}-fg} ● {/}  ${msg}   {gray-fg}│  Tab/Click to focus  │  Ctrl+C to exit{/gray-fg}`
  );
  screen.render();
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  logBox.pushLine(`{gray-fg}${time}{/gray-fg}  ${msg}`);
  logBox.setScrollPerc(100);
  screen.render();
}

function renderAll() {
  renderHeader();
  renderTicker();
  // Order book panels show a note since the book lives in exchange.js
  buyBox.setContent('{gray-fg} Order book is managed by the exchange.\n Use sendOrder.js or the form below to submit orders.{/gray-fg}');
  sellBox.setContent('{gray-fg} Order book is managed by the exchange.\n Use sendOrder.js or the form below to submit orders.{/gray-fg}');
  renderTrades();
  screen.render();
}

// ─────────────────────────────────────────────
//  EVENT HANDLERS
// ─────────────────────────────────────────────

sideBtn.on('press', () => {
  currentSide = currentSide === 'BUY' ? 'SELL' : 'BUY';
  if (currentSide === 'BUY') {
    sideBtn.setContent(' ▲  BUY  ');
    sideBtn.style.bg = C.green;
  } else {
    sideBtn.setContent(' ▼  SELL ');
    sideBtn.style.bg = C.red;
  }
  screen.render();
});

submitBtn.on('press', async () => {
  const username = inUser.value.trim() || 'trader1';
  const rawPrice = parseFloat(inPrice.value);

  if (isNaN(rawPrice) || rawPrice <= 0) {
    setStatus('⚠  Invalid price — enter a positive number', 'red');
    return;
  }
  if (!username) {
    setStatus('⚠  Username cannot be empty', 'red');
    return;
  }

  if (!channel) {
    setStatus('⚠  Not connected to RabbitMQ', 'red');
    return;
  }

  // Build and publish order to RabbitMQ
  const order = {
    id: `${username}-${orderIdSeq++}`,
    user: username,
    side: currentSide,
    price: rawPrice,
    qty: 100,
    timestamp: new Date().toISOString(),
  };

  try {
    channel.sendToQueue('orders', Buffer.from(JSON.stringify(order)));
    log(`{cyan-fg}ORDER SENT{/cyan-fg}  ${currentSide === 'BUY' ? '{green-fg}▲ BUY{/green-fg}' : '{red-fg}▼ SELL{/red-fg}'}  $${rawPrice.toFixed(2)} ×100  by ${username}`);
    setStatus(`Order sent: ${currentSide} $${rawPrice.toFixed(2)} ×100 by ${username}`, 'green');
  } catch (err) {
    setStatus(`⚠  Failed to send order: ${err.message}`, 'red');
  }
});

clearBtn.on('press', () => {
  inUser.setValue('trader1');
  inPrice.setValue('142.50');
  screen.render();
  setStatus('Form cleared', 'cyan');
});

// Tab navigation between inputs
const focusOrder = [inUser, sideBtn, inPrice, submitBtn, clearBtn];
let focusIdx = 0;

screen.key(['tab'], () => {
  focusOrder[focusIdx].focus();
  focusIdx = (focusIdx + 1) % focusOrder.length;
});

screen.key(['enter'], () => {
  const focused = screen.focused;
  if (focused === submitBtn) submitBtn.emit('press');
  if (focused === sideBtn)   sideBtn.emit('press');
  if (focused === clearBtn)  clearBtn.emit('press');
});

screen.key(['C-c', 'q'], () => process.exit(0));

// Refresh clock every second
setInterval(() => {
  renderHeader();
  screen.render();
}, 1000);

// ─────────────────────────────────────────────
//  RABBITMQ CONNECTION
// ─────────────────────────────────────────────
async function connectToRabbitMQ() {
  setStatus('Connecting to RabbitMQ …', 'yellow');
  log('{yellow-fg}⟳{/yellow-fg}  Connecting to middleware…');

  let connection;
  try {
    connection = await amqp.connect(endpoint);
  } catch (err) {
    log(`{red-fg}✖{/red-fg}  Failed to connect: ${err.message}`);
    setStatus(`Failed to connect to RabbitMQ at ${endpoint}`, 'red');
    return;
  }

  channel = await connection.createChannel();
  await channel.assertQueue('orders', { durable: false });
  await channel.assertQueue('trades', { durable: false });

  log('{green-fg}✔{/green-fg}  Connected to RabbitMQ');
  log('{green-fg}✔{/green-fg}  Subscribed to queue: {cyan-fg}trades{/cyan-fg}');
  setStatus('Connected to RabbitMQ  |  Queues: orders, trades', 'green');

  // Subscribe to trades queue — update display on each new trade
  await channel.consume('trades', (msg) => {
    if (!msg) return;
    try {
      const trade = JSON.parse(msg.content.toString());
      // Update price tracking
      priceChange = trade.price - lastPrice;
      lastPrice   = trade.price;
      tradeHistory.push(trade);

      log(`{green-fg}✔ TRADE{/green-fg}  $${trade.price.toFixed(2)} ×${trade.qty}  ${trade.buyer} ↔ ${trade.seller}`);
      renderAll();
    } catch (err) {
      log(`{red-fg}⚠{/red-fg}  Bad trade message: ${err.message}`);
    }
    channel.ack(msg);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await channel.close();
    await connection.close();
    process.exit(0);
  });
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
renderAll();
inUser.focus();
connectToRabbitMQ();
