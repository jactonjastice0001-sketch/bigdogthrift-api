const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
});

/**
 * Creates a hosted payment link — redirect the buyer's browser to `data.link`.
 * Flutterwave handles card entry, 3-D Secure, etc. On completion it redirects
 * back to FLW_REDIRECT_URL and also fires the webhook below.
 */
async function initiatePayment({ orderCode, amount, buyerEmail, buyerName, buyerPhone }) {
  const { data } = await client.post('/payments', {
    tx_ref: orderCode,
    amount,
    currency: 'KES',
    redirect_url: process.env.FLW_REDIRECT_URL,
    customer: { email: buyerEmail || 'no-email@dukatag.co.ke', name: buyerName, phonenumber: buyerPhone },
    customizations: { title: 'Duka Tag', description: `Payment for order ${orderCode}` }
  });
  return data; // data.data.link is the checkout URL
}

/**
 * Always re-verify a transaction server-side before trusting it — never trust
 * the redirect query params or webhook payload alone, since those can be spoofed.
 */
async function verifyTransaction(transactionId) {
  const { data } = await client.get(`/transactions/${transactionId}/verify`);
  return data;
}

module.exports = { initiatePayment, verifyTransaction };
