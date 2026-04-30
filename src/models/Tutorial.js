const mongoose = require('mongoose');

const TutorialSchema = new mongoose.Schema({
  title:       { fr: String, en: String, ar: String },
  description: { fr: String, en: String, ar: String },
  content:     { fr: String, en: String, ar: String },
  level:       { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  category:    { type: String },
  imageUrl:    { type: String, default: '' },
  youtubeUrl:  { type: String, default: '' },
  images:      [{ type: String }],

  components: [{
    // Keep productId for backward compatibility with existing data
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Also accept new 'product' field going forward
    product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // Optional manual name (multilang) if no product linked
    name: { fr: String, en: String, ar: String },
    imageUrl: { type: String, default: '' },
    category: { type: String, default: '' },
    price:    { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
  }],

  steps: [{
    title:   { type: String },
    content: { type: String },
  }],
  codeSnippet:  { type: String, default: '' },
  codeLanguage: { type: String, default: 'cpp' },
  duration:     { type: Number, default: 0 },
  views:        { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Tutorial', TutorialSchema);