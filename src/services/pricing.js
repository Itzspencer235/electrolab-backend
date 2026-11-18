// One place that decides the price a customer pays.
// finalPrice = price minus the biggest discount currently running:
//   - the product's own discountPercent (within its optional dates), or
//   - an active Sale covering everything or the product's category.
const Sale = require('../models/Sale');

let cache = { at: 0, sales: [] };
const CACHE_MS = 30 * 1000;

const runningNow = (start, end, now) =>
  (!start || new Date(start) <= now) && (!end || new Date(end) > now);

async function activeSales() {
  const now = Date.now();
  if (now - cache.at < CACHE_MS) return cache.sales;
  const sales = await Sale.find({ active: true }).lean();
  cache = { at: now, sales };
  return sales;
}

/** Call after creating/editing/deleting a sale so prices update immediately. */
function clearSalesCache() { cache = { at: 0, sales: [] }; }

/**
 * @returns {{ price, finalPrice, discountPercent, discountEndsAt, saleTitle }}
 * saleTitle is { fr, en, ar } when a Sale gives the discount, otherwise null.
 */
function priceInfo(product, sales, now = new Date()) {
  const price = Number(product.price) || 0;
  let best = 0, endsAt = null, saleTitle = null;

  const own = Number(product.discountPercent) || 0;
  if (own > 0 && runningNow(product.discountStartsAt, product.discountEndsAt, now)) {
    best = own; endsAt = product.discountEndsAt || null;
  }
  for (const s of sales) {
    if (!runningNow(s.startsAt, s.endsAt, now)) continue;
    if (s.scope === 'categories' && !(s.categories || []).includes(product.category)) continue;
    if (s.percent > best) { best = s.percent; endsAt = s.endsAt || null; saleTitle = s.title || null; }
  }
  best = Math.max(0, Math.min(90, best));
  return {
    price,
    finalPrice: best ? Math.round(price * (100 - best) / 100) : price,
    discountPercent: best,
    discountEndsAt: endsAt,
    saleTitle,
  };
}

/** Sales running right now (for banners/badges in the apps). */
async function runningSales() {
  const now = new Date();
  return (await activeSales()).filter(s => runningNow(s.startsAt, s.endsAt, now));
}

module.exports = { activeSales, priceInfo, clearSalesCache, runningSales };
