#!/usr/bin/env node
'use strict';

const blessed = require('blessed');

// ─────────────────────────────────────────────
//  SIMULATED STATE  (replace with RabbitMQ later)
// ─────────────────────────────────────────────
let lastPrice     = 142.50;
let priceChange   = 0;
let orderBook     = { buys: [], sells: [] };
let tradeHistory  = [];
let orderIdSeq    = 1000;
let connected     = false;   // toggled after "connect" animation

// Seed some starter orders
const SEED_BUYS  = [142.10, 141.90, 141.75, 141.50, 141.20];
const SEED_SELLS = [142.80, 143.00, 143.25, 143.50, 143.80];
SEED_BUYS.forEach(p  => orderBook.buys.push({ id: orderIdSeq++, user: 'MARKET', qty: 100, price: p }));
SEED_SELLS.forEach(p => orderBook.sells.push({ id: orderIdSeq++, user: 'MARKET', qty: 100, price: p }));

// ─────────────────────────────────────────────
//  SCREEN SETUP
// ─────────────────────────────────────────────
const screen = blessed.screen({
  smartCSR: true,
  title: 'XYZ Corp — Trading Terminal',
  fullUnicode: true,
  dockBorders: true,
});

// ─────────────────────────────────────────────
//  COLOUR PALETTE
// ─────────────────────────────────────────────
const C = {
  bg:       '#0a0e1a',
  panel:    '#0d1321',
  border:   '#1e2d45',
  accent:   '#00d4ff',
  green:    '#00ff9d',
  red:      '#ff4560',
  yellow:   '#ffd60a',
  dim:      '#3a4a5c',
  text:     '#c8d6e5',
  white:    '#ffffff',
  header:   '#00d4ff',
};

// ─────────────────────────────────────────────
//  LAYOUT BOXES
// ─────────────────────────────────────────────

// ── HEADER BAR ──────────────────────────────
const header = blessed.box({
  top: 0, left: 0, width: '100%', height: 3,
  content: '',
  tags: true,
  style: { bg: C.bg, fg: C.accent },
});
screen.append(header);

// ── TICKER STRIP ────────────────────────────
const ticker = blessed.box({
  top: 3, left: 0, width: '100%', height: 3,
  content: '',
  tags: true,
  style: { bg: C.panel, fg: C.text },
  border: { type: 'line', fg: C.border },
});
screen.append(ticker);

// ── ORDER BOOK — BUY SIDE ────────────────────
const buyBox = blessed.box({
  top: 6, left: 0, width: '34%', height: '55%-6',
  label: ' {bold}{green-fg}▲ BID / BUY ORDERS{/green-fg}{/bold} ',
  tags: true,
  scrollable: true, alwaysScroll: true, mouse: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.green }, label: { fg: C.green } },
  border: { type: 'line' },
  padding: { left: 1, right: 1 },
});
screen.append(buyBox);

// ── ORDER BOOK — SELL SIDE ───────────────────
const sellBox = blessed.box({
  top: 6, left: '34%', width: '34%', height: '55%-6',
  label: ' {bold}{red-fg}▼ ASK / SELL ORDERS{/red-fg}{/bold} ',
  tags: true,
  scrollable: true, alwaysScroll: true, mouse: true,
  style: { bg: C.panel, fg: C.text, border: { fg: C.red }, label: { fg: C.red } },
  border: { type: 'line' },
  padding: { left: 1, right: 1 },
});
screen.append(sellBox);

// ── TRADE FEED ───────────────────────────────
const tradeBox = blessed.box({
  top: 6, left: '68%', width: '32%', height: '55%-6',
  label: ' {bold}{yellow-fg}⚡ TRADE FEED{/yellow-fg}{/bold} ',
  tags: true,
  scrollable: true, alwaysScroll: true, mouse: true,
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
  content: '',
  tags: true,
  style: { bg: C.dim, fg: C.text },
});
screen.append(statusBar);

// ─────────────────────────────────────────────
//  FORM WIDGETS
// ─────────────────────────────────────────────

blessed.text({ parent: formBox, top: 0, left: 0,  content: 'Username :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 2, left: 0,  content: 'Side     :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 4, left: 0,  content: 'Price    :', tags: true, style: { fg: C.dim } });
blessed.text({ parent: formBox, top: 6, left: 0,  content: 'Qty      :', tags: true, style: { fg: C.dim } });

const inUser = blessed.textbox({
  parent: formBox, top: 0, left: 12, width: 20, height: 1,
  inputOnFocus: true, mouse: true,
  style: { fg: C.white, bg: C.border, focus: { bg: C.accent, fg: C.bg } },
  value: 'trader1',
});

// Side toggle button
let currentSide = 'BUY';
const sideBtn = blessed.button({
  parent: formBox, top: 2, left: 12, width: 12, height: 1,
  content: ' ▲  BUY  ',
  mouse: true, keys: true,
  tags: true,
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
  content: '100 shares  {dim-fg}(fixed){/dim-fg}',
  tags: true, style: { fg: C.text },
});

const submitBtn = blessed.button({
  parent: formBox, top: 9, left: 12, width: 22, height: 1,
  content: '  ⬆  SUBMIT ORDER  ',
  mouse: true, keys: true, shrink: true,
  style: { fg: C.bg, bg: C.accent, focus: { bg: '#00aad4' }, hover: { bg: '#00aad4' } },
});

const clearBtn = blessed.button({
  parent: formBox, top: 9, left: 36, width: 14, height: 1,
  content: '  ✖  CLEAR  ',
  mouse: true, keys: true,
  style: { fg: C.text, bg: C.dim, focus: { bg: C.border }, hover: { bg: C.border } },
});

// Log area inside form panel
const logBox = blessed.box({
  parent: formBox, top: 1, left: '55%', width: '44%', height: '100%-3',
  label: ' {dim-fg}activity log{/dim-fg} ',
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
  const pct  = ((priceChange / (lastPrice - priceChange)) * 100).toFixed(2);
  header.setContent(
    `{center}{bold}{cyan-fg}◈  XYZ CORP TRADING TERMINAL  ◈{/cyan-fg}{/bold}   ` +
    `${dir} {/}${col}$${lastPrice.toFixed(2)}{/}  ` +
    `${col}${sign}${priceChange.toFixed(2)}  (${sign}${pct}%){/}   ` +
    `{dim-fg}${new Date().toLocaleTimeString()}{/dim-fg}{/center}`
  );
}

function renderTicker() {
  const recentTrades = tradeHistory.slice(-6);
  const parts = recentTrades.map(t => {
    const col = t.side === 'BUY' ? C.green : C.red;
    return `{${col}-fg}${t.side === 'BUY' ? '▲' : '▼'} $${t.price.toFixed(2)} ×${t.qty}{/}`;
  });
  ticker.setContent('  {dim-fg}RECENT:{/dim-fg}  ' + (parts.join('   ') || '{dim-fg}— awaiting trades —{/dim-fg}'));
}

function renderOrderBook() {
  // BUY side — highest first
  const buys = [...orderBook.buys].sort((a, b) => b.price - a.price);
  const maxB = buys.length ? buys[0].price : 0;

  const buyLines = buys.map((o, i) => {
    const bar = '█'.repeat(Math.round((o.price / maxB) * 12));
    const dim = i === 0 ? '{bold}' : '{dim-fg}';
    const end = i === 0 ? '{/bold}' : '{/dim-fg}';
    return `${dim}${end}{green-fg}${bar.padEnd(12)}{/green-fg}  $${o.price.toFixed(2)}  {dim-fg}×${o.qty}  ${o.user}{/dim-fg}`;
  });
  buyBox.setContent(
    `{dim-fg} {'PRICE':>10}    QTY   USER\n ${'─'.repeat(36)}{/dim-fg}\n` +
    (buyLines.join('\n') || '{dim-fg} (empty){/dim-fg}')
  );

  // SELL side — lowest first
  const sells = [...orderBook.sells].sort((a, b) => a.price - b.price);
  const minS  = sells.length ? sells[0].price : 0;

  const sellLines = sells.map((o, i) => {
    const bar = '█'.repeat(Math.round((minS / (o.price || 1)) * 12));
    const dim = i === 0 ? '{bold}' : '{dim-fg}';
    const end = i === 0 ? '{/bold}' : '{/dim-fg}';
    return `${dim}${end}{red-fg}${bar.padEnd(12)}{/red-fg}  $${o.price.toFixed(2)}  {dim-fg}×${o.qty}  ${o.user}{/dim-fg}`;
  });
  sellBox.setContent(
    `{dim-fg} {'PRICE':>10}    QTY   USER\n ${'─'.repeat(36)}{/dim-fg}\n` +
    (sellLines.join('\n') || '{dim-fg} (empty){/dim-fg}')
  );
}

function renderTrades() {
  const lines = [...tradeHistory].reverse().slice(0, 40).map(t => {
    const col  = t.side === 'BUY' ? '{green-fg}' : '{red-fg}';
    const icon = t.side === 'BUY' ? '▲' : '▼';
    return `${col}${icon}{/} {bold}$${t.price.toFixed(2)}{/bold}  {dim-fg}×${t.qty}  ${t.buyer}↔${t.seller}\n  {dim-fg}${t.time}{/dim-fg}`;
  });
  tradeBox.setContent(lines.join('\n') || '{dim-fg} (no trades yet){/dim-fg}');
}

function setStatus(msg, colour) {
  statusBar.setContent(
    `{${colour || 'cyan'}-fg} ● {/}  ${msg}   {dim-fg}│  Tab/Click to focus  │  Ctrl+C to exit{/dim-fg}`
  );
  screen.render();
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  logBox.pushLine(`{dim-fg}${time}{/dim-fg}  ${msg}`);
  logBox.setScrollPerc(100);
  screen.render();
}

function renderAll() {
  renderHeader();
  renderTicker();
  renderOrderBook();
  renderTrades();
  screen.render();
}

// ─────────────────────────────────────────────
//  EXCHANGE MATCHING ENGINE  (local simulation)
// ─────────────────────────────────────────────
function submitOrder(username, side, price, qty) {
  const order = { id: orderIdSeq++, user: username, side, price, qty };
  log(`{cyan-fg}ORDER{/cyan-fg}  ${side === 'BUY' ? '{green-fg}▲ BUY{/green-fg}' : '{red-fg}▼ SELL{/red-fg}'}  $${price.toFixed(2)} ×${qty}  by ${username}`);

  if (side === 'BUY') {
    // find cheapest sell at or below buyer's price
    const match = orderBook.sells
      .filter(s => s.price <= price)
      .sort((a, b) => a.price - b.price)[0];

    if (match) {
      const tradePrice = match.price;
      orderBook.sells = orderBook.sells.filter(s => s.id !== match.id);
      priceChange = tradePrice - lastPrice;
      lastPrice   = tradePrice;
      tradeHistory.push({
        side: 'BUY', price: tradePrice, qty,
        buyer: username, seller: match.user,
        time: new Date().toLocaleTimeString(),
      });
      log(`{green-fg}✔ MATCHED{/green-fg}  $${tradePrice.toFixed(2)}  ${username} ↔ ${match.user}`);
    } else {
      orderBook.buys.push(order);
      log(`{yellow-fg}⏳ QUEUED{/yellow-fg}  BUY $${price.toFixed(2)} — no match`);
    }
  } else {
    // find highest buy at or above seller's price
    const match = orderBook.buys
      .filter(b => b.price >= price)
      .sort((a, b) => b.price - a.price)[0];

    if (match) {
      const tradePrice = match.price;
      orderBook.buys = orderBook.buys.filter(b => b.id !== match.id);
      priceChange = tradePrice - lastPrice;
      lastPrice   = tradePrice;
      tradeHistory.push({
        side: 'SELL', price: tradePrice, qty,
        buyer: match.user, seller: username,
        time: new Date().toLocaleTimeString(),
      });
      log(`{green-fg}✔ MATCHED{/green-fg}  $${tradePrice.toFixed(2)}  ${match.user} ↔ ${username}`);
    } else {
      orderBook.sells.push(order);
      log(`{yellow-fg}⏳ QUEUED{/yellow-fg}  SELL $${price.toFixed(2)} — no match`);
    }
  }

  renderAll();
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

submitBtn.on('press', () => {
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

  submitOrder(username, currentSide, rawPrice, 100);
  setStatus(`Order submitted: ${currentSide} $${rawPrice.toFixed(2)} ×100 by ${username}`, 'green');
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

// ─────────────────────────────────────────────
//  SIMULATED MARKET FEED  (remove when using RabbitMQ)
// ─────────────────────────────────────────────
let marketTick = 0;
const MARKET_TRADERS = ['algBot', 'fundX', 'hedgeZ', 'retail1', 'mmBot'];

function marketSimStep() {
  marketTick++;
  // Random market order every 2.5s
  if (marketTick % 5 === 0) {
    const trader = MARKET_TRADERS[Math.floor(Math.random() * MARKET_TRADERS.length)];
    const side   = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const spread = side === 'BUY'
      ? lastPrice + (Math.random() * 0.5 - 0.1).toFixed(2) * 1
      : lastPrice - (Math.random() * 0.5 - 0.1).toFixed(2) * 1;
    const price  = Math.max(100, parseFloat(spread.toFixed(2)));
    submitOrder(trader, side, price, 100);
  }

  // Refresh header clock every tick
  renderHeader();
  screen.render();
}

// ─────────────────────────────────────────────
//  STARTUP ANIMATION
// ─────────────────────────────────────────────
function boot() {
  setStatus('Connecting to RabbitMQ at localhost:5672 …', 'yellow');
  log('{yellow-fg}⟳{/yellow-fg}  Connecting to middleware…');

  setTimeout(() => {
    connected = true;
    log('{green-fg}✔{/green-fg}  Connected to RabbitMQ');
    log('{green-fg}✔{/green-fg}  Subscribed to topic: {cyan-fg}orders{/cyan-fg}');
    log('{green-fg}✔{/green-fg}  Subscribed to topic: {cyan-fg}trades{/cyan-fg}');
    setStatus('Connected to RabbitMQ  |  Topics: orders, trades', 'green');
    renderAll();

    // Start simulated market feed
    setInterval(marketSimStep, 500);
  }, 1200);
}

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
renderAll();
inUser.focus();
boot();
