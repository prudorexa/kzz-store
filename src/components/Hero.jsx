import { Link } from "react-router-dom";

export default function Hero({ products = [] }) {
  const goShop = () => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  const categories = [
    { label: "Boys", note: "Little explorers", emoji: "🦖", tone: "bg-sky" },
    { label: "Girls", note: "Big imaginations", emoji: "🌻", tone: "bg-blush" },
    { label: "Baby", note: "Tiny beginnings", emoji: "🧸", tone: "bg-mint" },
  ];

  return (
    <section className="hero-grid relative overflow-hidden border-b border-purple-mid/30">
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        <span className="floaty absolute left-[47%] top-9 text-3xl text-purple-vivid">✦</span>
        <span className="floaty-slow absolute bottom-8 left-[42%] text-xl text-purple-mid">✿</span>
        <span className="floaty-slow absolute right-8 top-8 h-4 w-4 rounded-full bg-purple-mid/70" />
      </div>
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#efbfd5] bg-white/90 px-3 py-1.5 text-xs font-bold text-purple-deep shadow-sm">
            <span className="h-2 w-2 rounded-full bg-coral" />
            LITTLE STYLE, LOTS OF JOY
          </div>
          <h1 className="max-w-3xl font-display text-[3.4rem] font-extrabold leading-[0.92] tracking-[-0.055em] sm:text-7xl lg:text-[5.25rem]">
            Little outfits.
            <span className="block bg-gradient-to-r from-coral via-purple-vivid to-purple-deep bg-clip-text text-transparent">Big adventures.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-ink/65 sm:text-lg">
            Comfy, colourful favourites for every leap, twirl and cuddle along the way.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={goShop}
              className="rounded-full bg-purple-deep px-7 py-3.5 text-sm font-bold text-purple-tint transition-colors hover:bg-purple-vivid"
            >
              Find their new favourite
            </button>
            <span className="px-2 text-sm font-bold text-ink/55">Made for play · Ready for every day</span>
          </div>
        </div>

        <div className="grid w-full grid-cols-3 items-center gap-3 sm:gap-4" aria-label="Shop by collection">
          {categories.map((category, index) => {
            const featuredProduct = products.find((product) => product.category === category.label && product.image);
            return (
              <Link
                key={category.label}
                to={`/?category=${category.label}`}
                className={`floaty group relative isolate aspect-[3/4] overflow-hidden rounded-[1.5rem] border border-purple-mid/40 ${category.tone} transition-transform hover:-translate-y-1 ${index === 1 ? "-translate-y-4" : "translate-y-3"}`}
                style={{ animationDelay: `${index * 0.65}s` }}
              >
                {featuredProduct?.image ? (
                  <img
                    src={featuredProduct.image}
                    alt={featuredProduct.name}
                    className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 z-0 grid place-items-center text-5xl sm:text-7xl" aria-hidden="true">{category.emoji}</div>
                )}
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-purple-deep/90 via-purple-deep/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-20 p-3 text-purple-tint sm:p-4">
                  <p className="font-display text-base font-extrabold sm:text-xl">{category.label}</p>
                  <p className="mt-0.5 hidden text-xs font-medium text-purple-tint/80 sm:block">{category.note}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
