import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { api } from '../../lib/api.js';
import { REQUEST_TYPES, dateTime } from '../../lib/format.js';
import { useToast } from '../../state/toast.jsx';

const STATUSES = { new: { label: 'New', tone: 'amber' }, in_progress: { label: 'In progress', tone: 'blue' }, resolved: { label: 'Resolved', tone: 'green' } };

const contactLinks = (contact) => {
  const digits = contact.replace(/\D/g, '');
  if (contact.includes('@')) return { email: contact };
  if (/^0\d{9}$/.test(digits)) return { phone: `233${digits.slice(1)}` };
  if (/^233\d{9}$/.test(digits)) return { phone: digits };
  return {};
};

function RequestCard({ request, onChange, onDelete }) {
  const toast = useToast();
  const [notes, setNotes] = useState(request.notes ?? '');
  const links = contactLinks(request.contact);

  const update = async (body) => {
    try {
      onChange(await api(`/admin/requests/${request.id}`, { method: 'PATCH', body }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <article className={`card request ${request.status}`}>
      <header>
        <div>
          <span className="badge tone-gray">{REQUEST_TYPES[request.type] ?? request.type}</span>
          <h3>{request.name}</h3>
          <small className="muted">{request.contact} · {dateTime(request.createdAt)}</small>
        </div>
        <select value={request.status} onChange={(e) => update({ status: e.target.value })} className={`status-select tone-${STATUSES[request.status].tone}`} aria-label="Request status">
          {Object.entries(STATUSES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
      </header>
      <p className="request-message">{request.message}</p>
      {request.orderReference && (
        <p className="small">Order: <Link to={`/order/${request.orderReference}`} target="_blank">{request.orderReference}</Link></p>
      )}
      <div className="row-gap wrap">
        {links.phone && (
          <>
            <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${links.phone}?text=${encodeURIComponent(`Hello ${request.name.split(' ')[0]}, thanks for contacting us. `)}`} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> Reply on WhatsApp</a>
            <a className="btn btn-ghost btn-sm" href={`tel:+${links.phone}`}><Icon name="phone" size={16} /> Call</a>
          </>
        )}
        {links.email && <a className="btn btn-ghost btn-sm" href={`mailto:${links.email}`}>Reply by email</a>}
        <button className="btn btn-link btn-sm danger" onClick={() => confirm('Delete this request?') && onDelete()}>Delete</button>
      </div>
      <textarea rows={2} placeholder="Notes (staff only)" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== request.notes && update({ notes })} />
    </article>
  );
}

export default function Requests() {
  const { refreshCounts } = useOutletContext();
  const [requests, setRequests] = useState(null);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    api('/admin/requests').then(setRequests).catch(() => {});
  }, []);

  const visible = useMemo(
    () => (requests ?? []).filter((r) => (filter === 'open' ? r.status !== 'resolved' : filter === 'all' ? true : r.status === filter)),
    [requests, filter],
  );

  return (
    <div className="admin-page">
      <header className="admin-header"><h1>Customer requests</h1></header>
      <p className="muted">Questions, product requests and order problems sent from the Help page.</p>
      <div className="chips">
        {[['open', 'Open'], ['new', 'New'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, label]) => (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      {!requests ? <div className="card skeleton tall" /> : visible.length === 0 ? (
        <div className="empty-state"><div className="empty-icon"><Icon name="inbox" size={32} /></div><h3>All caught up</h3></div>
      ) : (
        <div className="request-list">
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              onChange={(saved) => {
                setRequests((list) => list.map((x) => (x.id === saved.id ? saved : x)));
                refreshCounts();
              }}
              onDelete={async () => {
                await api(`/admin/requests/${r.id}`, { method: 'DELETE' });
                setRequests((list) => list.filter((x) => x.id !== r.id));
                refreshCounts();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
