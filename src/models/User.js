const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, unique: true, sparse: true },
  phone:    { type: String, unique: true, sparse: true },
  password: { type: String },           // null for OAuth users
  avatar:   { type: String, default: '' },
  role:     { type: String, enum: ['customer', 'admin'], default: 'customer' },
  language: { type: String, enum: ['fr', 'en', 'ar'], default: 'fr' },

  // OAuth
  googleId:   { type: String, sparse: true },
  facebookId: { type: String, sparse: true },
  provider:   { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },

  // Cart & Wishlist stored in DB
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

module.exports = mongoose.model('User', UserSchema);