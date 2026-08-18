# Duka Tag — Backend API

Real backend for the Duka Tag thrift store: Node.js/Express, PostgreSQL, Safaricom Daraja
(M-Pesa STK Push), Flutterwave (card payments), and Twilio (SMS order updates).

This connects to the front-end prototype from earlier in this conversation — replace its
mock `window.storage` calls with `fetch()` calls to this API.

## 1. What you need to get yourself (10-30 min each)

| Service | What it's for | Where to get it |
|---|---|---|
| PostgreSQL database | Stores everything | Free tier on [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app) |
| Safaricom Daraja | M-Pesa STK Push prompts | [developer.safaricom.co.ke](https://developer.safaricom.co.ke) → create app in **Sandbox** first, get Consumer Key/Secret. Apply for **Go-Live** later to get a real Till/Paybill + production passkey |
| Flutterwave | Card payments | [dashboard.flutterwave.com](https://dashboard.flutterwave.com) → Settings → API Keys (test keys first, then switch to live) |
| Twilio | SMS to buyers | [console.twilio.com](https://console.twilio.com) → get Account SID, Auth Token, and a phone number capable of SMS |
| Hosting | Runs this server | [Railway](https://railway.app) or [Render](https://render.com) are the easiest for Node + Postgres |
| ngrok (dev only) | Gives Safaricom a public URL to call while you test locally | [ngrok.com](https://ngrok.com) — run `ngrok http 4000` and use that URL as `PUBLIC_BASE_URL` while developing |

Safaricom and Flutterwave **cannot call `localhost`** — while developing locally, run ngrok
and put its `https://...ngrok-free.app` URL in `PUBLIC_BASE_URL`. Once deployed to Railway/Render,
use that service's real URL instead.

## 2. Install & configure

```bash
npm install
cp .env.example .env
# now fill in every value in .env using the table above
```

## 3. Set up the database

```bash
npm run migrate   # creates all tables
npm run seed       # creates your one seller/admin login from SELLER_EMAIL / SELLER_PASSWORD in .env
```

## 4. Run it

```bash
npm run dev     # local development, auto-restarts on change
npm start       # production
```

Visit `GET /health` to confirm it's up.

## 5. Deploying for real

1. Push this folder to a GitHub repo.
2. Create a Postgres database (Neon/Supabase/Railway) and copy its connection string into `DATABASE_URL`.
3. Deploy the repo to Railway or Render as a Node service; set every `.env` variable in their dashboard's environment variables screen (never commit `.env`).
4. Once deployed, set `PUBLIC_BASE_URL` to the real deployed URL, and update `DARAJA_CALLBACK_URL` / `FLW_REDIRECT_URL` to match.
5. In the Safaricom Daraja portal, apply for **Go-Live** to get your real till number and production credentials — sandbox only works with Safaricom's test phone numbers.
6. In the Flutterwave dashboard, switch from test keys to live keys, and register your webhook URL (`/api/payments/flutterwave/webhook`) plus the same secret hash you set in `FLW_WEBHOOK_SECRET_HASH`.
7. Swap local disk uploads for S3/Cloudflare R2/DigitalOcean Spaces if your host has an ephemeral filesystem (Railway and Render do) — see the comment at the top of `src/middleware/upload.js`.

## 6. API reference

All bodies are JSON unless noted. Protected routes need `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/buyer/signup` — `{ fullName, idNumber, phone, email, password, address }`
- `POST /api/auth/buyer/login` — `{ identifier, password }` (identifier = phone or email)
- `POST /api/auth/seller/login` — `{ email, password }`

### Items (catalog)
- `GET /api/items?category=Jeans` — public
- `GET /api/items/:id` — public
- `POST /api/items` — seller only, multipart form with `photo` file + `name, category, price, qty, description`
- `PATCH /api/items/:id` — seller only, same fields, all optional
- `DELETE /api/items/:id` — seller only
- `POST /api/items/:id/favorite` / `DELETE /api/items/:id/favorite` — buyer only
- `GET /api/items/mine/favorites` — buyer only

### Orders
- `POST /api/orders` — buyer only
  ```json
  {
    "items": [{ "itemId": "uuid", "qty": 1 }],
    "destination": "Nairobi, Westlands, ABC Apartments",
    "paymentMethod": "mpesa",
    "manualTransactionCode": "optional — if buyer already paid manually"
  }
  ```
  Response includes `paymentInfo`: for M-Pesa either an STK prompt was sent to the buyer's
  phone, or (if `manualTransactionCode` was given) it's left pending for the seller to confirm.
  For cards, `paymentInfo.paymentLink` is the Flutterwave checkout URL to redirect the buyer to.
- `GET /api/orders/mine` — buyer only, full order history with line items
- `GET /api/orders` — seller only, all orders with buyer info
- `PATCH /api/orders/:id/stage` — seller only, `{ "stage": "packaging" }`. Automatically texts
  the buyer and logs the change — this is the "press button → buyer notified" action.
- `PATCH /api/orders/:id/confirm-payment` — seller only, manually mark a till-payment as confirmed

### Payments (called by Safaricom/Flutterwave, not your frontend)
- `POST /api/payments/mpesa/callback` — Safaricom calls this automatically after STK Push
- `POST /api/payments/flutterwave/webhook` — Flutterwave calls this automatically after a card charge
- `GET /api/payments/flutterwave/redirect` — buyer's browser lands here after paying by card

### Seller settings
- `GET /api/seller/storefront` — public: till number, till name, logo, ad video for the storefront to display
- `GET /api/seller/settings` — seller only
- `PATCH /api/seller/settings/payment` — seller only, `{ tillNumber, tillName }`
- `POST /api/seller/settings/logo` — seller only, multipart `logo` file
- `POST /api/seller/settings/ad-video` — seller only, multipart `video` file OR `{ videoUrl }`

## 7. Policy

Return policy ("Goods once sold are not returnable") is a front-end/storefront display concern —
show it on the shop and checkout pages. Nothing to configure here.
