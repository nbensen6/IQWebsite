import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import VideoBackground from '../components/VideoBackground';

const ROLE_ICONS = {
  Top: '⚔️',
  Jungle: '🌲',
  Mid: '🎯',
  ADC: '🏹',
  Support: '🛡️'
};

const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];

const REGIONS = [
  { value: 'na', label: 'NA' },
  { value: 'euw', label: 'EUW' },
  { value: 'eune', label: 'EUNE' },
  { value: 'kr', label: 'KR' },
  { value: 'br', label: 'BR' },
  { value: 'lan', label: 'LAN' },
  { value: 'las', label: 'LAS' },
  { value: 'oce', label: 'OCE' },
  { value: 'tr', label: 'TR' },
  { value: 'ru', label: 'RU' },
  { value: 'jp', label: 'JP' },
];

function Roster() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('14.1.1');
  const [compositions, setCompositions] = useState([]);
  const [showCompForm, setShowCompForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [opggForm, setOpggForm] = useState({ username: '', region: 'na', iconId: '' });

  // Admin state
  const [users, setUsers] = useState([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    user_id: '',
    summoner_name: '',
    role: 'Top',
    champion_pool: '',
    opgg_username: '',
    opgg_region: 'na'
  });

  // New composition form state
  const [newComp, setNewComp] = useState({
    name: '',
    description: '',
    top_champion: '',
    jungle_champion: '',
    mid_champion: '',
    adc_champion: '',
    support_champion: '',
    tags: ''
  });

  const [champions, setChampions] = useState([]);

  useEffect(() => {
    fetchPlayers();
    fetchVersion();
    fetchCompositions();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchPlayers = async () => {
    try {
      const response = await api.get('/players');
      setPlayers(response.data);
    } catch (err) {
      console.error('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Failed to load users');
    }
  };

  const fetchVersion = async () => {
    try {
      const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await response.json();
      setVersion(versions[0]);

      // Also fetch champion list for composition selector
      const champResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`);
      const data = await champResponse.json();
      const champList = Object.values(data.data).map(c => ({ id: c.id, name: c.name }));
      setChampions(champList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to fetch version');
    }
  };

  const fetchCompositions = async () => {
    try {
      const response = await api.get('/compositions');
      setCompositions(response.data);
    } catch (err) {
      console.error('Failed to load compositions');
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

  const handleUpdateOpgg = async (playerId) => {
    try {
      const iconId = opggForm.iconId ? parseInt(opggForm.iconId) : null;
      await api.patch(`/players/${playerId}/opgg`, {
        opgg_username: opggForm.username,
        opgg_region: opggForm.region,
        profile_icon_id: iconId
      });
      setPlayers(players.map(p =>
        p.id === playerId
          ? { ...p, opgg_username: opggForm.username, opgg_region: opggForm.region, profile_icon_id: iconId }
          : p
      ));
      setEditingPlayer(null);
      setOpggForm({ username: '', region: 'na', iconId: '' });
    } catch (err) {
      console.error('Failed to update op.gg');
    }
  };

  const handleUpdateRole = async (playerId, newRole) => {
    try {
      await api.patch(`/players/${playerId}/role`, { role: newRole });
      setPlayers(players.map(p =>
        p.id === playerId ? { ...p, role: newRole } : p
      ));
      setEditingRole(null);
    } catch (err) {
      console.error('Failed to update role');
    }
  };

  const handleSyncRiot = async (playerId) => {
    try {
      const response = await api.post(`/players/${playerId}/sync-riot`);
      setPlayers(players.map(p =>
        p.id === playerId ? response.data : p
      ));
    } catch (err) {
      console.error('Failed to sync Riot data:', err.response?.data?.error || err.message);
      alert(err.response?.data?.error || 'Failed to sync Riot data');
    }
  };

  const getRankDisplay = (player) => {
    if (!player.rank_tier) return null;
    const winRate = player.rank_wins && player.rank_losses
      ? Math.round((player.rank_wins / (player.rank_wins + player.rank_losses)) * 100)
      : null;
    return {
      tier: player.rank_tier,
      division: player.rank_division,
      lp: player.rank_lp,
      wins: player.rank_wins,
      losses: player.rank_losses,
      winRate
    };
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/players', {
        ...newPlayer,
        user_id: newPlayer.user_id || null
      });
      setPlayers([...players, response.data]);
      setNewPlayer({
        user_id: '',
        summoner_name: '',
        role: 'Top',
        champion_pool: '',
        opgg_username: '',
        opgg_region: 'na'
      });
      setShowAddPlayer(false);
      fetchUsers(); // Refresh users to update player_id linkage
    } catch (err) {
      console.error('Failed to add player');
      alert(err.response?.data?.error || 'Failed to add player');
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!window.confirm('Remove this player from the roster?')) return;
    try {
      await api.delete(`/players/${playerId}`);
      setPlayers(players.filter(p => p.id !== playerId));
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete player');
    }
  };

  const handleCreateComposition = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/compositions', newComp);
      setCompositions([response.data, ...compositions]);
      setNewComp({
        name: '',
        description: '',
        top_champion: '',
        jungle_champion: '',
        mid_champion: '',
        adc_champion: '',
        support_champion: '',
        tags: ''
      });
      setShowCompForm(false);
    } catch (err) {
      console.error('Failed to create composition');
    }
  };

  const handleDeleteComposition = async (id) => {
    if (!window.confirm('Delete this composition?')) return;
    try {
      await api.delete(`/compositions/${id}`);
      setCompositions(compositions.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete composition');
    }
  };

  const getOpggUrl = (player) => {
    if (!player.opgg_username) return null;
    const region = player.opgg_region || 'na';
    // OP.GG uses Riot ID format: Name#TAG becomes Name-TAG in URL
    const formattedName = player.opgg_username.replace('#', '-');
    return `https://www.op.gg/summoners/${region}/${encodeURIComponent(formattedName)}`;
  };

  // Generate composition suggestions based on player champion pools
  const getCompSuggestions = () => {
    const suggestions = [];
    const playersByRole = {};

    players.forEach(p => {
      if (p.role && p.champion_pool) {
        playersByRole[p.role] = p.champion_pool.split(',').map(c => c.trim());
      }
    });

    // Simple suggestion: first champion from each player's pool
    if (Object.keys(playersByRole).length >= 3) {
      suggestions.push({
        name: 'Main Comfort Picks',
        champions: {
          top: playersByRole['Top']?.[0],
          jungle: playersByRole['Jungle']?.[0],
          mid: playersByRole['Mid']?.[0],
          adc: playersByRole['ADC']?.[0],
          support: playersByRole['Support']?.[0]
        }
      });

      // Second suggestion: second champion from each pool if available
      const hasSecondPicks = Object.values(playersByRole).some(pool => pool.length > 1);
      if (hasSecondPicks) {
        suggestions.push({
          name: 'Flex Picks',
          champions: {
            top: playersByRole['Top']?.[1] || playersByRole['Top']?.[0],
            jungle: playersByRole['Jungle']?.[1] || playersByRole['Jungle']?.[0],
            mid: playersByRole['Mid']?.[1] || playersByRole['Mid']?.[0],
            adc: playersByRole['ADC']?.[1] || playersByRole['ADC']?.[0],
            support: playersByRole['Support']?.[1] || playersByRole['Support']?.[0]
          }
        });
      }
    }

    return suggestions;
  };

  // Get users not yet linked to a player
  const getUnlinkedUsers = () => {
    return users.filter(u => !u.player_id);
  };

  if (loading) return <div className="loading">Loading roster...</div>;

  const compSuggestions = getCompSuggestions();
  const isAdmin = user?.role === 'admin';

  return (
    <VideoBackground videoSrc="/videos/AhriLoop.mp4">
      <div className="roster-page">
        <h1 style={{marginBottom: '1.5rem', textAlign: 'center'}}>Team Roster</h1>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="card mb-3">
          <div className="card-header">
            <h3 className="card-title">Admin Panel</h3>
            <button
              className="btn btn-primary btn-small"
              onClick={() => setShowAddPlayer(!showAddPlayer)}
            >
              {showAddPlayer ? 'Cancel' : '+ Add Player'}
            </button>
          </div>

          {showAddPlayer && (
            <form onSubmit={handleAddPlayer} className="add-player-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Link to User (optional)</label>
                  <select
                    value={newPlayer.user_id}
                    onChange={(e) => setNewPlayer({...newPlayer, user_id: e.target.value})}
                  >
                    <option value="">No linked user</option>
                    {getUnlinkedUsers().map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Summoner Name *</label>
                  <input
                    type="text"
                    value={newPlayer.summoner_name}
                    onChange={(e) => setNewPlayer({...newPlayer, summoner_name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={newPlayer.role}
                    onChange={(e) => setNewPlayer({...newPlayer, role: e.target.value})}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Champion Pool (comma separated)</label>
                  <input
                    type="text"
                    value={newPlayer.champion_pool}
                    onChange={(e) => setNewPlayer({...newPlayer, champion_pool: e.target.value})}
                    placeholder="e.g., Jinx, Caitlyn, Aphelios"
                  />
                </div>
                <div className="form-group">
                  <label>Riot ID</label>
                  <input
                    type="text"
                    value={newPlayer.opgg_username}
                    onChange={(e) => setNewPlayer({...newPlayer, opgg_username: e.target.value})}
                    placeholder="Name#TAG"
                  />
                </div>
                <div className="form-group">
                  <label>Region</label>
                  <select
                    value={newPlayer.opgg_region}
                    onChange={(e) => setNewPlayer({...newPlayer, opgg_region: e.target.value})}
                  >
                    {REGIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary">Add to Roster</button>
            </form>
          )}

          {/* Registered Users */}
          <div style={{marginTop: '1rem'}}>
            <h4 style={{marginBottom: '0.5rem'}}>Registered Users ({users.length})</h4>
            <div className="users-list">
              {users.map(u => (
                <div key={u.id} className="user-item">
                  <span className="user-name">{u.username}</span>
                  <span className="user-role">{u.role}</span>
                  {u.player_id ? (
                    <span className="user-status linked">On Roster</span>
                  ) : (
                    <span className="user-status">Not on roster</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: '3rem'}}>
          <p>No players registered yet.</p>
          {isAdmin && (
            <p style={{color: 'var(--text-secondary)', marginTop: '1rem'}}>
              Use the Admin Panel above to add players to the roster.
            </p>
          )}
        </div>
      ) : (
        <div className="roster-grid">
          {players.map(player => {
            const rank = getRankDisplay(player);
            const canEdit = user && (user.role === 'admin' || user.id === player.user_id);

            return (
              <div key={player.id} className="card player-card">
                {/* Action Buttons */}
                <div className="player-card-actions">
                  {player.opgg_username && canEdit && (
                    <button
                      onClick={() => handleSyncRiot(player.id)}
                      title="Sync Riot Data"
                    >
                      ↻
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="delete-btn"
                      onClick={() => handleDeletePlayer(player.id)}
                      title="Remove from roster"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Avatar */}
                <div className="player-avatar">
                  {player.profile_icon_id ? (
                    <img
                      src={getProfileIconUrl(player.profile_icon_id)}
                      alt="Profile Icon"
                    />
                  ) : (
                    ROLE_ICONS[player.role] || '🎮'
                  )}
                </div>

                {/* Player Info */}
                <div className="player-info">
                  <div className="player-header">
                    <h3 className="player-name">{player.summoner_name}</h3>
                    {player.summoner_level && (
                      <span className="player-level">Lv. {player.summoner_level}</span>
                    )}
                  </div>

                  {/* Role Dropdown */}
                  <div>
                    <select
                      className="player-role-select"
                      value={player.role}
                      onChange={(e) => handleUpdateRole(player.id, e.target.value)}
                      disabled={!isAdmin}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rank Display */}
                  {rank && (
                    <div className="player-rank">
                      <span className={`rank-tier ${rank.tier.toLowerCase()}`}>
                        {rank.tier} {rank.division}
                      </span>
                      <span className="rank-lp">{rank.lp} LP</span>
                      <span className="rank-record">
                        <span className="wins">{rank.wins}W</span>
                        {' '}
                        <span className="losses">{rank.losses}L</span>
                        {' '}({rank.winRate}%)
                      </span>
                    </div>
                  )}

                  {/* Username */}
                  {player.username && (
                    <span className="player-username">@{player.username}</span>
                  )}

                  {/* Links */}
                  <div className="player-links">
                    {player.opgg_username ? (
                      <>
                        <a
                          href={getOpggUrl(player)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opgg-link"
                        >
                          OP.GG ↗
                        </a>
                        {canEdit && (
                          <button
                            className="opgg-link"
                            style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}
                            onClick={() => {
                              setEditingPlayer(player.id);
                              setOpggForm({
                                username: player.opgg_username || '',
                                region: player.opgg_region || 'na',
                                iconId: player.profile_icon_id || ''
                              });
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </>
                    ) : canEdit && (
                      <button
                        className="opgg-link"
                        style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}
                        onClick={() => {
                          setEditingPlayer(player.id);
                          setOpggForm({ username: '', region: 'na', iconId: '' });
                        }}
                      >
                        + Link Riot ID
                      </button>
                    )}
                  </div>

                  {/* Edit Form */}
                  {editingPlayer === player.id && (
                    <div className="player-edit-form">
                      <input
                        type="text"
                        placeholder="Riot ID (Name#TAG)"
                        value={opggForm.username}
                        onChange={(e) => setOpggForm({...opggForm, username: e.target.value})}
                      />
                      <select
                        value={opggForm.region}
                        onChange={(e) => setOpggForm({...opggForm, region: e.target.value})}
                      >
                        {REGIONS.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <div className="form-actions">
                        <button
                          className="btn btn-primary btn-small"
                          onClick={() => handleUpdateOpgg(player.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => setEditingPlayer(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Champion Pool */}
                  {player.champion_pool && (
                    <div className="champion-pool">
                      {player.champion_pool.split(',').map((champ, idx) => (
                        <img
                          key={idx}
                          src={getChampionImage(champ.trim())}
                          alt={champ.trim()}
                          title={champ.trim()}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composition Suggestions */}
      {compSuggestions.length > 0 && (
        <div className="card mt-3">
          <div className="card-header">
            <h3 className="card-title">Suggested Compositions</h3>
          </div>
          <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem'}}>
            Based on player champion pools
          </p>
          <div className="comp-suggestions">
            {compSuggestions.map((suggestion, idx) => (
              <div key={idx} className="comp-suggestion-card">
                <h4>{suggestion.name}</h4>
                <div className="comp-champions">
                  {['top', 'jungle', 'mid', 'adc', 'support'].map(role => (
                    suggestion.champions[role] && (
                      <div key={role} className="comp-champ">
                        <img
                          src={getChampionImage(suggestion.champions[role])}
                          alt={suggestion.champions[role]}
                          title={`${role}: ${suggestion.champions[role]}`}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span>{role}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Compositions */}
      <div className="card mt-3">
        <div className="card-header">
          <h3 className="card-title">Team Compositions</h3>
          {user && (
            <button
              className="btn btn-primary btn-small"
              onClick={() => setShowCompForm(!showCompForm)}
            >
              {showCompForm ? 'Cancel' : '+ New Comp'}
            </button>
          )}
        </div>

        {showCompForm && (
          <form onSubmit={handleCreateComposition} className="comp-form mb-3">
            <div className="form-group">
              <label>Composition Name</label>
              <input
                type="text"
                value={newComp.name}
                onChange={(e) => setNewComp({...newComp, name: e.target.value})}
                placeholder="e.g., Wombo Combo, Poke Comp"
                required
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newComp.description}
                onChange={(e) => setNewComp({...newComp, description: e.target.value})}
                placeholder="Describe the strategy..."
                rows={2}
              />
            </div>
            <div className="comp-champion-selectors">
              {['Top', 'Jungle', 'Mid', 'ADC', 'Support'].map(role => (
                <div key={role} className="form-group" style={{flex: 1, minWidth: '120px'}}>
                  <label>{role}</label>
                  <select
                    value={newComp[`${role.toLowerCase()}_champion`]}
                    onChange={(e) => setNewComp({...newComp, [`${role.toLowerCase()}_champion`]: e.target.value})}
                  >
                    <option value="">Select...</option>
                    {champions.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="form-group">
              <label>Tags (comma separated)</label>
              <input
                type="text"
                value={newComp.tags}
                onChange={(e) => setNewComp({...newComp, tags: e.target.value})}
                placeholder="e.g., teamfight, early game, scaling"
              />
            </div>
            <button type="submit" className="btn btn-primary">Save Composition</button>
          </form>
        )}

        {compositions.length === 0 ? (
          <p style={{color: 'var(--text-secondary)'}}>
            No compositions saved yet. Create one to plan your team strategies.
          </p>
        ) : (
          <div className="compositions-list">
            {compositions.map(comp => (
              <div key={comp.id} className="composition-card">
                <div className="comp-header">
                  <div>
                    <h4>{comp.name}</h4>
                    {comp.tags && (
                      <div className="comp-tags">
                        {comp.tags.split(',').map((tag, idx) => (
                          <span key={idx} className="comp-tag">{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {user && (
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDeleteComposition(comp.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {comp.description && (
                  <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>
                    {comp.description}
                  </p>
                )}
                <div className="comp-champions">
                  {[
                    { role: 'Top', champ: comp.top_champion },
                    { role: 'Jungle', champ: comp.jungle_champion },
                    { role: 'Mid', champ: comp.mid_champion },
                    { role: 'ADC', champ: comp.adc_champion },
                    { role: 'Support', champ: comp.support_champion }
                  ].map(({ role, champ }) => (
                    champ && (
                      <div key={role} className="comp-champ">
                        <img
                          src={getChampionImage(champ)}
                          alt={champ}
                          title={`${role}: ${champ}`}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span>{role}</span>
                      </div>
                    )
                  ))}
                </div>
                <small style={{color: 'var(--text-secondary)'}}>
                  Created by {comp.author_name}
                </small>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </VideoBackground>
  );
}

export default Roster;
