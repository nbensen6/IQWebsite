import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLE_ICONS = {
  Top: '⚔️',
  Jungle: '🌲',
  Mid: '🎯',
  ADC: '🏹',
  Support: '🛡️'
};

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
  const [opggForm, setOpggForm] = useState({ username: '', region: 'na' });

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

  const handleUpdateOpgg = async (playerId) => {
    try {
      await api.patch(`/players/${playerId}/opgg`, {
        opgg_username: opggForm.username,
        opgg_region: opggForm.region
      });
      setPlayers(players.map(p =>
        p.id === playerId
          ? { ...p, opgg_username: opggForm.username, opgg_region: opggForm.region }
          : p
      ));
      setEditingPlayer(null);
      setOpggForm({ username: '', region: 'na' });
    } catch (err) {
      console.error('Failed to update op.gg');
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
    return `https://www.op.gg/summoners/${region}/${encodeURIComponent(player.opgg_username)}`;
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

  if (loading) return <div className="loading">Loading roster...</div>;

  const compSuggestions = getCompSuggestions();

  return (
    <div className="roster-page">
      <h1 style={{marginBottom: '1.5rem', textAlign: 'center'}}>Team Roster</h1>

      {players.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: '3rem'}}>
          <p>No players registered yet.</p>
          <p style={{color: 'var(--text-secondary)', marginTop: '1rem'}}>
            Players can be added by admins or through the player profile settings.
          </p>
        </div>
      ) : (
        <div className="roster-grid">
          {players.map(player => (
            <div key={player.id} className="card player-card">
              <div className="player-avatar">
                {ROLE_ICONS[player.role] || '🎮'}
              </div>
              <h3>{player.summoner_name}</h3>
              <p className="player-role">{player.role}</p>

              {/* OP.GG Link */}
              {player.opgg_username ? (
                <a
                  href={getOpggUrl(player)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-small"
                  style={{marginBottom: '0.5rem', display: 'inline-block'}}
                >
                  View OP.GG ({player.opgg_region?.toUpperCase()})
                </a>
              ) : user && (user.role === 'admin' || user.id === player.user_id) ? (
                editingPlayer === player.id ? (
                  <div style={{marginBottom: '0.5rem'}}>
                    <input
                      type="text"
                      placeholder="Summoner name"
                      value={opggForm.username}
                      onChange={(e) => setOpggForm({...opggForm, username: e.target.value})}
                      style={{width: '100%', marginBottom: '0.25rem', padding: '0.25rem'}}
                    />
                    <select
                      value={opggForm.region}
                      onChange={(e) => setOpggForm({...opggForm, region: e.target.value})}
                      style={{width: '100%', marginBottom: '0.25rem', padding: '0.25rem'}}
                    >
                      {REGIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <div style={{display: 'flex', gap: '0.25rem'}}>
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
                ) : (
                  <button
                    className="btn btn-secondary btn-small"
                    style={{marginBottom: '0.5rem'}}
                    onClick={() => {
                      setEditingPlayer(player.id);
                      setOpggForm({
                        username: player.opgg_username || '',
                        region: player.opgg_region || 'na'
                      });
                    }}
                  >
                    Link OP.GG
                  </button>
                )
              ) : null}

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
          ))}
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

      <div className="card mt-3" style={{textAlign: 'center'}}>
        <h3 className="card-title">About IQ</h3>
        <p style={{color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto'}}>
          IQ is a competitive League of Legends team focused on improvement, teamwork, and having fun.
          We practice regularly and compete in amateur tournaments.
        </p>
      </div>
    </div>
  );
}

export default Roster;
