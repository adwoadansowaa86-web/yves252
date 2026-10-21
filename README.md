# Akwaaba Market: online shop for a Ghanaian business

A complete online shop with prices in **Ghana cedis (GH₵)** and payment through **Hubtel Checkout**: MTN MoMo, Telecel Cash, AT Money, Visa/Mastercard and the Hubtel wallet.

## What's included

**For customers (mobile-first)**
- Shop with instant search, category filters, sorting, discount and "only 3 left" labels
- Cart that slides out, updates live and is remembered on the phone, plus a sticky "View cart" bar on mobile
- One-page checkout in 3 steps: details → delivery or pickup → payment. Delivery fee is set per region, with a free-delivery progress bar.
- Pay now with Hubtel (MoMo/card) **or** pay on delivery/pickup
- Order page with live payment confirmation and a progress tracker (Confirmed → Being prepared → On the way → Delivered)
- "Track order" page and a Help page for questions, product requests and order problems
- WhatsApp chat button

**For the business (`/admin`)**
- **Dashboard:** today's and total sales, 14-day sales chart, low-stock alerts, best sellers, recent orders
- **Products:** add/edit with photo upload, **edit price and stock right in the table**, +/- stock buttons, show/hide products, featured items
- **Bulk update with a spreadsheet:** export products to CSV, edit in Excel/Google Sheets, import back
- **Orders:** filter (to fulfil, awaiting payment, completed…), one-click "next step" buttons, call/WhatsApp the customer, mark cash orders as paid, staff notes, full history, CSV export. Cancelling an order puts the stock back.
- **Customer requests inbox:** new / in progress / resolved, reply on WhatsApp in one tap
- **Settings:** shop name and contacts, delivery regions and fees, free-delivery threshold, pickup address, pay-on-delivery on/off

## Run it on your computer

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env      # then set ADMIN_PASSWORD in .env
npm run dev
```

- Shop: http://localhost:5173
- Admin: http://localhost:5173/admin (log in with your `ADMIN_PASSWORD`)

Without Hubtel keys the shop runs in **test mode**. "Pay now" opens a pretend payment page, so you can try the whole flow without real money.

Run the tests with `npm test`.

## Going live with Hubtel

1. Open a Hubtel merchant account and request **Online Checkout** API access.
2. In the Hubtel dashboard, copy your **API ID**, **API Key** and **Merchant Account Number** (POS Sales ID).
3. Put them in `.env`:
   ```
   HUBTEL_API_ID=...
   HUBTEL_API_KEY=...
   HUBTEL_MERCHANT_ACCOUNT=...
   HUBTEL_POS_SALES_ID=...        # usually the same as the merchant account number
   PUBLIC_URL=https://your-shop-domain.com
   ```
4. Ask Hubtel to **whitelist your server's IP address** for the Transaction Status API. The shop uses it to double-check every payment with Hubtel before confirming an order. If `HUBTEL_POS_SALES_ID` is empty, orders are confirmed from Hubtel's callback alone (the amount is still checked).
5. Make a small real payment first and check that the order turns **Paid** in `/admin/orders`.

How a payment works:

1. The customer clicks **Pay**. The server creates the order, works out the total from the catalogue (never trusting prices sent by the browser) and asks Hubtel for a checkout page.
2. The customer pays on Hubtel's page and is sent back to `/order/<reference>`.
3. Hubtel calls `POST /api/payments/hubtel/callback`. The server confirms the payment with Hubtel, marks the order paid and reduces stock.
4. If the callback is late, the order page keeps checking Hubtel, and staff can press **Check payment with Hubtel** on any order.

All Hubtel code is in `server/hubtel.js`, so adding another provider (Paystack, ExpressPay, direct MoMo, …) only needs a new file next to it.

## Putting it online

```bash
npm install
npm run build
NODE_ENV=production npm start     # serves the shop and API on PORT (default 3001)
```

Any Node host works (a VPS, Render, Railway, Fly.io…). Notes:

- Use HTTPS and set `PUBLIC_URL` to your real domain. Hubtel needs it for the callback.
- Set a long random `SESSION_SECRET`.
- All data (products, orders, requests, uploaded photos) is stored in the `data/` folder. Keep it on a **persistent disk** and back it up. When the business grows, `server/db.js` can be swapped for PostgreSQL without touching the rest of the code.
- In production, test mode is switched off: without Hubtel keys only pay-on-delivery is offered.

## Project layout

```
server/            Express API
  app.js           all routes (shop, checkout, Hubtel callback, admin)
  hubtel.js        Hubtel Online Checkout + status check
  orders.js        pricing, stock, order status rules
  db.js            JSON-file storage (atomic writes)
client/src/        React storefront and admin dashboard
  pages/           Shop, Product, Checkout, Order, Track, Contact
  pages/admin/     Dashboard, Orders, Products, Requests, Settings
test/              API tests (node --test)
```

Money is stored in **pesewas** (whole numbers) to avoid rounding mistakes and is shown as GH₵.
