const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  phone:    { type: String, required: true, unique: true },
  location: { type: String, default: '' },
  password: { type: String, required: true },
  role:     { type: String, enum: ['customer', 'admin'], default: 'customer' },
  language: { type: String, enum: ['fr', 'en', 'ar'], default: 'fr' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);