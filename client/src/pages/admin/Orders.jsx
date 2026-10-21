import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { api, download } from '../../lib/api.js';
import { dateTime, money, statusLabel } from '../../lib/format.js';
import { useToast } from '../../state/toast.jsx';
import { OrderBadge, PaymentBadge } from './Badge.jsx';

const FILTERS = {
  to_fulfil: { label: 'To fulfil', test: (o) => ['confirmed', 'processing', 'dispatched'].includes(o.status) },
  pending_payment: { label: 'Awaiting payment', test: (o) => o.status === 'pending_payment' },
  delivered: { label: 'Completed', test: (o) => o.status === 'delivered' },
  cancelled: { label: 'Cancelled', test: (o) => o.status === 'cancelled' },
  all: { label: 'All', test: () => true },
};

const NEXT = { confirmed: 'processing', processing: 'dispatched', dispatched: 'delivered' };
const NEXT_LABEL = {
  processing: 'Start preparing',
  dispatched: (o) => (o.fulfilment.method === 'pickup' ? 'Mark ready for pickup' : 'Mark as sent out'),
  delivered: (o) => (o.fulfilment.method === 'pickup' ? 'Mark as collected' : 'Mark as delivered'),
};

const phoneLocal = (p) => (p.startsWith('233') ? `0${p.slice(3)}` : p);

