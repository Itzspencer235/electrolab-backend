const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    fr: { type: String, required: true },
    en: { type: String },
    ar: { type: String },
  },
  // Rich description fields — all optional
  description:      { fr: String, en: String, ar: String },
  workingPrinciple: { fr: String, en: String, ar: String },
  features:         { fr: String, en: String, ar: String },
  specifications:   { fr: String, en: String, ar: String },
  applications:     { fr: String, en: String, ar: String },
  howToUse:         { fr: String, en: String, ar: String },
  parameters: [{
    key:   { type: String },
    value: { type: String },
  }],
  sampleCode:   { type: String, default: '' },
  codeLanguage: { type: String, default: 'cpp' },
  // Images
  imageUrl:      { type: String, default: '' },
  images:        [{ type: String }],
  circuitImages: [{ type: String }],
  cloudinaryId:  { type: String, default: '' },
  // Shop
  price:    { type: Number, required: true },
  // ← Free-text category: no enum constraint, admins type whatever they want
  category: { type: String, required: true, trim: true },
  stock:    { type: Number, default: 0 },

  // Discount on this product (0 = none). Optional dates limit when it applies.
  // Site-wide/category sales live in the Sale model; the bigger one wins.
  discountPercent:  { type: Number, default: 0, min: 0, max: 90 },
  discountStartsAt: { type: Date },
  discountEndsAt:   { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);