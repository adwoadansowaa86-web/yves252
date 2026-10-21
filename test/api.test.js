import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';

let server;
let base;
let dataDir;
let token;
let app;

const call = async (method, url, body, headers = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
};

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-test-'));
  app = createApp({ dataDir, adminPassword: 'secret', sessionSecret: 'x' });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await app.locals.db.flush();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const customer = { name: 'Ama Mensah', phone: '024 123 4567', email: '' };
const delivery = { method: 'delivery', region: 'Greater Accra', city: 'East Legon', address: 'Near A&C Mall' };

test('storefront lists seeded products and store info', async () => {
  const store = await call('GET', '/api/store');
  assert.equal(store.status, 200);
  assert.deepEqual(store.body.paymentOptions, ['hubtel', 'cod']);
  const products = await call('GET', '/api/products');
  assert.ok(products.body.length > 0);
});

test('admin routes require login', async () => {
  const res = await call('GET', '/api/admin/products');
  assert.equal(res.status, 401);
  const bad = await call('POST', '/api/admin/login', { password: 'nope' });
  assert.equal(bad.status, 401);
  const good = await call('POST', '/api/admin/login', { password: 'secret' });
  assert.equal(good.status, 200);
  token = good.body.token;
});

test('admin can create, edit and hide a product', async () => {
  const created = await call('POST', '/api/admin/products', { name: 'Test Waakye Bowl', price: '12.50', stock: 4, category: 'Food' });
  assert.equal(created.status, 201);
  assert.equal(created.body.price, 1250);

  const edited = await call('PATCH', `/api/admin/products/${created.body.id}`, { stock: 9 });
  assert.equal(edited.body.stock, 9);
  assert.equal(edited.body.price, 1250);

  const bad = await call('PATCH', `/api/admin/products/${created.body.id}`, { price: -1 });
  assert.equal(bad.status, 400);

  await call('PATCH', `/api/admin/products/${created.body.id}`, { active: false });
  const t = token; token = null;
  const hidden = await call('GET', `/api/products/${created.body.id}`);
  token = t;
  assert.equal(hidden.status, 404);
});

test('order uses server prices, adds delivery and deducts stock when paid', async () => {
  const product = (await call('POST', '/api/admin/products', { name: 'Kelewele Spice', price: 20, stock: 5 })).body;

  const tooMany = await call('POST', '/api/orders', {
    items: [{ productId: product.id, quantity: 6 }], customer, fulfilment: delivery, paymentMethod: 'hubtel',
  });
  assert.equal(tooMany.status, 409);

  const res = await call('POST', '/api/orders', {
    items: [{ productId: product.id, quantity: 2, price: 1 }], customer, fulfilment: delivery, paymentMethod: 'hubtel',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.subtotal, 4000);
  assert.equal(res.body.order.deliveryFee, 3000);
  assert.equal(res.body.order.total, 7000);
  assert.equal(res.body.order.status, 'pending_payment');
  assert.match(res.body.checkoutUrl, /^\/pay\/test\//);
  assert.equal(res.body.order.customer.phone.includes('1234'), false, 'phone is masked');

  const ref = res.body.order.reference;
  const paid = await call('POST', `/api/payments/test/${ref}`, { outcome: 'success' });
  assert.equal(paid.body.paymentStatus, 'paid');
  assert.equal(paid.body.status, 'confirmed');

  const after = (await call('GET', '/api/admin/products')).body.find((p) => p.id === product.id);
  assert.equal(after.stock, 3);

  // Cancelling puts the stock back.
  const order = (await call('GET', '/api/admin/orders')).body.find((o) => o.reference === ref);
  await call('PATCH', `/api/admin/orders/${order.id}`, { status: 'cancelled' });
  const restocked = (await call('GET', '/api/admin/products')).body.find((p) => p.id === product.id);
  assert.equal(restocked.stock, 5);
});

test('Hubtel callback confirms a matching order', async () => {
  const product = (await call('POST', '/api/admin/products', { name: 'Callback Item', price: 100, stock: 3 })).body;
  const res = await call('POST', '/api/orders', {
    items: [{ productId: product.id, quantity: 1 }], customer, fulfilment: { method: 'pickup' }, paymentMethod: 'hubtel',
  });
  const ref = res.body.order.reference;
  assert.equal(res.body.order.total, 10000);

  const short = await call('POST', '/api/payments/hubtel/callback', {
    ResponseCode: '0000', Status: 'Success', Data: { ClientReference: ref, Status: 'Success', Amount: 1.0 },
  });
  assert.equal(short.status, 200);
  assert.equal((await call('GET', `/api/orders/${ref}`)).body.paymentStatus, 'unpaid', 'underpayment is ignored');

  await call('POST', '/api/payments/hubtel/callback', {
    ResponseCode: '0000', Status: 'Success',
    Data: { CheckoutId: 'abc', SalesInvoiceId: 'inv1', ClientReference: ref, Status: 'Success', Amount: 100.0, PaymentDetails: { Channel: 'mtn-gh' } },
  });
  const order = (await call('GET', `/api/orders/${ref}`)).body;
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.status, 'confirmed');
});

test('pay on delivery confirms immediately', async () => {
  const product = (await call('GET', '/api/products')).body[0];
  const res = await call('POST', '/api/orders', {
    items: [{ productId: product.id, quantity: 1 }], customer, fulfilment: delivery, paymentMethod: 'cod',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.status, 'confirmed');
  assert.equal(res.body.checkoutUrl, undefined);
});

test('checkout validates Ghana phone numbers', async () => {
  const product = (await call('GET', '/api/products')).body[0];
  const res = await call('POST', '/api/orders', {
    items: [{ productId: product.id, quantity: 1 }], customer: { ...customer, phone: '12345' }, fulfilment: delivery, paymentMethod: 'cod',
  });
  assert.equal(res.status, 400);
});

test('customer requests reach the admin inbox', async () => {
  const res = await call('POST', '/api/requests', { type: 'product_request', name: 'Kofi', contact: '0201234567', message: 'Do you sell smock?' });
  assert.equal(res.status, 201);
  const inbox = (await call('GET', '/api/admin/requests')).body;
  assert.equal(inbox[0].message, 'Do you sell smock?');
  assert.equal(inbox[0].status, 'new');
});

test('products CSV round-trips through import', async () => {
  const csv = (await call('GET', '/api/admin/products.csv')).body;
  assert.match(csv, /^id,name,category,price/);
  const res = await call(
    'POST',
    '/api/admin/products/import',
    'name,price,stock,category\r\nKente Stole,275,30,Fashion\r\n"Fugu Smock, Large",450,5,Fashion\r\n,abc,1,\r\n',
    { 'Content-Type': 'text/csv' },
  );
  assert.equal(res.body.updated, 1);
  assert.equal(res.body.created, 1);
  assert.equal(res.body.errors.length, 1);
  const kente = (await call('GET', '/api/admin/products')).body.find((p) => p.name === 'Kente Stole');
  assert.equal(kente.price, 27500);
  assert.equal(kente.stock, 30);
});
