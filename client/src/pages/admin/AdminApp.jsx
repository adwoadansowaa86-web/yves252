import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { adminToken, api } from '../../lib/api.js';

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api('/admin/login', { method: 'POST', body: { password } });
      adminToken.set(token);
      onLogin();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="admin-login">
      <form className="card section" onSubmit={submit}>
        <img src="/favicon.svg" alt="" width="48" height="48" />
        <h1>Shop admin</h1>
        <label className="field">
          <span>Password</span>
          <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <p className="alert">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <Link to="/" className="btn btn-link">Back to shop</Link>
      </form>
    </div>
  );
}

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/admin/orders', label: 'Orders', icon: 'box' },
  { to: '/admin/products', label: 'Products', icon: 'store' },
  { to: '/admin/requests', label: 'Requests', icon: 'inbox' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export default function AdminApp() {
  const [authed, setAuthed] = useState(Boolean(adminToken.get()));
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const out = () => setAuthed(false);
    window.addEventListener('admin-logout', out);
    return () => window.removeEventListener('admin-logout', out);
  }, []);

  // Light polling so new orders and requests show up without refreshing.
  useEffect(() => {
    if (!authed) return;
    const load = () => api('/admin/summary').then((s) => setCounts({ orders: s.toFulfil, requests: s.newRequests })).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const logout = () => {
    adminToken.clear();
    setAuthed(false);
  };

  return (
    <div className="admin">
      <aside className="admin-nav">
        <Link to="/admin" className="brand"><img src="/favicon.svg" alt="" width="28" /> <span>Admin</span></Link>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} size={18} /> <span>{n.label}</span>
              {n.label === 'Orders' && counts.orders > 0 && <em className="nav-count">{counts.orders}</em>}
              {n.label === 'Requests' && counts.requests > 0 && <em className="nav-count">{counts.requests}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-nav-foot">
          <a href="/" target="_blank" rel="noreferrer"><Icon name="eye" size={18} /> <span>View shop</span></a>
          <button onClick={logout}><Icon name="logout" size={18} /> <span>Log out</span></button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet context={{ refreshCounts: () => api('/admin/summary').then((s) => setCounts({ orders: s.toFulfil, requests: s.newRequests })).catch(() => {}) }} />
      </main>
    </div>
  );
}
