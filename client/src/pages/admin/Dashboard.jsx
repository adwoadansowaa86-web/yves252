import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { api } from '../../lib/api.js';
import { dateTime, money } from '../../lib/format.js';
import { OrderBadge, PaymentBadge } from './Badge.jsx';

function RevenueChart({ days }) {
  const max = Math.max(...days.map((d) => d.revenue), 1);
  return (
    <div className="bar-chart" role="img" aria-label="Sales over the last 14 days">
      {days.map((d) => (
        <div key={d.date} className="bar-col" title={`${new Date(d.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}: ${money(d.revenue)} from ${d.orders} order${d.orders === 1 ? '' : 's'}`}>
          <div className="bar" style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} />
          <span>{new Date(d.date).getDate()}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/admin/summary').then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="card skeleton tall" />;

  return (
    <div className="admin-page">
      <header className="admin-header"><h1>Dashboard</h1></header>

      <div className="stats">
        <div className="stat card"><span>Sales today</span><strong>{money(data.todayRevenue)}</strong></div>
        <div className="stat card"><span>Total sales</span><strong>{money(data.totalRevenue)}</strong></div>
        <Link to="/admin/orders?filter=to_fulfil" className="stat card"><span>Orders to fulfil</span><strong>{data.toFulfil}</strong></Link>
        <Link to="/admin/requests" className="stat card"><span>New customer requests</span><strong>{data.newRequests}</strong></Link>
      </div>

      <div className="admin-columns">
        <section className="card section">
          <h2>Sales, last 14 days</h2>
          <RevenueChart days={data.days} />
        </section>

        <section className="card section">
          <h2>Low stock</h2>
          {data.lowStock.length === 0 ? (
            <p className="muted">All products are well stocked.</p>
          ) : (
            <ul className="mini-list">
              {data.lowStock.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <span className={`badge ${p.stock === 0 ? 'tone-red' : 'tone-amber'}`}>{p.stock === 0 ? 'Sold out' : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/products" className="btn btn-link">Update stock <Icon name="back" size={14} style={{ transform: 'rotate(180deg)' }} /></Link>
        </section>
      </div>

      <div className="admin-columns">
        <section className="card section">
          <h2>Recent orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="muted">No orders yet. Share your shop link to get your first sale!</p>
          ) : (
            <ul className="mini-list">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders?open=${o.id}`}>
                    <strong>{o.customer.name}</strong> <span className="muted small">{o.reference} · {dateTime(o.createdAt)}</span>
                  </Link>
                  <span className="row-gap">
                    <PaymentBadge order={o} />
                    <OrderBadge status={o.status} method={o.fulfilment.method} />
                    <strong>{money(o.total)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card section">
          <h2>Best sellers</h2>
          {data.topProducts.length === 0 ? <p className="muted">No sales yet.</p> : (
            <ol className="mini-list">
              {data.topProducts.map((p) => <li key={p.name}><span>{p.name}</span><strong>{p.quantity} sold</strong></li>)}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
