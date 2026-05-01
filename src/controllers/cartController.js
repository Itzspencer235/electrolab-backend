const Cart = require('../models/Cart');

// ── GET cart ───────────────────────────────────────────────────────────────────
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) cart = await Cart.create({ user: req.user.id, items: [] });
    res.json(cart);
  } catch (err) {
    console.error('getCart error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── SYNC cart (replaces entire cart) ─────────────────────────────────────────
exports.syncCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items))
      return res.status(400).json({ message: 'items must be an array' });

    console.log(`🛒 syncCart  user=${req.user.id}  items=${items.length}`);

    const cart = await Cart.findOneAndUpdate(
      { user: req.user.id },
      {
        user: req.user.id,
        items: items
          .filter(i => i.product || i.id)
          .map(i => ({
            product:  i.product || i.id,
            name:     i.name     || '',
            price:    Number(i.price)    || 0,
            imageUrl: i.imageUrl || '',
            category: i.category || '',
            quantity: Number(i.quantity) || 1,
          })),
      },
      { new: true, upsert: true }
    );

    console.log(`✅ Cart synced — items in DB: ${cart.items.length}`);
    res.json(cart);
  } catch (err) {
    console.error('❌ syncCart error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── ADD item ──────────────────────────────────────────────────────────────────
exports.addItem = async (req, res) => {
  try {
    const { product, name, price, imageUrl, category, quantity = 1 } = req.body;

    if (!product)
      return res.status(400).json({ message: 'product id required' });

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) cart = new Cart({ user: req.user.id, items: [] });

    const idx = cart.items.findIndex(i => i.product.toString() === product);
    if (idx >= 0) {
      cart.items[idx].quantity += Number(quantity);
    } else {
      cart.items.push({ product, name, price, imageUrl, category, quantity });
    }

    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error('addItem error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── REMOVE item ───────────────────────────────────────────────────────────────
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOneAndUpdate(
      { user: req.user.id },
      { $pull: { items: { product: productId } } },
      { new: true }
    );

    res.json(cart || { user: req.user.id, items: [] });
  } catch (err) {
    console.error('removeItem error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE quantity ───────────────────────────────────────────────────────────
exports.updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity }  = req.body;

    if (quantity < 1) {
      // Remove if quantity < 1
      return exports.removeItem(req, res);
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });

    const idx = cart.items.findIndex(i => i.product.toString() === productId);
    if (idx >= 0) cart.items[idx].quantity = quantity;

    await cart.save();
    res.json(cart);
  } catch (err) {
    console.error('updateQuantity error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── CLEAR cart ────────────────────────────────────────────────────────────────
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user.id },
      { items: [] },
      { new: true, upsert: true }
    );
    res.json(cart);
  } catch (err) {
    console.error('clearCart error:', err.message);
    res.status(500).json({ message: err.message });
  }
};