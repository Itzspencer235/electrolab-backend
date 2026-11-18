// Sales (discounts on many products) and pop-up promotions.
//   /api/sales       GET /active (public) · admin: GET / POST / PUT /:id / DELETE /:id
//   /api/promotions  GET /active?platform=app|web (public) · POST /:id/view|click (public)
//                    admin: GET / POST / PUT /:id / DELETE /:id
const express  = require('express');
const mongoose = require('mongoose');
const { adminMiddleware } = require('../middleware/auth');
const Sale      = require('../models/Sale');
const Promotion = require('../models/Promotion');
const { clearSalesCache, runningSales } = require('../services/pricing');

const sales = express.Router();
const promotions = express.Router();

// ── helpers ───────────────────────────────────────────────────────────────────
class Bad extends Error {}
const str = (v, max) => (v === undefined || v === null ? '' : String(v)).trim().slice(0, max);
const ml  = (v, max) => ({ fr: str(v?.fr, max), en: str(v?.en, max), ar: str(v?.ar, max) });
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
function date(v) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Bad('Invalid date');
  return d;
}
const checkRange = (start, end) => {
  if (start && end && end <= start) throw new Bad('The end date must be after the start date');
};
const fail = (res, err) => (err instanceof Bad || err.name === 'ValidationError' || err.name === 'CastError'
  ? res.status(400).json({ message: err.message })
  : (console.error(err), res.status(500).json({ message: 'Server error' })));
const validId = (req, res, next) =>
  (mongoose.isValidObjectId(req.params.id) ? next() : res.status(404).json({ message: 'Not found' }));

// ── Sales ─────────────────────────────────────────────────────────────────────

function saleFields(b) {
  const percent = Math.round(Number(b.percent));
  if (!(percent >= 1 && percent <= 90)) throw new Bad('Percent must be between 1 and 90');
  const scope = oneOf(b.scope, ['all', 'categories'], 'all');
  const categories = scope === 'categories'
    ? [...new Set((Array.isArray(b.categories) ? b.categories : []).map(c => str(c, 80)).filter(Boolean))]
    : [];
  if (scope === 'categories' && !categories.length) throw new Bad('Choose at least one category');
  const startsAt = date(b.startsAt) ?? null;
  const endsAt   = date(b.endsAt) ?? null;
  checkRange(startsAt, endsAt);
  return { title: ml(b.title, 80), percent, scope, categories, startsAt, endsAt, active: b.active !== false };
}

// Sales running now — the apps use this for "-15% on everything" banners
sales.get('/active', async (req, res) => {
  try {
    const lang = ['fr', 'en', 'ar'].includes(req.query.lang) ? req.query.lang : 'fr';
    const list = await runningSales();
    res.json(list.map(s => ({
      _id: s._id, title: s.title?.[lang] || s.title?.fr || '', percent: s.percent,
      scope: s.scope, categories: s.categories, endsAt: s.endsAt || null,
    })).sort((a, b) => b.percent - a.percent));
  } catch (err) { fail(res, err); }
});

