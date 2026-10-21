import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AdminApp from './pages/admin/AdminApp.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Orders from './pages/admin/Orders.jsx';
import Products from './pages/admin/Products.jsx';
import Requests from './pages/admin/Requests.jsx';
import Settings from './pages/admin/Settings.jsx';
import Checkout from './pages/Checkout.jsx';
import Contact from './pages/Contact.jsx';
import NotFound from './pages/NotFound.jsx';
import OrderPage from './pages/OrderPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import Shop from './pages/Shop.jsx';
import TestPay from './pages/TestPay.jsx';
import Track from './pages/Track.jsx';
import { CartProvider } from './state/cart.jsx';
import { StoreProvider } from './state/store.jsx';

function Storefront() {
  return (
    <StoreProvider>
      <CartProvider>
        <Layout />
      </CartProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminApp />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="requests" element={<Requests />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route element={<Storefront />}>
        <Route index element={<Shop />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/:reference" element={<OrderPage />} />
        <Route path="pay/test/:reference" element={<TestPay />} />
        <Route path="track" element={<Track />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
