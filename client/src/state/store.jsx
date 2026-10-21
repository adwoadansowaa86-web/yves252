import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const StoreContext = createContext(null);

/** Shop details and the product catalogue, shared across the storefront. */
export function StoreProvider({ children }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api('/store'), api('/products')]);
      setStore(s);
      setProducts(p);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (store?.storeName) document.title = store.storeName;
  }, [store?.storeName]);

  return (
    <StoreContext.Provider value={{ store, products, loading, error, refresh }}>{children}</StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);