sales.get('/', adminMiddleware, async (req, res) => {
  try { res.json(await Sale.find().sort({ createdAt: -1 })); } catch (err) { fail(res, err); }
});
sales.post('/', adminMiddleware, async (req, res) => {
  try {
    const s = await Sale.create(saleFields(req.body || {}));
    clearSalesCache();
    res.status(201).json(s);
  } catch (err) { fail(res, err); }
});
sales.put('/:id', adminMiddleware, validId, async (req, res) => {
  try {
    const s = await Sale.findByIdAndUpdate(req.params.id, saleFields(req.body || {}), { new: true, runValidators: true });
    if (!s) return res.status(404).json({ message: 'Not found' });
    clearSalesCache();
    res.json(s);
  } catch (err) { fail(res, err); }
});
sales.delete('/:id', adminMiddleware, validId, async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    clearSalesCache();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ── Promotions (pop-ups) ──────────────────────────────────────────────────────

function promoFields(b) {
  const title = ml(b.title, 120);
  if (!title.fr && !title.en && !title.ar) throw new Bad('A title is required');
  const ctaType = oneOf(b.ctaType, ['none', 'shop', 'product', 'category', 'url'], 'shop');
  let ctaValue = str(b.ctaValue, 500);
  if (ctaType === 'url' && !/^https:\/\/[^\s]+$/i.test(ctaValue)) throw new Bad('The link must start with https://');
  if (ctaType === 'product' && !mongoose.isValidObjectId(ctaValue)) throw new Bad('Choose a product');
  if (ctaType === 'category' && !ctaValue) throw new Bad('Choose a category');
  if (ctaType === 'none' || ctaType === 'shop') ctaValue = '';
  const imageUrl = str(b.imageUrl, 1000);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw new Bad('Invalid image');
  const startsAt = date(b.startsAt) ?? null;
  const endsAt   = date(b.endsAt) ?? null;
  checkRange(startsAt, endsAt);
  return {
    kind: oneOf(b.kind, ['sale', 'info', 'partner'], 'sale'),
    title, body: ml(b.body, 600), ctaLabel: ml(b.ctaLabel, 40), imageUrl,
    ctaType, ctaValue,
    audience: oneOf(b.audience, ['all', 'app', 'web'], 'all'),
    frequency: oneOf(b.frequency, ['every_visit', 'daily', 'once'], 'daily'),
    startsAt, endsAt, active: b.active !== false,
    priority: Math.max(-100, Math.min(100, Math.round(Number(b.priority) || 0))),
  };
}

// Pop-ups to show now on this platform, best first. The app/site decides
// (using `frequency`) whether this visitor has already seen it.
promotions.get('/active', async (req, res) => {
  try {
    const platform = req.query.platform === 'web' ? 'web' : 'app';
    const lang = ['fr', 'en', 'ar'].includes(req.query.lang) ? req.query.lang : 'fr';
    const now = new Date();
    const list = await Promotion.find({
      active: true,
      audience: { $in: ['all', platform] },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }] },
      ],
    }).sort({ priority: -1, createdAt: -1 }).limit(5).lean();
    const pick = (m) => m?.[lang] || m?.fr || m?.en || m?.ar || '';
    res.json(list.map(p => ({
      _id: p._id, kind: p.kind, title: pick(p.title), body: pick(p.body), imageUrl: p.imageUrl,
      ctaLabel: pick(p.ctaLabel), ctaType: p.ctaType, ctaValue: p.ctaValue,
      frequency: p.frequency, endsAt: p.endsAt || null,
      // version changes when the admin edits it, so "show once" shows edited pop-ups again
      version: new Date(p.updatedAt).getTime(),
    })));
  } catch (err) { fail(res, err); }
});

promotions.post('/:id/view', validId, async (req, res) => {
  await Promotion.updateOne({ _id: req.params.id }, { $inc: { views: 1 } }).catch(() => {});
  res.json({ ok: true });
});
promotions.post('/:id/click', validId, async (req, res) => {
  await Promotion.updateOne({ _id: req.params.id }, { $inc: { clicks: 1 } }).catch(() => {});
  res.json({ ok: true });
});

promotions.get('/', adminMiddleware, async (req, res) => {
  try { res.json(await Promotion.find().sort({ priority: -1, createdAt: -1 })); } catch (err) { fail(res, err); }
});
promotions.post('/', adminMiddleware, async (req, res) => {
  try { res.status(201).json(await Promotion.create(promoFields(req.body || {}))); } catch (err) { fail(res, err); }
});
promotions.put('/:id', adminMiddleware, validId, async (req, res) => {
  try {
    const p = await Promotion.findByIdAndUpdate(req.params.id, promoFields(req.body || {}), { new: true, runValidators: true });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (err) { fail(res, err); }
});
promotions.delete('/:id', adminMiddleware, validId, async (req, res) => {
  try { await Promotion.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (err) { fail(res, err); }
});

module.exports = { sales, promotions };
