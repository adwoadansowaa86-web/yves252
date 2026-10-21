import { randomUUID } from 'node:crypto';

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const product = (name, category, cedis, stock, description, extra = {}) => {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name,
    category,
    price: Math.round(cedis * 100),
    compareAtPrice: null,
    stock,
    description,
    images: [img(name.toLowerCase().replace(/\W+/g, '-'))],
    active: true,
    featured: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
};

// Starter data so the shop looks alive on first run. Edit or delete these
// from the admin dashboard.
export function seedData() {
  return {
    settings: {
      storeName: 'Akwaaba Market',
      tagline: 'Quality goods, delivered across Ghana',
      phone: '+233 20 000 0000',
      whatsapp: '233200000000',
      email: 'hello@example.com',
      deliveryZones: [
        { region: 'Greater Accra', fee: 3000 },
        { region: 'Ashanti', fee: 5000 },
        { region: 'Central', fee: 5000 },
        { region: 'Eastern', fee: 5000 },
        { region: 'Western', fee: 6000 },
        { region: 'Volta', fee: 6000 },
        { region: 'Northern', fee: 8000 },
        { region: 'Other regions', fee: 8000 },
      ],
      freeDeliveryOver: 100000,
      pickupEnabled: true,
      pickupAddress: 'Osu, Oxford Street, Accra',
      codEnabled: true,
      lowStockThreshold: 5,
    },
    products: [
      product('Kente Stole', 'Fashion', 250, 12, 'Hand-woven kente stole from Bonwire. Perfect for graduations and special occasions.', { featured: true, compareAtPrice: 30000 }),
      product('Ankara Print Shirt', 'Fashion', 180, 20, 'Tailored short-sleeve shirt in bold Ankara print. Available in M, L and XL.'),
      product('Shea Butter (500g)', 'Beauty', 65, 40, 'Pure unrefined shea butter from Northern Ghana. Great for skin and hair.', { featured: true }),
      product('Black Soap', 'Beauty', 35, 50, 'Traditional alata samina black soap made with plantain skin ash and palm kernel oil.'),
      product('Gari (2kg)', 'Groceries', 40, 60, 'Fine, crunchy gari. Perfect for soakings or eba.'),
      product('Shito (Hot, 450g)', 'Groceries', 55, 3, 'Homemade black pepper sauce with dried fish and shrimp. Spicy!', { featured: true }),
      product('Bolga Basket', 'Home', 320, 8, 'Hand-woven straw basket from Bolgatanga with leather handles.', { featured: true }),
      product('Adinkra Wall Art', 'Home', 150, 15, 'Carved wooden Adinkra symbol wall piece: Gye Nyame.'),
    ],
    orders: [],
    requests: [],
  };
}
