import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// When the KZZ backend exists, run it on port 3000 and these proxies
// make /api/products and product images work during development.
const backend = "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": backend,
      "/uploads": backend,
      "/images": backend,
    },
  },
});
