const mongoose = require('mongoose');

const TutorialSchema = new mongoose.Schema({
  title: {
    fr: { type: String, required: true },
    en: String,
    ar: String,
  },
  content: {
    fr: String,
    en: String,
    ar: String,
  },
  level:    { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },

  // Cloudinary for thumbnail
  imageUrl:     { type: String, default: '' },
  cloudinaryId: { type: String, default: '' },

  // YouTube video link
  youtubeUrl:   { type: String, default: '' }, // e.g. https://youtube.com/watch?v=xxxxx

  components:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  codeSnippet: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Tutorial', TutorialSchema);