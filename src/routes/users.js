const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  register, login, googleAuth, facebookAuth,
  getProfile, updateProfile,
  syncCart, syncWishlist,
  addToCart, removeFromCart, toggleWishlist,
} = require('../controllers/userController');

// ── Auth ───────────────────────────────────────────────────────────────────────
router.post('/register',  register);
router.post('/login',     login);
router.post('/google',    googleAuth);
router.post('/facebook',  facebookAuth);

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
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/role',   adminMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findByIdAndUpdate(
      req.params.id, { role: req.body.role }, { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id',     adminMiddleware, async (req, res) => {
  try {
    const User = require('../models/User');
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;