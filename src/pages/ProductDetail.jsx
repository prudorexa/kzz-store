import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { useProducts } from "../hooks/useProducts.js";
import { formatKSh } from "../lib/format.js";
import { WHATSAPP_NUMBER } from "../lib/contact.js";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { addItem } = useCart();
  const { isSaved, toggle } = useWishlist();
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [added, setAdded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [selectedImage, setSelectedImage] = useState("");

  const product = products.find((item) => String(item.id) === String(id));

  useEffect(() => {
    if (product?.sizes?.length) setSize(product.sizes[0]);
    setColor(product?.colors?.[0] || "");
  }, [product]);

  useEffect(() => setImageFailed(false), [product?.id]);
  useEffect(() => {
    if (product) setSelectedImage(product.image || product.gallery?.[0] || "");
  }, [product]);

  if (loading) {
    return <section className="mx-auto max-w-7xl px-5 py-16"><div className="h-96 animate-pulse rounded-3xl bg-purple-soft" /></section>;
  }

  if (!product) {
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-7xl" aria-hidden="true">🔎</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold">Product not found</h1>
        <button onClick={() => navigate(-1)} className="mt-7 rounded-full bg-purple-deep px-7 py-3 font-bold text-purple-tint">Go back</button>
      </section>
    );
  }

  const soldOut = product.stock <= 0;
  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const gallery = [product.image, ...(product.gallery || [])].filter(
    (image, index, images) => image && images.indexOf(image) === index
  );

  function handleAdd() {
    if (!size || (product.colors?.length && !color) || soldOut) return;
    addItem(product, size, color);
    setAdded(true);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link to="/" className="mb-7 inline-flex text-sm font-bold text-ink/65 hover:text-ink">← Back to shop</Link>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className={`grid min-h-[420px] place-items-center overflow-hidden rounded-[2rem] ${product.tone || "bg-sky"}`}>
            {selectedImage && !imageFailed ? (
              <img src={selectedImage} alt={product.name} onError={() => setImageFailed(true)} className="h-full max-h-[650px] w-full object-cover" />
            ) : (
              <span className="text-[9rem]" role="img" aria-label={product.name}>{product.emoji || "👕"}</span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {gallery.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => { setSelectedImage(image); setImageFailed(false); }}
                  aria-label={`View image ${index + 1} of ${product.name}`}
                  aria-pressed={selectedImage === image}
                  className={`aspect-square overflow-hidden rounded-2xl border-2 ${selectedImage === image ? "border-purple-deep" : "border-transparent"}`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="py-2 lg:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">{product.category}</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{product.name}</h1>
          <p className="mt-5 font-display text-3xl font-extrabold">{formatKSh(product.price)}</p>
          <p className="mt-3 text-sm font-bold text-ink/60">{soldOut ? "Currently sold out" : product.stock <= 5 ? `Only ${product.stock} left` : `${product.stock} in stock`}</p>

          <fieldset className="mt-8">
            <legend className="mb-3 font-bold">Choose size</legend>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((option) => (
                <button key={option} type="button" onClick={() => setSize(option)} aria-pressed={size === option} className={`rounded-full border px-5 py-2.5 text-sm font-bold ${size === option ? "border-purple-deep bg-purple-deep text-purple-tint" : "border-purple-mid/70 hover:bg-purple-soft"}`}>
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          {product.colors?.length > 0 && (
            <fieldset className="mt-6">
              <legend className="mb-3 font-bold">Choose colour</legend>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((option) => (
                  <button key={option} type="button" onClick={() => setColor(option)} aria-pressed={color === option} className={`rounded-full border px-5 py-2.5 text-sm font-bold ${color === option ? "border-purple-deep bg-purple-deep text-purple-tint" : "border-purple-mid/70 hover:bg-purple-soft"}`}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-8 flex gap-3">
            <button onClick={handleAdd} disabled={soldOut} className="flex-1 rounded-full bg-purple-deep py-4 font-bold text-purple-tint hover:bg-purple-vivid disabled:bg-ink/25">
              {soldOut ? "Sold out" : added ? "Added to cart ✓" : "Add to cart"}
            </button>
            <button type="button" onClick={() => toggle(product)} aria-pressed={isSaved(product)} className="grid h-14 w-14 place-items-center rounded-full border border-purple-mid text-xl">
              {isSaved(product) ? "♥" : "♡"}
            </button>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-purple-mid/50 bg-purple-soft p-5 text-sm leading-6">
            {product.description && <p>{product.description}</p>}
            {product.careInstructions && <p><strong>Care:</strong> {product.careInstructions}</p>}
            {product.sizeGuide && <p><strong>Size guide:</strong> {product.sizeGuide}</p>}
            {!product.description && <p><strong>Comfort first:</strong> Easy-to-wear fabric and colours made for everyday play.</p>}
            <p><strong>Delivery:</strong> 1–3 working days in Nairobi, 2–5 days in other counties.</p>
            <p><strong>Fit:</strong> Choose the closest age size or size up for a comfortable fit.</p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi KZZ! I have a question about ${product.name}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#168b47] underline"
          >
            Ask about this outfit on WhatsApp
          </a>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-3xl font-extrabold">You may also like</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`} className={`group rounded-3xl border border-purple-mid/40 p-4 ${item.tone || "bg-sky"}`}>
                <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl">
                  {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <span className="text-6xl">{item.emoji}</span>}
                </div>
                <p className="mt-3 font-display font-extrabold">{item.name}</p>
                <p className="mt-1 text-sm font-bold">{formatKSh(item.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
