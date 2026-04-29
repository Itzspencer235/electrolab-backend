const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const Order = require('../models/Order');
const {
  createOrder, getOrders, getOrder, updateOrderStatus,
} = require('../controllers/orderController');

router.post('/', createOrder);

// User's own orders
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ 'user.userId': req.user.id })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
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
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id',            getOrder);
router.put('/:id/status',     adminMiddleware, updateOrderStatus);

module.exports = router;