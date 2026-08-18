const axios = require('axios');

const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

let accessToken = null;
let expiresAt = 0; // epoch ms

async function fetchNewToken() {
  const response = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      client_id: process.env.FLW_CLIENT_ID,
      client_secret: process.env.FLW_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  accessToken = response.data.access_token;
  // Refresh 60s before actual expiry
  expiresAt = Date.now() + (response.data.expires_in - 60) * 1000;

  return accessToken;
}

async function getAccessToken() {
  if (!accessToken || Date.now() >= expiresAt) {
    return fetchNewToken();
  }
  return accessToken;
}

module.exports = { getAccessToken };
