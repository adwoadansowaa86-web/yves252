import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { dateTime, money, statusLabel } from '../lib/format.js';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

const STEPS = ['confirmed', 'processing', 'dispatched', 'delivered'];

export default function OrderPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const { store, refresh } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    let polls = 0;
    const load = async () => {
      try {
        const o = await api(`/orders/${reference}`);
        if (cancelled) return;
        setOrder(o);
        setError(null);
        // Hubtel may take a few seconds to tell us about the payment.
        const waiting = o.paymentMethod === 'hubtel' && o.paymentStatus === 'unpaid' && o.status === 'pending_payment';
        polls += 1;
        if (waiting && polls < 40) timer = setTimeout(load, polls < 10 ? 3000 : 8000);
        else if (o.status !== 'pending_payment') refresh();
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reference]);

  const retryPayment = async () => {
    setPaying(true);
    try {
      const { checkoutUrl } = await api(`/orders/${reference}/pay`, { method: 'POST' });
      if (checkoutUrl.startsWith('/')) navigate(checkoutUrl);
      else window.location.assign(checkoutUrl);
    } catch (err) {
      toast(err.message, 'error');
      setPaying(false);
    }
  };

  const copyRef = () => {
    navigator.clipboard?.writeText(reference).then(() => toast('Order number copied'));
  };

  if (error) {
    return (
      <div className="container page empty-state">
        <h2>Order not found</h2>
        <p className="muted">Check the order number and try again.</p>
        <Link to="/track" className="btn btn-primary">Track another order</Link>
      </div>
    );
  }
  if (!order) return <div className="container page"><div className="card skeleton tall" /></div>;

  const paid = order.paymentStatus === 'paid';
  const awaitingOnline = order.paymentMethod === 'hubtel' && !paid && order.status === 'pending_payment';
  const cancelledByCustomer = params.get('cancelled') || order.paymentStatus === 'failed' || params.get('failed');
  const currentStep = STEPS.indexOf(order.status);
  const isPickup = order.fulfilment.method === 'pickup';

  let hero;
  if (order.status === 'cancelled') {
    hero = { tone: 'red', icon: 'close', title: 'This order was cancelled', text: 'Contact us if you have any questions.' };
  } else if (awaitingOnline && cancelledByCustomer) {
    hero = { tone: 'amber', icon: 'refresh', title: 'Payment not completed', text: "Your order is saved. You can try paying again; you won't be charged twice." };
  } else if (awaitingOnline) {
    hero = { tone: 'amber', icon: 'refresh', title: 'Confirming your payment…', text: 'This usually takes a few seconds. Keep this page open.', spin: true };
  } else {
    hero = {
      tone: 'green',
      icon: 'check',
      title: params.get('new') || params.get('paid') ? `Thank you, ${order.customer.name.split(' ')[0]}!` : statusLabel(order.status, order.fulfilment.method),
      text: paid ? 'Payment received. ' + (isPickup ? "We'll call you when it's ready for pickup." : "We'll call you before delivery.") : `Please pay ${money(order.total)} on ${isPickup ? 'pickup' : 'delivery'}.`,
    };
  }

  return (
    <div className="container page narrow">
      <section className={`order-hero tone-${hero.tone}`}>
        <div className={`order-hero-icon ${hero.spin ? 'spin' : ''}`}><Icon name={hero.icon} size={30} /></div>
        <h1>{hero.title}</h1>
        <p>{hero.text}</p>
        <button className="order-ref" onClick={copyRef} title="Copy order number">
          Order <strong>{order.reference}</strong> <Icon name="copy" size={14} />
        </button>
        {awaitingOnline && (
          <button className="btn btn-primary btn-lg" onClick={retryPayment} disabled={paying}>
            {paying ? 'Opening Hubtel…' : `Pay ${money(order.total)} now`}
          </button>
        )}
      </section>

      {order.status !== 'cancelled' && order.status !== 'pending_payment' && (
        <section className="card section">
          <h2>Order progress</h2>
          <ol className="tracker">
            {STEPS.map((step, i) => {
              const entry = order.history.findLast((h) => h.status === step);
              return (
                <li key={step} className={i <= currentStep ? 'done' : ''}>
                  <span className="dot">{i <= currentStep ? <Icon name="check" size={14} /> : i + 1}</span>
                  <div>
                    <strong>{statusLabel(step, order.fulfilment.method)}</strong>
                    {entry && <small className="muted">{dateTime(entry.at)}</small>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="card section">
        <h2>Items</h2>
        <ul className="summary-lines">
          {order.items.map((item) => (
            <li key={item.productId}>
              <div className="cart-thumb small">{item.image && <img src={item.image} alt="" />}</div>
              <div className="grow"><span>{item.name}</span><small className="muted">{item.quantity} × {money(item.price)}</small></div>
              <strong>{money(item.price * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <dl className="totals">
          <div><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          <div><dt>{isPickup ? 'Pickup' : 'Delivery'}</dt><dd>{order.deliveryFee ? money(order.deliveryFee) : 'Free'}</dd></div>
          <div className="grand"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
        <p className="muted small">
          {isPickup ? `Pickup at ${store?.pickupAddress ?? 'our shop'}` : `Delivery to ${order.fulfilment.city}, ${order.fulfilment.region}`} ·{' '}
          {order.paymentMethod === 'cod' ? 'Pay on receipt' : 'Online payment via Hubtel'} · {dateTime(order.createdAt)}
        </p>
      </section>

      <div className="center stack">
        <Link to="/" className="btn btn-outline">Continue shopping</Link>
        <Link to={`/contact?type=order_issue&order=${order.reference}`} className="btn btn-link">Need help with this order?</Link>
      </div>
    </div>
  );
}
