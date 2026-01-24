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

// Sync Riot data for a player
router.post('/:id/sync-riot', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const RIOT_API_KEY = process.env.RIOT_API_KEY;

    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'Riot API key not configured' });
    }

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (!player.opgg_username) {
      return res.status(400).json({ error: 'Player has no Riot ID linked' });
    }

    // Parse Riot ID (Name#TAG)
    const riotId = player.opgg_username.replace('#', '-').split('-');
    if (riotId.length < 2) {
      return res.status(400).json({ error: 'Invalid Riot ID format. Use Name#TAG' });
    }

    const gameName = riotId.slice(0, -1).join('-');
    const tagLine = riotId[riotId.length - 1];
    const region = player.opgg_region || 'na';

    // Map region to API values
    const regionMap = {
      'na': 'na1', 'euw': 'euw1', 'eune': 'eun1', 'kr': 'kr',
      'br': 'br1', 'lan': 'la1', 'las': 'la2', 'oce': 'oc1',
      'tr': 'tr1', 'ru': 'ru', 'jp': 'jp1'
    };
    const routingMap = {
      'na': 'americas', 'br': 'americas', 'lan': 'americas', 'las': 'americas',
      'euw': 'europe', 'eune': 'europe', 'tr': 'europe', 'ru': 'europe',
      'kr': 'asia', 'jp': 'asia', 'oce': 'sea'
    };

    const apiRegion = regionMap[region] || 'na1';
    const routing = routingMap[region] || 'americas';

    const riotFetch = async (url) => {
      const response = await fetch(url, {
        headers: { 'X-Riot-Token': RIOT_API_KEY }
      });
      if (!response.ok) {
        const error = new Error(`Riot API: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    };

    // Get PUUID
    const accountData = await riotFetch(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    // Get summoner data
    const summonerData = await riotFetch(
      `https://${apiRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`
    );

    // Get ranked data
    let soloQueue = null;
    try {
      const rankedData = await riotFetch(
        `https://${apiRegion}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`
      );
      soloQueue = rankedData.find(q => q.queueType === 'RANKED_SOLO_5x5');
    } catch (e) {
      console.log('Could not fetch ranked data');
    }

    // Update player in database
    db.prepare(`
      UPDATE players SET
        profile_icon_id = ?,
        summoner_level = ?,
        rank_tier = ?,
        rank_division = ?,
        rank_lp = ?,
        rank_wins = ?,
        rank_losses = ?,
        riot_puuid = ?,
        riot_data_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      summonerData.profileIconId,
      summonerData.summonerLevel,
      soloQueue?.tier || null,
      soloQueue?.rank || null,
      soloQueue?.leaguePoints || null,
      soloQueue?.wins || null,
      soloQueue?.losses || null,
      accountData.puuid,
      id
    );

    const updated = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    res.json(updated);

  } catch (error) {
    console.error('Riot sync error:', error);
    if (error.status === 404) {
      return res.status(404).json({ error: 'Player not found on Riot servers' });
    }
    if (error.status === 403) {
      return res.status(403).json({ error: 'Riot API key expired or invalid' });
    }
    res.status(500).json({ error: 'Failed to sync Riot data' });
  }
});

// Fetch op.gg data for a player (legacy endpoint)
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
