import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

const ROLES = ['All', 'Top', 'Jungle', 'Mid', 'ADC', 'Support'];

const ROLE_MAPPING = {
  'fighter': ['Top', 'Jungle'],
  'tank': ['Top', 'Jungle', 'Support'],
  'mage': ['Mid', 'Support'],
  'assassin': ['Mid', 'Jungle'],
  'marksman': ['ADC'],
  'support': ['Support']
};

function DraftHelper() {
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [version, setVersion] = useState('14.1.1');

  const [bluePicks, setBluePicks] = useState([null, null, null, null, null]);
  const [redPicks, setRedPicks] = useState([null, null, null, null, null]);
  const [blueBans, setBlueBans] = useState([null, null, null, null, null]);
  const [redBans, setRedBans] = useState([null, null, null, null, null]);
  const [mode, setMode] = useState('bluePick');

  const [selectedChampion, setSelectedChampion] = useState(null);
  const [championNotes, setChampionNotes] = useState({});

  useEffect(() => {
    fetchChampions();
    fetchNotes();
  }, []);

  const fetchChampions = async () => {
    try {
      const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
      const versions = await response.json();
      const latestVersion = versions[0];
      setVersion(latestVersion);

      const champResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
      const data = await champResponse.json();

      const champList = Object.values(data.data).map(champ => ({
        id: champ.id,
        name: champ.name,
        tags: champ.tags,
        image: `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${champ.id}.png`
      }));

      setChampions(champList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('Failed to load champions');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await api.get('/notes/champion');
      const notesMap = {};
      response.data.forEach(n => {
        notesMap[n.champion_id] = n.notes;
      });
      setChampionNotes(notesMap);
    } catch (err) {
      console.error('Failed to load notes');
    }
  };

  const getChampionRoles = (champ) => {
    const roles = new Set();
    champ.tags.forEach(tag => {
      const mapped = ROLE_MAPPING[tag.toLowerCase()];
      if (mapped) mapped.forEach(r => roles.add(r));
    });
    return Array.from(roles);
  };

  const filteredChampions = useMemo(() => {
    return champions.filter(champ => {
      if (searchTerm && !champ.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (roleFilter !== 'All') {
        const roles = getChampionRoles(champ);
        if (!roles.includes(roleFilter)) return false;
      }
      return true;
    });
  }, [champions, searchTerm, roleFilter]);

  const isChampionUsed = (champId) => {
    return bluePicks.includes(champId) ||
           redPicks.includes(champId) ||
           blueBans.includes(champId) ||
           redBans.includes(champId);
  };

  const handleChampionClick = (champId) => {
    if (isChampionUsed(champId)) return;

    let updated = false;

    if (mode === 'bluePick') {
      const idx = bluePicks.findIndex(p => p === null);
      if (idx !== -1) {
        const newPicks = [...bluePicks];
        newPicks[idx] = champId;
        setBluePicks(newPicks);
        updated = true;
      }
    } else if (mode === 'redPick') {
      const idx = redPicks.findIndex(p => p === null);
      if (idx !== -1) {
        const newPicks = [...redPicks];
        newPicks[idx] = champId;
        setRedPicks(newPicks);
        updated = true;
      }
    } else if (mode === 'blueBan') {
      const idx = blueBans.findIndex(p => p === null);
      if (idx !== -1) {
        const newBans = [...blueBans];
        newBans[idx] = champId;
        setBlueBans(newBans);
        updated = true;
      }
    } else if (mode === 'redBan') {
      const idx = redBans.findIndex(p => p === null);
      if (idx !== -1) {
        const newBans = [...redBans];
        newBans[idx] = champId;
        setRedBans(newBans);
        updated = true;
      }
    }
  };

  const handleSlotClick = (team, type, idx) => {
    if (team === 'blue') {
      if (type === 'pick') {
        const newPicks = [...bluePicks];
        newPicks[idx] = null;
        setBluePicks(newPicks);
      } else {
        const newBans = [...blueBans];
        newBans[idx] = null;
        setBlueBans(newBans);
      }
    } else {
      if (type === 'pick') {
        const newPicks = [...redPicks];
        newPicks[idx] = null;
        setRedPicks(newPicks);
      } else {
        const newBans = [...redBans];
        newBans[idx] = null;
        setRedBans(newBans);
      }
    }
  };

  const resetDraft = () => {
    setBluePicks([null, null, null, null, null]);
    setRedPicks([null, null, null, null, null]);
    setBlueBans([null, null, null, null, null]);
    setRedBans([null, null, null, null, null]);
  };

  const getChampionImage = (champId) => {
    const champ = champions.find(c => c.id === champId);
    return champ?.image;
  };

  const handleRightClick = (e, champ) => {
    e.preventDefault();
    setSelectedChampion(champ);
  };

  const saveChampionNote = async (champId, notes) => {
    try {
      await api.post('/notes/champion', { champion_id: champId, notes });
      setChampionNotes(prev => ({ ...prev, [champId]: notes }));
    } catch (err) {
      console.error('Failed to save note');
    }
  };

  if (loading) return <div className="loading">Loading champions...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="draft-page">
      <h1 style={{marginBottom: '1.5rem'}}>Draft Helper</h1>

      <div className="draft-container">
        <div className="champion-section">
          <div className="champion-filters">
            <div className="role-filter">
              {ROLES.map(role => (
                <button
                  key={role}
                  className={`role-btn ${roleFilter === role ? 'active' : ''}`}
                  onClick={() => setRoleFilter(role)}
                >
                  {role}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="champion-search"
              placeholder="Search champions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="champion-grid">
            {filteredChampions.map(champ => {
              const used = isChampionUsed(champ.id);
              const isPicked = bluePicks.includes(champ.id) || redPicks.includes(champ.id);
              const isBanned = blueBans.includes(champ.id) || redBans.includes(champ.id);

              return (
                <div
                  key={champ.id}
                  className={`champion-card ${isPicked ? 'picked' : ''} ${isBanned ? 'banned' : ''}`}
                  onClick={() => handleChampionClick(champ.id)}
                  onContextMenu={(e) => handleRightClick(e, champ)}
                  title={champ.name}
                >
                  <img src={champ.image} alt={champ.name} />
                  <div className="champion-name">{champ.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="draft-board card">
          <div className="draft-mode mb-2">
            <label>Mode: </label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="bluePick">Blue Pick</option>
              <option value="redPick">Red Pick</option>
              <option value="blueBan">Blue Ban</option>
              <option value="redBan">Red Ban</option>
            </select>
          </div>

          <div className="draft-team mb-3">
            <h3>Blue Team</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Picks</p>
            <div className="draft-slots">
              {bluePicks.map((champId, idx) => (
                <div
                  key={idx}
                  className="draft-slot"
                  onClick={() => handleSlotClick('blue', 'pick', idx)}
                >
                  {champId && <img src={getChampionImage(champId)} alt="" />}
                </div>
              ))}
            </div>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0'}}>Bans</p>
            <div className="ban-slots">
              {blueBans.map((champId, idx) => (
                <div
                  key={idx}
                  className="ban-slot"
                  onClick={() => handleSlotClick('blue', 'ban', idx)}
                >
                  {champId && <img src={getChampionImage(champId)} alt="" />}
                </div>
              ))}
            </div>
          </div>

          <div className="draft-team enemy">
            <h3>Red Team</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Picks</p>
            <div className="draft-slots">
              {redPicks.map((champId, idx) => (
                <div
                  key={idx}
                  className="draft-slot"
                  onClick={() => handleSlotClick('red', 'pick', idx)}
                >
                  {champId && <img src={getChampionImage(champId)} alt="" />}
                </div>
              ))}
            </div>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0'}}>Bans</p>
            <div className="ban-slots">
              {redBans.map((champId, idx) => (
                <div
                  key={idx}
                  className="ban-slot"
                  onClick={() => handleSlotClick('red', 'ban', idx)}
                >
                  {champId && <img src={getChampionImage(champId)} alt="" />}
                </div>
              ))}
            </div>
          </div>

          <div className="draft-actions">
            <button className="btn btn-secondary btn-small" onClick={resetDraft}>
              Reset Draft
            </button>
          </div>
        </div>
      </div>

      {selectedChampion && (
        <div className="card mt-3" style={{maxWidth: '600px'}}>
          <div className="card-header">
            <h3 className="card-title">{selectedChampion.name} Notes</h3>
            <button className="btn btn-secondary btn-small" onClick={() => setSelectedChampion(null)}>
              Close
            </button>
          </div>
          <textarea
            className="form-group"
            style={{width: '100%', minHeight: '150px', padding: '0.75rem'}}
            value={championNotes[selectedChampion.id] || ''}
            onChange={(e) => setChampionNotes(prev => ({ ...prev, [selectedChampion.id]: e.target.value }))}
            placeholder={`Add notes about ${selectedChampion.name}...`}
          />
          <button
            className="btn btn-primary btn-small"
            onClick={() => saveChampionNote(selectedChampion.id, championNotes[selectedChampion.id] || '')}
          >
            Save Notes
          </button>
        </div>
      )}

      <p style={{marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
        Right-click a champion to add notes. Click to add to draft board.
      </p>
    </div>
  );
}

export default DraftHelper;
