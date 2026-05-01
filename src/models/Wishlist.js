const mongoose = require('mongoose');

const WishItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, default: '' },
  price:    { type: Number, default: 0 },
  imageUrl: { type: String, default: '' },
  category: { type: String, default: '' },
});

const WishlistSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [WishItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', WishlistSchema);