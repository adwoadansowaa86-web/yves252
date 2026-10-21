import { useDeferredValue, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import { money } from '../lib/format.js';
import { useStore } from '../state/store.jsx';

const SORTS = {
  featured: { label: 'Featured', fn: (a, b) => Number(b.featured) - Number(a.featured) },
  newest: { label: 'Newest', fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  low: { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
  high: { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
};

export default function Shop() {
  const { store, products, loading, error, refresh } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'featured';
  const query = useDeferredValue(q);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const visible = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return products
      .filter((p) => !category || p.category === category)
      .filter((p) => words.every((w) => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(w)))
      .sort((a, b) => (a.stock === 0) - (b.stock === 0) || SORTS[sort].fn(a, b));
  }, [products, category, query, sort]);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">Akwaaba! Welcome</p>
            <h1>{store?.tagline ?? 'Shop online'}</h1>
            <p className="hero-sub">Pay safely with Mobile Money or card. Fast delivery across Ghana{store?.pickupEnabled ? ', or pick up in store' : ''}.</p>
            <div className="hero-perks">
              <span><Icon name="shield" size={18} /> Secure Hubtel checkout</span>
              <span><Icon name="truck" size={18} /> {store?.freeDeliveryOver ? `Free delivery over ${money(store.freeDeliveryOver)}` : 'Nationwide delivery'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container shop">
        <div className="shop-toolbar">
          <label className="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search products…" value={q} onChange={(e) => update('q', e.target.value)} aria-label="Search products" />
          </label>
          <select value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)} aria-label="Sort products">
            {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
          </select>
        </div>

        <div className="chips" role="tablist" aria-label="Categories">
          <button role="tab" aria-selected={!category} className={`chip ${!category ? 'active' : ''}`} onClick={() => update('category', '')}>All</button>
          {store?.categories.map((c) => (
            <button key={c} role="tab" aria-selected={category === c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => update('category', c)}>{c}</button>
          ))}
        </div>

        {error ? (
          <div className="empty-state">
            <h3>We couldn't load the shop</h3>
            <p className="muted">{error}</p>
            <button className="btn btn-primary" onClick={refresh}>Try again</button>
          </div>
        ) : loading ? (
          <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="search" size={32} /></div>
            <h3>No products found</h3>
            <p className="muted">Can't find what you need? <Link to={`/contact?type=product_request&message=${encodeURIComponent(q ? `I'm looking for: ${q}` : '')}`}>Ask us and we'll try to get it.</Link></p>
          </div>
        ) : (
          <>
            <p className="muted small results-count">{visible.length} product{visible.length === 1 ? '' : 's'}</p>
            <div className="grid">{visible.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </>
        )}
      </section>
    </>
  );
}
