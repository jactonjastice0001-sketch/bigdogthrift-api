const express = require('express');
const router = express.Router();

let cachedRates = null;
let cachedAt = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

router.get('/rates', async (req, res) => {
  try {
    const now = Date.now();

    if (cachedRates && (now - cachedAt) < CACHE_DURATION) {
      return res.json({ success: true, base: 'KES', rates: cachedRates, cached: true });
    }

    const response = await fetch('https://open.er-api.com/v6/latest/KES');
    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('Exchange rate API returned an error');
    }

    cachedRates = data.rates;
    cachedAt = now;

    res.json({ success: true, base: 'KES', rates: cachedRates, cached: false });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    if (cachedRates) {
      return res.json({ success: true, base: 'KES', rates: cachedRates, cached: true, stale: true });
    }

    res.status(500).json({ success: false, message: 'Unable to fetch exchange rates' });
  }
});

module.exports = router;

