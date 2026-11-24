import { useLocation } from "react-router-dom";
import { WHATSAPP_NUMBER } from "../lib/contact.js";

export default function WhatsAppButton() {
  const { pathname } = useLocation();
  if (pathname === "/admin") return null;

  const message = encodeURIComponent(
    pathname.startsWith("/product/")
      ? "Hi KZZ! I have a question about this outfit."
      : "Hi KZZ! I’d like help choosing or ordering an outfit."
  );

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with KZZ on WhatsApp"
      className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-2xl text-white shadow-[0_12px_30px_rgba(37,211,102,0.35)] transition-transform hover:-translate-y-1"
    >
      <span aria-hidden="true">◉</span>
    </a>
  );
}
