const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String },
  phone:    { type: String },
  password: { type: String },           // null for OAuth users
  avatar:   { type: String, default: '' },
  role:     { type: String, enum: ['customer', 'admin'], default: 'customer' },
  language: { type: String, enum: ['fr', 'en', 'ar'], default: 'fr' },

  // OAuth
  googleId:   { type: String },
  facebookId: { type: String },
  provider:   { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },

  // Legacy cart & wishlist (the app now uses the Cart and Wishlist collections)
  cart: [{
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:     String,
    price:    Number,
    imageUrl: String,
    category: String,
    quantity: { type: Number, default: 1 },
  }],
  wishlist: [{
    product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name:     String,
    price:    Number,
    imageUrl: String,
    category: String,
  }],

  isVerified:  { type: Boolean, default: false },
  lastLoginAt: { type: Date },
}, { timestamps: true });

// Unique only when the value is a real string (null or missing is ignored)
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);
UserSchema.index(
  { googleId: 1 },
  { partialFilterExpression: { googleId: { $type: 'string' } } }
);
UserSchema.index(
  { facebookId: 1 },
  { partialFilterExpression: { facebookId: { $type: 'string' } } }
);

module.exports = mongoose.model('User', UserSchema);
