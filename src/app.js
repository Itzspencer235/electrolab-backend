const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

require('dotenv').config();

const app = express();

// ── CORS — allow ALL origins for now (fix for dev) ────────────────────────────
app.use(cors({
  origin: true,        // reflects the request origin — allows everything
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/products',  require('./routes/products'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/tutorials', require('./routes/tutorials'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/chat',      require('./routes/chat'));

// ── Test route ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'IP ElectroLab API is running ✅' });
});

// ── Connect + start ───────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });