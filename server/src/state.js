'use strict';

// ─────────────────────────────────────────────
//  In-memory state cache for the web server.
//  Stores latest trades, orderbooks, and prices
//  per stock so new WebSocket clients get a
//  snapshot immediately on connect.
// ─────────────────────────────────────────────

const MAX_TRADES = 50;

// trades[stock] = Trade[]
const trades = {};

// orderbooks[stock] = { buys: [], sells: [] }
const orderbooks = {};

// prices[stock] = { lastPrice, prevPrice }
const prices = {};

function addTrade(trade) {
  const stock = trade.stock || 'XYZ';
  if (!trades[stock]) trades[stock] = [];
  trades[stock].unshift(trade);
  if (trades[stock].length > MAX_TRADES) trades[stock].pop();

  // Update price
  if (!prices[stock]) prices[stock] = { lastPrice: 0, prevPrice: 0 };
  prices[stock].prevPrice = prices[stock].lastPrice;
  prices[stock].lastPrice = trade.price;
}

function updateOrderBook(snapshot) {
  const stock = snapshot.stock || 'XYZ';
  orderbooks[stock] = { buys: snapshot.buys, sells: snapshot.sells };
}

function getTrades(stock) {
  return trades[stock] || [];
}

function getOrderBook(stock) {
  return orderbooks[stock] || { buys: [], sells: [] };
}

function getPrice(stock) {
  const p = prices[stock];
  if (!p) return { stock, lastPrice: 0, priceChange: 0 };
  return {
    stock,
    lastPrice: p.lastPrice,
    priceChange: p.lastPrice - p.prevPrice,
  };
}

function getSnapshot() {
  const stocks = new Set([
    ...Object.keys(trades),
    ...Object.keys(orderbooks),
    ...Object.keys(prices),
  ]);
  if (stocks.size === 0) stocks.add('XYZ');

  const result = {};
  for (const stock of stocks) {
    result[stock] = {
      trades: getTrades(stock),
      orderbook: getOrderBook(stock),
      price: getPrice(stock),
    };
  }
  return result;
}

module.exports = { addTrade, updateOrderBook, getTrades, getOrderBook, getPrice, getSnapshot };
