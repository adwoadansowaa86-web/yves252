import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { api, download } from '../../lib/api.js';
import { money } from '../../lib/format.js';
import { useToast } from '../../state/toast.jsx';
import ProductEditor from './ProductEditor.jsx';

/** Price cell that saves when you press Enter or click away. */
function InlinePrice({ product, onSave }) {
  const [value, setValue] = useState((product.price / 100).toFixed(2));
  useEffect(() => setValue((product.price / 100).toFixed(2)), [product.price]);
  const commit = () => {
    if (value !== '' && Math.round(Number(value) * 100) !== product.price) onSave({ price: value });
  };
  return (
    <label className="inline-input">
      <span>GH₵</span>
      <input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Price of ${product.name}`} />
    </label>
  );
}

function InlineStock({ product, onSave, low }) {
  const [value, setValue] = useState(product.stock);
  useEffect(() => setValue(product.stock), [product.stock]);
  const save = (stock) => {
    const n = Math.max(0, Math.floor(Number(stock)));
    setValue(n);
    if (n !== product.stock && Number.isFinite(n)) onSave({ stock: n });
  };
  return (
    <div className={`stock-edit ${product.stock === 0 ? 'out' : product.stock <= low ? 'low' : ''}`}>
      <button type="button" onClick={() => save(product.stock - 1)} disabled={product.stock === 0} aria-label="Decrease stock"><Icon name="minus" size={14} /></button>
      <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => save(value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Stock of ${product.name}`} />
      <button type="button" onClick={() => save(product.stock + 1)} aria-label="Increase stock"><Icon name="plus" size={14} /></button>
    </div>
  );
}

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState(null);
  const [settings, setSettings] = useState({ lowStockThreshold: 5 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const importInput = useRef(null);

  const load = () => api('/admin/products').then(setProducts);
  useEffect(() => {
    load();
    api('/admin/settings').then(setSettings).catch(() => {});
  }, []);

  const categories = useMemo(() => [...new Set((products ?? []).map((p) => p.category))].sort(), [products]);
  const low = settings.lowStockThreshold;

  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return (products ?? []).filter((p) => {
      if (q && !`${p.name} ${p.category}`.toLowerCase().includes(q)) return false;
      if (filter === 'active') return p.active;
      if (filter === 'hidden') return !p.active;
      if (filter === 'low') return p.stock <= low;
      return true;
    });
  }, [products, query, filter, low]);

  const patch = async (product, body) => {
    setProducts((list) => list.map((p) => (p.id === product.id ? { ...p, ...('price' in body ? {} : body) } : p)));
    try {
      const saved = await api(`/admin/products/${product.id}`, { method: 'PATCH', body });
      setProducts((list) => list.map((p) => (p.id === saved.id ? saved : p)));
      toast(`Saved ${product.name}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
      load();
    }
  };

  const remove = async (product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.\n\nTip: untick "Visible in shop" instead to hide it temporarily.`)) return;
    await api(`/admin/products/${product.id}`, { method: 'DELETE' });
    setProducts((list) => list.filter((p) => p.id !== product.id));
    toast('Product deleted');
  };

  const importCsv = async (file) => {
    if (!file) return;
    try {
      const result = await api('/admin/products/import', { method: 'POST', body: await file.text(), headers: { 'Content-Type': 'text/csv' } });
      toast(`Import done: ${result.created} added, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} skipped` : ''}`, result.errors.length ? 'error' : 'success');
      if (result.errors.length) alert(`Some rows were skipped:\n\n${result.errors.join('\n')}`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      importInput.current.value = '';
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Products <span className="muted">{products?.length ?? ''}</span></h1>
        <div className="row-gap wrap">
          <button className="btn btn-ghost" onClick={() => download('/admin/products.csv', 'products.csv')} title="Download all products as a spreadsheet"><Icon name="download" size={18} /> Export</button>
          <button className="btn btn-ghost" onClick={() => importInput.current.click()} title="Add or update many products from a CSV spreadsheet"><Icon name="upload" size={18} /> Import CSV</button>
          <input ref={importInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => importCsv(e.target.files[0])} />
          <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={18} /> Add product</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search products" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="chips">
          {[['all', 'All'], ['active', 'Visible'], ['hidden', 'Hidden'], ['low', 'Low stock']].map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      <p className="muted small">Tip: change prices and stock right in the table. Changes save automatically.</p>

      {!products ? <div className="card skeleton tall" /> : (
        <div className="card table-wrap">
          <table className="table products-table">
            <thead>
              <tr><th>Product</th><th>Price</th><th>Stock</th><th>Visible</th><th /></tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'dim'}>
                  <td>
                    <button className="product-cell" onClick={() => setEditing(p)}>
                      <span className="cart-thumb small">{p.images[0] && <img src={p.images[0]} alt="" />}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <small className="muted">{p.category}{p.featured && ' · ★ Featured'}{p.compareAtPrice > p.price && ` · was ${money(p.compareAtPrice)}`}</small>
                      </span>
                    </button>
                  </td>
                  <td data-label="Price"><InlinePrice product={p} onSave={(b) => patch(p, b)} /></td>
                  <td data-label="Stock"><InlineStock product={p} low={low} onSave={(b) => patch(p, b)} /></td>
                  <td data-label="Visible">
                    <label className="toggle" title={p.active ? 'Shown in shop' : 'Hidden from shop'}>
                      <input type="checkbox" checked={p.active} onChange={(e) => patch(p, { active: e.target.checked })} />
                      <span className="switch" />
                    </label>
                  </td>
                  <td className="actions">
                    <button className="icon-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Icon name="edit" size={18} /></button>
                    <button className="icon-btn danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Icon name="trash" size={18} /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={5} className="center muted">No products match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <details className="help card section">
        <summary>How to update many products at once with a spreadsheet</summary>
        <ol>
          <li>Click <strong>Export</strong> to download your products as a CSV file.</li>
          <li>Open it in Excel or Google Sheets and change prices, stock, etc. Add new rows for new products (leave <code>id</code> empty).</li>
          <li>Save as CSV and click <strong>Import CSV</strong>. Rows are matched by <code>id</code>, or by product name.</li>
        </ol>
        <p className="muted small">Columns: id, name, category, price, old_price, stock, active (yes/no), featured (yes/no), description, images (separate links with |).</p>
      </details>

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setProducts((list) => (list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...list]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
