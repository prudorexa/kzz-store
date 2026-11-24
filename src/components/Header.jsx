import { Link, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";

const links = [
  { label: "Shop", to: "/", category: null },
  { label: "Gallery", to: "/gallery", category: null },
  { label: "Boys", to: "/?category=Boys", category: "Boys" },
  { label: "Girls", to: "/?category=Girls", category: "Girls" },
  { label: "Baby", to: "/?category=Baby", category: "Baby" },
  { label: "My orders", to: "/my-orders", category: null },
  { label: "Contact", to: "/contact", category: null },
];

function NavLinks({ pathname, current, className, itemClass }) {
  return (
    <nav className={className} aria-label="Main">
      {links.map((l) => {
        const active = l.to === "/gallery"
          ? pathname === "/gallery"
          : l.to === "/my-orders"
            ? pathname === "/my-orders"
                  : l.to === "/contact"
                    ? pathname === "/contact"
                  : pathname === "/" && current === l.category;
        return (
          <Link
            key={l.label}
            to={l.to}
            className={`${itemClass} ${active ? "bg-purple-deep text-purple-tint" : "text-ink/75 hover:bg-purple-tint hover:text-ink"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Header() {
  const { count, openCart } = useCart();
  const { ids } = useWishlist();
  const { pathname, search } = useLocation();
  const current = new URLSearchParams(search).get("category");

  return (
    <header className="sticky top-0 z-30 border-b border-[#efbdd1]/70 bg-[#fffafd]/95 text-ink shadow-[0_6px_24px_rgba(219,79,145,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/kzz-kids-logo.png"
            alt="KZZ Kids Luxe"
            className="h-12 w-12 rounded-full object-contain sm:h-14 sm:w-14"
          />
          <span className="leading-tight">
            <span className="block font-display text-sm font-extrabold uppercase tracking-[0.1em] sm:text-base">KZZ Kids Luxe</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-ink/60 sm:block">Little wardrobes</span>
          </span>
        </Link>

        <NavLinks
          pathname={pathname}
          current={current}
          className="hidden items-center gap-1 rounded-full bg-purple-tint/80 p-1 lg:flex"
          itemClass="rounded-full px-4 py-2 text-sm font-bold transition-colors"
        />

        <div className="flex items-center gap-2">
          <Link
            to="/wishlist"
            className="grid h-10 w-10 place-items-center rounded-full border border-purple-mid/60 text-lg transition-colors hover:bg-purple-tint"
            aria-label={`Open wishlist, ${ids.length} items`}
          >
            <span aria-hidden="true">♡</span>
            {ids.length > 0 && <span className="sr-only">{ids.length} saved items</span>}
          </Link>
          <button
            onClick={openCart}
            className="flex items-center gap-2 rounded-full bg-purple-deep px-4 py-2.5 text-sm font-bold text-purple-tint transition-colors hover:bg-purple-vivid"
            aria-label={`Open cart, ${count} items`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-current" strokeWidth="1.8">
              <path d="M5 8h14l1 13H4L5 8Z" strokeLinejoin="round" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round" />
            </svg>
            <span>Bag</span>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-purple-mid px-1.5 text-xs text-purple-deep">
              {count}
            </span>
          </button>
        </div>
      </div>

      <NavLinks
        pathname={pathname}
        current={current}
        className="flex gap-2 overflow-x-auto px-5 pb-3 lg:hidden"
        itemClass="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors"
      />
    </header>
  );
}
