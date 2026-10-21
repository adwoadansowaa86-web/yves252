import { randomBytes } from 'node:crypto';

export const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'];

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newReference = () =>
  'AK' + Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');

export class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const clean = (value, max = 200) => String(value ?? '').trim().slice(0, max);

// Accepts 024xxxxxxx, +233 24 xxx xxxx, 23324xxxxxxx; returns 233XXXXXXXXX.
export function normalisePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return '233' + digits.slice(1);
  if (/^233\d{9}$/.test(digits)) return digits;
  return null;
}

export function deliveryFeeFor(settings, fulfilment, subtotal) {
  if (fulfilment.method === 'pickup') return 0;
  if (settings.freeDeliveryOver && subtotal >= settings.freeDeliveryOver) return 0;
  const zone = settings.deliveryZones.find((z) => z.region === fulfilment.region);
  return zone ? zone.fee : 0;
}

/**
 * Builds an order from what the customer sent. Prices always come from the
 * catalogue, never from the browser.
 */
export function buildOrder(db, input, { paymentOptions }) {
  const settings = db.getSettings();
  const lines = Array.isArray(input.items) ? input.items : [];
  if (lines.length === 0) throw new OrderError('Your cart is empty');

  const merged = new Map();
  for (const line of lines) {
    const qty = Math.floor(Number(line.quantity));
    if (!line.productId || !(qty > 0)) throw new OrderError('Invalid cart item');
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + qty);
  }

  const items = [];
  for (const [productId, quantity] of merged) {
    const product = db.products.get(productId);
    if (!product || !product.active) throw new OrderError('A product in your cart is no longer available');
    if (product.stock < quantity) {
      throw new OrderError(
        product.stock === 0
          ? `${product.name} is sold out`
          : `Only ${product.stock} of ${product.name} left in stock`,
        409,
      );
    }
    items.push({
      productId,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images?.[0] ?? null,
    });
  }

  const name = clean(input.customer?.name, 100);
  const phone = normalisePhone(input.customer?.phone);
  const email = clean(input.customer?.email, 120);
  if (!name) throw new OrderError('Please enter your name');
  if (!phone) throw new OrderError('Please enter a valid Ghana phone number, e.g. 024 123 4567');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new OrderError('Please enter a valid email');

  const method = input.fulfilment?.method === 'pickup' ? 'pickup' : 'delivery';
  if (method === 'pickup' && !settings.pickupEnabled) throw new OrderError('Pickup is not available right now');
  const fulfilment = {
    method,
    region: clean(input.fulfilment?.region, 60),
    city: clean(input.fulfilment?.city, 80),
    address: clean(input.fulfilment?.address, 300),
    notes: clean(input.fulfilment?.notes, 500),
  };
  if (method === 'delivery') {
    if (!settings.deliveryZones.some((z) => z.region === fulfilment.region)) {
      throw new OrderError('Please choose a delivery region');
    }
    if (!fulfilment.city || !fulfilment.address) {
      throw new OrderError('Please enter your town/area and a delivery address or landmark');
    }
  }

  const paymentMethod = clean(input.paymentMethod, 20);
  if (!paymentOptions.includes(paymentMethod)) throw new OrderError('Please choose a payment method');

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = deliveryFeeFor(settings, fulfilment, subtotal);

  return {
    reference: newReference(),
    items,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    customer: { name, phone, email },
    fulfilment,
    paymentMethod,
    paymentStatus: 'unpaid',
    payment: null,
    status: 'pending_payment',
    stockDeducted: false,
    history: [{ at: new Date().toISOString(), status: 'pending_payment', note: 'Order placed' }],
  };
}

const historyEntry = (status, note) => ({ at: new Date().toISOString(), status, note });

function deductStock(db, order) {
  if (order.stockDeducted) return [];
  const shortages = [];
  for (const item of order.items) {
    const product = db.products.get(item.productId);
    if (!product) continue;
    if (product.stock < item.quantity) shortages.push(item.name);
    db.products.update(product.id, { stock: Math.max(0, product.stock - item.quantity) });
  }
  order.stockDeducted = true;
  return shortages;
}

function restoreStock(db, order) {
  if (!order.stockDeducted) return;
  for (const item of order.items) {
    const product = db.products.get(item.productId);
    if (product) db.products.update(product.id, { stock: product.stock + item.quantity });
  }
  order.stockDeducted = false;
}

/** Confirms an order once money has been received (or for pay-on-delivery). */
export function confirmOrder(db, order, { paid, payment, note }) {
  if (order.status === 'cancelled' && !paid) return order;
  const history = [...order.history];
  const shortages = deductStock(db, order);
  const patch = { stockDeducted: order.stockDeducted };
  if (paid && order.paymentStatus !== 'paid') {
    patch.paymentStatus = 'paid';
    patch.payment = { ...order.payment, ...payment, paidAt: new Date().toISOString() };
    history.push(historyEntry(order.status, note ?? 'Payment received'));
  }
  if (order.status === 'pending_payment' || order.status === 'cancelled') {
    patch.status = 'confirmed';
    history.push(historyEntry('confirmed', 'Order confirmed'));
  }
  if (shortages.length) {
    history.push(historyEntry(patch.status ?? order.status, `Stock was short for: ${shortages.join(', ')}`));
  }
  patch.history = history;
  return db.orders.update(order.id, patch);
}

export function setOrderStatus(db, order, status, note) {
  if (!ORDER_STATUSES.includes(status)) throw new OrderError('Unknown status');
  if (status === order.status) return order;
  if (status === 'cancelled') restoreStock(db, order);
  else if (status !== 'pending_payment') deductStock(db, order);
  return db.orders.update(order.id, {
    status,
    stockDeducted: order.stockDeducted,
    history: [...order.history, historyEntry(status, clean(note, 300) || null)],
  });
}

export function markPaymentFailed(db, order, note) {
  if (order.paymentStatus === 'paid') return order;
  return db.orders.update(order.id, {
    paymentStatus: 'failed',
    history: [...order.history, historyEntry(order.status, note || 'Payment was not completed')],
  });
}

/** What a customer may see about their order. */
export function publicOrder(order) {
  const phone = order.customer.phone;
  return {
    reference: order.reference,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    customer: { name: order.customer.name, phone: `${phone.slice(0, 5)}*****${phone.slice(-2)}` },
    fulfilment: { method: order.fulfilment.method, region: order.fulfilment.region, city: order.fulfilment.city },
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    history: order.history.map(({ at, status }) => ({ at, status })),
    createdAt: order.createdAt,
  };
}
