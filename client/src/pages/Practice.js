import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function Practice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [overview, setOverview] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [matches, setMatches] = useState([]);
  const [settings, setSettings] = useState({ auto_pool_threshold: 3 });
  const [expandedMatches, setExpandedMatches] = useState(new Set());
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [version, setVersion] = useState('14.1.1');
  const [scanResult, setScanResult] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchData();
    fetchVersion();
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, statsRes, matchesRes] = await Promise.all([
        api.get('/practice/overview'),
        api.get('/practice/stats'),
        api.get('/practice/matches?limit=50')
      ]);
      setOverview(overviewRes.data);
      setPlayerStats(statsRes.data);
      setMatches(matchesRes.data.matches);

      if (isAdmin) {
        const settingsRes = await api.get('/practice/settings');
        setSettings(settingsRes.data);
      }
    } catch (err) {
      console.error('Failed to load practice data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersion = async () => {
    try {
      const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await response.json();
      setVersion(versions[0]);
    } catch (err) {
      console.error('Failed to fetch version');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const response = await api.post('/practice/scan');
      setScanResult(response.data);
      await fetchData();
    } catch (err) {
      console.error('Scan failed:', err);
      alert(err.response?.data?.error || 'Failed to scan for practice matches');
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateThreshold = async (newThreshold) => {
    try {
      const response = await api.put('/practice/settings', {
        auto_pool_threshold: newThreshold
      });
      setSettings(response.data);
    } catch (err) {
      console.error('Failed to update settings');
    }
  };

  const getChampionImage = (champId) => {
    if (!champId) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`;
  };

  const getProfileIconUrl = (iconId) => {
    if (!iconId) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${iconId}.png`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMatch = (matchId) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(matchId)) {
      newExpanded.delete(matchId);
    } else {
      newExpanded.add(matchId);
    }
    setExpandedMatches(newExpanded);
  };

  const togglePlayer = (playerId) => {
    const newExpanded = new Set(expandedPlayers);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedPlayers(newExpanded);
  };

  if (loading) return <div className="loading">Loading practice data...</div>;

  return (
    <div className="practice-page">
      <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Team Stats</h1>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="card mb-3">
          <div className="card-header">
            <h3 className="card-title">Scan Controls</h3>
          </div>
          <div className="practice-controls">
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : 'Scan for Practice Games'}
            </button>
            <div className="threshold-control">
              <label>Auto-add to pool after:</label>
              <select
                value={settings.auto_pool_threshold}
                onChange={(e) => handleUpdateThreshold(parseInt(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 10].map(n => (
                  <option key={n} value={n}>{n} games</option>
                ))}
              </select>
            </div>
            {overview?.lastScan && (
              <span className="last-scan">
                Last scan: {formatDate(overview.lastScan)}
              </span>
            )}
          </div>
          {scanResult && (
            <div className="scan-result">
              Scanned {scanResult.matchesScanned} matches, found {scanResult.practiceMatchesFound} practice games.
              {scanResult.poolsUpdated > 0 && ` Updated ${scanResult.poolsUpdated} champion pools.`}
            </div>
          )}
        </div>
      )}

      {/* Team Overview */}
      {overview && overview.totalMatches > 0 && (
        <div className="card mb-3">
          <div className="card-header">
            <h3 className="card-title">Team Overview</h3>
            <span className="match-count">{overview.totalMatches} practice games</span>
          </div>
          <div className="overview-grid">
            <div className="overview-section">
              <h4>Most Played</h4>
              <div className="champion-list">
                {overview.mostPlayed.slice(0, 5).map((champ, idx) => (
                  <div key={idx} className="champion-item">
                    <img
                      src={getChampionImage(champ.champion)}
                      alt={champ.champion}
                      className="champion-icon"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span className="champion-name">{champ.champion}</span>
                    <span className="champion-games">{champ.total_games} games</span>
                    <span className={`champion-winrate ${champ.winRate >= 50 ? 'positive' : 'negative'}`}>
                      {champ.winRate}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="overview-section">
              <h4>Best Performing</h4>
              <div className="champion-list">
                {overview.bestPerforming.map((champ, idx) => (
                  <div key={idx} className="champion-item">
                    <img
                      src={getChampionImage(champ.champion)}
                      alt={champ.champion}
                      className="champion-icon"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span className="champion-name">{champ.champion}</span>
                    <span className="champion-games">{champ.total_games} games</span>
                    <span className="champion-winrate positive">{champ.winRate}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player Stats */}
      <div className="card mb-3">
        <div className="card-header">
          <h3 className="card-title">Player Practice Stats</h3>
        </div>
        {playerStats.length === 0 || playerStats.every(p => p.totalGames === 0) ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No practice stats yet. {isAdmin ? 'Use the scan button above to find practice matches.' : 'Ask an admin to scan for practice matches.'}
          </p>
        ) : (
          <div className="player-stats-list">
            {playerStats.filter(p => p.totalGames > 0).map(player => (
              <div key={player.player.id} className="player-stats-item">
                <div
                  className="player-stats-header"
                  onClick={() => togglePlayer(player.player.id)}
                >
                  <div className="player-info">
                    <span className="player-name">{player.player.name}</span>
                    <span className="player-role">{player.player.role}</span>
                  </div>
                  <div className="player-summary">
                    <span className="total-games">{player.totalGames} games</span>
                    <span className={`total-winrate ${player.winRate >= 50 ? 'positive' : 'negative'}`}>
                      {player.winRate}% WR
                    </span>
                    <span className="expand-icon">
                      {expandedPlayers.has(player.player.id) ? '−' : '+'}
                    </span>
                  </div>
                </div>
                {expandedPlayers.has(player.player.id) && (
                  <div className="player-champions">
                    {player.champions.map((champ, idx) => (
                      <div key={idx} className="champion-stat-row">
                        <div className="champion-info">
                          <img
                            src={getChampionImage(champ.champion)}
                            alt={champ.champion}
                            className="champion-icon"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="champion-name">{champ.champion}</span>
                          {champ.inPool && <span className="in-pool-badge">In Pool</span>}
                        </div>
                        <div className="champion-stats">
                          <span className="stat">{champ.games} games</span>
                          <span className={`stat winrate ${champ.winRate >= 50 ? 'positive' : 'negative'}`}>
                            {champ.winRate}% WR
                          </span>
                          <span className="stat">{champ.kda} KDA</span>
                          <span className="stat-detail">
                            {champ.avgKills}/{champ.avgDeaths}/{champ.avgAssists}
                          </span>
                          <span className="stat-detail">{champ.avgCs} CS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Match History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Practice Matches</h3>
        </div>
        {matches.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            No practice matches found yet.
          </p>
        ) : (
          <div className="match-cards-grid">
            {matches.map(match => {
              const didWin = match.rosterParticipants.length > 0 && match.rosterParticipants[0].win;
              return (
                <div key={match.id} className={`match-card ${didWin ? 'win' : 'loss'}`}>
                  <div className="match-card-header">
                    <span className={`match-result ${didWin ? 'win' : 'loss'}`}>
                      {didWin ? 'Victory' : 'Defeat'}
                    </span>
                    <span className="match-card-duration">{formatDuration(match.game_duration)}</span>
                  </div>
                  <div className="match-card-date">{formatDate(match.game_creation)}</div>
                  <div className="match-card-players">
                    {match.rosterParticipants.map((p, idx) => (
                      <div key={idx} className="match-player-card">
                        <div className="player-avatar-wrapper">
                          {p.profileIconId ? (
                            <img
                              src={getProfileIconUrl(p.profileIconId)}
                              alt=""
                              className="player-profile-icon"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="player-profile-placeholder" />
                          )}
                          <img
                            src={getChampionImage(p.champion)}
                            alt={p.champion}
                            className="player-champion-overlay"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <div className="player-card-info">
                          <span className="player-card-name">{p.playerName}</span>
                          <span className="player-card-role">{p.role}</span>
                          <span className="player-card-kda">
                            {p.kills}/{p.deaths}/{p.assists}
                          </span>
                          <span className="player-card-cs">{p.cs} CS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="match-card-expand"
                    onClick={() => toggleMatch(match.id)}
                  >
                    {expandedMatches.has(match.id) ? 'Hide Details' : 'Show All Players'}
                  </button>
                  {expandedMatches.has(match.id) && (
                    <div className="match-card-details">
                      <div className="match-teams">
                        {[100, 200].map(teamId => (
                          <div key={teamId} className="match-team">
                            <div className={`team-header ${match.winning_team === teamId ? 'win' : 'loss'}`}>
                              {match.winning_team === teamId ? 'Victory' : 'Defeat'}
                            </div>
                            {match.participants
                              .filter(p => p.teamId === teamId)
                              .map((p, idx) => {
                                const isRoster = match.rosterParticipants.some(rp => rp.puuid === p.puuid);
                                return (
                                  <div key={idx} className={`team-player ${isRoster ? 'roster' : ''}`}>
                                    <img
                                      src={getChampionImage(p.champion)}
                                      alt={p.champion}
                                      className="team-player-champ"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <span className="team-player-name">{p.summonerName}</span>
                                    <span className="team-player-kda">{p.kills}/{p.deaths}/{p.assists}</span>
                                  </div>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .practice-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
        }

        .practice-controls {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }

        .threshold-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .threshold-control label {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .threshold-control select {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .last-scan {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .scan-result {
          margin-top: 1rem;
          padding: 0.75rem;
          background: var(--bg-secondary);
          border-radius: 4px;
          color: var(--accent-green);
        }

        .match-count {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .overview-section h4 {
          margin-bottom: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
          text-transform: uppercase;
        }

        .champion-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .champion-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: var(--bg-secondary);
          border-radius: 4px;
        }

        .champion-icon {
          width: 32px;
          height: 32px;
          border-radius: 4px;
        }

        .champion-icon-small {
          width: 24px;
          height: 24px;
          border-radius: 4px;
        }

        .champion-name {
          flex: 1;
        }

        .champion-games {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .champion-winrate {
          font-weight: 600;
          min-width: 40px;
          text-align: right;
        }

        .positive { color: var(--accent-green, #4ade80); }
        .negative { color: var(--accent-red, #f87171); }

        .player-stats-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .player-stats-item {
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        .player-stats-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          cursor: pointer;
          background: var(--bg-secondary);
        }

        .player-stats-header:hover {
          background: var(--bg-hover, var(--bg-secondary));
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .player-name {
          font-weight: 600;
          font-size: 1.1rem;
        }

        .player-role {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .player-summary {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .total-games {
          color: var(--text-secondary);
        }

        .total-winrate {
          font-weight: 600;
        }

        .expand-icon {
          font-size: 1.5rem;
          color: var(--text-secondary);
          width: 24px;
          text-align: center;
        }

        .player-champions {
          padding: 0.5rem 1rem 1rem;
        }

        .champion-stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          border-bottom: 1px solid var(--border);
        }

        .champion-stat-row:last-child {
          border-bottom: none;
        }

        .champion-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .in-pool-badge {
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          background: var(--accent-green, #4ade80);
          color: black;
          border-radius: 4px;
          font-weight: 600;
        }

        .champion-stats {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat {
          min-width: 70px;
          text-align: right;
        }

        .stat.winrate {
          font-weight: 600;
        }

        .stat-detail {
          color: var(--text-secondary);
          font-size: 0.85rem;
          min-width: 60px;
          text-align: right;
        }

        .match-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .match-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 1rem;
          border: 2px solid transparent;
        }

        .match-card.win {
          border-color: rgba(74, 222, 128, 0.3);
        }

        .match-card.loss {
          border-color: rgba(248, 113, 113, 0.3);
        }

        .match-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .match-result {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .match-result.win {
          color: var(--accent-green, #4ade80);
        }

        .match-result.loss {
          color: var(--accent-red, #f87171);
        }

        .match-card-duration {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .match-card-date {
          color: var(--text-secondary);
          font-size: 0.8rem;
          margin-bottom: 1rem;
        }

        .match-card-players {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .match-player-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          background: var(--bg-tertiary, #2a2a2a);
          border-radius: 8px;
        }

        .player-avatar-wrapper {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .player-profile-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
        }

        .player-profile-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--bg-primary);
          border: 2px solid var(--border-color);
        }

        .player-champion-overlay {
          position: absolute;
          bottom: -4px;
          right: -4px;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 2px solid var(--bg-secondary);
        }

        .player-card-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .player-card-name {
          font-weight: 600;
          font-size: 0.95rem;
        }

        .player-card-role {
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        .player-card-kda {
          font-size: 0.9rem;
          margin-top: 0.25rem;
        }

        .player-card-cs {
          color: var(--text-secondary);
          font-size: 0.8rem;
        }

        .match-card-expand {
          width: 100%;
          margin-top: 1rem;
          padding: 0.5rem;
          background: var(--bg-tertiary, #2a2a2a);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 0.85rem;
        }

        .match-card-expand:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .match-card-details {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        .match-teams {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .match-team {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .team-header {
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }

        .team-header.win {
          color: var(--accent-green, #4ade80);
        }

        .team-header.loss {
          color: var(--accent-red, #f87171);
        }

        .team-player {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          padding: 0.2rem 0;
        }

        .team-player.roster {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          padding: 0.2rem 0.4rem;
          margin: 0 -0.4rem;
        }

        .team-player-champ {
          width: 20px;
          height: 20px;
          border-radius: 4px;
        }

        .team-player-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .team-player-kda {
          color: var(--text-secondary);
          font-size: 0.75rem;
        }

        @media (max-width: 768px) {
          .champion-stats {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .match-cards-grid {
            grid-template-columns: 1fr;
          }

          .match-teams {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Practice;
