import { formatKSh } from "../lib/format.js";

export default function ProductPrice({
  price,
  originalPrice,
  className = "",
  currentClassName = "",
  previousClassName = "",
}) {
  const hasOffer = Number.isFinite(Number(originalPrice)) && Number(originalPrice) > Number(price);

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className={`font-bold ${currentClassName}`}>{formatKSh(price)}</span>
      {hasOffer && (
        <>
          <span className={`text-ink/55 line-through ${previousClassName}`} aria-label={`Previous price ${formatKSh(originalPrice)}`}>
            {formatKSh(originalPrice)}
          </span>
          <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-coral">Offer</span>
        </>
      )}
    </div>
  );
}
