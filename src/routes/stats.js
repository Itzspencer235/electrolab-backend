const router   = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const Product  = require('../models/Product');
const User     = require('../models/User');
const Order    = require('../models/Order');
const Tutorial = require('../models/Tutorial');

router.get('/', adminMiddleware, async (req, res) => {
  try {
    const [
      totalProducts, totalUsers, totalOrders,
      totalTutorials, revenueAgg,
      recentOrders, ordersByStatus,
      topWishlisted, topCarted,
      usersByMonth, ordersByMonth,
    ] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      Order.countDocuments(),
      Tutorial.countDocuments(),

      // Revenue
      Order.aggregate([
        { $match: { status: { $in: ['confirmed', 'delivered'] } } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),

      // Recent 5 orders
      Order.find().sort({ createdAt: -1 }).limit(5),

      // Orders by status
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Top wishlisted products
      User.aggregate([
        { $unwind: '$wishlist' },
        { $group: { _id: '$wishlist.product', name: { $first: '$wishlist.name' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Top carted products
      User.aggregate([
        { $unwind: '$cart' },
        { $group: { _id: '$cart.product', name: { $first: '$cart.name' }, count: { $sum: 1 }, totalQty: { $sum: '$cart.quantity' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // New users per month (last 6 months)
      User.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { '_id': 1 } },
      ]),

      // Orders per month (last 6 months)
      Order.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
        { $sort: { '_id': 1 } },
      ]),
    ]);

    res.json({
      totals: {
        products: totalProducts,
        users:    totalUsers,
        orders:   totalOrders,
        tutorials: totalTutorials,
        revenue:  revenueAgg[0]?.total || 0,
      },
      recentOrders,
      ordersByStatus: ordersByStatus.reduce((a, b) => ({...a, [b._id]: b.count }), {}),
      topWishlisted,
      topCarted,
      usersByMonth,
      ordersByMonth,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;