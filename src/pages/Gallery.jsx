import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../hooks/useProducts.js";
import { formatKSh } from "../lib/format.js";

const categories = ["All", "Boys", "Girls", "Baby"];

function GalleryTile({ product }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = [product.image, ...(product.gallery || [])].filter(
    (image, index, all) => image && all.indexOf(image) === index
  );
  const activeImage = images[imageIndex];

  return (
    <article className="group overflow-hidden rounded-[1.7rem] border border-[#eaddea] bg-purple-tint transition-all hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(219,79,145,0.12)]">
      <Link to={`/product/${product.id}`} className="block">
        <div className={`relative aspect-[4/5] overflow-hidden ${product.tone || "bg-sky"}`}>
          {activeImage ? (
            <img src={activeImage} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center text-8xl" aria-hidden="true">{product.emoji || "👕"}</div>
          )}
          {product.stock <= 0 ? (
            <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">Sold out</span>
          ) : product.stock <= 5 ? (
            <span className="absolute left-3 top-3 rounded-full bg-purple-tint/95 px-3 py-1.5 text-xs font-bold">Almost gone</span>
          ) : null}
          <span className="absolute bottom-3 right-3 rounded-full bg-purple-tint/95 px-3 py-1.5 text-xs font-bold">
            {product.category || "Kids"}
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold leading-tight">{product.name}</h2>
            <p className="shrink-0 text-sm font-bold">{formatKSh(product.price)}</p>
          </div>
          <p className="mt-2 text-sm text-ink/60">{product.sizes?.length ? `Sizes ${product.sizes.join(" · ")}` : "One size"}</p>
          <p className="mt-3 text-sm font-bold text-purple-vivid">View outfit <span aria-hidden="true">→</span></p>
        </div>
      </Link>
      {images.length > 1 && (
        <div className="flex gap-2 px-4 pb-4 sm:px-5 sm:pb-5" aria-label={`${images.length} product photos`}>
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setImageIndex(index)}
              aria-label={`Show product photo ${index + 1}`}
              aria-pressed={imageIndex === index}
              className={`h-10 w-10 overflow-hidden rounded-lg border-2 ${imageIndex === index ? "border-purple-deep" : "border-transparent"}`}
            >
              <img src={image} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

export default function Gallery() {
  const { products, loading, error } = useProducts();
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState("All");
  const [search, setSearch] = useState("");

  const sizes = useMemo(
    () => ["All", ...new Set(products.flatMap((product) => product.sizes || []))],
    [products]
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) =>
      (category === "All" || product.category === category) &&
      (size === "All" || product.sizes?.includes(size)) &&
      (!query || product.name.toLowerCase().includes(query))
    );
  }, [products, category, size, search]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ffe8f1] to-[#f4efff] px-6 py-10 sm:px-10 sm:py-14">
        <span className="pointer-events-none absolute -right-4 -top-10 text-[12rem] opacity-10" aria-hidden="true">✿</span>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">The KZZ collection</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">Little looks, all in one place.</h1>
        <p className="mt-4 max-w-xl leading-7 text-ink/65">Browse the collection, explore each outfit and find their next favourite.</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" aria-label="Filter by collection">
          {categories.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={category === option}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${category === option ? "border-purple-deep bg-purple-deep text-purple-tint" : "border-purple-mid/70 bg-purple-tint hover:bg-purple-soft"}`}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="text-sm font-bold text-ink/55">{loading ? "Loading collection…" : `${visible.length} ${visible.length === 1 ? "outfit" : "outfits"}`}</p>
      </div>

      <div className="mt-4 grid gap-3 rounded-3xl border border-purple-mid/45 bg-purple-soft p-4 sm:grid-cols-[1fr_220px]">
        <label className="text-sm font-bold">
          Find an outfit
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          Size
          <select value={size} onChange={(event) => setSize(event.target.value)} className="mt-1.5 w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 font-normal">
            {sizes.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">We couldn’t load the collection. Please try again later.</p>}

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-3xl bg-purple-soft" />)}
        </div>
      ) : visible.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => <GalleryTile key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-purple-mid bg-purple-soft px-5 py-16 text-center">
          <p className="text-6xl" aria-hidden="true">🔎</p>
          <h2 className="mt-4 font-display text-2xl font-extrabold">No outfits match those filters</h2>
          <button type="button" onClick={() => { setCategory("All"); setSize("All"); setSearch(""); }} className="mt-5 rounded-full bg-purple-deep px-6 py-3 font-bold text-purple-tint">Clear filters</button>
        </div>
      )}
    </section>
  );
}
