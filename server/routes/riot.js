const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Helper to make Riot API requests
const riotFetch = async (url) => {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': RIOT_API_KEY
    }
  });

  if (!response.ok) {
    const error = new Error(`Riot API error: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

// Get player data by Riot ID (gameName#tagLine)
router.get('/player/:gameName/:tagLine', authenticateToken, async (req, res) => {
  try {
    if (!RIOT_API_KEY) {
      return res.status(500).json({ error: 'Riot API key not configured' });
    }

    const { gameName, tagLine } = req.params;
    const region = req.query.region || 'na1';

    // Map region to routing value for account API
    const routingMap = {
      'na1': 'americas',
      'br1': 'americas',
      'la1': 'americas',
      'la2': 'americas',
      'euw1': 'europe',
      'eun1': 'europe',
      'tr1': 'europe',
      'ru': 'europe',
      'kr': 'asia',
      'jp1': 'asia',
      'oc1': 'sea',
      'ph2': 'sea',
      'sg2': 'sea',
      'th2': 'sea',
      'tw2': 'sea',
      'vn2': 'sea'
    };

    const routing = routingMap[region] || 'americas';

    // Step 1: Get PUUID from Riot ID
    const accountData = await riotFetch(
      `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    const puuid = accountData.puuid;

    // Step 2: Get summoner data (profile icon, level)
    const summonerData = await riotFetch(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`
    );

    // Step 3: Get ranked data
    let rankedData = [];
    try {
      rankedData = await riotFetch(
        `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`
      );
    } catch (e) {
      // Player might be unranked
      console.log('Could not fetch ranked data:', e.message);
    }

    // Find solo queue rank
    const soloQueue = rankedData.find(q => q.queueType === 'RANKED_SOLO_5x5');
    const flexQueue = rankedData.find(q => q.queueType === 'RANKED_FLEX_SR');

    res.json({
      puuid: puuid,
      gameName: accountData.gameName,
      tagLine: accountData.tagLine,
      profileIconId: summonerData.profileIconId,
      summonerLevel: summonerData.summonerLevel,
      soloQueue: soloQueue ? {
        tier: soloQueue.tier,
        rank: soloQueue.rank,
        lp: soloQueue.leaguePoints,
        wins: soloQueue.wins,
        losses: soloQueue.losses,
        winRate: Math.round((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100)
      } : null,
      flexQueue: flexQueue ? {
        tier: flexQueue.tier,
        rank: flexQueue.rank,
        lp: flexQueue.leaguePoints,
        wins: flexQueue.wins,
        losses: flexQueue.losses,
        winRate: Math.round((flexQueue.wins / (flexQueue.wins + flexQueue.losses)) * 100)
      } : null
    });

  } catch (error) {
    console.error('Riot API error:', error);
    if (error.status === 404) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (error.status === 403) {
      return res.status(403).json({ error: 'Riot API key expired or invalid' });
    }
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

module.exports = router;
