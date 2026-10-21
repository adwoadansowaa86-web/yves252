import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useStore } from './store.jsx';

const CartContext = createContext(null);
const KEY = 'shop-cart-v1';

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * The cart only stores product ids and quantities. Names, prices and stock
 * always come from the live catalogue so customers never see stale prices.
 */
export function CartProvider({ children }) {
  const { products } = useStore();
  const [lines, setLines] = useState(load);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage full or blocked: cart still works for this visit */
    }
  }, [lines]);

  const items = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return lines
      .map((l) => ({ product: byId.get(l.productId), quantity: l.quantity }))
      .filter((l) => l.product && l.product.stock > 0)
      .map((l) => ({ ...l, quantity: Math.min(l.quantity, l.product.stock) }));
  }, [lines, products]);

  const setQuantity = useCallback((productId, quantity) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((l) => l.productId !== productId);
      const exists = current.some((l) => l.productId === productId);
      return exists
        ? current.map((l) => (l.productId === productId ? { ...l, quantity } : l))
        : [...current, { productId, quantity }];
    });
  }, []);

  const add = useCallback(
    (product, quantity = 1) => {
      const inCart = lines.find((l) => l.productId === product.id)?.quantity ?? 0;
      const next = Math.min(product.stock, inCart + quantity);
      setQuantity(product.id, next);
      setBump((b) => b + 1);
      return next > inCart;
    },
    [lines, setQuantity],
  );

  const quantityOf = useCallback((id) => items.find((i) => i.product.id === id)?.quantity ?? 0, [items]);

  const value = {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((n, i) => n + i.quantity * i.product.price, 0),
    add,
    setQuantity,
    remove: (id) => setQuantity(id, 0),
    clear: () => setLines([]),
    quantityOf,
    open,
    setOpen,
    bump,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
