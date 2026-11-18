const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const helmet   = require('helmet');

require('dotenv').config();

const { sanitizeBody, apiLimiter } = require('./middleware/security');

const app = express();

// Render sits behind one proxy: needed so rate limits see the real client IP
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());

// CORS_ORIGINS="https://site.com,https://www.site.com" limits which websites
// may call the API from a browser. Unset = any site (the mobile apps don't
// send an Origin, so they are never affected).
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody);
app.use('/api', apiLimiter);

// Routes
app.use('/api/products',  require('./routes/products'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/tutorials', require('./routes/tutorials'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/chat',      require('./routes/chat'));

// ── NEW dedicated cart & wishlist routes ──────────────────────────────────────
app.use('/api/cart',      require('./routes/cart'));
app.use('/api/wishlist',  require('./routes/wishlist'));

// Product requests (customer asks for a product the shop doesn't have)
app.use('/api/requests',  require('./routes/requests'));
app.use('/api/translate', require('./routes/translate'));   // admin auto-translate
app.use('/api/notifications', require('./routes/notifications'));

app.get('/', (req, res) => res.json({ message: 'IP ElectroLab API ✅' }));

// Last resort: never send stack traces or internal error text to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Unhandled error:', err);
  res.status(status).json({
    message: status >= 500 ? 'Server error' : (err.expose ? err.message : 'Bad request'),
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    // Replace old unique email/phone indexes that break Google/Facebook sign-up
    require('./utils/fixUserIndexes')()
      .catch(err => console.error('❌ User index fix failed:', err.message));
    app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`✅ Server on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('❌ MongoDB error:', err));