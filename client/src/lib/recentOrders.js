const KEY = 'shop-recent-orders';

export const recentOrders = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? [];
    } catch {
      return [];
    }
  },
  add(reference) {
    try {
      const next = [reference, ...this.list().filter((r) => r !== reference)].slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },
};
