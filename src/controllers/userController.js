const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { welcomeUser } = require('../services/notify');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signToken = (user) => jwt.sign(
  { id: user._id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '90d' }
);

// Only plain strings are accepted for identifiers (never {"$regex": ...} etc.)
const asString = (v, max = 200) =>
  (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : undefined);

// Same answer whether the account is missing or the password is wrong,
// so the login form can't be used to find out who has an account.
const BAD_LOGIN = 'Identifiants incorrects';

// A Google/Facebook sign-in proved who owns this email. If a password account
// with the same email was never verified, whoever created it may not own the
// email: drop that password so only the real owner keeps access.
const claimByEmail = (user) => {
  if (!user.isVerified && user.password) user.password = undefined;
  user.isVerified = true;
};

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
    const name     = asString(req.body?.name, 100);
    const email    = asString(req.body?.email)?.toLowerCase();
    const phone    = asString(req.body?.phone, 30);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const language = ['fr', 'en', 'ar'].includes(req.body?.language) ? req.body.language : 'fr';

    if (password.length > 200)
      return res.status(400).json({ message: 'Mot de passe trop long' });
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
      language,
      provider:    'local',
      lastLoginAt: new Date(),
    });

    res.status(201).json(userResponse(user, signToken(user)));
    welcomeUser(user); // in-app welcome + welcome email (after responding)
  } catch (err) {
    console.error('Register error:', err.message);
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const email    = asString(req.body?.email);
    const phone    = asString(req.body?.phone, 30);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if ((!email && !phone) || !password || password.length > 200)
      return res.status(401).json({ message: BAD_LOGIN });

    const user = email
      ? await User.findOne({ email: { $in: [email, email.toLowerCase()] } })
      : await User.findOne({ phone });

    // Google/Facebook-only accounts have no password: same generic answer
    const valid = !!user?.password && await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: BAD_LOGIN });

    user.lastLoginAt = new Date();
    await user.save();

    res.json(userResponse(user, signToken(user)));
    welcomeUser(user); // only does something the first time (or until the email went out)
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

// ── Google OAuth (ID token from mobile, access token from web) ────────────────
exports.googleAuth = async (req, res) => {
  try {
    const idToken = asString(req.body?.idToken, 4096);
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

    if (!payload?.email || !payload?.sub) {
      return res.status(400).json({ message: 'Email introuvable depuis Google' });
    }
    // userinfo can return the flag as a string
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      return res.status(401).json({ message: 'Email Google non vérifié' });
    }

    let user = await User.findOne({ googleId: String(payload.sub) });
    if (!user) {
      user = await User.findOne({ email: String(payload.email) });
      if (user) {
        user.googleId = payload.sub;
        user.provider = 'google';
        claimByEmail(user);
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
    welcomeUser(user); // only does something the first time (or until the email went out)
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(500).json({ message: 'Connexion Google impossible' });
  }
};

// ── Facebook OAuth ────────────────────────────────────────────────────────────
exports.facebookAuth = async (req, res) => {
  try {
    const accessToken = asString(req.body?.accessToken, 4096);
    if (!accessToken) return res.status(400).json({ message: 'Token requis' });
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      console.error('Facebook login: FACEBOOK_APP_ID is not set on the server');
      return res.status(503).json({ message: 'Connexion Facebook indisponible' });
    }

    // The token must have been issued for OUR Facebook app, not any app
    const appRes  = await fetch(`https://graph.facebook.com/app?${new URLSearchParams({ access_token: accessToken })}`);
    const appData = await appRes.json().catch(() => ({}));
    if (!appRes.ok || String(appData.id) !== String(appId))
      return res.status(401).json({ message: 'Token Facebook invalide' });

    const fbRes  = await fetch(`https://graph.facebook.com/me?${new URLSearchParams({
      fields: 'id,name,email,picture', access_token: accessToken,
    })}`);
    const fbData = await fbRes.json().catch(() => ({}));
    if (!fbRes.ok || fbData.error || !fbData.id)
      return res.status(401).json({ message: 'Token Facebook invalide' });

    let user = await User.findOne({ facebookId: fbData.id });
    if (!user) {
      if (fbData.email) user = await User.findOne({ email: String(fbData.email) });
      if (user) {
        user.facebookId = fbData.id;
        user.provider   = 'facebook';
        claimByEmail(user);
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
    welcomeUser(user); // only does something the first time (or until the email went out)
  } catch (err) {
    console.error('Facebook auth error:', err.message);
    res.status(500).json({ message: 'Connexion Facebook impossible' });
  }
};

// ── Get profile ───────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -fcmTokens')
      .populate('cart.product',     'name price imageUrl category stock')
      .populate('wishlist.product', 'name price imageUrl category stock');
    if (!user)
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};

// ── Update profile ────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const update = {};
    const name   = asString(req.body?.name, 100);
    const avatar = typeof req.body?.avatar === 'string' ? req.body.avatar.trim() : undefined;
    if (name) update.name = name;
    if (['fr', 'en', 'ar'].includes(req.body?.language)) update.language = req.body.language;
    if (avatar !== undefined) {
      if (avatar && !/^https:\/\//i.test(avatar)) return res.status(400).json({ message: 'Invalid avatar URL' });
      update.avatar = avatar.slice(0, 1000);
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true })
      .select('-password -fcmTokens');
    res.json(user);
  } catch (err) {
    console.error(err); res.status(500).json({ message: 'Server error' });
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
    console.error(err); res.status(500).json({ message: 'Server error' });
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
    console.error(err); res.status(500).json({ message: 'Server error' });
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
    console.error(err); res.status(500).json({ message: 'Server error' });
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
    console.error(err); res.status(500).json({ message: 'Server error' });
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
    console.error(err); res.status(500).json({ message: 'Server error' });
  }
};