function OrderDetail({ order, onChange, onClose }) {
  const toast = useToast();
  const [notes, setNotes] = useState(order.staffNotes ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => setNotes(order.staffNotes ?? ''), [order.id]);

  const update = async (body, message) => {
    setBusy(true);
    try {
      const saved = await api(`/admin/orders/${order.id}`, { method: 'PATCH', body });
      onChange(saved);
      if (message) toast(message, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const checkPayment = async () => {
    setBusy(true);
    try {
      const saved = await api(`/admin/orders/${order.id}/check-payment`, { method: 'POST' });
      onChange(saved);
      toast(saved.paymentStatus === 'paid' ? 'Payment confirmed by Hubtel' : 'Hubtel has not received this payment yet');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const next = NEXT[order.status];
  const nextLabel = next && (typeof NEXT_LABEL[next] === 'function' ? NEXT_LABEL[next](order) : NEXT_LABEL[next]);
  const f = order.fulfilment;

  return (
    <aside className="order-detail card">
      <header className="drawer-header">
        <div>
          <h2>{order.reference}</h2>
          <small className="muted">{dateTime(order.createdAt)}</small>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </header>
      <div className="order-detail-body">
        <div className="row-gap wrap">
          <OrderBadge status={order.status} method={f.method} />
          <PaymentBadge order={order} />
        </div>

        {next && (
          <button className="btn btn-primary btn-block btn-lg" disabled={busy} onClick={() => update({ status: next }, `Order marked: ${statusLabel(next, f.method)}`)}>
            {nextLabel}
          </button>
        )}
        {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
          <div className="row-gap wrap">
            {order.paymentMethod === 'hubtel' && <button className="btn btn-outline" disabled={busy} onClick={checkPayment}><Icon name="refresh" size={16} /> Check payment with Hubtel</button>}
            <button className="btn btn-outline" disabled={busy} onClick={() => confirm(`Record that ${money(order.total)} was received for this order?`) && update({ markPaid: true, method: order.paymentMethod === 'cod' ? 'cash/momo on delivery' : 'manual' }, 'Payment recorded')}>
              <Icon name="check" size={16} /> Mark as paid
            </button>
          </div>
        )}

        <section>
          <h3>Customer</h3>
          <p><strong>{order.customer.name}</strong></p>
          <div className="row-gap wrap">
            <a className="btn btn-ghost btn-sm" href={`tel:+${order.customer.phone}`}><Icon name="phone" size={16} /> {phoneLocal(order.customer.phone)}</a>
            <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${order.customer.phone}?text=${encodeURIComponent(`Hello ${order.customer.name.split(' ')[0]}, this is about your order ${order.reference}.`)}`} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> WhatsApp</a>
          </div>
          {order.customer.email && <p><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a></p>}
        </section>

        <section>
          <h3>{f.method === 'pickup' ? 'Pickup' : 'Delivery'}</h3>
          {f.method === 'pickup' ? <p>Customer will pick up in store.</p> : (
            <p>{f.address}<br />{f.city}, {f.region}</p>
          )}
          {f.notes && <p className="note small">“{f.notes}”</p>}
        </section>

        <section>
          <h3>Items</h3>
          <ul className="mini-list">
            {order.items.map((i) => (
              <li key={i.productId}><span>{i.quantity} × {i.name}</span><span>{money(i.price * i.quantity)}</span></li>
            ))}
            <li><span className="muted">Delivery</span><span>{order.deliveryFee ? money(order.deliveryFee) : 'Free'}</span></li>
            <li><strong>Total</strong><strong>{money(order.total)}</strong></li>
          </ul>
          {order.payment && (
            <p className="muted small">
              Payment: {order.payment.provider}{order.payment.method && ` · ${order.payment.method}`}
              {order.payment.transactionId && ` · ref ${order.payment.transactionId}`}
              {order.payment.provider === 'hubtel' && order.payment.paidAt && (order.payment.verified ? ' · verified with Hubtel' : ' · from Hubtel callback')}
            </p>
          )}
        </section>

        <section>
          <h3>Staff notes</h3>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (order.staffNotes ?? '') && update({ staffNotes: notes }, 'Notes saved')} placeholder="Only visible to staff" />
        </section>

        <section>
          <h3>History</h3>
          <ul className="history">
            {[...order.history].reverse().map((h, i) => (
              <li key={i}><span className="muted small">{dateTime(h.at)}</span> {h.note ?? statusLabel(h.status, f.method)}</li>
            ))}
          </ul>
        </section>

        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <button className="btn btn-link danger" disabled={busy} onClick={() => {
            const reason = prompt('Cancel this order? Stock will be returned.\n\nReason (optional):');
            if (reason !== null) update({ status: 'cancelled', note: reason || 'Cancelled by staff' }, 'Order cancelled');
          }}>
            Cancel order
          </button>
        )}
        {order.status === 'cancelled' && (
          <button className="btn btn-link" disabled={busy} onClick={() => update({ status: 'confirmed', note: 'Re-opened by staff' }, 'Order re-opened')}>Re-open order</button>
        )}
      </div>
    </aside>
  );
}

export default function Orders() {
  const { refreshCounts } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState(null);
  const [query, setQuery] = useState('');
  const filter = FILTERS[params.get('filter')] ? params.get('filter') : 'to_fulfil';
  const openId = params.get('open');

  const load = () => api('/admin/orders').then(setOrders).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    const q = query.toLowerCase().replace(/^0/, '233');
    return (orders ?? []).filter(FILTERS[filter].test).filter((o) =>
      !q || `${o.reference} ${o.customer.name} ${o.customer.phone}`.toLowerCase().includes(q),
    );
  }, [orders, filter, query]);

  const open = orders?.find((o) => o.id === openId);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, (orders ?? []).filter(f.test).length])), [orders]);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Orders</h1>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={load}><Icon name="refresh" size={18} /> Refresh</button>
          <button className="btn btn-ghost" onClick={() => download('/admin/orders.csv', 'orders.csv')}><Icon name="download" size={18} /> Export</button>
        </div>
      </header>
      <div className="admin-toolbar">
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search by name, phone or order number" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips">
          {Object.entries(FILTERS).map(([k, f]) => (
            <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setParam('filter', k)}>
              {f.label} <span className="chip-count">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`orders-layout ${open ? 'has-detail' : ''}`}>
        {!orders ? <div className="card skeleton tall" /> : (
          <div className="card table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {visible.map((o) => (
                  <tr key={o.id} className={`clickable ${o.id === openId ? 'selected' : ''}`} onClick={() => setParam('open', o.id)}>
                    <td><strong>{o.reference}</strong><small className="muted block">{dateTime(o.createdAt)}</small></td>
                    <td data-label="Customer">{o.customer.name}<small className="muted block">{o.fulfilment.method === 'pickup' ? 'Pickup' : `${o.fulfilment.city}, ${o.fulfilment.region}`}</small></td>
                    <td data-label="Total"><strong>{money(o.total)}</strong><small className="muted block">{o.items.reduce((n, i) => n + i.quantity, 0)} items</small></td>
                    <td data-label="Payment"><PaymentBadge order={o} /></td>
                    <td data-label="Status"><OrderBadge status={o.status} method={o.fulfilment.method} /></td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td colSpan={5} className="center muted">No orders here.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {open && (
          <OrderDetail
            order={open}
            onClose={() => setParam('open', '')}
            onChange={(saved) => {
              setOrders((list) => list.map((o) => (o.id === saved.id ? saved : o)));
              refreshCounts();
            }}
          />
        )}
      </div>
    </div>
  );
}
