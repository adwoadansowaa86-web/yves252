import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../state/toast.jsx';

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/settings').then((s) => setForm({ ...s, freeDeliveryOver: s.freeDeliveryOver ?? '' }));
  }, []);

  if (!form) return <div className="card skeleton tall" />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setZone = (i, key, value) => setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.map((z, j) => (j === i ? { ...z, [key]: value } : z)) }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await api('/admin/settings', { method: 'PUT', body: form });
      setForm({ ...saved, freeDeliveryOver: saved.freeDeliveryOver ?? '' });
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const p = form.payments;

  return (
    <form className="admin-page" onSubmit={save}>
      <header className="admin-header">
        <h1>Settings</h1>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </header>

      <section className="card section">
        <h2>Shop details</h2>
        <div className="field-grid">
          <label className="field"><span>Shop name</span><input required value={form.storeName} onChange={set('storeName')} /></label>
          <label className="field"><span>Tagline</span><input value={form.tagline} onChange={set('tagline')} /></label>
          <label className="field"><span>Phone</span><input value={form.phone} onChange={set('phone')} /></label>
          <label className="field"><span>WhatsApp number <em className="muted">e.g. 233241234567</em></span><input value={form.whatsapp} onChange={set('whatsapp')} /></label>
          <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} /></label>
          <label className="field"><span>Low stock warning at</span><input type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} /></label>
        </div>
      </section>

      <section className="card section">
        <h2>Delivery</h2>
        <p className="muted small">Set a delivery fee for each region customers can choose at checkout.</p>
        <div className="zones">
          {form.deliveryZones.map((z, i) => (
            <div key={i} className="zone-row">
              <input value={z.region} onChange={(e) => setZone(i, 'region', e.target.value)} placeholder="Region or area" aria-label="Region" />
              <label className="inline-input"><span>GH₵</span><input type="number" min="0" step="0.01" value={z.fee} onChange={(e) => setZone(i, 'fee', e.target.value)} aria-label="Fee" /></label>
              <button type="button" className="icon-btn danger" onClick={() => setForm((f) => ({ ...f, deliveryZones: f.deliveryZones.filter((_, j) => j !== i) }))} aria-label="Remove region"><Icon name="trash" size={18} /></button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => setForm((f) => ({ ...f, deliveryZones: [...f.deliveryZones, { region: '', fee: 0 }] }))}><Icon name="plus" size={16} /> Add region</button>
        </div>
        <div className="field-grid">
          <label className="field"><span>Free delivery when order is over (GH₵) <em className="muted">leave empty for never</em></span><input type="number" min="0" step="0.01" value={form.freeDeliveryOver} onChange={set('freeDeliveryOver')} /></label>
          <label className="field"><span>Pickup address</span><input value={form.pickupAddress} onChange={set('pickupAddress')} /></label>
        </div>
        <label className="toggle"><input type="checkbox" checked={form.pickupEnabled} onChange={set('pickupEnabled')} /><span className="switch" /> Allow in-store pickup</label>
      </section>

      <section className="card section">
        <h2>Payments</h2>
        <ul className="mini-list">
          <li>
            <span><strong>Hubtel checkout</strong> <small className="muted block">MoMo (MTN, Telecel, AT), cards, Hubtel wallet</small></span>
            {p.hubtelConfigured ? <span className="badge tone-green">Connected</span> : p.mockPayments ? <span className="badge tone-amber">Test mode</span> : <span className="badge tone-red">Not set up</span>}
          </li>
          <li>
            <span><strong>Payment verification</strong> <small className="muted block">Double-checks every payment with Hubtel before confirming</small></span>
            {p.hubtelVerification ? <span className="badge tone-green">On</span> : <span className="badge tone-gray">Off</span>}
          </li>
        </ul>
        {!p.hubtelConfigured && (
          <p className="note small">To take real payments, add your Hubtel API ID, API key and merchant account number to the server's <code>.env</code> file (see README).</p>
        )}
        <label className="toggle"><input type="checkbox" checked={form.codEnabled} onChange={set('codEnabled')} /><span className="switch" /> Allow pay on delivery / pickup</label>
      </section>
    </form>
  );
}
