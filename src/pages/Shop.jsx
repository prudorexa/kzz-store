import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useProducts } from "../hooks/useProducts.js";
import { useCart } from "../context/CartContext.jsx";

const categories = ["All", "Boys", "Girls", "Baby"];

function Skeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-3xl border border-purple-mid/40 bg-purple-tint">
      <div className="aspect-square bg-ink/10" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 rounded bg-ink/10" />
        <div className="h-4 w-1/3 rounded bg-ink/10" />
        <div className="h-10 rounded-full bg-ink/10" />
      </div>
    </div>
  );
}

export default function Shop() {
  const { products, loading, usingSample, error } = useProducts();
  const { reconcileStock } = useCart();
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "All";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [size, setSize] = useState("All");
  const [availability, setAvailability] = useState("All");

  useEffect(() => {
    if (params.get("category")) {
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [params]);

  useEffect(() => {
    if (!loading && products.length) reconcileStock(products);
  }, [loading, products]);

  const allSizes = useMemo(
    () => ["All", ...new Set(products.flatMap((product) => product.sizes || []))],
    [products]
  );

  const visible = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesSearch = product.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesSize = size === "All" || product.sizes?.includes(size);
      const matchesAvailability =
        availability === "All" ||
        (availability === "In stock" ? product.stock > 0 : product.stock <= 0);
      return matchesCategory && matchesSearch && matchesSize && matchesAvailability;
    });

    if (sort === "price-low") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-high") return [...filtered].sort((a, b) => b.price - a.price);
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [products, category, search, size, availability, sort]);
  const hasCategories = products.some((p) => p.category);

  function pick(c) {
    if (c === "All") setParams({});
    else setParams({ category: c });
  }

  return (
    <>
      <Hero products={products} />

      <section id="shop" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14 sm:px-8">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Fresh picks</p>
            <h2 className="font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
              {category === "All" ? "Shop the favourites" : `${category} collection`}
            </h2>
          </div>

          {hasCategories && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => pick(c)}
                  aria-pressed={category === c}
                  className={`rounded-full border border-ink/15 px-4 py-1.5 text-sm font-bold transition-colors ${
                    category === c ? "bg-purple-deep text-purple-tint" : "bg-purple-tint hover:bg-purple-soft"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-7 grid gap-3 rounded-3xl border border-[#efc5d7] bg-gradient-to-br from-[#fff5f9] to-[#f5efff] p-4 shadow-[0_12px_35px_rgba(219,79,145,0.07)] sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or style"
              className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-3 py-2.5 font-normal"
            />
          </label>
          <label className="text-sm font-bold">
            Size
            <select value={size} onChange={(event) => setSize(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-3 py-2.5 font-normal">
              {allSizes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Availability
            <select value={availability} onChange={(event) => setAvailability(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-3 py-2.5 font-normal">
              {["All", "In stock", "Sold out"].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-3 py-2.5 font-normal">
              <option value="featured">Featured</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </label>
        </div>

        {import.meta.env.DEV && usingSample && !loading && (
          <p className="mb-6 rounded-2xl border border-dashed border-purple-mid bg-purple-soft px-4 py-3 text-sm">
            Demo catalog: configure Supabase to load your live products.
          </p>
        )}

        {error && (
          <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            We couldn’t load products right now. Please try again later.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} />)
            : visible.map((p, index) => <ProductCard key={p.id} product={p} index={index} />)}
        </div>

        {!loading && visible.length === 0 && (
          <p className="py-16 text-center text-ink/60">Nothing in this category yet. Check back soon.</p>
        )}
      </section>
    </>
  );
}
