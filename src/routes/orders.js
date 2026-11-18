const router = require('express').Router();
const { authMiddleware, adminMiddleware, optionalAuth } = require('../middleware/auth');
const { orderLimiter } = require('../middleware/security');
const Order = require('../models/Order');
const {
  createOrder, getOrders, getOrder, updateOrderStatus,
} = require('../controllers/orderController');

// Guests can order too; a valid token links the order to that account
router.post('/', orderLimiter, optionalAuth, createOrder);

// User's own orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ 'user.userId': req.user.id })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// Admin
router.get('/',          adminMiddleware, getOrders);
router.get('/stats',     adminMiddleware, async (req, res) => {
  try {
    const [total, pending, confirmed, delivered, cancelled, revenue] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ status: 'pending' }),
        Order.countDocuments({ status: 'confirmed' }),
        Order.countDocuments({ status: 'delivered' }),
        Order.countDocuments({ status: 'cancelled' }),
        Order.aggregate([
          { $match: { status: { $in: ['confirmed', 'delivered'] } } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } },
        ]),
      ]);
    res.json({
      total, pending, confirmed, delivered, cancelled,
      revenue: revenue[0]?.total || 0,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

router.get('/:id',            authMiddleware, getOrder);   // owner or admin
router.put('/:id/status',     adminMiddleware, updateOrderStatus);

module.exports = router;