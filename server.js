require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const searchRoutes = require('./routes/search');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // React frontend URL
//   credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
});

// Routes
app.use('/api/search', searchRoutes);

app.get('/test', (req, res) => {
  res.json({ status: 'ok', message: 'Test route is working' });
});


// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Backend: http://localhost:${PORT}`);
  console.log(`🔍 Search API: http://localhost:${PORT}/api/search`);
});