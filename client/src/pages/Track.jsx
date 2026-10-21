import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { recentOrders } from '../lib/recentOrders.js';

export default function Track() {
  const [reference, setReference] = useState('');
  const navigate = useNavigate();
  const recent = recentOrders.list();

  return (
    <div className="container page narrow">
      <div className="card section">
        <h1>Track your order</h1>
        <p className="muted">Enter the order number from your confirmation (it starts with <strong>AK</strong>).</p>
        <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (reference.trim()) navigate(`/order/${reference.trim().toUpperCase()}`); }}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. AKX7K2M9QP" aria-label="Order number" />
          <button className="btn btn-primary"><Icon name="search" size={18} /> Track</button>
        </form>
        {recent.length > 0 && (
          <>
            <h3>Your recent orders on this phone</h3>
            <ul className="link-list">
              {recent.map((r) => <li key={r}><Link to={`/order/${r}`}>{r}</Link></li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
