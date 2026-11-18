const mongoose = require('mongoose');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const User     = require('../models/User');
const { notifyUser } = require('../services/notify');

// Message the customer gets when the admin changes their order's status
const ORDER_MSG = {
  confirmed: {
    title: { fr: 'Commande confirmée ✅', en: 'Order confirmed ✅', ar: 'تم تأكيد طلبك ✅' },
    body:  { fr: 'Votre commande #{n} est confirmée. Nous vous contacterons pour la livraison.',
             en: 'Your order #{n} is confirmed. We will contact you about delivery.',
             ar: 'تم تأكيد طلبك #{n}. سنتواصل معك بخصوص التوصيل.' },
  },
  delivered: {
    title: { fr: 'Commande livrée 📦', en: 'Order delivered 📦', ar: 'تم تسليم طلبك 📦' },
    body:  { fr: 'Votre commande #{n} a été livrée. Merci pour votre confiance !',
             en: 'Your order #{n} has been delivered. Thank you!',
             ar: 'تم تسليم طلبك #{n}. شكراً لثقتك!' },
  },
  cancelled: {
    title: { fr: 'Commande annulée', en: 'Order cancelled', ar: 'تم إلغاء الطلب' },
    body:  { fr: 'Votre commande #{n} a été annulée. Contactez-nous pour toute question.',
             en: 'Your order #{n} was cancelled. Contact us if you have any questions.',
             ar: 'تم إلغاء طلبك #{n}. تواصل معنا لأي استفسار.' },
  },
};
const STATUSES = ['pending', 'confirmed', 'delivered', 'cancelled'];
const fill = (ml, n) => Object.fromEntries(Object.entries(ml).map(([k, v]) => [k, v.replace('{n}', n)]));

// POST create order
// Prices, total and status are decided here, never by the client: the client
// only says which products, how many, and where to deliver.
const MAX_LINES = 50;
const MAX_QTY   = 1000;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

exports.createOrder = async (req, res) => {
  try {
    const b = req.body || {};
    const name     = str(b.user?.name, 100);
    const phone    = str(b.user?.phone, 30);
    const location = str(b.user?.location, 300);
    if (!name || !phone || !location) {
      return res.status(400).json({ message: 'Nom, téléphone et adresse requis' });
    }

    const lines = Array.isArray(b.products) ? b.products.slice(0, MAX_LINES) : [];
    const ids   = lines.map(l => String(l?.product || ''));
    if (!lines.length || !ids.every(id => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: 'Produits invalides' });
    }

    const found = await Product.find({ _id: { $in: ids } }).select('name price').lean();
    const byId  = new Map(found.map(p => [String(p._id), p]));
    if (byId.size !== new Set(ids).size) {
      return res.status(400).json({ message: 'Produit introuvable' });
    }

    const products = lines.map((l, i) => {
      const p   = byId.get(ids[i]);
      const qty = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(l.quantity)) || 1));
      return { product: p._id, name: p.name?.fr || '', quantity: qty, price: p.price };
    });
    const totalPrice = products.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const order = await Order.create({
      user: { userId: req.user?.id, name, phone, location },
      products,
      totalPrice,
      note: str(b.note, 1000),
      status: 'pending',
    });
    res.status(201).json(order);
  } catch (err) {
    console.error('createOrder error:', err.message);
    res.status(400).json({ message: 'Commande invalide' });
  }
};

// GET all orders (admin)
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

// GET single order
exports.getOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Order not found' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const isOwner = order.user?.userId && String(order.user.userId) === String(req.user.id);
    if (!isOwner) {
      const me = await User.findById(req.user.id).select('role').lean();
      // Same answer as "not found", so order IDs can't be probed
      if (me?.role !== 'admin') return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

// PUT update order status (admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ message: 'Invalid status' });
    const before = await Order.findById(req.params.id).select('status');
    if (!before) return res.status(404).json({ message: 'Order not found' });
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    res.json(order);

    // Tell the customer (only for logged-in orders, and only on a real change)
    const msg = ORDER_MSG[order?.status];
    if (msg && order.user?.userId && before?.status !== order.status) {
      const n = String(order._id).slice(-8).toUpperCase();
      notifyUser(order.user.userId, {
        type: 'order', title: msg.title, body: fill(msg.body, n),
        data: { orderId: String(order._id) },
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};