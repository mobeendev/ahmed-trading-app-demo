'use strict';

// ─────────────────────────────────────────────
//  REST routes for orders, trades, and orderbook
// ─────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const rabbitmq = require('../services/rabbitmq');
const state = require('../state');

// POST /api/orders — submit an order
router.post('/orders', async (req, res) => {
  try {
    const { user, side, price, qty, stock } = req.body;

    if (!user || !side || price === undefined) {
      return res.status(400).json({ error: 'Missing required fields: user, side, price' });
    }

    const sideUp = side.toUpperCase();
    if (sideUp !== 'BUY' && sideUp !== 'SELL') {
      return res.status(400).json({ error: 'side must be BUY or SELL' });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    const order = {
      id: `${user}-${Date.now()}`,
      user,
      side: sideUp,
      price: priceNum,
      qty: parseInt(qty, 10) || 100,
      stock: (stock || 'XYZ').toUpperCase(),
      timestamp: new Date().toISOString(),
    };

    await rabbitmq.publishOrder(order);
    res.json({ ok: true, order });
  } catch (err) {
    console.error('[API] Error submitting order:', err.message);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

// GET /api/trades?stock=XYZ
router.get('/trades', (req, res) => {
  const stock = (req.query.stock || 'XYZ').toUpperCase();
  res.json(state.getTrades(stock));
});

// GET /api/orderbook?stock=XYZ
router.get('/orderbook', (req, res) => {
  const stock = (req.query.stock || 'XYZ').toUpperCase();
  res.json(state.getOrderBook(stock));
});

module.exports = router;
