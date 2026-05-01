const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getCart, syncCart, addItem,
  removeItem, updateQuantity, clearCart,
} = require('../controllers/cartController');

router.get('/',                    authMiddleware, getCart);
router.put('/sync',                authMiddleware, syncCart);
router.post('/add',                authMiddleware, addItem);
router.delete('/clear',            authMiddleware, clearCart);
router.delete('/:productId',       authMiddleware, removeItem);
router.put('/:productId/quantity', authMiddleware, updateQuantity);

module.exports = router;