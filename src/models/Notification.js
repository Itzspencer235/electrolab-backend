const mongoose = require('mongoose');

// One notification shown in a user's list (bell icon). Push/email are sent
// alongside, but this record is what the apps display.
const NotificationSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:  { type: String, enum: ['order', 'request', 'announcement', 'welcome'], default: 'announcement' },
  title: { type: String, required: true, maxlength: 140 },
  body:  { type: String, default: '', maxlength: 2000 },
  // What to open when tapped, e.g. { orderId } / { requestId, productId }
  data:  { type: Map, of: String, default: {} },
  read:  { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
