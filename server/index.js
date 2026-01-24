require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const notesRoutes = require('./routes/notes');
const playersRoutes = require('./routes/players');
const announcementsRoutes = require('./routes/announcements');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/announcements', announcementsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
