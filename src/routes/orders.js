const router = require('express').Router();
const { adminMiddleware } = require('../middleware/auth');
const {
  createOrder, getOrders, getOrder, updateOrderStatus
} = require('../controllers/orderController');

router.post('/',           createOrder);
router.get('/',            adminMiddleware, getOrders);
router.get('/:id',         getOrder);
router.put('/:id/status',  adminMiddleware, updateOrderStatus);

module.exports = router;