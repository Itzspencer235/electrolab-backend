const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getWishlist, syncWishlist,
  toggleItem, removeItem, clearWishlist,
} = require('../controllers/wishlistController');

router.get('/',              authMiddleware, getWishlist);
router.put('/sync',          authMiddleware, syncWishlist);
router.post('/toggle',       authMiddleware, toggleItem);
router.delete('/clear',      authMiddleware, clearWishlist);
router.delete('/:productId', authMiddleware, removeItem);

module.exports = router;