const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

require('dotenv').config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.get('/', (req, res) => res.json({ message: 'IP ElectroLab API ✅' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`✅ Server on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('❌ MongoDB error:', err));