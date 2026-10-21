import { Link } from 'react-router-dom';
import { money } from '../lib/format.js';
import { useCart } from '../state/cart.jsx';
import { useToast } from '../state/toast.jsx';
import Icon from './Icon.jsx';
import QuantityStepper from './QuantityStepper.jsx';

export default function ProductCard({ product }) {
  const cart = useCart();
  const toast = useToast();
  const inCart = cart.quantityOf(product.id);
  const soldOut = product.stock === 0;
  const discount = product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  const add = () => {
    cart.add(product);
    toast(`Added ${product.name} to cart`, 'success');
  };

  return (
    <article className="card product-card">
      <Link to={`/product/${product.id}`} className="product-image">
        {product.images[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" /> : <div className="img-placeholder"><Icon name="box" size={40} /></div>}
        {discount > 0 && <span className="ribbon">-{discount}%</span>}
        {soldOut && <span className="ribbon ribbon-dark">Sold out</span>}
        {!soldOut && product.stock <= 5 && <span className="ribbon ribbon-amber">Only {product.stock} left</span>}
      </Link>
      <div className="product-body">
        <span className="product-category">{product.category}</span>
        <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>
        <div className="price-row">
          <strong className="price">{money(product.price)}</strong>
          {discount > 0 && <s className="price-old">{money(product.compareAtPrice)}</s>}
        </div>
        <div className="product-action">
          {inCart > 0 ? (
            <QuantityStepper value={inCart} max={product.stock} onChange={(q) => cart.setQuantity(product.id, q)} size="sm" />
          ) : (
            <button className="btn btn-primary btn-block" onClick={add} disabled={soldOut}>
              <Icon name="cart" size={18} /> {soldOut ? 'Sold out' : 'Add to cart'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
