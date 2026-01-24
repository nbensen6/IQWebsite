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

  const [draggedChampion, setDraggedChampion] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

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

  // Drag handlers for champions
  const handleDragStart = (e, champ) => {
    if (isChampionUsed(champ.id)) {
      e.preventDefault();
      return;
    }
    setDraggedChampion(champ);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', champ.id);
  };

  const handleDragEnd = () => {
    setDraggedChampion(null);
    setDragOverSlot(null);
  };

  // Slot drag handlers
  const handleSlotDragOver = (e, slotType, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot({ type: slotType, index });
  };

  const handleSlotDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleSlotDrop = (e, slotType, index) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedChampion) return;

    const champId = draggedChampion.id;

    switch (slotType) {
      case 'bluePick':
        const newBluePicks = [...bluePicks];
        newBluePicks[index] = champId;
        setBluePicks(newBluePicks);
        break;
      case 'redPick':
        const newRedPicks = [...redPicks];
        newRedPicks[index] = champId;
        setRedPicks(newRedPicks);
        break;
      case 'blueBan':
        const newBlueBans = [...blueBans];
        newBlueBans[index] = champId;
        setBlueBans(newBlueBans);
        break;
      case 'redBan':
        const newRedBans = [...redBans];
        newRedBans[index] = champId;
        setRedBans(newRedBans);
        break;
      default:
        break;
    }

    setDraggedChampion(null);
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

  const isSlotHighlighted = (slotType, index) => {
    return dragOverSlot?.type === slotType && dragOverSlot?.index === index;
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

          <p style={{marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
            Drag champions to pick/ban slots. Right-click for notes. Click filled slots to remove.
          </p>

          <div className="champion-grid">
            {filteredChampions.map(champ => {
              const used = isChampionUsed(champ.id);
              const isPicked = bluePicks.includes(champ.id) || redPicks.includes(champ.id);
              const isBanned = blueBans.includes(champ.id) || redBans.includes(champ.id);

              return (
                <div
                  key={champ.id}
                  className={`champion-card ${isPicked ? 'picked' : ''} ${isBanned ? 'banned' : ''} ${used ? '' : 'draggable'}`}
                  draggable={!used}
                  onDragStart={(e) => handleDragStart(e, champ)}
                  onDragEnd={handleDragEnd}
                  onContextMenu={(e) => handleRightClick(e, champ)}
                  title={champ.name}
                  style={{ cursor: used ? 'not-allowed' : 'grab' }}
                >
                  <img src={champ.image} alt={champ.name} />
                  <div className="champion-name">{champ.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="draft-board card">
          <div className="draft-team mb-3">
            <h3>Blue Team (Ally)</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Picks</p>
            <div className="draft-slots">
              {bluePicks.map((champId, idx) => (
                <div
                  key={idx}
                  className={`draft-slot ${isSlotHighlighted('bluePick', idx) ? 'drag-over' : ''}`}
                  onClick={() => handleSlotClick('blue', 'pick', idx)}
                  onDragOver={(e) => handleSlotDragOver(e, 'bluePick', idx)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, 'bluePick', idx)}
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
                  className={`ban-slot ${isSlotHighlighted('blueBan', idx) ? 'drag-over' : ''}`}
                  onClick={() => handleSlotClick('blue', 'ban', idx)}
                  onDragOver={(e) => handleSlotDragOver(e, 'blueBan', idx)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, 'blueBan', idx)}
                >
                  {champId && <img src={getChampionImage(champId)} alt="" />}
                </div>
              ))}
            </div>
          </div>

          <div className="draft-team enemy">
            <h3>Red Team (Enemy)</h3>
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem'}}>Picks</p>
            <div className="draft-slots">
              {redPicks.map((champId, idx) => (
                <div
                  key={idx}
                  className={`draft-slot ${isSlotHighlighted('redPick', idx) ? 'drag-over' : ''}`}
                  onClick={() => handleSlotClick('red', 'pick', idx)}
                  onDragOver={(e) => handleSlotDragOver(e, 'redPick', idx)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, 'redPick', idx)}
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
                  className={`ban-slot ${isSlotHighlighted('redBan', idx) ? 'drag-over' : ''}`}
                  onClick={() => handleSlotClick('red', 'ban', idx)}
                  onDragOver={(e) => handleSlotDragOver(e, 'redBan', idx)}
                  onDragLeave={handleSlotDragLeave}
                  onDrop={(e) => handleSlotDrop(e, 'redBan', idx)}
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
    </div>
  );
}

export default DraftHelper;
