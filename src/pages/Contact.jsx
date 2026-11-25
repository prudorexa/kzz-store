import { WHATSAPP_NUMBER } from "../lib/contact.js";
import {
  BUSINESS_DESCRIPTION,
  BUSINESS_LOCATION,
  BUSINESS_PICKUP_DELIVERY,
} from "../lib/business.js";

export default function Contact() {
  const phone = WHATSAPP_NUMBER;
  const message = encodeURIComponent("Hi KZZ! I’d like help choosing or ordering an outfit.");
  const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <div className="grid overflow-hidden rounded-3xl border border-purple-mid/70 bg-purple-tint lg:grid-cols-2">
        <div className="p-7 sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">We’re here to help</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold sm:text-5xl">Welcome to KZZ Kids Luxe 🤍✨</h1>
          <p className="mt-5 max-w-lg leading-7 text-ink/65">
            {BUSINESS_DESCRIPTION}. Ask about sizes, stock, delivery or a complete outfit.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#25D366] px-6 py-3.5 font-bold text-[#173b27] transition-transform hover:-translate-y-0.5"
          >
            <span className="text-xl" aria-hidden="true">◉</span>
            Continue on WhatsApp
          </a>
        </div>

        <div className="grid min-h-72 place-items-center bg-purple-soft p-8">
          <div className="max-w-sm">
            <p className="text-5xl" aria-hidden="true">📍</p>
            <p className="mt-4 font-display text-2xl font-extrabold">Find us</p>
            <p className="mt-2 text-sm leading-6 text-ink/70">{BUSINESS_LOCATION}, Kenya.</p>
            <p className="mt-2 text-sm font-bold text-ink/70">{BUSINESS_PICKUP_DELIVERY}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${BUSINESS_LOCATION}, Kenya`)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-bold text-purple-vivid underline"
            >
              Open in Google Maps
            </a>
            <p className="mt-4 text-xs leading-5 text-ink/55">Usually replies quickly on WhatsApp for product and delivery questions.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Size help", "Tell us the child’s age and height."],
          ["Delivery", "Ask about your county and estimated arrival."],
          ["Order support", "Share your order number for a quick update."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-3xl border border-purple-mid/50 bg-purple-tint p-5">
            <h2 className="font-display text-lg font-extrabold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
