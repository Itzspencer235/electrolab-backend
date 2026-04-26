const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    fr: { type: String, required: true },
    en: String,
    ar: String,
  },
  description: {
    fr: String,
    en: String,
    ar: String,
  },
  price:    { type: Number, required: true },
  category: {
    type: String,
    enum: ['Microcontrollers', 'Sensors', 'GSM', 'Tools', 'Accessories'],
    required: true,
  },
  stock:    { type: Number, default: 0 },

  // Cloudinary fields
  imageUrl:    { type: String, default: '' },  // main image
  images:      [{ type: String }],             // multiple images
  cloudinaryId: { type: String, default: '' }, // for deleting image later

}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);