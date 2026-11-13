const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '90d' }
);

const userResponse = (user, token) => ({
  token,
  user: {
    id:       user._id,
    name:     user.name,
    email:    user.email,
    phone:    user.phone,
    avatar:   user.avatar,
    role:     user.role,
    provider: user.provider,
    language: user.language,
  },
});

// ── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, language } = req.body;

    if (!name || !password)
      return res.status(400).json({ message: 'Nom et mot de passe requis' });
    if (!email && !phone)
      return res.status(400).json({ message: 'Email ou téléphone requis' });

    if (email) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email déjà utilisé' });
    }
    if (phone) {
      const exists = await User.findOne({ phone });
      if (exists) return res.status(400).json({ message: 'Téléphone déjà utilisé' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({
      name,
      email:       email    || undefined,
      phone:       phone    || undefined,
      password:    hashed,
      language:    language || 'fr',
      provider:    'local',
      lastLoginAt: new Date(),
    });

    res.status(201).json(userResponse(user, signToken(user)));
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    const user = email
      ? await User.findOne({ email })
      : await User.findOne({ phone });

    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    if (!user.password)
      return res.status(400).json({ message: 'Compte OAuth — utilisez Google ou Facebook' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Mot de passe incorrect' });

    user.lastLoginAt = new Date();
    await user.save();

    res.json(userResponse(user, signToken(user)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Google OAuth (ID token from mobile, access token from web) ────────────────
exports.googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Token requis' });

    let payload;

    try {
      // Mobile: ID token
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      // Web: access token. Confirm it was issued for OUR client ID first.
      const infoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(idToken)}`
      );
      if (!infoRes.ok) throw new Error('Invalid Google token');
      const info = await infoRes.json();
      if (info.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Google token audience mismatch');
      }

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!userRes.ok) throw new Error('Cannot read Google profile');
      payload = await userRes.json();
    }

    if (!payload?.email) {
      return res.status(400).json({ message: 'Email introuvable depuis Google' });
    }

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email });
      if (user) {
        user.googleId = payload.sub;
        user.provider = 'google';
        if (!user.avatar) user.avatar = payload.picture;
      } else {
        user = await User.create({
          name:        payload.name,
          email:       payload.email,
          googleId:    payload.sub,
          avatar:      payload.picture,
          provider:    'google',
          isVerified:  true,
          lastLoginAt: new Date(),
        });
      }
    }

    user.lastLoginAt = new Date();
    await user.save();
    res.json(userResponse(user, signToken(user)));
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(500).json({ message: 'Erreur Google OAuth: ' + err.message });
  }
};

// ── Facebook OAuth ────────────────────────────────────────────────────────────
exports.facebookAuth = async (req, res) => {
  try {
    const { accessToken, userId } = req.body;
    const fbRes  = await fetch(
      `https://graph.facebook.com/${userId}?fields=id,name,email,picture&access_token=${accessToken}`
    );
    const fbData = await fbRes.json();
    if (fbData.error)
      return res.status(401).json({ message: 'Token Facebook invalide' });

    let user = await User.findOne({ facebookId: fbData.id });
    if (!user) {
      if (fbData.email) user = await User.findOne({ email: fbData.email });
      if (user) {
        user.facebookId = fbData.id;
        user.provider   = 'facebook';
      } else {
        user = await User.create({
          name: fbData.name, email: fbData.email || undefined,
          facebookId: fbData.id, avatar: fbData.picture?.data?.url || '',
          provider: 'facebook', isVerified: true, lastLoginAt: new Date(),
        });
      }
    }
    user.lastLoginAt = new Date();
    await user.save();
    res.json(userResponse(user, signToken(user)));
  } catch (err) {
    console.error('Facebook auth error:', err.message);
    res.status(500).json({ message: 'Erreur Facebook OAuth: ' + err.message });
  }
};

// ── Get profile ───────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('cart.product',     'name price imageUrl category stock')
      .populate('wishlist.product', 'name price imageUrl category stock');
    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update profile ────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, language, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, language, avatar },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Sync cart (legacy) ────────────────────────────────────────────────────────
exports.syncCart = async (req, res) => {
  try {
    const { cart } = req.body;

    if (!Array.isArray(cart))
      return res.status(400).json({ message: 'cart must be an array' });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          cart: cart.map(i => ({
            product:  i.product  || undefined,
            name:     i.name     || '',
            price:    Number(i.price)    || 0,
            imageUrl: i.imageUrl || '',
            category: i.category || '',
            quantity: Number(i.quantity) || 1,
          })),
        },
      },
      { new: true }
    ).select('cart');

    if (!updated)
      return res.status(404).json({ message: 'User not found' });

    res.json({ cart: updated.cart });
  } catch (err) {
    console.error('❌ syncCart error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── Sync wishlist (legacy) ────────────────────────────────────────────────────
exports.syncWishlist = async (req, res) => {
  try {
    const { wishlist } = req.body;

    if (!Array.isArray(wishlist))
      return res.status(400).json({ message: 'wishlist must be an array' });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          wishlist: wishlist.map(i => ({
            product:  i.product  || undefined,
            name:     i.name     || '',
            price:    Number(i.price)    || 0,
            imageUrl: i.imageUrl || '',
            category: i.category || '',
          })),
        },
      },
      { new: true }
    ).select('wishlist');

    if (!updated)
      return res.status(404).json({ message: 'User not found' });

    res.json({ wishlist: updated.wishlist });
  } catch (err) {
    console.error('❌ syncWishlist error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ── Add to cart ───────────────────────────────────────────────────────────────
exports.addToCart = async (req, res) => {
  try {
    const { productId, name, price, imageUrl, category } = req.body;
    const user = await User.findById(req.user.id);

    const idx = user.cart.findIndex(i => i.product?.toString() === productId);
    if (idx >= 0) {
      user.cart[idx].quantity += 1;
    } else {
      user.cart.push({ product: productId, name, price, imageUrl, category, quantity: 1 });
    }
    await user.save();
    res.json({ cart: user.cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Remove from cart ──────────────────────────────────────────────────────────
exports.removeFromCart = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.cart  = user.cart.filter(i => i.product?.toString() !== req.params.productId);
    await user.save();
    res.json({ cart: user.cart });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Toggle wishlist ───────────────────────────────────────────────────────────
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId, name, price, imageUrl, category } = req.body;
    const user = await User.findById(req.user.id);

    const idx = user.wishlist.findIndex(i => i.product?.toString() === productId);
    if (idx >= 0) {
      user.wishlist.splice(idx, 1);
    } else {
      user.wishlist.push({ product: productId, name, price, imageUrl, category });
    }
    await user.save();
    res.json({ wishlist: user.wishlist, wishlisted: idx < 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
