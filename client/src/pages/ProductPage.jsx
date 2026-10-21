import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ProductCard from '../components/ProductCard.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';
import { money } from '../lib/format.js';
import { useCart } from '../state/cart.jsx';
import { useStore } from '../state/store.jsx';
import { useToast } from '../state/toast.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { products, loading } = useStore();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const product = products.find((p) => p.id === id);
  if (loading) return <div className="container page"><div className="card skeleton tall" /></div>;
  if (!product) {
    return (
      <div className="container page empty-state">
        <h2>Product not found</h2>
        <p className="muted">It may have been removed or sold out.</p>
        <Link to="/" className="btn btn-primary">Back to shop</Link>
      </div>
    );
  }

  const inCart = cart.quantityOf(product.id);
  const available = product.stock - inCart;
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  const add = (goToCheckout) => {
    cart.add(product, Math.min(quantity, available));
    toast(`Added ${product.name} to cart`, 'success');
    setQuantity(1);
    if (goToCheckout) navigate('/checkout');
  };

  return (
    <div className="container page">
      <button className="btn btn-ghost back" onClick={() => navigate(-1)}><Icon name="back" size={18} /> Back</button>
      <div className="product-detail">
        <div className="gallery">
          <div className="gallery-main">
            {product.images[imageIndex] ? <img src={product.images[imageIndex]} alt={product.name} /> : <div className="img-placeholder"><Icon name="box" size={56} /></div>}
          </div>
          {product.images.length > 1 && (
            <div className="gallery-thumbs">
              {product.images.map((src, i) => (
                <button key={src} className={i === imageIndex ? 'active' : ''} onClick={() => setImageIndex(i)} aria-label={`Image ${i + 1}`}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <span className="product-category">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="price-row big">
            <strong className="price">{money(product.price)}</strong>
            {product.compareAtPrice > product.price && <s className="price-old">{money(product.compareAtPrice)}</s>}
          </div>
          <p className={`stock-note ${product.stock === 0 ? 'out' : product.stock <= 5 ? 'low' : ''}`}>
            {product.stock === 0 ? 'Sold out' : product.stock <= 5 ? `Hurry, only ${product.stock} left` : 'In stock'}
          </p>
          <p className="description">{product.description}</p>

          {product.stock > 0 && (
            <div className="buy-box">
              {available > 0 ? (
                <>
                  <QuantityStepper value={quantity} max={available} onChange={(q) => setQuantity(Math.max(1, q))} />
                  <button className="btn btn-primary btn-lg" onClick={() => add(false)}><Icon name="cart" size={18} /> Add to cart</button>
                  <button className="btn btn-gold btn-lg" onClick={() => add(true)}>Buy now</button>
                </>
              ) : (
                <p className="muted">You have all {product.stock} in your cart.</p>
              )}
              {inCart > 0 && <button className="btn btn-link" onClick={() => cart.setOpen(true)}>{inCart} in your cart, view cart</button>}
            </div>
          )}
          {product.stock === 0 && (
            <Link className="btn btn-outline" to={`/contact?type=product_request&message=${encodeURIComponent(`Please let me know when "${product.name}" is back in stock.`)}`}>
              Notify me when it's back
            </Link>
          )}

          <ul className="assurances">
            <li><Icon name="shield" size={18} /> Pay with MoMo or card via Hubtel</li>
            <li><Icon name="truck" size={18} /> Delivery across Ghana</li>
            <li><Icon name="chat" size={18} /> Questions? <Link to="/contact">Message us</Link></li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <h2>You may also like</h2>
          <div className="grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
