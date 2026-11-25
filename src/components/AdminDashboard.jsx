



import { formatKSh } from "../lib/format.js";

const periods = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const fulfillmentLabels = {
  awaiting_payment: "Awaiting payment",
  processing: "Processing",
  packed: "Packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

function MetricCard({ label, value, detail, tone = "bg-purple-tint" }) {
  return (
    <article className={`rounded-3xl border border-purple-mid/30 p-5 sm:p-6 ${tone}`}>
      <p className="text-sm font-bold text-ink/60">{label}</p>
      <p className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-ink/55">{detail}</p>
    </article>
  );
}

function RevenueChart({ orders, days }) {
  const count = days === 7 ? 7 : days === 30 ? 10 : 12;
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const duration = Math.max(now.getTime() - start.getTime(), 1);
  const buckets = Array.from({ length: count }, (_, index) => ({
    label: new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric" })
      .format(new Date(start.getTime() + (duration * index) / count)),
    revenue: 0,
  }));

  for (const order of orders) {
    if (order.payment_status !== "paid") continue;
    const elapsed = new Date(order.created_at).getTime() - start.getTime();
    const index = Math.max(0, Math.min(count - 1, Math.floor((elapsed / duration) * count)));
    buckets[index].revenue += Number(order.total_ksh) || 0;
  }

  const maximum = Math.max(...buckets.map((bucket) => bucket.revenue), 1);
  const chartWidth = 720;
  const chartHeight = 220;
  const plotTop = 16;
  const baseline = 174;
  const slotWidth = chartWidth / count;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-extrabold">Revenue over time</h2>
          <p className="mt-1 text-xs text-ink/55">Payments received · KSh</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-bold text-ink/60">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-vivid" /> Revenue
        </span>
      </div>
      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Paid revenue for the last ${days} days`}
        >
          <line x1="0" y1={baseline} x2={chartWidth} y2={baseline} stroke="currentColor" strokeOpacity=".12" />
          {buckets.map((bucket, index) => {
            const barHeight = (bucket.revenue / maximum) * (baseline - plotTop);
            const barWidth = Math.min(28, slotWidth * 0.48);
            const x = index * slotWidth + (slotWidth - barWidth) / 2;
            return (
              <g key={`${bucket.label}-${index}`}>
                <rect
                  x={x}
                  y={baseline - barHeight}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx="6"
                  fill="currentColor"
                  className="text-purple-vivid"
                >
                  <title>{`${bucket.label}: ${formatKSh(bucket.revenue)}`}</title>
                </rect>
                <text
                  x={index * slotWidth + slotWidth / 2}
                  y="205"
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  className="text-ink/55"
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {!orders.some((order) => order.payment_status === "paid") && (
        <p className="mt-2 text-center text-sm text-ink/55">No payments received in this period yet.</p>
      )}
    </div>
  );
}

export default function AdminDashboard({
  products,
  orders,
  loading,
  error,
  days,
  onDaysChange,
  usingSample,
}) {
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;
  const periodOrders = orders.filter((order) => {
    const createdAt = new Date(order.created_at).getTime();
    return createdAt >= start && createdAt <= now;
  });
  const paidOrders = periodOrders.filter((order) => order.payment_status === "paid");
  const revenue = paidOrders.reduce((sum, order) => sum + (Number(order.total_ksh) || 0), 0);
  const soldLines = paidOrders.flatMap((order) => order.order_items || []);
  const uncostedLines = soldLines.filter((item) => item.unit_cost_ksh == null);
  const costedLines = soldLines.filter((item) => item.unit_cost_ksh != null);
  const trackedProfit = costedLines.reduce(
    (sum, item) => sum + (Number(item.unit_price_ksh) - Number(item.unit_cost_ksh)) * Number(item.quantity),
    0
  );
  const productSales = new Map();
  for (const order of paidOrders) {
    for (const item of order.order_items || []) {
      const current = productSales.get(item.product_name) || { quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity) || 0;
      current.revenue += (Number(item.unit_price_ksh) || 0) * (Number(item.quantity) || 0);
      productSales.set(item.product_name, current);
    }
  }
  const bestSellers = [...productSales.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5);
  const lowStock = products
    .filter((product) => Number(product.stock) <= 5)
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 5);
  const fulfillmentCounts = periodOrders.reduce((counts, order) => {
    const status = order.fulfillment_status || "awaiting_payment";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const completeProfit = soldLines.length > 0 && uncostedLines.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink/60">Here’s how your store is doing.</p>
          <p className="mt-1 text-xs text-ink/45">Revenue and profit include paid orders only.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-purple-soft p-1" aria-label="Dashboard date range">
          {periods.map((period) => (
            <button
              key={period.days}
              type="button"
              onClick={() => onDaysChange(period.days)}
              aria-pressed={days === period.days}
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors sm:px-4 ${
                days === period.days ? "bg-purple-deep text-purple-tint" : "hover:bg-purple-tint"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {usingSample && (
        <p className="rounded-2xl border border-purple-mid/40 bg-purple-soft px-4 py-3 text-sm text-ink/70">
          Demo catalog: order and sales data will appear here after connecting the store database.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue collected" value={loading ? "—" : formatKSh(revenue)} detail={`${paidOrders.length} paid orders in this period`} tone="bg-purple-deep text-purple-tint" />
        <MetricCard label="Orders placed" value={loading ? "—" : periodOrders.length.toLocaleString("en-KE")} detail={`${periodOrders.filter((order) => order.payment_status === "pending").length} awaiting payment`} />
        <MetricCard label="Average order value" value={loading ? "—" : paidOrders.length ? formatKSh(Math.round(revenue / paidOrders.length)) : "—"} detail="Average of paid orders" />
        <MetricCard
          label="Tracked gross profit"
          value={loading ? "—" : costedLines.length ? formatKSh(trackedProfit) : "—"}
          detail={loading ? " " : completeProfit ? "Product costs recorded for all paid items" : uncostedLines.length ? `${uncostedLines.length} paid item line${uncostedLines.length === 1 ? "" : "s"} missing cost data` : "No paid items in this period"}
          tone="bg-mint"
        />
      </div>

      {!loading && uncostedLines.length > 0 && (
        <p className="rounded-2xl border border-purple-mid/40 bg-purple-soft px-4 py-3 text-sm leading-6 text-ink/70">
          Profit is partial because some orders predate cost tracking or their products have no recorded cost. Add each product’s cost to track gross profit on future orders.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <section className="rounded-3xl border border-purple-mid/30 bg-purple-tint p-5 sm:p-6">
          <RevenueChart orders={periodOrders} days={days} />
        </section>
        <section className="rounded-3xl border border-purple-mid/30 bg-purple-tint p-5 sm:p-6">
          <h2 className="font-display text-lg font-extrabold">Order progress</h2>
          <p className="mt-1 text-xs text-ink/55">Orders placed in this period</p>
          <div className="mt-5 space-y-4">
            {Object.entries(fulfillmentLabels).map(([status, label]) => {
              const count = fulfillmentCounts[status] || 0;
              const width = periodOrders.length ? (count / periodOrders.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex justify-between gap-3 text-sm">
                    <span className="text-ink/70">{label}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-purple-soft">
                    <div className="h-full rounded-full bg-purple-vivid transition-all" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-3xl border border-purple-mid/30 bg-purple-tint p-5 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-extrabold">Top sellers</h2>
              <p className="mt-1 text-xs text-ink/55">By units in paid orders</p>
            </div>
          </div>
          {bestSellers.length ? (
            <div className="divide-y divide-ink/10">
              {bestSellers.map(([name, sales], index) => (
                <div key={name} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple-soft text-xs font-extrabold">{index + 1}</span>
                    <span className="truncate text-sm font-bold">{name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{sales.quantity} sold</p>
                    <p className="text-xs text-ink/55">{formatKSh(sales.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-ink/55">Paid product sales will show here.</p>}
        </section>

        <section className="rounded-3xl border border-purple-mid/30 bg-purple-tint p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-extrabold">Stock watch</h2>
            <p className="mt-1 text-xs text-ink/55">Products with 5 or fewer units</p>
          </div>
          {lowStock.length ? (
            <div className="divide-y divide-ink/10">
              {lowStock.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="truncate text-sm font-bold">{product.name}</span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${product.stock === 0 ? "bg-blush text-coral" : "bg-sun text-ink"}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-ink/55">All listed products have more than 5 units.</p>}
        </section>
      </div>
    </div>
  );
}
