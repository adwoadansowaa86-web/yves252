import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { money } from '../lib/format.js';
import { useCart } from '../state/cart.jsx';
import { useStore } from '../state/store.jsx';
import CartDrawer from './CartDrawer.jsx';
import Icon from './Icon.jsx';

function CartButton() {
  const cart = useCart();
  const [pop, setPop] = useState(false);
  useEffect(() => {
    if (!cart.bump) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(t);
  }, [cart.bump]);
  return (
    <button className={`cart-btn ${pop ? 'pop' : ''}`} onClick={() => cart.setOpen(true)} aria-label={`Open cart, ${cart.count} items`}>
      <Icon name="cart" />
      {cart.count > 0 && <span className="cart-count">{cart.count}</span>}
    </button>
  );
}

export default function Layout() {
  const { store } = useStore();
  const cart = useCart();
  const { pathname } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  const showCartBar = cart.count > 0 && !pathname.startsWith('/checkout') && !pathname.startsWith('/order');

  return (
    <div className="app">
      <div className="kente-strip" />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark"><img src="/favicon.svg" alt="" /></span>
            <span>{store?.storeName ?? 'Shop'}</span>
          </Link>
          <nav className="main-nav">
            <NavLink to="/" end>Shop</NavLink>
            <NavLink to="/track">Track order</NavLink>
            <NavLink to="/contact">Help</NavLink>
          </nav>
          <CartButton />
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <strong>{store?.storeName}</strong>
            <p className="muted">{store?.tagline}</p>
          </div>
          <div>
            <strong>Contact</strong>
            {store?.phone && <p><a href={`tel:${store.phone.replace(/\s/g, '')}`}>{store.phone}</a></p>}
            {store?.email && <p><a href={`mailto:${store.email}`}>{store.email}</a></p>}
          </div>
          <div>
            <strong>We accept</strong>
            <div className="pay-logos">
              <span>MTN MoMo</span><span>Telecel Cash</span><span>AT Money</span><span>Visa / Mastercard</span>
            </div>
            <p className="muted small">Secure payments powered by Hubtel</p>
          </div>
        </div>
      </footer>

      {store?.whatsapp && (
        <a className={`whatsapp-fab ${showCartBar ? 'raised' : ''}`} href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp">
          <Icon name="chat" size={26} />
        </a>
      )}

      {showCartBar && (
        <button className="mobile-cart-bar" onClick={() => cart.setOpen(true)}>
          <span><Icon name="cart" size={18} /> {cart.count} item{cart.count === 1 ? '' : 's'}</span>
          <strong>View cart · {money(cart.subtotal)}</strong>
        </button>
      )}

      <CartDrawer />
    </div>
  );
}
