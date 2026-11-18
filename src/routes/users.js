const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const {
  register, login, googleAuth, facebookAuth,
  getProfile, updateProfile,
  syncCart, syncWishlist,
  addToCart, removeFromCart, toggleWishlist,
} = require('../controllers/userController');

// ── Auth ───────────────────────────────────────────────────────────────────────
router.post('/register',  authLimiter, register);
router.post('/login',     authLimiter, login);
router.post('/google',    authLimiter, googleAuth);
router.post('/facebook',  authLimiter, facebookAuth);

// ── Profile ────────────────────────────────────────────────────────────────────
router.get('/profile',    authMiddleware, getProfile);
router.put('/profile',    authMiddleware, updateProfile);

// ── Cart ───────────────────────────────────────────────────────────────────────
router.put('/cart/sync',          authMiddleware, syncCart);
router.post('/cart',              authMiddleware, addToCart);
router.delete('/cart/:productId', authMiddleware, removeFromCart);

// ── Wishlist ───────────────────────────────────────────────────────────────────
router.put('/wishlist/sync',      authMiddleware, syncWishlist);
router.post('/wishlist/toggle',   authMiddleware, toggleWishlist);

// ── Admin ──────────────────────────────────────────────────────────────────────
router.get('/all',        adminMiddleware, async (req, res) => {
  try {
    const User  = require('../models/User');
    const users = await User.find().select('-password -fcmTokens').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id/role',   adminMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    if (!['customer', 'admin'].includes(req.body?.role))
      return res.status(400).json({ message: 'Invalid role' });
    if (String(req.params.id) === String(req.user.id) && req.body.role !== 'admin')
      return res.status(400).json({ message: 'You cannot remove your own admin role' });
    const user = await User.findByIdAndUpdate(
      req.params.id, { role: req.body.role }, { new: true, runValidators: true }
    ).select('-password -fcmTokens');
    if (!user) return res.status(404).json({ message: 'Not found' });
    res.json(user);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id',     adminMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;