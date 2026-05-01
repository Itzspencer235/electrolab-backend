const Wishlist = require('../models/Wishlist');

// ── GET wishlist ──────────────────────────────────────────────────────────────
exports.getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) wishlist = await Wishlist.create({ user: req.user.id, items: [] });
    res.json(wishlist);
  } catch (err) {
    console.error('getWishlist error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── SYNC wishlist ─────────────────────────────────────────────────────────────
exports.syncWishlist = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items))
      return res.status(400).json({ message: 'items must be an array' });

    console.log(`❤️  syncWishlist  user=${req.user.id}  items=${items.length}`);

    const wishlist = await Wishlist.findOneAndUpdate(
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
          })),
      },
      { new: true, upsert: true }
    );

    console.log(`✅ Wishlist synced — items in DB: ${wishlist.items.length}`);
    res.json(wishlist);
  } catch (err) {
    console.error('❌ syncWishlist error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── TOGGLE item ───────────────────────────────────────────────────────────────
exports.toggleItem = async (req, res) => {
  try {
    const { product, name, price, imageUrl, category } = req.body;

    if (!product)
      return res.status(400).json({ message: 'product id required' });

    let wishlist = await Wishlist.findOne({ user: req.user.id });
    if (!wishlist) wishlist = new Wishlist({ user: req.user.id, items: [] });

    const idx = wishlist.items.findIndex(i => i.product.toString() === product);
    let wishlisted = false;

    if (idx >= 0) {
      wishlist.items.splice(idx, 1);
      wishlisted = false;
    } else {
      wishlist.items.push({ product, name, price, imageUrl, category });
      wishlisted = true;
    }

    await wishlist.save();
    res.json({ wishlist, wishlisted });
  } catch (err) {
    console.error('toggleItem error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── REMOVE item ───────────────────────────────────────────────────────────────
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user.id },
      { $pull: { items: { product: productId } } },
      { new: true }
    );

    res.json(wishlist || { user: req.user.id, items: [] });
  } catch (err) {
    console.error('removeItem error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── CLEAR wishlist ────────────────────────────────────────────────────────────
exports.clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user.id },
      { items: [] },
      { new: true, upsert: true }
    );
    res.json(wishlist);
  } catch (err) {
    console.error('clearWishlist error:', err.message);
    res.status(500).json({ message: err.message });
  }
};