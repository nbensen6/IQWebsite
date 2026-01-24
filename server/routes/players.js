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
    const { summoner_name, role, champion_pool, user_id, opgg_username, opgg_region } = req.body;

    if (!summoner_name || !role) {
      return res.status(400).json({ error: 'Summoner name and role are required' });
    }

    // Check if user_id is already linked to a player
    if (user_id) {
      const existingPlayer = db.prepare('SELECT id FROM players WHERE user_id = ?').get(user_id);
      if (existingPlayer) {
        return res.status(400).json({ error: 'This user is already linked to a player' });
      }
    }

    const result = db.prepare(`
      INSERT INTO players (user_id, summoner_name, role, champion_pool, opgg_username, opgg_region)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(user_id || null, summoner_name, role, champion_pool || '', opgg_username || null, opgg_region || 'na');

    const player = db.prepare(`
      SELECT p.*, u.username
      FROM players p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
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
    const { summoner_name, role, champion_pool, user_id, opgg_username, opgg_region } = req.body;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    db.prepare(`
      UPDATE players
      SET summoner_name = ?, role = ?, champion_pool = ?, user_id = ?, opgg_username = ?, opgg_region = ?
      WHERE id = ?
    `).run(
      summoner_name || player.summoner_name,
      role || player.role,
      champion_pool !== undefined ? champion_pool : player.champion_pool,
      user_id !== undefined ? user_id : player.user_id,
      opgg_username !== undefined ? opgg_username : player.opgg_username,
      opgg_region !== undefined ? opgg_region : player.opgg_region,
      id
    );

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Update player's role (admin only)
router.patch('/:id/role', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['Top', 'Jungle', 'Mid', 'ADC', 'Support'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    db.prepare('UPDATE players SET role = ? WHERE id = ?').run(role, id);

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating player role:', error);
    res.status(500).json({ error: 'Failed to update player role' });
  }
});

// Update player's op.gg link and profile icon (authenticated users can update their own)
router.patch('/:id/opgg', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { opgg_username, opgg_region, profile_icon_id } = req.body;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Allow if user is admin or if the player is linked to their account
    if (req.user.role !== 'admin' && player.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this player' });
    }

    db.prepare(`
      UPDATE players
      SET opgg_username = ?, opgg_region = ?, profile_icon_id = ?
      WHERE id = ?
    `).run(
      opgg_username !== undefined ? opgg_username : player.opgg_username,
      opgg_region || player.opgg_region || 'na',
      profile_icon_id !== undefined ? profile_icon_id : player.profile_icon_id,
      id
    );

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating player op.gg:', error);
    res.status(500).json({ error: 'Failed to update player op.gg' });
  }
});

// Fetch op.gg data for a player (scrapes public profile)
router.get('/:id/opgg-data', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (!player.opgg_username) {
      return res.status(400).json({ error: 'Player has no op.gg linked' });
    }

    // Return the op.gg URL - client will fetch via iframe/embed or we'll use their API
    const region = player.opgg_region || 'na';
    const opggUrl = `https://www.op.gg/summoners/${region}/${encodeURIComponent(player.opgg_username)}`;

    res.json({
      player_id: player.id,
      opgg_username: player.opgg_username,
      opgg_region: region,
      opgg_url: opggUrl
    });
  } catch (error) {
    console.error('Error fetching op.gg data:', error);
    res.status(500).json({ error: 'Failed to fetch op.gg data' });
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
