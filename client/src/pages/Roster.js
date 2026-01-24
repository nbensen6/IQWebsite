import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ROLE_ICONS = {
  Top: '⚔️',
  Jungle: '🌲',
  Mid: '🎯',
  ADC: '🏹',
  Support: '🛡️'
};

function Roster() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('14.1.1');

  useEffect(() => {
    fetchPlayers();
    fetchVersion();
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
    } catch (err) {
      console.error('Failed to fetch version');
    }
  };

  const getChampionImage = (champId) => {
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`;
  };

  if (loading) return <div className="loading">Loading roster...</div>;

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
