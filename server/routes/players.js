const express = require('express');
const db = require('../database/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all players (public)
router.get('/', (req, res) => {
  try {
    const players = db.prepare(`
      SELECT p.*, u.username
      FROM players p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY
        CASE p.role
          WHEN 'Top' THEN 1
          WHEN 'Jungle' THEN 2
          WHEN 'Mid' THEN 3
          WHEN 'ADC' THEN 4
          WHEN 'Support' THEN 5
          ELSE 6
        END
    `).all();

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get player by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const player = db.prepare(`
      SELECT p.*, u.username
      FROM players p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(id);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Create player (admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { summoner_name, role, champion_pool, user_id } = req.body;

    if (!summoner_name || !role) {
      return res.status(400).json({ error: 'Summoner name and role are required' });
    }

    const result = db.prepare(`
      INSERT INTO players (user_id, summoner_name, role, champion_pool)
      VALUES (?, ?, ?, ?)
    `).run(user_id || null, summoner_name, role, champion_pool || '');

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update player (admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { summoner_name, role, champion_pool, user_id } = req.body;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    db.prepare(`
      UPDATE players
      SET summoner_name = ?, role = ?, champion_pool = ?, user_id = ?
      WHERE id = ?
    `).run(
      summoner_name || player.summoner_name,
      role || player.role,
      champion_pool !== undefined ? champion_pool : player.champion_pool,
      user_id !== undefined ? user_id : player.user_id,
      id
    );

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player (admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    db.prepare('DELETE FROM players WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

module.exports = router;
