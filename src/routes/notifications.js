const router   = require('express').Router();
const mongoose = require('mongoose');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { notifyUser, notifyMany } = require('../services/notify');
const { pushConfigured } = require('../services/push');
const { emailConfigured } = require('../services/mailer');

const MAX_TOKENS = 10; // phones per account

// ── User ──────────────────────────────────────────────────────────────────────

// GET /api/notifications/my → { items, unread }
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);
    res.json({ items, unread });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    await Notification.updateOne({ _id: req.params.id, user: req.user.id }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Not found' });
    await Notification.deleteOne({ _id: req.params.id, user: req.user.id });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// POST /api/notifications/device { token } — register this phone for push
router.post('/device', authMiddleware, async (req, res) => {
  try {
    const token = (req.body?.token || '').toString().trim();
    if (!token || token.length > 4096) return res.status(400).json({ message: 'Invalid token' });
    // A phone belongs to one account at a time (e.g. after switching accounts)
    await User.updateMany({ _id: { $ne: req.user.id }, fcmTokens: token }, { $pull: { fcmTokens: token } });
    const user = await User.findById(req.user.id).select('fcmTokens');
    if (!user) return res.status(401).json({ message: 'User not found' });
    const tokens = [...user.fcmTokens.filter(t => t !== token), token].slice(-MAX_TOKENS);
    await User.updateOne({ _id: req.user.id }, { $set: { fcmTokens: tokens } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// DELETE /api/notifications/device { token } — on logout
router.delete('/device', authMiddleware, async (req, res) => {
  try {
    const token = (req.body?.token || '').toString();
    await User.updateOne({ _id: req.user.id }, { $pull: { fcmTokens: token } });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// GET/PUT /api/notifications/prefs { push: boolean }
router.get('/prefs', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('notifyPush');
  res.json({ push: user?.notifyPush !== false });
});
router.put('/prefs', authMiddleware, async (req, res) => {
  try {
    const push = req.body?.push !== false;
    await User.updateOne({ _id: req.user.id }, { $set: { notifyPush: push } });
    res.json({ push });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

// GET /api/notifications/admin/status → which channels are configured on the server
router.get('/admin/status', adminMiddleware, (req, res) => {
  res.json({ push: !!pushConfigured(), email: emailConfigured() });
});

/**
 * POST /api/notifications/admin/send
 * { target: 'all' | 'customers' | 'user', userId?, title, body,
 *   channels: { inApp: bool, push: bool, email: bool } }
 * inApp and push go together in the apps ("in the app"); email is separate.
 */
router.post('/admin/send', adminMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    const title = (b.title || '').toString().trim();
    const body  = (b.body  || '').toString().trim();
    if (!title) return res.status(400).json({ message: 'Title required' });
    if (title.length > 140) return res.status(400).json({ message: 'Title too long (140 max)' });
    if (body.length > 2000) return res.status(400).json({ message: 'Message too long (2000 max)' });
    const ch = {
      inApp: b.channels?.inApp !== false,
      push:  b.channels?.push  !== false && b.channels?.inApp !== false,
      email: b.channels?.email === true,
    };
    if (!ch.inApp && !ch.email) return res.status(400).json({ message: 'Choose at least one channel' });

    if (b.target === 'user') {
      if (!mongoose.isValidObjectId(b.userId) || !(await User.exists({ _id: b.userId }))) {
        return res.status(400).json({ message: 'User not found' });
      }
      const r = await notifyUser(b.userId, { type: 'announcement', title, body }, ch);
      return res.json({ users: 1, inApp: r.inApp, push: r.push, emailQueued: r.email });
    }
    const filter = b.target === 'customers' ? { role: 'customer' } : {};
    res.json(await notifyMany(filter, { title, body }, ch));
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
