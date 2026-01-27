const express = require('express');
const db = require('../database/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Helper to make Riot API requests
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

// Get region routing for Riot API
const getRouting = (region) => {
  const routingMap = {
    'na': 'americas', 'br': 'americas', 'lan': 'americas', 'las': 'americas',
    'euw': 'europe', 'eune': 'europe', 'tr': 'europe', 'ru': 'europe',
    'kr': 'asia', 'jp': 'asia', 'oce': 'sea'
  };
  return routingMap[region] || 'americas';
};

// POST /api/practice/scan - Scan for practice matches (admin or cron)
router.post('/scan', async (req, res, next) => {
  // Allow cron jobs to bypass auth
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret === process.env.CRON_SECRET || cronSecret === 'internal-refresh') {
    req.user = { role: 'admin' };
    return next();
  }
  // Otherwise require normal auth
  authenticateToken(req, res, () => {
    requireAdmin(req, res, next);
  });
}, async (req, res) => {
  try {
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'Riot API key not configured' });
    }

    // Get all roster players with riot_puuid
    const players = db.prepare(`
      SELECT id, summoner_name, riot_puuid, opgg_region, champion_pool
      FROM players WHERE riot_puuid IS NOT NULL
    `).all();

    if (players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players with linked Riot IDs to detect practice matches' });
    }

    // Create PUUID -> player mapping
    const puuidToPlayer = {};
    players.forEach(p => {
      puuidToPlayer[p.riot_puuid] = p;
    });

    const allPuuids = new Set(players.map(p => p.riot_puuid));

    // Fetch recent match IDs for each player
    const matchIdSets = {};
    for (const player of players) {
      const routing = getRouting(player.opgg_region || 'na');
      try {
        const matchIds = await riotFetch(
          `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${player.riot_puuid}/ids?count=20`
        );
        matchIdSets[player.id] = new Set(matchIds);
        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.log(`Failed to fetch matches for ${player.summoner_name}:`, e.message);
        matchIdSets[player.id] = new Set();
      }
    }

    // Collect all unique match IDs
    const allMatchIds = new Set();
    Object.values(matchIdSets).forEach(set => {
      set.forEach(id => allMatchIds.add(id));
    });

    // Check which matches we already have
    const existingMatches = new Set(
      db.prepare('SELECT match_id FROM practice_matches').all().map(r => r.match_id)
    );

    // Filter to new matches only
    const newMatchIds = [...allMatchIds].filter(id => !existingMatches.has(id));

    let practiceMatchesFound = 0;
    let playersUpdated = new Set();
    const routing = getRouting(players[0].opgg_region || 'na');

    // Process each new match
    for (const matchId of newMatchIds) {
      try {
        const match = await riotFetch(
          `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`
        );

        // Count roster members in this match
        const rosterParticipants = match.info.participants.filter(p => allPuuids.has(p.puuid));

        if (rosterParticipants.length >= 2) {
          // This is a practice match!
          practiceMatchesFound++;

          // Store the match
          db.prepare(`
            INSERT OR IGNORE INTO practice_matches
            (match_id, game_creation, game_duration, game_mode, winning_team, roster_player_count, participants)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            matchId,
            match.info.gameCreation,
            match.info.gameDuration,
            match.info.gameMode,
            match.info.participants.find(p => p.win)?.teamId || null,
            rosterParticipants.length,
            JSON.stringify(match.info.participants.map(p => ({
              puuid: p.puuid,
              summonerName: p.riotIdGameName || p.summonerName,
              champion: p.championName,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              cs: p.totalMinionsKilled + p.neutralMinionsKilled,
              damage: p.totalDamageDealtToChampions,
              win: p.win,
              teamId: p.teamId
            })))
          );

          // Update player stats for each roster member
          for (const participant of rosterParticipants) {
            const player = puuidToPlayer[participant.puuid];
            if (!player) continue;

            playersUpdated.add(player.id);

            // Upsert champion stats
            db.prepare(`
              INSERT INTO practice_player_stats (player_id, champion, games, wins, kills, deaths, assists, cs, total_damage, updated_at)
              VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(player_id, champion) DO UPDATE SET
                games = games + 1,
                wins = wins + excluded.wins,
                kills = kills + excluded.kills,
                deaths = deaths + excluded.deaths,
                assists = assists + excluded.assists,
                cs = cs + excluded.cs,
                total_damage = total_damage + excluded.total_damage,
                updated_at = CURRENT_TIMESTAMP
            `).run(
              player.id,
              participant.championName,
              participant.win ? 1 : 0,
              participant.kills,
              participant.deaths,
              participant.assists,
              participant.totalMinionsKilled + participant.neutralMinionsKilled,
              participant.totalDamageDealtToChampions
            );
          }
        }

        // Rate limit delay
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (e) {
        console.log(`Failed to process match ${matchId}:`, e.message);
      }
    }

    // Auto-update champion pools based on threshold
    const settings = db.prepare('SELECT auto_pool_threshold FROM practice_settings WHERE id = 1').get();
    const threshold = settings?.auto_pool_threshold || 3;

    let poolsUpdated = 0;
    for (const playerId of playersUpdated) {
      const player = players.find(p => p.id === playerId);
      if (!player) continue;

      const currentPool = player.champion_pool ? player.champion_pool.split(',').map(c => c.trim()).filter(Boolean) : [];
      const practiceChamps = db.prepare(`
        SELECT champion FROM practice_player_stats
        WHERE player_id = ? AND games >= ?
      `).all(playerId, threshold);

      let poolChanged = false;
      for (const { champion } of practiceChamps) {
        if (!currentPool.includes(champion)) {
          currentPool.push(champion);
          poolChanged = true;
        }
      }

      if (poolChanged) {
        db.prepare('UPDATE players SET champion_pool = ? WHERE id = ?')
          .run(currentPool.join(', '), playerId);
        poolsUpdated++;
      }
    }

    // Update last scan time
    db.prepare('UPDATE practice_settings SET last_scan_at = CURRENT_TIMESTAMP WHERE id = 1').run();

    res.json({
      success: true,
      matchesScanned: newMatchIds.length,
      practiceMatchesFound,
      playersUpdated: playersUpdated.size,
      poolsUpdated
    });

  } catch (error) {
    console.error('Practice scan error:', error);
    res.status(500).json({ error: 'Failed to scan for practice matches' });
  }
});

// GET /api/practice/matches - Get practice match history
router.get('/matches', authenticateToken, (req, res) => {
  try {
    const { limit = 20, offset = 0, player_id } = req.query;

    let query = `
      SELECT * FROM practice_matches
      ORDER BY game_creation DESC
      LIMIT ? OFFSET ?
    `;
    let params = [parseInt(limit), parseInt(offset)];

    const matches = db.prepare(query).all(...params);

    // Parse participants and add player info
    const players = db.prepare('SELECT id, summoner_name, riot_puuid FROM players').all();
    const puuidToPlayer = {};
    players.forEach(p => {
      puuidToPlayer[p.riot_puuid] = p;
    });

    const enrichedMatches = matches.map(match => {
      const participants = JSON.parse(match.participants);
      const rosterParticipants = participants.filter(p => puuidToPlayer[p.puuid]);

      return {
        ...match,
        participants,
        rosterParticipants: rosterParticipants.map(p => ({
          ...p,
          playerId: puuidToPlayer[p.puuid]?.id,
          playerName: puuidToPlayer[p.puuid]?.summoner_name
        }))
      };
    });

    // Filter by player if requested
    let filteredMatches = enrichedMatches;
    if (player_id) {
      filteredMatches = enrichedMatches.filter(m =>
        m.rosterParticipants.some(p => p.playerId === parseInt(player_id))
      );
    }

    const total = db.prepare('SELECT COUNT(*) as count FROM practice_matches').get().count;

    res.json({
      matches: filteredMatches,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching practice matches:', error);
    res.status(500).json({ error: 'Failed to fetch practice matches' });
  }
});

// GET /api/practice/stats - Get aggregated practice stats for all players
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const players = db.prepare(`
      SELECT id, summoner_name, role, champion_pool FROM players
      ORDER BY
        CASE role
          WHEN 'Top' THEN 1
          WHEN 'Jungle' THEN 2
          WHEN 'Mid' THEN 3
          WHEN 'ADC' THEN 4
          WHEN 'Support' THEN 5
          ELSE 6
        END
    `).all();

    const playerStats = players.map(player => {
      const stats = db.prepare(`
        SELECT champion, games, wins, kills, deaths, assists, cs, total_damage
        FROM practice_player_stats
        WHERE player_id = ?
        ORDER BY games DESC
      `).all(player.id);

      const currentPool = player.champion_pool ? player.champion_pool.split(',').map(c => c.trim()).filter(Boolean) : [];

      const enrichedStats = stats.map(s => ({
        ...s,
        winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
        kda: s.deaths === 0 ? 'Perfect' : ((s.kills + s.assists) / s.deaths).toFixed(2),
        avgKills: (s.kills / s.games).toFixed(1),
        avgDeaths: (s.deaths / s.games).toFixed(1),
        avgAssists: (s.assists / s.games).toFixed(1),
        avgCs: Math.round(s.cs / s.games),
        avgDamage: Math.round(s.total_damage / s.games),
        inPool: currentPool.includes(s.champion)
      }));

      const totalGames = stats.reduce((sum, s) => sum + s.games, 0);
      const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);

      return {
        player: {
          id: player.id,
          name: player.summoner_name,
          role: player.role
        },
        totalGames,
        totalWins,
        winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0,
        champions: enrichedStats
      };
    });

    res.json(playerStats);

  } catch (error) {
    console.error('Error fetching practice stats:', error);
    res.status(500).json({ error: 'Failed to fetch practice stats' });
  }
});

// GET /api/practice/stats/:playerId - Get practice stats for a specific player
router.get('/stats/:playerId', authenticateToken, (req, res) => {
  try {
    const { playerId } = req.params;

    const player = db.prepare('SELECT id, summoner_name, role, champion_pool FROM players WHERE id = ?').get(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const stats = db.prepare(`
      SELECT champion, games, wins, kills, deaths, assists, cs, total_damage
      FROM practice_player_stats
      WHERE player_id = ?
      ORDER BY games DESC
    `).all(playerId);

    const currentPool = player.champion_pool ? player.champion_pool.split(',').map(c => c.trim()).filter(Boolean) : [];

    const enrichedStats = stats.map(s => ({
      ...s,
      winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
      kda: s.deaths === 0 ? 'Perfect' : ((s.kills + s.assists) / s.deaths).toFixed(2),
      avgKills: (s.kills / s.games).toFixed(1),
      avgDeaths: (s.deaths / s.games).toFixed(1),
      avgAssists: (s.assists / s.games).toFixed(1),
      avgCs: Math.round(s.cs / s.games),
      avgDamage: Math.round(s.total_damage / s.games),
      inPool: currentPool.includes(s.champion)
    }));

    res.json({
      player: {
        id: player.id,
        name: player.summoner_name,
        role: player.role
      },
      champions: enrichedStats
    });

  } catch (error) {
    console.error('Error fetching player practice stats:', error);
    res.status(500).json({ error: 'Failed to fetch player practice stats' });
  }
});

// GET /api/practice/settings - Get practice settings
router.get('/settings', authenticateToken, requireAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM practice_settings WHERE id = 1').get();
    res.json(settings || { auto_pool_threshold: 3, last_scan_at: null });
  } catch (error) {
    console.error('Error fetching practice settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/practice/settings - Update practice settings
router.put('/settings', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { auto_pool_threshold } = req.body;

    if (auto_pool_threshold !== undefined) {
      const threshold = Math.max(1, Math.min(20, parseInt(auto_pool_threshold)));
      db.prepare('UPDATE practice_settings SET auto_pool_threshold = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1')
        .run(threshold);
    }

    const settings = db.prepare('SELECT * FROM practice_settings WHERE id = 1').get();
    res.json(settings);

  } catch (error) {
    console.error('Error updating practice settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/practice/overview - Get team practice overview
router.get('/overview', authenticateToken, (req, res) => {
  try {
    // Total practice matches
    const totalMatches = db.prepare('SELECT COUNT(*) as count FROM practice_matches').get().count;

    // Most played champions across team
    const mostPlayed = db.prepare(`
      SELECT champion, SUM(games) as total_games, SUM(wins) as total_wins
      FROM practice_player_stats
      GROUP BY champion
      ORDER BY total_games DESC
      LIMIT 10
    `).all().map(c => ({
      ...c,
      winRate: c.total_games > 0 ? Math.round((c.total_wins / c.total_games) * 100) : 0
    }));

    // Best performing (min 3 games, sorted by winrate)
    const bestPerforming = db.prepare(`
      SELECT champion, SUM(games) as total_games, SUM(wins) as total_wins
      FROM practice_player_stats
      GROUP BY champion
      HAVING total_games >= 3
      ORDER BY (CAST(total_wins AS FLOAT) / total_games) DESC
      LIMIT 5
    `).all().map(c => ({
      ...c,
      winRate: c.total_games > 0 ? Math.round((c.total_wins / c.total_games) * 100) : 0
    }));

    // Last scan time
    const settings = db.prepare('SELECT last_scan_at FROM practice_settings WHERE id = 1').get();

    res.json({
      totalMatches,
      mostPlayed,
      bestPerforming,
      lastScan: settings?.last_scan_at
    });

  } catch (error) {
    console.error('Error fetching practice overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

module.exports = router;
