const cedis = new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', currencyDisplay: 'symbol' });

/** Formats integer pesewas as Ghana cedis, e.g. 12550 -> "GH₵125.50". */
export const money = (pesewas) => cedis.format((pesewas ?? 0) / 100).replace(/^GHS\s?/, 'GH₵');

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const ORDER_STATUS = {
  pending_payment: { label: 'Awaiting payment', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'blue' },
  processing: { label: 'Being prepared', tone: 'purple' },
  dispatched: { label: 'On the way', tone: 'teal' },
  delivered: { label: 'Delivered', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export const statusLabel = (status, method) =>
  status === 'dispatched' && method === 'pickup' ? 'Ready for pickup' : status === 'delivered' && method === 'pickup' ? 'Collected' : ORDER_STATUS[status]?.label ?? status;

export const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  failed: { label: 'Payment failed', tone: 'red' },
};

export const REQUEST_TYPES = {
  question: 'General question',
  product_request: 'Request a product',
  order_issue: 'Help with an order',
  bulk_order: 'Bulk / wholesale order',
};
