import { useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../state/toast.jsx';

const cedis = (pesewas) => (pesewas === null || pesewas === undefined ? '' : (pesewas / 100).toFixed(2));

export default function ProductEditor({ product, categories, onClose, onSaved }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    category: product?.category ?? '',
    price: cedis(product?.price),
    compareAtPrice: cedis(product?.compareAtPrice),
    stock: product?.stock ?? 0,
    description: product?.description ?? '',
    images: product?.images ?? [],
    active: product?.active ?? true,
    featured: product?.featured ?? false,
  });
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const upload = async (files) => {
    if (!files.length) return;
    const data = new FormData();
    [...files].forEach((f) => data.append('images', f));
    setUploading(true);
    try {
      const { urls } = await api('/admin/uploads', { method: 'POST', body: data });
      setForm((f) => ({ ...f, images: [...f.images, ...urls].slice(0, 8) }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addUrl = () => {
    if (!/^https?:\/\//.test(imageUrl)) return toast('Image links must start with http:// or https://', 'error');
    setForm((f) => ({ ...f, images: [...f.images, imageUrl].slice(0, 8) }));
    setImageUrl('');
  };

  const moveImage = (index, dir) => {
    setForm((f) => {
      const images = [...f.images];
      const [img] = images.splice(index, 1);
      images.splice(index + dir, 0, img);
      return { ...f, images };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...form, stock: Number(form.stock), compareAtPrice: form.compareAtPrice === '' ? null : form.compareAtPrice };
    try {
      const saved = product
        ? await api(`/admin/products/${product.id}`, { method: 'PATCH', body })
        : await api('/admin/products', { method: 'POST', body });
      toast(product ? 'Product updated' : 'Product added', 'success');
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={product ? 'Edit product' : 'Add product'}>
      <div className="drawer-backdrop" onClick={onClose} />
      <form className="modal card" onSubmit={save}>
        <header className="drawer-header">
          <h2>{product ? 'Edit product' : 'Add a product'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        <div className="modal-body field-grid">
          <label className="field span-2">
            <span>Product name</span>
            <input required value={form.name} onChange={set('name')} autoFocus />
          </label>
          <label className="field">
            <span>Price (GH₵)</span>
            <input required type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={set('price')} />
          </label>
          <label className="field">
            <span>Old price (GH₵) <em className="muted">optional, shows a discount</em></span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={form.compareAtPrice} onChange={set('compareAtPrice')} />
          </label>
          <label className="field">
            <span>Quantity in stock</span>
            <input required type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={set('stock')} />
          </label>
          <label className="field">
            <span>Category</span>
            <input list="category-list" value={form.category} onChange={set('category')} placeholder="e.g. Fashion" />
            <datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field span-2">
            <span>Description</span>
            <textarea rows={4} value={form.description} onChange={set('description')} placeholder="Size, material, what's included…" />
          </label>

          <div className="field span-2">
            <span>Photos <em className="muted">(the first one is the main photo)</em></span>
            <div className="image-grid">
              {form.images.map((src, i) => (
                <div key={src + i} className="image-tile">
                  <img src={src} alt="" />
                  <div className="image-tile-actions">
                    {i > 0 && <button type="button" onClick={() => moveImage(i, -1)} aria-label="Move left"><Icon name="back" size={14} /></button>}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} aria-label="Remove photo"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              ))}
              <button type="button" className="image-add" onClick={() => fileInput.current?.click()} disabled={uploading}>
                <Icon name="upload" /> {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
            <div className="inline-form">
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="…or paste an image link" />
              <button type="button" className="btn btn-outline" onClick={addUrl} disabled={!imageUrl}>Add link</button>
            </div>
          </div>

          <label className="toggle">
            <input type="checkbox" checked={form.active} onChange={set('active')} />
            <span className="switch" /> Visible in shop
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.featured} onChange={set('featured')} />
            <span className="switch" /> Featured (shown first)
          </label>
        </div>
        <footer className="modal-footer">
          {error && <p className="alert">{error}</p>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || uploading}>{busy ? 'Saving…' : 'Save product'}</button>
        </footer>
      </form>
    </div>
  );
}
