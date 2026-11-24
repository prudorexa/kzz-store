import { Link } from "react-router-dom";
import { WHATSAPP_NUMBER } from "../lib/contact.js";
import {
  BUSINESS_DESCRIPTION,
  BUSINESS_LOCATION,
  BUSINESS_PICKUP_DELIVERY,
} from "../lib/business.js";

const links = [
  { label: "Shop all", to: "/" },
  { label: "Gallery", to: "/gallery" },
  { label: "Boys", to: "/?category=Boys" },
  { label: "Girls", to: "/?category=Girls" },
  { label: "Baby", to: "/?category=Baby" },
  { label: "My orders", to: "/my-orders" },
  { label: "Contact us", to: "/contact" },
];

export default function Footer() {
  return (
    <footer className="mt-16 px-3 pb-3 text-purple-tint sm:px-5 sm:pb-5">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#792aaf] via-[#6d28d9] to-[#a855f7] px-6 py-10 shadow-[0_18px_50px_rgba(109,40,217,0.16)] sm:px-10 sm:py-12">
        <span className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[#ffbdd7]/25" aria-hidden="true" />
        <span className="pointer-events-none absolute bottom-[-5rem] left-[38%] h-36 w-36 rounded-full bg-[#ffffff]/10" aria-hidden="true" />

        <div className="relative grid gap-8 lg:grid-cols-[1.5fr_0.8fr_1fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 p-1 shadow-lg">
                <img src="/kzz-kids-logo.png" alt="KZZ Kids Luxe" className="h-full w-full rounded-full object-contain" />
              </span>
              <span>
                <span className="block font-display text-xl font-extrabold">KZZ Kids Luxe</span>
                <span className="mt-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#ffd9e8]">Little wardrobes, big joy</span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/80">{BUSINESS_DESCRIPTION}</p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ffdfeb] px-5 py-2.5 text-sm font-bold text-purple-deep transition-transform hover:-translate-y-0.5"
            >
              <span aria-hidden="true">♡</span> Chat with us
            </a>
          </div>

          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#ffd9e8]">Explore</h2>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-1" aria-label="Footer">
              {links.map((link) => (
                <Link key={link.label} to={link.to} className="w-fit text-white/85 transition-colors hover:text-white hover:underline">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffd9e8]">Visit & deliver</p>
            <p className="mt-3 text-sm leading-6 text-white/85">{BUSINESS_LOCATION}, Kenya.</p>
            <p className="mt-2 text-sm font-bold text-[#ffeaf3]">{BUSINESS_PICKUP_DELIVERY}</p>
          </div>
        </div>

        <div className="relative mt-9 flex flex-col gap-2 border-t border-white/15 pt-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 KZZ Kids Clothing</span>
          <span>Made with love for little adventures 🤍</span>
        </div>
      </div>
    </footer>
  );
}
