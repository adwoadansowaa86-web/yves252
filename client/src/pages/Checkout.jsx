import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FreeDeliveryBar } from '../components/CartDrawer.jsx';
import Icon from '../components/Icon.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { recentOrders } from '../lib/recentOrders.js';
import { useCart } from '../state/cart.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

const DETAILS_KEY = 'shop-checkout-details';
const loadDetails = () => {
  try {
    return JSON.parse(localStorage.getItem(DETAILS_KEY)) ?? {};
  } catch {
    return {};
  }
};

export default function Checkout() {
  const { store, refresh } = useStore();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const saved = loadDetails();

  const [form, setForm] = useState({
    name: saved.name ?? '',
    phone: saved.phone ?? '',
    email: saved.email ?? '',
    method: saved.method ?? 'delivery',
    region: saved.region ?? '',
    city: saved.city ?? '',
    address: saved.address ?? '',
    notes: '',
    paymentMethod: 'hubtel',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const options = store?.paymentOptions ?? [];
  useEffect(() => {
    if (options.length && !options.includes(form.paymentMethod)) setForm((f) => ({ ...f, paymentMethod: options[0] }));
  }, [options.join()]);
  useEffect(() => {
    if (store && !store.pickupEnabled && form.method === 'pickup') setForm((f) => ({ ...f, method: 'delivery' }));
  }, [store]);

  if (!store) return <div className="container page"><div className="card skeleton tall" /></div>;

  if (cart.items.length === 0) {
    return (
      <div className="container page empty-state">
        <div className="empty-icon"><Icon name="cart" size={36} /></div>
        <h2>Your cart is empty</h2>
        <p className="muted">Add a few things before checking out.</p>
        <Link className="btn btn-primary" to="/">Go to shop</Link>
      </div>
    );
  }

  const zone = store.deliveryZones.find((z) => z.region === form.region);
  const freeDelivery = store.freeDeliveryOver && cart.subtotal >= store.freeDeliveryOver;
  const deliveryFee = form.method === 'pickup' || freeDelivery ? 0 : zone?.fee ?? null;
  const total = cart.subtotal + (deliveryFee ?? 0);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { name, phone, email, method, region, city, address } = form;
    try {
      localStorage.setItem(DETAILS_KEY, JSON.stringify({ name, phone, email, method, region, city, address }));
    } catch {
      /* ignore */
    }
    try {
      const result = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          customer: { name: form.name, phone: form.phone, email: form.email },
          fulfilment: { method: form.method, region: form.region, city: form.city, address: form.address, notes: form.notes },
          paymentMethod: form.paymentMethod,
        },
      });
      recentOrders.add(result.order.reference);
      cart.clear();
      if (result.checkoutUrl) {
        if (result.checkoutUrl.startsWith('/')) navigate(result.checkoutUrl);
        else window.location.assign(result.checkoutUrl);
      } else {
        navigate(`/order/${result.order.reference}?new=1`);
      }
    } catch (err) {
      setError(err.message);
      if (err.body?.reference) {
        recentOrders.add(err.body.reference);
        cart.clear();
        navigate(`/order/${err.body.reference}?failed=1`);
        return;
      }
      if (err.status === 409) refresh();
      toast(err.message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="container page">
      <h1 className="page-title">Checkout</h1>
      <form className="checkout" onSubmit={submit}>
        <div className="checkout-main">
          <section className="card section">
            <h2><span className="step">1</span> Your details</h2>
            <div className="field-grid">
              <label className="field">
                <span>Full name</span>
                <input required value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Ama Mensah" />
              </label>
              <label className="field">
                <span>Phone number</span>
                <input required type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="024 123 4567" inputMode="tel" />
                <small className="muted">We'll call or text this number about your order.</small>
              </label>
              <label className="field span-2">
                <span>Email <em className="muted">(optional)</em></span>
                <input type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" />
              </label>
            </div>
          </section>

          <section className="card section">
            <h2><span className="step">2</span> How do you want to receive it?</h2>
            <div className="choice-grid">
              <label className={`choice ${form.method === 'delivery' ? 'selected' : ''}`}>
                <input type="radio" name="method" value="delivery" checked={form.method === 'delivery'} onChange={set('method')} />
                <Icon name="truck" />
                <div><strong>Delivery</strong><small>To your door</small></div>
              </label>
              {store.pickupEnabled && (
                <label className={`choice ${form.method === 'pickup' ? 'selected' : ''}`}>
                  <input type="radio" name="method" value="pickup" checked={form.method === 'pickup'} onChange={set('method')} />
                  <Icon name="store" />
                  <div><strong>Pickup</strong><small>Free · {store.pickupAddress}</small></div>
                </label>
              )}
            </div>

            {form.method === 'delivery' ? (
              <div className="field-grid">
                <label className="field">
                  <span>Region</span>
                  <select required value={form.region} onChange={set('region')}>
                    <option value="">Choose your region</option>
                    {store.deliveryZones.map((z) => (
                      <option key={z.region} value={z.region}>{z.region} ({freeDelivery ? 'free' : money(z.fee)})</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Town / area</span>
                  <input required value={form.city} onChange={set('city')} placeholder="e.g. East Legon" autoComplete="address-level2" />
                </label>
                <label className="field span-2">
                  <span>Address, GhanaPost GPS or landmark</span>
                  <input required value={form.address} onChange={set('address')} placeholder="e.g. GA-123-4567, near the Shell station" autoComplete="street-address" />
                </label>
                <label className="field span-2">
                  <span>Delivery notes <em className="muted">(optional)</em></span>
                  <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Best time to deliver, gate colour…" />
                </label>
              </div>
            ) : (
              <p className="note"><Icon name="store" size={18} /> Pick up at <strong>{store.pickupAddress}</strong>. We'll call you when your order is ready.</p>
            )}
          </section>

          <section className="card section">
            <h2><span className="step">3</span> Payment</h2>
            {options.length === 0 && <p className="alert">Online payment is not available right now. Please contact us to order.</p>}
            <div className="choice-grid">
              {options.includes('hubtel') && (
                <label className={`choice ${form.paymentMethod === 'hubtel' ? 'selected' : ''}`}>
                  <input type="radio" name="paymentMethod" value="hubtel" checked={form.paymentMethod === 'hubtel'} onChange={set('paymentMethod')} />
                  <Icon name="shield" />
                  <div>
                    <strong>Pay now: MoMo or card</strong>
                    <small>MTN MoMo, Telecel Cash, AT Money, Visa, Mastercard via Hubtel</small>
                  </div>
                </label>
              )}
              {options.includes('cod') && (
                <label className={`choice ${form.paymentMethod === 'cod' ? 'selected' : ''}`}>
                  <input type="radio" name="paymentMethod" value="cod" checked={form.paymentMethod === 'cod'} onChange={set('paymentMethod')} />
                  <Icon name="truck" />
                  <div>
                    <strong>Pay on {form.method === 'pickup' ? 'pickup' : 'delivery'}</strong>
                    <small>Cash or MoMo when you receive your order</small>
                  </div>
                </label>
              )}
            </div>
            {store.mockPayments && form.paymentMethod === 'hubtel' && (
              <p className="note small">Test mode: Hubtel keys are not set, so you'll see a pretend payment page.</p>
            )}
          </section>
        </div>

        <aside className="checkout-summary card">
          <h2>Order summary</h2>
          <ul className="summary-lines">
            {cart.items.map(({ product, quantity }) => (
              <li key={product.id}>
                <div className="cart-thumb small">{product.images[0] && <img src={product.images[0]} alt="" />}</div>
                <div className="grow">
                  <span>{product.name}</span>
                  <QuantityStepper value={quantity} max={product.stock} onChange={(q) => cart.setQuantity(product.id, q)} size="sm" />
                </div>
                <strong>{money(product.price * quantity)}</strong>
              </li>
            ))}
          </ul>
          <FreeDeliveryBar subtotal={cart.subtotal} />
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{money(cart.subtotal)}</dd></div>
            <div>
              <dt>{form.method === 'pickup' ? 'Pickup' : 'Delivery'}</dt>
              <dd>{deliveryFee === null ? <span className="muted">Choose region</span> : deliveryFee === 0 ? 'Free' : money(deliveryFee)}</dd>
            </div>
            <div className="grand"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={submitting || options.length === 0}>
            {submitting ? 'Please wait…' : form.paymentMethod === 'hubtel' ? `Pay ${money(total)}` : `Place order · ${money(total)}`}
          </button>
          <p className="muted small center"><Icon name="shield" size={14} /> Your payment is processed securely by Hubtel.</p>
        </aside>
      </form>
    </div>
  );
}
