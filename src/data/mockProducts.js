// Sample products so the shop works before the backend is connected.
// Shape mirrors the old /api/products response (name, price, sizes, stock),
// plus category / emoji / tone which only the sample data uses.
export const mockProducts = [
  { id: 1, name: "Dino Print Tee", category: "Boys", productGroup: "Tops", price: 850, sizes: ["2Y", "3Y", "4Y", "5Y"], stock: 14, emoji: "🦖", tone: "bg-mint", description: "Soft cotton tee for energetic everyday adventures.", careInstructions: "Wash cold and tumble dry low.", sizeGuide: "Choose the child's usual age size." },
  { id: 2, name: "Cargo Shorts", category: "Boys", productGroup: "Bottoms", price: 1200, sizes: ["3Y", "4Y", "5Y", "6Y"], stock: 9, emoji: "🩳", tone: "bg-sky" },
  { id: 3, name: "Hooded Sweater", category: "Boys", productGroup: "Outerwear", price: 2400, sizes: ["4Y", "5Y", "6Y", "7Y"], stock: 6, emoji: "🧥", tone: "bg-lilac" },
  { id: 4, name: "Sunflower Dress", category: "Girls", productGroup: "Dresses", price: 1900, sizes: ["2Y", "3Y", "4Y", "5Y"], stock: 11, emoji: "🌻", tone: "bg-sun" },
  { id: 5, name: "Tutu Skirt Set", category: "Girls", productGroup: "Sets", price: 2200, sizes: ["3Y", "4Y", "5Y"], stock: 5, emoji: "🩰", tone: "bg-blush" },
  { id: 6, name: "Rainbow Leggings", category: "Girls", productGroup: "Bottoms", price: 950, sizes: ["2Y", "3Y", "4Y", "5Y", "6Y"], stock: 20, emoji: "🌈", tone: "bg-lilac" },
  { id: 7, name: "Cozy Bear Onesie", category: "Baby", productGroup: "Sleepwear", price: 1500, sizes: ["0-3M", "3-6M", "6-12M"], stock: 8, emoji: "🧸", tone: "bg-blush" },
  { id: 8, name: "Knit Beanie & Booties", category: "Baby", productGroup: "Accessories", price: 1100, sizes: ["0-6M", "6-12M"], stock: 0, emoji: "🧦", tone: "bg-mint" },
];
