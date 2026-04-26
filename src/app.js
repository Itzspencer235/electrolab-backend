const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/products',  require('./routes/products'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/tutorials', require('./routes/tutorials'));
app.use('/api/chat',      require('./routes/chat'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'IP ElectroLab API is running ✅' });
});

// Connect to MongoDB then start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    // FIXED - listens on all network interfaces
app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
  console.log(`✅ Network: http://0.0.0.0:${process.env.PORT || 5000}`);
});
    
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });