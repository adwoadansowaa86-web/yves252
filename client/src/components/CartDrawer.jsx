import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money } from '../lib/format.js';
import { useCart } from '../state/cart.jsx';
import { useStore } from '../state/store.jsx';
import Icon from './Icon.jsx';
import QuantityStepper from './QuantityStepper.jsx';

export function FreeDeliveryBar({ subtotal }) {
  const { store } = useStore();
  const target = store?.freeDeliveryOver;
  if (!target) return null;
  const remaining = target - subtotal;
  const pct = Math.min(100, Math.round((subtotal / target) * 100));
  return (
    <div className="free-delivery">
      <p>
        {remaining > 0 ? (
          <>Add <strong>{money(remaining)}</strong> more for <strong>free delivery</strong></>
        ) : (
          <><Icon name="check" size={16} /> You get <strong>free delivery!</strong></>
        )}
      </p>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cart.open) return;
    const onKey = (e) => e.key === 'Escape' && cart.setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [cart.open]);

  return (
    <div className={`drawer-root ${cart.open ? 'is-open' : ''}`} aria-hidden={!cart.open}>
      <div className="drawer-backdrop" onClick={() => cart.setOpen(false)} />
      <aside className="drawer" role="dialog" aria-label="Your cart" aria-modal="true">
        <header className="drawer-header">
          <h2>Your cart {cart.count > 0 && <span className="muted">({cart.count})</span>}</h2>
          <button className="icon-btn" onClick={() => cart.setOpen(false)} aria-label="Close cart">
            <Icon name="close" />
          </button>
        </header>

        {cart.items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="cart" size={36} /></div>
            <h3>Your cart is empty</h3>
            <p className="muted">Browse the shop and tap "Add to cart" on anything you like.</p>
            <button className="btn btn-primary" onClick={() => cart.setOpen(false)}>Start shopping</button>
          </div>
        ) : (
          <>
            <FreeDeliveryBar subtotal={cart.subtotal} />
            <ul className="cart-lines">
              {cart.items.map(({ product, quantity }) => (
                <li key={product.id} className="cart-line">
                  <Link to={`/product/${product.id}`} onClick={() => cart.setOpen(false)} className="cart-thumb">
                    {product.images[0] && <img src={product.images[0]} alt="" />}
                  </Link>
                  <div className="cart-line-info">
                    <Link to={`/product/${product.id}`} onClick={() => cart.setOpen(false)} className="cart-line-name">{product.name}</Link>
                    <span className="muted small">{money(product.price)} each</span>
                    <QuantityStepper value={quantity} max={product.stock} onChange={(q) => cart.setQuantity(product.id, q)} size="sm" />
                  </div>
                  <strong>{money(product.price * quantity)}</strong>
                </li>
              ))}
            </ul>
            <footer className="drawer-footer">
              <div className="total-row">
                <span>Subtotal</span>
                <strong>{money(cart.subtotal)}</strong>
              </div>
              <p className="muted small">Delivery is calculated at checkout.</p>
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={() => {
                  cart.setOpen(false);
                  navigate('/checkout');
                }}
              >
                Checkout · {money(cart.subtotal)}
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => cart.setOpen(false)}>Continue shopping</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
