
import { Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import Shop from "./pages/Shop.jsx";
import WhatsAppButton from "./components/WhatsAppButton.jsx";

const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const Gallery = lazy(() => import("./pages/Gallery.jsx"));
const OrderTracking = lazy(() => import("./pages/OrderTracking.jsx"));
const MyOrders = lazy(() => import("./pages/MyOrders.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function RouteFallback() {
  return <p role="status" className="py-20 text-center text-sm text-ink/60">Loading…</p>;
}

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (pathname === "/admin") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Admin />
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Shop />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/track/:orderNumber" element={<OrderTracking />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </div>
  );
}
