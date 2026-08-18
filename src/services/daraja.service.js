const axios = require('axios');

const BASE_URL = process.env.DARAJA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

let cachedToken = null;
let tokenExpiresAt = 0;

async function withRetry(fn, { retries = 1, delayMs = 1500, timeoutLabel = 'request' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = !err.response && ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND'].includes(err.code);
      if (!isTransient || attempt === retries) throw err;
      console.warn(`Daraja ${timeoutLabel} transient error (${err.code}), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const auth = Buffer.from(
    `${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`
  ).toString('base64');

  const { data } = await withRetry(
    () => axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` }, timeout: 20000 }
    ),
    { timeoutLabel: 'OAuth token request' }
  );

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (Number(data.expires_in || 3599) - 60) * 1000;
  return cachedToken;
}

function timestampNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function stkPush({ phone, amount, orderCode }) {
  const token = await getAccessToken();
  const shortcode = process.env.DARAJA_SHORTCODE;
  const timestamp = timestampNow();
  const password = Buffer.from(`${shortcode}${process.env.DARAJA_PASSKEY}${timestamp}`).toString('base64');
  const normalizedPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

  const { data } = await withRetry(
    () => axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.ceil(amount),
        PartyA: normalizedPhone,
        PartyB: shortcode,
        PhoneNumber: normalizedPhone,
        CallBackURL: process.env.DARAJA_CALLBACK_URL,
        AccountReference: orderCode,
        TransactionDesc: `Duka Tag order ${orderCode}`
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
    ),
    { timeoutLabel: 'STK push request' }
  );

  return data;
}

module.exports = { stkPush, getAccessToken };
