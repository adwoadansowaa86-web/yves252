import { toCedis } from './money.js';

const INITIATE_URL = 'https://payproxyapi.hubtel.com/items/initiate';
const STATUS_URL = 'https://api-txnstatus.hubtel.com/transactions';

// Hubtel's JSON uses PascalCase in callbacks and camelCase elsewhere.
// Read a field regardless of the casing used.
const pick = (obj, key) => {
  if (!obj || typeof obj !== 'object') return undefined;
  const match = Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase());
  return match === undefined ? undefined : obj[match];
};

/**
 * Hubtel Online Checkout client.
 *
 * Flow:
 *  1. initiate()  -> Hubtel returns a checkoutUrl; we redirect the customer there.
 *  2. Customer pays with MoMo / card / Hubtel wallet / G-Money etc.
 *  3. Hubtel POSTs the result to our callbackUrl and sends the customer to returnUrl.
 *  4. We confirm with checkStatus() before trusting a callback (when a
 *     POS Sales ID is configured; that API also needs our server IP whitelisted).
 */
export function createHubtel({ apiId, apiKey, merchantAccount, posSalesId, fetchImpl = fetch }) {
  const configured = Boolean(apiId && apiKey && merchantAccount);
  const authHeader = () => `Basic ${Buffer.from(`${apiId}:${apiKey}`).toString('base64')}`;

  return {
    configured,
    canVerify: configured && Boolean(posSalesId),

    async initiate({ order, callbackUrl, returnUrl, cancellationUrl, description }) {
      const res = await fetchImpl(INITIATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({
          totalAmount: toCedis(order.total),
          description,
          callbackUrl,
          returnUrl,
          cancellationUrl,
          merchantAccountNumber: merchantAccount,
          clientReference: order.reference,
        }),
      });
      const body = await res.json().catch(() => ({}));
      const data = pick(body, 'data');
      const checkoutUrl = pick(data, 'checkoutUrl');
      if (!res.ok || pick(body, 'responseCode') !== '0000' || !checkoutUrl) {
        const message = pick(body, 'message') || pick(data, 'message') || `HTTP ${res.status}`;
        throw new Error(`Hubtel checkout could not be started: ${message}`);
      }
      return { checkoutUrl, checkoutId: pick(data, 'checkoutId') };
    },

    /** Returns { paid, amount (pesewas), transactionId, raw } or null if unknown. */
    async checkStatus(reference) {
      if (!this.canVerify) return null;
      const url = `${STATUS_URL}/${encodeURIComponent(posSalesId)}/status?clientReference=${encodeURIComponent(reference)}`;
      const res = await fetchImpl(url, { headers: { Authorization: authHeader() } });
      if (!res.ok) return null;
      const body = await res.json().catch(() => ({}));
      const data = pick(body, 'data');
      if (!data) return null;
      const status = String(pick(data, 'status') ?? '').toLowerCase();
      return {
        paid: status === 'paid' || status === 'success',
        amount: Math.round(Number(pick(data, 'amount')) * 100),
        transactionId: pick(data, 'transactionId') ?? null,
        method: pick(data, 'paymentMethod') ?? null,
        raw: body,
      };
    },

    /** Normalises the body Hubtel POSTs to our callbackUrl. */
    parseCallback(body) {
      const data = pick(body, 'data') ?? {};
      const details = pick(data, 'paymentDetails') ?? {};
      const status = String(pick(data, 'status') ?? pick(body, 'status') ?? '').toLowerCase();
      const code = pick(body, 'responseCode');
      return {
        reference: pick(data, 'clientReference'),
        paid: code === '0000' && (status === 'success' || status === 'paid'),
        amount: Math.round(Number(pick(data, 'amount')) * 100),
        checkoutId: pick(data, 'checkoutId') ?? null,
        transactionId: pick(data, 'salesInvoiceId') ?? null,
        method: pick(details, 'channel') ?? pick(details, 'paymentType') ?? null,
        phone: pick(data, 'customerPhoneNumber') ?? null,
      };
    },
  };
}
