import { Link } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext.jsx";
import { useProducts } from "../hooks/useProducts.js";
import ProductCard from "../components/ProductCard.jsx";

export default function Wishlist() {
  const { ids } = useWishlist();
  const { products, loading } = useProducts();
  const saved = products.filter((product) => ids.some((id) => String(id) === String(product.id)));

  return (
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Saved for later</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold">Your wishlist</h1>
      {loading ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl bg-purple-soft" />
      ) : saved.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {saved.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-[#e4acd0] bg-gradient-to-br from-[#fff1f7] to-[#f7f1ff] px-5 py-16 text-center">
          <p className="text-6xl">♡</p>
          <h2 className="mt-4 font-display text-2xl font-extrabold">Nothing saved yet</h2>
          <p className="mt-2 text-ink/65">Tap the heart on products you want to keep nearby.</p>
          <Link to="/" className="mt-6 inline-block rounded-full bg-purple-deep px-7 py-3 font-bold text-purple-tint">Browse products</Link>
        </div>
      )}
    </section>
  );
}
