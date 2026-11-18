const mongoose = require('mongoose');

// A sale applied to many products at once: everything, or some categories.
const SaleSchema = new mongoose.Schema({
  title:      { fr: { type: String, default: '' }, en: { type: String, default: '' }, ar: { type: String, default: '' } },
  percent:    { type: Number, required: true, min: 1, max: 90 },
  scope:      { type: String, enum: ['all', 'categories'], default: 'all' },
  categories: { type: [String], default: [] },
  startsAt:   { type: Date },
  endsAt:     { type: Date },
  active:     { type: Boolean, default: true },
}, { timestamps: true });

SaleSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Sale', SaleSchema);
