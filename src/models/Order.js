const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: {
    name:     { type: String, required: true },
    phone:    { type: String, required: true },
    location: { type: String, required: true },
  },
  products: [
    {
      product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:     String,
      quantity: { type: Number, default: 1 },
      price:    Number,
    }
  ],
  totalPrice: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'delivered', 'cancelled'],
    default: 'pending',
  },
  note: { type: String, default: '' },
  user: {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:     { type: String, required: true },
    phone:    { type: String, required: true },
    location: { type: String, required: true },
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);