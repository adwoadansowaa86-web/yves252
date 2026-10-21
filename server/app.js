import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { createDb } from './db.js';
import { createAuth } from './auth.js';
import { createHubtel } from './hubtel.js';
import { toCedis, toPesewas } from './money.js';
import { parseCsv, toCsv } from './csv.js';
import { productFromInput, ValidationError } from './products.js';
import {
  ORDER_STATUSES,
  OrderError,
  buildOrder,
  confirmOrder,
  markPaymentFailed,
  publicOrder,
  setOrderStatus,
} from './orders.js';

const REQUEST_TYPES = ['question', 'product_request', 'order_issue', 'bulk_order'];
const REQUEST_STATUSES = ['new', 'in_progress', 'resolved'];

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp(config) {
  const {
    dataDir,
    adminPassword,
    sessionSecret,
    publicUrl,
    production = false,
    hubtel: hubtelConfig = {},
    clientDist,
  } = config;

  const db = createDb(dataDir);
  const auth = createAuth({ password: adminPassword, secret: sessionSecret });
  const hubtel = createHubtel(hubtelConfig);
  // Without Hubtel keys we simulate payments locally so the full flow can be
  // tried out. In production we never fake payments.
  const mockPayments = !hubtel.configured && !production;
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const paymentOptions = () => {
    const options = [];
    if (hubtel.configured || mockPayments) options.push('hubtel');
    if (db.getSettings().codEnabled) options.push('cod');
    return options;
  };

  const baseUrl = (req) => (publicUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const api = express.Router();

  // ---------- Storefront ----------

  api.get('/store', (req, res) => {
    const s = db.getSettings();
    const categories = [...new Set(db.products.all().filter((p) => p.active).map((p) => p.category))].sort();
    res.json({
      storeName: s.storeName,
      tagline: s.tagline,
      phone: s.phone,
      whatsapp: s.whatsapp,
      email: s.email,
      deliveryZones: s.deliveryZones,
      freeDeliveryOver: s.freeDeliveryOver,
      pickupEnabled: s.pickupEnabled,
      pickupAddress: s.pickupAddress,
      paymentOptions: paymentOptions(),
      mockPayments,
      categories,
    });
  });

  const shopProduct = ({ id, name, category, price, compareAtPrice, stock, description, images, featured, createdAt }) => ({
    id, name, category, price, compareAtPrice, stock, description, images, featured, createdAt,
  });

  api.get('/products', (req, res) => {
    res.json(db.products.all().filter((p) => p.active).map(shopProduct));
  });

  api.get('/products/:id', (req, res) => {
    const product = db.products.get(req.params.id);
    if (!product || !product.active) return res.status(404).json({ error: 'Product not found' });
    res.json(shopProduct(product));
  });

  const startHubtelCheckout = async (req, order) => {
    const ref = order.reference;
    if (mockPayments) {
      return { checkoutUrl: `/pay/test/${ref}`, checkoutId: null };
    }
    const base = baseUrl(req);
    const settings = db.getSettings();
    return hubtel.initiate({
      order,
      description: `${settings.storeName} order ${ref}`,
      callbackUrl: `${base}/api/payments/hubtel/callback`,
      returnUrl: `${base}/order/${ref}?paid=1`,
      cancellationUrl: `${base}/order/${ref}?cancelled=1`,
    });
  };

  api.post('/orders', asyncRoute(async (req, res) => {
    const draft = buildOrder(db, req.body ?? {}, { paymentOptions: paymentOptions() });
    let order = db.orders.insert(draft);

    if (order.paymentMethod === 'cod') {
      order = confirmOrder(db, order, { paid: false, note: 'Pay on delivery' });
      return res.status(201).json({ order: publicOrder(order) });
    }

    try {
      const checkout = await startHubtelCheckout(req, order);
      order = db.orders.update(order.id, { payment: { provider: 'hubtel', checkoutId: checkout.checkoutId } });
      res.status(201).json({ order: publicOrder(order), checkoutUrl: checkout.checkoutUrl });
    } catch (err) {
      console.error(err);
      markPaymentFailed(db, order, 'Could not reach Hubtel');
      res.status(502).json({
        error: 'We could not connect to the payment service. Please try again in a moment.',
        reference: order.reference,
      });
    }
  }));

  const findByReference = (ref) => db.orders.find((o) => o.reference === String(ref).toUpperCase());

  // Ask Hubtel directly whether an order was paid. Used when the customer
  // returns from checkout, in case the callback was delayed or missed.
  const lastChecked = new Map();
  const reconcile = async (order, { force = false } = {}) => {
    if (order.paymentMethod !== 'hubtel' || order.paymentStatus === 'paid' || !hubtel.canVerify) return order;
    const last = lastChecked.get(order.id) ?? 0;
    if (!force && Date.now() - last < 15_000) return order;
    lastChecked.set(order.id, Date.now());
    try {
      const status = await hubtel.checkStatus(order.reference);
      if (status?.paid && status.amount >= order.total) {
        return confirmOrder(db, order, {
          paid: true,
          payment: { provider: 'hubtel', transactionId: status.transactionId, method: status.method, verified: true },
        });
      }
    } catch (err) {
      console.error('Hubtel status check failed', err);
    }
    return order;
  };

  api.get('/orders/:reference', asyncRoute(async (req, res) => {
    let order = findByReference(req.params.reference);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order = await reconcile(order);
    res.json(publicOrder(order));
  }));

  // Lets a customer retry payment if they closed the Hubtel page.
  api.post('/orders/:reference/pay', asyncRoute(async (req, res) => {
    const order = findByReference(req.params.reference);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.paymentMethod !== 'hubtel' || order.paymentStatus === 'paid' || order.status === 'cancelled') {
      return res.status(409).json({ error: 'This order cannot be paid online' });
    }
    try {
      const checkout = await startHubtelCheckout(req, order);
      db.orders.update(order.id, { paymentStatus: 'unpaid', payment: { provider: 'hubtel', checkoutId: checkout.checkoutId } });
      res.json({ checkoutUrl: checkout.checkoutUrl });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: 'We could not connect to the payment service. Please try again in a moment.' });
    }
  }));

  // Hubtel posts the final payment result here.
  api.post('/payments/hubtel/callback', asyncRoute(async (req, res) => {
    const result = hubtel.parseCallback(req.body);
    const order = result.reference && findByReference(result.reference);
    if (!order) {
      console.warn('Hubtel callback for unknown order', result.reference);
      return res.json({ received: true });
    }
    if (!result.paid) {
      markPaymentFailed(db, order, 'Payment failed or was cancelled on Hubtel');
      return res.json({ received: true });
    }
    if (hubtel.canVerify) {
      // Never trust the callback body alone: confirm with Hubtel's status API.
      await reconcile(order, { force: true });
    } else if (result.amount >= order.total) {
      confirmOrder(db, order, {
        paid: true,
        payment: { provider: 'hubtel', checkoutId: result.checkoutId, transactionId: result.transactionId, method: result.method, verified: false },
      });
    } else {
      console.warn(`Hubtel callback amount ${result.amount} below order total ${order.total} for ${order.reference}`);
    }
    res.json({ received: true });
  }));

  if (mockPayments) {
    // Test-only stand-in for the Hubtel payment page.
    api.post('/payments/test/:reference', (req, res) => {
      const order = findByReference(req.params.reference);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      if (req.body?.outcome === 'success') {
        confirmOrder(db, order, { paid: true, payment: { provider: 'test', method: req.body.method ?? 'mobile_money' } });
      } else {
        markPaymentFailed(db, order, 'Test payment cancelled');
      }
      res.json(publicOrder(findByReference(req.params.reference)));
    });
  }

  api.post('/requests', (req, res) => {
    const body = req.body ?? {};
    const type = REQUEST_TYPES.includes(body.type) ? body.type : 'question';
    const name = String(body.name ?? '').trim().slice(0, 100);
    const contact = String(body.contact ?? '').trim().slice(0, 120);
    const message = String(body.message ?? '').trim().slice(0, 3000);
    if (!name || !contact || !message) {
      return res.status(400).json({ error: 'Please fill in your name, phone/email and message' });
    }
    db.requests.insert({
      type,
      name,
      contact,
      message,
      orderReference: String(body.orderReference ?? '').trim().slice(0, 20) || null,
      productId: String(body.productId ?? '').slice(0, 60) || null,
      status: 'new',
      notes: '',
    });
    res.status(201).json({ ok: true });
  });

  // ---------- Admin ----------

  api.post('/admin/login', (req, res) => {
    const result = auth.login(req.ip, req.body?.password);
    if (result.error) return res.status(401).json({ error: result.error });
    res.json({ token: result.token });
  });

  const admin = express.Router();
  admin.use((req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!auth.verify(token)) return res.status(401).json({ error: 'Please log in again' });
    next();
  });

  admin.get('/summary', (req, res) => {
    const settings = db.getSettings();
    const orders = db.orders.all();
    const products = db.products.all();
    const today = new Date().toISOString().slice(0, 10);
    const paidOrCod = orders.filter((o) => o.status !== 'cancelled' && (o.paymentStatus === 'paid' || o.paymentMethod === 'cod'));
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
      const dayOrders = paidOrCod.filter((o) => o.createdAt.startsWith(d));
      return { date: d, orders: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + o.total, 0) };
    });
    const sold = new Map();
    for (const o of paidOrCod) for (const i of o.items) sold.set(i.name, (sold.get(i.name) ?? 0) + i.quantity);
    res.json({
      todayRevenue: paidOrCod.filter((o) => o.createdAt.startsWith(today)).reduce((s, o) => s + o.total, 0),
      totalRevenue: paidOrCod.reduce((s, o) => s + o.total, 0),
      toFulfil: orders.filter((o) => ['confirmed', 'processing'].includes(o.status)).length,
      awaitingPayment: orders.filter((o) => o.status === 'pending_payment').length,
      newRequests: db.requests.all().filter((r) => r.status === 'new').length,
      lowStock: products
        .filter((p) => p.active && p.stock <= settings.lowStockThreshold)
        .map(({ id, name, stock }) => ({ id, name, stock })),
      topProducts: [...sold].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity })),
      days,
      recentOrders: orders.slice(0, 6),
    });
  });

  // Products
  admin.get('/products', (req, res) => res.json(db.products.all()));

  admin.post('/products', (req, res) => {
    const product = db.products.insert(productFromInput(req.body ?? {}));
    res.status(201).json(product);
  });

  admin.patch('/products/:id', (req, res) => {
    if (!db.products.get(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    res.json(db.products.update(req.params.id, productFromInput(req.body ?? {}, { partial: true })));
  });

  admin.delete('/products/:id', (req, res) => {
    if (!db.products.remove(req.params.id)) return res.status(404).json({ error: 'Product not found' });
    res.status(204).end();
  });

  const productColumns = [
    { header: 'id', value: (p) => p.id },
    { header: 'name', value: (p) => p.name },
    { header: 'category', value: (p) => p.category },
    { header: 'price', value: (p) => toCedis(p.price).toFixed(2) },
    { header: 'old_price', value: (p) => (p.compareAtPrice ? toCedis(p.compareAtPrice).toFixed(2) : '') },
    { header: 'stock', value: (p) => p.stock },
    { header: 'active', value: (p) => (p.active ? 'yes' : 'no') },
    { header: 'featured', value: (p) => (p.featured ? 'yes' : 'no') },
    { header: 'description', value: (p) => p.description },
    { header: 'images', value: (p) => p.images.join(' | ') },
  ];

  admin.get('/products.csv', (req, res) => {
    res.type('text/csv').attachment('products.csv').send(toCsv(db.products.all(), productColumns));
  });

  // Bulk add/update from a spreadsheet. Rows match on id, then on name.
  admin.post('/products/import', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
    const rows = parseCsv(req.body ?? '');
    const yes = (v) => /^(yes|y|true|1)$/i.test(v);
    const results = { created: 0, updated: 0, errors: [] };
    rows.forEach((row, index) => {
      const existing =
        (row.id && db.products.get(row.id)) ||
        db.products.find((p) => p.name.toLowerCase() === (row.name ?? '').toLowerCase());
      const input = {};
      if (row.name !== undefined) input.name = row.name;
      if (row.category !== undefined) input.category = row.category;
      if (row.price !== undefined && row.price !== '') input.price = row.price.replace(/[^\d.]/g, '');
      if (row.old_price !== undefined) input.compareAtPrice = row.old_price.replace(/[^\d.]/g, '') || null;
      if (row.stock !== undefined && row.stock !== '') input.stock = Number(row.stock);
      if (row.active !== undefined && row.active !== '') input.active = yes(row.active);
      if (row.featured !== undefined && row.featured !== '') input.featured = yes(row.featured);
      if (row.description !== undefined) input.description = row.description;
      if (row.images !== undefined) input.images = row.images.split('|').map((s) => s.trim()).filter(Boolean);
      try {
        if (existing) {
          db.products.update(existing.id, productFromInput(input, { partial: true }));
          results.updated++;
        } else {
          db.products.insert(productFromInput(input));
          results.created++;
        }
      } catch (err) {
        results.errors.push(`Row ${index + 2}: ${err.message}`);
      }
    });
    res.json(results);
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (req, file, cb) => {
        const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype];
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 8 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
      else cb(new ValidationError('Only JPG, PNG, WEBP or GIF images can be uploaded'));
    },
  });

  admin.post('/uploads', upload.array('images', 8), (req, res) => {
    res.status(201).json({ urls: (req.files ?? []).map((f) => `/uploads/${f.filename}`) });
  });

  // Orders
  admin.get('/orders', (req, res) => res.json(db.orders.all()));

  admin.patch('/orders/:id', (req, res) => {
    const order = db.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    let updated = order;
    if (req.body?.status) updated = setOrderStatus(db, order, req.body.status, req.body.note);
    if (req.body?.markPaid && updated.paymentStatus !== 'paid') {
      updated = confirmOrder(db, updated, {
        paid: true,
        payment: { provider: 'manual', method: String(req.body.method ?? 'cash').slice(0, 30) },
        note: 'Payment recorded by staff',
      });
    }
    if (typeof req.body?.staffNotes === 'string') {
      updated = db.orders.update(order.id, { staffNotes: req.body.staffNotes.slice(0, 2000) });
    }
    res.json(updated);
  });

  admin.post('/orders/:id/check-payment', asyncRoute(async (req, res) => {
    const order = db.orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!hubtel.canVerify) {
      return res.status(400).json({ error: 'Add HUBTEL_POS_SALES_ID to enable payment status checks' });
    }
    res.json(await reconcile(order, { force: true }));
  }));

  admin.get('/orders.csv', (req, res) => {
    const columns = [
      { header: 'reference', value: (o) => o.reference },
      { header: 'date', value: (o) => o.createdAt },
      { header: 'customer', value: (o) => o.customer.name },
      { header: 'phone', value: (o) => o.customer.phone },
      { header: 'email', value: (o) => o.customer.email },
      { header: 'items', value: (o) => o.items.map((i) => `${i.quantity} x ${i.name}`).join('; ') },
      { header: 'subtotal_ghs', value: (o) => toCedis(o.subtotal).toFixed(2) },
      { header: 'delivery_ghs', value: (o) => toCedis(o.deliveryFee).toFixed(2) },
      { header: 'total_ghs', value: (o) => toCedis(o.total).toFixed(2) },
      { header: 'payment_method', value: (o) => o.paymentMethod },
      { header: 'payment_status', value: (o) => o.paymentStatus },
      { header: 'status', value: (o) => o.status },
      { header: 'fulfilment', value: (o) => o.fulfilment.method },
      { header: 'region', value: (o) => o.fulfilment.region },
      { header: 'city', value: (o) => o.fulfilment.city },
      { header: 'address', value: (o) => o.fulfilment.address },
    ];
    res.type('text/csv').attachment('orders.csv').send(toCsv(db.orders.all(), columns));
  });

  // Customer requests
  admin.get('/requests', (req, res) => res.json(db.requests.all()));

  admin.patch('/requests/:id', (req, res) => {
    const request = db.requests.get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    const patch = {};
    if (REQUEST_STATUSES.includes(req.body?.status)) patch.status = req.body.status;
    if (typeof req.body?.notes === 'string') patch.notes = req.body.notes.slice(0, 2000);
    res.json(db.requests.update(request.id, patch));
  });

  admin.delete('/requests/:id', (req, res) => {
    if (!db.requests.remove(req.params.id)) return res.status(404).json({ error: 'Request not found' });
    res.status(204).end();
  });

  // Settings (money values in cedis over the wire)
  const settingsOut = (s) => ({
    ...s,
    freeDeliveryOver: s.freeDeliveryOver ? toCedis(s.freeDeliveryOver) : null,
    deliveryZones: s.deliveryZones.map((z) => ({ region: z.region, fee: toCedis(z.fee) })),
    payments: { hubtelConfigured: hubtel.configured, hubtelVerification: hubtel.canVerify, mockPayments },
  });

  admin.get('/settings', (req, res) => res.json(settingsOut(db.getSettings())));

  admin.put('/settings', (req, res) => {
    const b = req.body ?? {};
    const str = (v, max) => String(v ?? '').trim().slice(0, max);
    const zones = Array.isArray(b.deliveryZones) ? b.deliveryZones : [];
    const patch = {
      storeName: str(b.storeName, 80) || 'My Shop',
      tagline: str(b.tagline, 160),
      phone: str(b.phone, 40),
      whatsapp: str(b.whatsapp, 20).replace(/\D/g, ''),
      email: str(b.email, 120),
      pickupEnabled: Boolean(b.pickupEnabled),
      pickupAddress: str(b.pickupAddress, 300),
      codEnabled: Boolean(b.codEnabled),
      lowStockThreshold: Math.max(0, Math.floor(Number(b.lowStockThreshold) || 0)),
      freeDeliveryOver: Number(b.freeDeliveryOver) > 0 ? toPesewas(b.freeDeliveryOver) : null,
      deliveryZones: zones
        .map((z) => ({ region: str(z.region, 60), fee: Math.max(0, toPesewas(Number(z.fee) || 0)) }))
        .filter((z) => z.region),
    };
    if (patch.deliveryZones.length === 0 && !patch.pickupEnabled) {
      return res.status(400).json({ error: 'Add at least one delivery region or enable pickup' });
    }
    res.json(settingsOut(db.updateSettings(patch)));
  });

  admin.get('/order-statuses', (req, res) => res.json(ORDER_STATUSES));

  api.use('/admin', admin);
  api.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use('/api', api);
  app.use('/uploads', express.static(uploadsDir, { maxAge: '30d', immutable: true }));

  if (clientDist && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { index: false }));
    app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use((err, req, res, next) => {
    if (err instanceof OrderError || err instanceof ValidationError || err instanceof multer.MulterError) {
      return res.status(err.status ?? 400).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

  app.locals.db = db;
  return app;
}
