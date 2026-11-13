const mongoose = require('mongoose');

// A customer's request for a product the shop does not have yet.
const ProductRequestSchema = new mongoose.Schema({
  user: {
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:    { type: String, default: '' },
    contact: { type: String, default: '' }, // email or phone, copied at creation
  },

  // What the customer filled in
  name:          { type: String, required: true, trim: true, maxlength: 120 },
  description:   { type: String, default: '', trim: true, maxlength: 1000 },
  imageUrl:      { type: String, default: '' },
  intendedPrice: { type: Number, min: 0 },
  quantity:      { type: Number, min: 1, default: 1 },
  searchQuery:   { type: String, default: '', maxlength: 120 }, // what they typed in search
  source:        { type: String, enum: ['app', 'web'], default: 'app' },

  // Admin feedback
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'available', 'rejected'],
    default: 'pending',
  },
  adminMessage: { type: String, default: '', trim: true, maxlength: 1000 },
  product:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // set when it's in the shop
  respondedAt:  { type: Date },
}, { timestamps: true });

ProductRequestSchema.index({ 'user.userId': 1, createdAt: -1 });
ProductRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ProductRequest', ProductRequestSchema);
