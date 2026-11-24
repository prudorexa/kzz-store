import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { Link } from "react-router-dom";
import { formatKSh } from "../lib/format.js";

export default function ProductCard({ product, index = 0 }) {
  const { addItem } = useCart();
  const { isSaved, toggle } = useWishlist();
  const [size, setSize] = useState(product.sizes[0]);
  const [color, setColor] = useState(product.colors?.[0] || "");
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const timer = useRef();

  useEffect(() => () => clearTimeout(timer.current), []);

  const soldOut = product.stock <= 0;
  const showImage = product.image && !imageFailed;

  function handleAdd() {
    addItem(product, size, color);
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <article
      style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
      className="pop-in group flex flex-col overflow-hidden rounded-[1.5rem] border border-[#eaddea] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(219,79,145,0.12)]"
    >
      <div className={`relative grid aspect-[4/4.2] place-items-center overflow-hidden ${product.tone || "bg-sky"}`}>
        {showImage ? (
          <Link to={`/product/${product.id}`} aria-label={`View ${product.name}`} className="block h-full w-full">
            <img
              src={product.image}
              alt={product.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          </Link>
        ) : (
          <span className="text-7xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" role="img" aria-label={product.name}>
            {product.emoji || "👕"}
          </span>
        )}
        {soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">
            Sold out
          </span>
        )}
        {!soldOut && (
          <span className="absolute right-3 top-3 rounded-full border border-purple-mid/50 bg-purple-tint/95 px-3 py-1.5 text-xs font-bold backdrop-blur">
            {product.category || "Kids"}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggle(product)}
          aria-pressed={isSaved(product)}
          aria-label={isSaved(product) ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-purple-mid/50 bg-purple-tint/95 text-xl shadow-sm"
        >
          {isSaved(product) ? "♥" : "♡"}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-extrabold leading-tight sm:text-xl">
            <Link to={`/product/${product.id}`} className="hover:text-purple-vivid">{product.name}</Link>
          </h3>
          <p className="shrink-0 text-sm font-bold">{formatKSh(product.price)}</p>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-ink/70">Size</legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={`rounded-full border border-ink/15 px-3 py-1 text-sm font-bold transition-colors ${
                  size === s ? "bg-purple-deep text-purple-tint" : "bg-purple-soft hover:bg-purple-mid/60"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        {product.colors?.length > 0 && (
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm text-ink/70">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-pressed={color === option}
                  className={`rounded-full border px-3 py-1 text-sm font-bold transition-colors ${
                    color === option ? "border-purple-deep bg-purple-deep text-purple-tint" : "border-ink/15 bg-purple-soft hover:bg-purple-mid/60"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <p className="mt-4 text-sm text-ink/60">
          {soldOut ? "Out of stock" : product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} in stock`}
        </p>

        <button
          onClick={handleAdd}
          disabled={soldOut}
          className="mt-4 rounded-full bg-purple-deep py-3 font-bold text-purple-tint transition-colors hover:bg-purple-vivid disabled:cursor-not-allowed disabled:bg-ink/25 disabled:hover:bg-ink/25 disabled:hover:text-white"
        >
          {soldOut ? "Sold out" : added ? "Added ✓" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}
