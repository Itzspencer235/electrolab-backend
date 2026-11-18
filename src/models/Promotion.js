const mongoose = require('mongoose');

const ML = {
  fr: { type: String, default: '' },
  en: { type: String, default: '' },
  ar: { type: String, default: '' },
};

// A pop-up shown when someone opens the app or the website: a sale,
// information, or an ad for a partner business. Fully controlled by admins.
const PromotionSchema = new mongoose.Schema({
  kind:     { type: String, enum: ['sale', 'info', 'partner'], default: 'sale' },
  title:    ML,
  body:     ML,
  imageUrl: { type: String, default: '' },

  // Button: where it goes
  ctaLabel: ML,
  ctaType:  { type: String, enum: ['none', 'shop', 'product', 'category', 'url'], default: 'shop' },
  ctaValue: { type: String, default: '' },   // product id, category name or https:// link

  audience:  { type: String, enum: ['all', 'app', 'web'], default: 'all' },
  frequency: { type: String, enum: ['every_visit', 'daily', 'once'], default: 'daily' },
  startsAt:  { type: Date },
  endsAt:    { type: Date },
  active:    { type: Boolean, default: true },
  priority:  { type: Number, default: 0 },   // higher shows first

  views:  { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
}, { timestamps: true });

PromotionSchema.index({ active: 1, audience: 1, priority: -1 });

module.exports = mongoose.model('Promotion', PromotionSchema);
