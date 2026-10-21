import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';

/** Stand-in for Hubtel's payment page, used only when Hubtel keys are not set. */
export default function TestPay() {
  const { reference } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [method, setMethod] = useState('mtn-gh');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/orders/${reference}`).then(setOrder).catch(() => navigate('/'));
  }, [reference]);

  const finish = async (outcome) => {
    setBusy(true);
    await api(`/payments/test/${reference}`, { method: 'POST', body: { outcome, method } });
    navigate(`/order/${reference}?${outcome === 'success' ? 'paid=1' : 'cancelled=1'}`);
  };

  if (!order) return <div className="container page"><div className="card skeleton tall" /></div>;

  return (
    <div className="container page narrow">
      <div className="card section testpay">
        <p className="badge tone-amber">TEST MODE · no real money</p>
        <h1>Hubtel Checkout (simulated)</h1>
        <p className="muted">Add your Hubtel API keys to <code>.env</code> to use the real Hubtel payment page.</p>
        <div className="testpay-amount">{money(order.total)}</div>
        <div className="choice-grid">
          {[['mtn-gh', 'MTN MoMo'], ['vodafone-gh', 'Telecel Cash'], ['tigo-gh', 'AT Money'], ['card', 'Visa / Mastercard']].map(([value, label]) => (
            <label key={value} className={`choice ${method === value ? 'selected' : ''}`}>
              <input type="radio" name="m" value={value} checked={method === value} onChange={() => setMethod(value)} />
              <div><strong>{label}</strong></div>
            </label>
          ))}
        </div>
        <div className="stack">
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => finish('success')}>
            <Icon name="check" size={18} /> Simulate successful payment
          </button>
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => finish('cancel')}>Cancel payment</button>
        </div>
      </div>
    </div>
  );
}
