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

  // ← Components: each has a name (multilang), optional product ref, price, qty
  components: [{
    name: {
      fr: { type: String },
      en: { type: String },
      ar: { type: String },
    },
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
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