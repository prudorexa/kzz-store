import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-5 py-20 text-center">
      <p className="text-7xl" aria-hidden="true">🔎</p>
      <h1 className="mt-4 font-display text-4xl font-extrabold">Page not found</h1>
      <p className="mt-3 leading-7 text-ink/70">This link may be incorrect or the page may have moved.</p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-purple-deep px-8 py-4 font-bold text-purple-tint hover:bg-purple-vivid">
        Back to the shop
      </Link>
    </section>
  );
}
