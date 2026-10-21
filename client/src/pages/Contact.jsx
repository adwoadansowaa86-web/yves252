import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { api } from '../lib/api.js';
import { REQUEST_TYPES } from '../lib/format.js';
import { useStore } from '../state/store.jsx';

export default function Contact() {
  const { store } = useStore();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    type: REQUEST_TYPES[params.get('type')] ? params.get('type') : 'question',
    name: '',
    contact: '',
    orderReference: params.get('order') ?? '',
    message: params.get('message') ?? '',
  });
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await api('/requests', { method: 'POST', body: form });
      setState('sent');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  return (
    <div className="container page narrow">
      <div className="card section">
        <h1>How can we help?</h1>
        <p className="muted">Ask a question, request a product we don't stock yet, or get help with an order. We usually reply the same day.</p>

        {store?.whatsapp && (
          <div className="contact-quick">
            <a className="btn btn-whatsapp" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> WhatsApp us</a>
            {store.phone && <a className="btn btn-outline" href={`tel:${store.phone.replace(/\s/g, '')}`}><Icon name="phone" size={18} /> Call {store.phone}</a>}
          </div>
        )}

        {state === 'sent' ? (
          <div className="success-box">
            <div className="order-hero-icon"><Icon name="check" size={28} /></div>
            <h2>Message sent!</h2>
            <p>Thanks {form.name.split(' ')[0]}, we'll get back to you on {form.contact}.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="field-grid">
            <label className="field span-2">
              <span>What is it about?</span>
              <select value={form.type} onChange={set('type')}>
                {Object.entries(REQUEST_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Your name</span>
              <input required value={form.name} onChange={set('name')} autoComplete="name" />
            </label>
            <label className="field">
              <span>Phone or email</span>
              <input required value={form.contact} onChange={set('contact')} placeholder="024 123 4567" />
            </label>
            {form.type === 'order_issue' && (
              <label className="field span-2">
                <span>Order number</span>
                <input value={form.orderReference} onChange={set('orderReference')} placeholder="AK…" />
              </label>
            )}
            <label className="field span-2">
              <span>Message</span>
              <textarea required rows={5} value={form.message} onChange={set('message')} />
            </label>
            {error && <p className="alert span-2">{error}</p>}
            <button className="btn btn-primary btn-lg span-2" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
