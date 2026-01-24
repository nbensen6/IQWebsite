const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all stats
router.get('/', authenticateToken, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT * FROM match_stats
      ORDER BY match_date DESC
    `).all();

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Upload stats from CSV
router.post('/upload', authenticateToken, (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    const insert = db.prepare(`
      INSERT INTO match_stats (player, match_date, champion, kills, deaths, assists, cs, vision_score, damage, gold, result)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      let count = 0;
      for (const row of rows) {
        // Parse the CSV row - handle various column name formats
        const player = row.player || row.Player || '';
        const matchDate = row.date || row.match_date || row.Date || new Date().toISOString().split('T')[0];
        const champion = row.champion || row.Champion || '';
        const kills = parseInt(row.kills || row.Kills || 0);
        const deaths = parseInt(row.deaths || row.Deaths || 0);
        const assists = parseInt(row.assists || row.Assists || 0);
        const cs = parseInt(row.cs || row.CS || row.creeps || 0);
        const visionScore = parseInt(row.vision_score || row.vision || row.Vision || 0);
        const damage = parseInt(row.damage || row.Damage || 0);
        const gold = parseInt(row.gold || row.Gold || 0);
        const result = row.result || row.Result || 'Win';

        if (player && champion) {
          insert.run(player, matchDate, champion, kills, deaths, assists, cs, visionScore, damage, gold, result);
          count++;
        }
      }
      return count;
    });

    const count = insertMany(data);

    res.json({ success: true, count });
  } catch (error) {
    console.error('Error uploading stats:', error);
    res.status(500).json({ error: 'Failed to upload stats' });
  }
});

// Get stats for a specific player
router.get('/player/:name', authenticateToken, (req, res) => {
  try {
    const { name } = req.params;
    const stats = db.prepare(`
      SELECT * FROM match_stats
      WHERE player = ?
      ORDER BY match_date DESC
    `).all(name);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Delete a stat entry
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM match_stats WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stat:', error);
    res.status(500).json({ error: 'Failed to delete stat' });
  }
});

module.exports = router;
