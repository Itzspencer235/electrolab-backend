const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name:     { type: String, default: '' },
  price:    { type: Number, default: 0 },
  imageUrl: { type: String, default: '' },
  category: { type: String, default: '' },
  quantity: { type: Number, default: 1, min: 1 },
});

const CartSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [CartItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Cart', CartSchema);