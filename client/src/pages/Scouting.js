import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const NOTE_CATEGORIES = ['General', 'Draft Tendencies', 'Playstyle', 'Weaknesses', 'Player Notes'];
const NODE_TYPES = ['start', 'action', 'decision', 'note'];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function FlowchartNode({ nodeId, nodes, edges, selectedNodeId, onSelectNode }) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return null;
  const childEdges = edges.filter(e => e.from === nodeId);
  const isSelected = selectedNodeId === nodeId;

  return (
    <div className="fc-branch">
      <div
        className={`fc-node fc-${node.type}${isSelected ? ' selected' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelectNode && onSelectNode(nodeId); }}
      >
        {node.text || <em style={{color: 'var(--text-secondary)'}}>Empty</em>}
      </div>
      {childEdges.length > 0 && (
        <>
          <div className="fc-connector-down" />
          {childEdges.length > 1 && <div className="fc-horizontal-line" />}
          <div className="fc-children">
            {childEdges.map(edge => (
              <div key={edge.to} className="fc-child">
                {edge.label && <div className="fc-edge-label">{edge.label}</div>}
                <div className="fc-connector-down" />
                <FlowchartNode
                  nodeId={edge.to}
                  nodes={nodes}
                  edges={edges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FlowchartRenderer({ nodes, edges, selectedNodeId, onSelectNode }) {
  if (!nodes || nodes.length === 0) return null;
  const childNodeIds = new Set(edges.map(e => e.to));
  const rootNodes = nodes.filter(n => !childNodeIds.has(n.id));
  const rootId = rootNodes.length > 0 ? rootNodes[0].id : nodes[0].id;

  return (
    <div className="fc-renderer" onClick={() => onSelectNode && onSelectNode(null)}>
      <FlowchartNode
        nodeId={rootId}
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </div>
  );
}

function Scouting() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('images');
  const [teamNotes, setTeamNotes] = useState([]);
  const [teamImages, setTeamImages] = useState([]);
  const [teamDrafts, setTeamDrafts] = useState([]);
  const [teamFlowcharts, setTeamFlowcharts] = useState([]);
  const [version, setVersion] = useState('14.1.1');

  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  const [showNewNote, setShowNewNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [editingNote, setEditingNote] = useState(null);

  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [modalImage, setModalImage] = useState(null);

  // Flowchart builder state
  const [showFlowchartModal, setShowFlowchartModal] = useState(false);
  const [editingFlowchart, setEditingFlowchart] = useState(null);
  const [fcName, setFcName] = useState('');
  const [fcNodes, setFcNodes] = useState([]);
  const [fcEdges, setFcEdges] = useState([]);
  const [fcSelectedNodeId, setFcSelectedNodeId] = useState(null);

  useEffect(() => {
    fetchTeams();
    fetchVersion();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await api.get('/scouting/teams');
      setTeams(response.data);
    } catch (err) {
      setError('Failed to load teams');
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

  const fetchTeamData = useCallback(async (teamId) => {
    try {
      const [notesRes, imagesRes, draftsRes, flowchartsRes] = await Promise.all([
        api.get(`/scouting/teams/${teamId}/notes`),
        api.get(`/scouting/teams/${teamId}/images`),
        api.get(`/scouting/teams/${teamId}/drafts`),
        api.get(`/scouting/teams/${teamId}/flowcharts`)
      ]);
      setTeamNotes(notesRes.data);
      setTeamImages(imagesRes.data);
      setTeamDrafts(draftsRes.data);
      setTeamFlowcharts(flowchartsRes.data);
    } catch (err) {
      setError('Failed to load team data');
    }
  }, []);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamData(selectedTeam.id);
    }
  }, [selectedTeam, fetchTeamData]);

  const handleSelectTeam = (team) => {
    setSelectedTeam(team);
    setActiveTab('images');
    setShowNewNote(false);
    setEditingNote(null);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const response = await api.post('/scouting/teams', { name: newTeamName });
      setTeams([response.data, ...teams]);
      setNewTeamName('');
      setShowNewTeam(false);
      setSelectedTeam(response.data);
    } catch (err) {
      setError('Failed to create team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Delete this team and all its notes/images?')) return;

    try {
      await api.delete(`/scouting/teams/${teamId}`);
      setTeams(teams.filter(t => t.id !== teamId));
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(null);
      }
    } catch (err) {
      setError('Failed to delete team');
    }
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    try {
      if (editingNote) {
        const response = await api.put(`/scouting/notes/${editingNote.id}`, {
          title: noteTitle,
          content: noteContent,
          category: noteCategory
        });
        setTeamNotes(teamNotes.map(n => n.id === editingNote.id ? response.data : n));
      } else {
        const response = await api.post(`/scouting/teams/${selectedTeam.id}/notes`, {
          title: noteTitle,
          content: noteContent,
          category: noteCategory
        });
        setTeamNotes([response.data, ...teamNotes]);
      }
      setShowNewNote(false);
      setEditingNote(null);
      setNoteTitle('');
      setNoteContent('');
      setNoteCategory('General');
    } catch (err) {
      setError('Failed to save note');
    }
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content || '');
    setNoteCategory(note.category);
    setShowNewNote(true);
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;

    try {
      await api.delete(`/scouting/notes/${noteId}`);
      setTeamNotes(teamNotes.filter(n => n.id !== noteId));
    } catch (err) {
      setError('Failed to delete note');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    await uploadImages(files);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    await uploadImages(files);
    e.target.value = '';
  };

  const uploadImages = async (files) => {
    setUploading(true);
    setError('');

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await api.post(
          `/scouting/teams/${selectedTeam.id}/images`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        setTeamImages(prev => [response.data, ...prev]);
      }
    } catch (err) {
      setError('Failed to upload image(s)');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Delete this image?')) return;

    try {
      await api.delete(`/scouting/images/${imageId}`);
      setTeamImages(teamImages.filter(i => i.id !== imageId));
    } catch (err) {
      setError('Failed to delete image');
    }
  };

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Delete this saved draft?')) return;

    try {
      await api.delete(`/scouting/drafts/${draftId}`);
      setTeamDrafts(teamDrafts.filter(d => d.id !== draftId));
    } catch (err) {
      setError('Failed to delete draft');
    }
  };

  // Flowchart handlers
  const openNewFlowchart = () => {
    const startId = generateId();
    setEditingFlowchart(null);
    setFcName('');
    setFcNodes([{ id: startId, type: 'start', text: '' }]);
    setFcEdges([]);
    setFcSelectedNodeId(startId);
    setShowFlowchartModal(true);
  };

  const openEditFlowchart = (flowchart) => {
    setEditingFlowchart(flowchart);
    setFcName(flowchart.name);
    const data = typeof flowchart.data === 'string' ? JSON.parse(flowchart.data) : flowchart.data;
    setFcNodes(data.nodes || []);
    setFcEdges(data.edges || []);
    setFcSelectedNodeId(null);
    setShowFlowchartModal(true);
  };

  const closeFlowchartModal = () => {
    setShowFlowchartModal(false);
    setEditingFlowchart(null);
    setFcName('');
    setFcNodes([]);
    setFcEdges([]);
    setFcSelectedNodeId(null);
  };

  const handleAddChildNode = () => {
    if (!fcSelectedNodeId) return;
    const newId = generateId();
    const parentNode = fcNodes.find(n => n.id === fcSelectedNodeId);
    const defaultType = parentNode?.type === 'decision' ? 'action' : 'action';
    setFcNodes([...fcNodes, { id: newId, type: defaultType, text: '' }]);
    setFcEdges([...fcEdges, { from: fcSelectedNodeId, to: newId, label: '' }]);
    setFcSelectedNodeId(newId);
  };

  const handleDeleteNode = () => {
    if (!fcSelectedNodeId) return;
    if (fcNodes.length <= 1) return;

    // Get all descendant node IDs (recursive)
    const getDescendants = (nodeId) => {
      const childEdges = fcEdges.filter(e => e.from === nodeId);
      let descendants = [];
      for (const edge of childEdges) {
        descendants.push(edge.to);
        descendants = [...descendants, ...getDescendants(edge.to)];
      }
      return descendants;
    };

    const toRemove = new Set([fcSelectedNodeId, ...getDescendants(fcSelectedNodeId)]);
    setFcNodes(fcNodes.filter(n => !toRemove.has(n.id)));
    setFcEdges(fcEdges.filter(e => !toRemove.has(e.from) && !toRemove.has(e.to)));
    setFcSelectedNodeId(null);
  };

  const handleUpdateNodeField = (field, value) => {
    if (!fcSelectedNodeId) return;
    setFcNodes(fcNodes.map(n => n.id === fcSelectedNodeId ? { ...n, [field]: value } : n));
  };

  const handleUpdateEdgeLabel = (edgeFrom, edgeTo, newLabel) => {
    setFcEdges(fcEdges.map(e =>
      (e.from === edgeFrom && e.to === edgeTo) ? { ...e, label: newLabel } : e
    ));
  };

  const handleSaveFlowchart = async () => {
    if (!fcName.trim()) return;

    const payload = {
      name: fcName,
      data: { nodes: fcNodes, edges: fcEdges }
    };

    try {
      if (editingFlowchart) {
        const response = await api.put(`/scouting/flowcharts/${editingFlowchart.id}`, payload);
        setTeamFlowcharts(teamFlowcharts.map(f => f.id === editingFlowchart.id ? response.data : f));
      } else {
        const response = await api.post(`/scouting/teams/${selectedTeam.id}/flowcharts`, payload);
        setTeamFlowcharts([response.data, ...teamFlowcharts]);
      }
      closeFlowchartModal();
    } catch (err) {
      setError('Failed to save flowchart');
    }
  };

  const handleDeleteFlowchart = async (flowchartId) => {
    if (!window.confirm('Delete this flowchart?')) return;

    try {
      await api.delete(`/scouting/flowcharts/${flowchartId}`);
      setTeamFlowcharts(teamFlowcharts.filter(f => f.id !== flowchartId));
    } catch (err) {
      setError('Failed to delete flowchart');
    }
  };

  const getChampionImage = (champId) => {
    if (!champId) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`;
  };

  const parseDraftPicks = (picksStr) => {
    try {
      return JSON.parse(picksStr);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) return <div className="loading">Loading scouting data...</div>;

  return (
    <div className="scouting-page">
      <div className="teams-sidebar card">
        <div className="card-header">
          <h3 className="card-title">Enemy Teams</h3>
          <button
            className="btn btn-primary btn-small"
            onClick={() => setShowNewTeam(!showNewTeam)}
          >
            + New
          </button>
        </div>

        {showNewTeam && (
          <form onSubmit={handleCreateTeam} style={{marginBottom: '1rem'}}>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name..."
              style={{
                width: '100%',
                padding: '0.5rem',
                marginBottom: '0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)'
              }}
              autoFocus
            />
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <button type="submit" className="btn btn-primary btn-small">Add</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowNewTeam(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <div className="error">{error}</div>}

        <div className="teams-list">
          {teams.length === 0 ? (
            <p style={{color: 'var(--text-secondary)', padding: '1rem'}}>
              No teams yet. Add your first opponent.
            </p>
          ) : (
            teams.map(team => (
              <div
                key={team.id}
                className={`team-item ${selectedTeam?.id === team.id ? 'active' : ''}`}
                onClick={() => handleSelectTeam(team)}
              >
                <div>
                  <div className="team-name">{team.name}</div>
                  <div className="team-meta">
                    {team.images_count} images, {team.notes_count} notes
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTeam(team.id);
                  }}
                  style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem'}}
                >
                  X
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="team-content card">
        {selectedTeam ? (
          <>
            <div className="team-header">
              <h2>{selectedTeam.name}</h2>
            </div>

            <div className="team-tabs">
              <button
                className={`team-tab ${activeTab === 'images' ? 'active' : ''}`}
                onClick={() => setActiveTab('images')}
              >
                Draft Images ({teamImages.length})
              </button>
              <button
                className={`team-tab ${activeTab === 'drafts' ? 'active' : ''}`}
                onClick={() => setActiveTab('drafts')}
              >
                Saved Drafts ({teamDrafts.length})
              </button>
              <button
                className={`team-tab ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes ({teamNotes.length})
              </button>
              <button
                className={`team-tab ${activeTab === 'flowcharts' ? 'active' : ''}`}
                onClick={() => setActiveTab('flowcharts')}
              >
                Flowcharts ({teamFlowcharts.length})
              </button>
            </div>

            {activeTab === 'images' && (
              <div className="images-tab">
                <div
                  className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('imageUpload').click()}
                >
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    style={{display: 'none'}}
                  />
                  {uploading ? (
                    <p>Uploading...</p>
                  ) : (
                    <>
                      <p>Drag & drop draft screenshots here</p>
                      <small>or click to browse</small>
                    </>
                  )}
                </div>

                {teamImages.length > 0 && (
                  <div className="draft-images-grid">
                    {teamImages.map(img => (
                      <div key={img.id} className="draft-image-card">
                        <img
                          src={`/api/scouting/uploads/${img.filename}`}
                          alt={img.original_name}
                          onClick={() => setModalImage(img)}
                        />
                        <div className="image-info">
                          <div className="image-date">{formatDate(img.created_at)}</div>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeleteImage(img.id)}
                            style={{marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem'}}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'drafts' && (
              <div className="drafts-tab">
                <p style={{color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem'}}>
                  Drafts saved from the Draft Helper. Go to Draft Helper to create and save new drafts.
                </p>

                {teamDrafts.length === 0 ? (
                  <p style={{color: 'var(--text-secondary)'}}>
                    No saved drafts yet. Use the Draft Helper to create and save drafts against this team.
                  </p>
                ) : (
                  <div className="saved-drafts-list">
                    {teamDrafts.map(draft => {
                      const bluePicks = parseDraftPicks(draft.blue_picks);
                      const redPicks = parseDraftPicks(draft.red_picks);
                      const blueBans = parseDraftPicks(draft.blue_bans);
                      const redBans = parseDraftPicks(draft.red_bans);

                      return (
                        <div key={draft.id} className="saved-draft-card card mb-2">
                          <div className="card-header">
                            <div>
                              <h4 style={{color: 'var(--accent-gold)'}}>{draft.name}</h4>
                              <small style={{color: 'var(--text-secondary)'}}>
                                {formatDate(draft.created_at)} by {draft.author_name}
                              </small>
                            </div>
                            <button
                              className="btn btn-danger btn-small"
                              onClick={() => handleDeleteDraft(draft.id)}
                            >
                              Delete
                            </button>
                          </div>

                          <div className="draft-display">
                            <div className="draft-side blue-side">
                              <h5>Blue Team (Ally)</h5>
                              <div className="picks-display">
                                <span className="label">Picks:</span>
                                <div className="champ-row">
                                  {bluePicks.map((champId, idx) => (
                                    champId ? (
                                      <img
                                        key={idx}
                                        src={getChampionImage(champId)}
                                        alt={champId}
                                        title={champId}
                                        className="draft-champ-img"
                                      />
                                    ) : (
                                      <div key={idx} className="empty-slot" />
                                    )
                                  ))}
                                </div>
                              </div>
                              <div className="bans-display">
                                <span className="label">Bans:</span>
                                <div className="champ-row bans">
                                  {blueBans.map((champId, idx) => (
                                    champId ? (
                                      <img
                                        key={idx}
                                        src={getChampionImage(champId)}
                                        alt={champId}
                                        title={champId}
                                        className="draft-champ-img banned"
                                      />
                                    ) : (
                                      <div key={idx} className="empty-slot small" />
                                    )
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="draft-side red-side">
                              <h5>Red Team (Enemy)</h5>
                              <div className="picks-display">
                                <span className="label">Picks:</span>
                                <div className="champ-row">
                                  {redPicks.map((champId, idx) => (
                                    champId ? (
                                      <img
                                        key={idx}
                                        src={getChampionImage(champId)}
                                        alt={champId}
                                        title={champId}
                                        className="draft-champ-img"
                                      />
                                    ) : (
                                      <div key={idx} className="empty-slot" />
                                    )
                                  ))}
                                </div>
                              </div>
                              <div className="bans-display">
                                <span className="label">Bans:</span>
                                <div className="champ-row bans">
                                  {redBans.map((champId, idx) => (
                                    champId ? (
                                      <img
                                        key={idx}
                                        src={getChampionImage(champId)}
                                        alt={champId}
                                        title={champId}
                                        className="draft-champ-img banned"
                                      />
                                    ) : (
                                      <div key={idx} className="empty-slot small" />
                                    )
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {draft.notes && (
                            <div className="draft-notes" style={{marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '4px'}}>
                              <small style={{color: 'var(--text-secondary)'}}>Notes:</small>
                              <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{draft.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="notes-tab">
                <div style={{marginBottom: '1rem'}}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowNewNote(true);
                      setEditingNote(null);
                      setNoteTitle('');
                      setNoteContent('');
                      setNoteCategory('General');
                    }}
                  >
                    + New Note
                  </button>
                </div>

                {showNewNote && (
                  <div className="card mb-3" style={{background: 'var(--bg-tertiary)'}}>
                    <form onSubmit={handleSaveNote}>
                      <div className="form-group">
                        <input
                          type="text"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          placeholder="Note title..."
                          required
                        />
                      </div>
                      <div className="form-group">
                        <select
                          value={noteCategory}
                          onChange={(e) => setNoteCategory(e.target.value)}
                        >
                          {NOTE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Write your scouting notes here..."
                          rows={6}
                        />
                      </div>
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <button type="submit" className="btn btn-primary">
                          {editingNote ? 'Update' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowNewNote(false);
                            setEditingNote(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {teamNotes.length === 0 && !showNewNote ? (
                  <p style={{color: 'var(--text-secondary)'}}>
                    No notes yet. Add scouting intel about this team.
                  </p>
                ) : (
                  teamNotes.map(note => (
                    <div key={note.id} className="card mb-2">
                      <div className="card-header">
                        <div>
                          <h4 style={{color: 'var(--accent-gold)'}}>{note.title}</h4>
                          <small style={{color: 'var(--text-secondary)'}}>
                            {note.category} | {formatDate(note.created_at)} by {note.author_name}
                          </small>
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                          <button
                            className="btn btn-secondary btn-small"
                            onClick={() => handleEditNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div style={{whiteSpace: 'pre-wrap', lineHeight: 1.6}}>
                        {note.content || <em style={{color: 'var(--text-secondary)'}}>No content</em>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'flowcharts' && (
              <div className="flowcharts-tab">
                <div style={{marginBottom: '1rem'}}>
                  <button className="btn btn-primary" onClick={openNewFlowchart}>
                    + New Flowchart
                  </button>
                </div>

                {teamFlowcharts.length === 0 ? (
                  <p style={{color: 'var(--text-secondary)'}}>
                    No flowcharts yet. Create a draft flowchart to plan pick/ban strategies.
                  </p>
                ) : (
                  teamFlowcharts.map(fc => {
                    const data = typeof fc.data === 'string' ? JSON.parse(fc.data) : fc.data;
                    const rootNodes = data.nodes ? data.nodes.filter(n => !data.edges?.some(e => e.to === n.id)) : [];
                    const rootId = rootNodes.length > 0 ? rootNodes[0].id : (data.nodes?.[0]?.id || null);

                    return (
                      <div key={fc.id} className="card mb-2">
                        <div className="card-header">
                          <div>
                            <h4 style={{color: 'var(--accent-gold)'}}>{fc.name}</h4>
                            <small style={{color: 'var(--text-secondary)'}}>
                              {formatDate(fc.created_at)}{fc.author_name ? ` by ${fc.author_name}` : ''}
                            </small>
                          </div>
                          <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button
                              className="btn btn-secondary btn-small"
                              onClick={() => openEditFlowchart(fc)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger btn-small"
                              onClick={() => handleDeleteFlowchart(fc.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {rootId && data.nodes && (
                          <div style={{overflowX: 'auto', padding: '1rem 0'}}>
                            <FlowchartRenderer
                              nodes={data.nodes}
                              edges={data.edges || []}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {showFlowchartModal && (
              <div className="image-modal" onClick={closeFlowchartModal}>
                <div
                  className="fc-modal-content card"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '900px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    padding: '1.5rem',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                    <h3 style={{color: 'var(--accent-gold)', margin: 0}}>
                      {editingFlowchart ? 'Edit Flowchart' : 'New Flowchart'}
                    </h3>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={closeFlowchartModal}
                    >
                      Close
                    </button>
                  </div>

                  <div className="form-group" style={{marginBottom: '1rem'}}>
                    <input
                      type="text"
                      value={fcName}
                      onChange={(e) => setFcName(e.target.value)}
                      placeholder="Flowchart name..."
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  {/* Node editor panel */}
                  {fcSelectedNodeId && (() => {
                    const selectedNode = fcNodes.find(n => n.id === fcSelectedNodeId);
                    if (!selectedNode) return null;
                    const parentEdge = fcEdges.find(e => e.to === fcSelectedNodeId);
                    const parentNode = parentEdge ? fcNodes.find(n => n.id === parentEdge.from) : null;

                    return (
                      <div style={{
                        padding: '1rem',
                        marginBottom: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <h4 style={{marginTop: 0, marginBottom: '0.75rem', color: 'var(--text-primary)'}}>
                          Edit Node
                        </h4>
                        <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end'}}>
                          <div style={{flex: '0 0 auto'}}>
                            <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem'}}>
                              Type
                            </label>
                            <select
                              value={selectedNode.type}
                              onChange={(e) => handleUpdateNodeField('type', e.target.value)}
                              style={{
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)'
                              }}
                            >
                              {NODE_TYPES.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{flex: '1 1 200px'}}>
                            <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem'}}>
                              Text
                            </label>
                            <input
                              type="text"
                              value={selectedNode.text}
                              onChange={(e) => handleUpdateNodeField('text', e.target.value)}
                              placeholder="Node text..."
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)'
                              }}
                            />
                          </div>
                          {parentEdge && parentNode?.type === 'decision' && (
                            <div style={{flex: '0 0 120px'}}>
                              <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem'}}>
                                Edge Label
                              </label>
                              <input
                                type="text"
                                value={parentEdge.label}
                                onChange={(e) => handleUpdateEdgeLabel(parentEdge.from, parentEdge.to, e.target.value)}
                                placeholder="Yes / No"
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)'
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.75rem'}}>
                          <button className="btn btn-primary btn-small" onClick={handleAddChildNode}>
                            + Add Child
                          </button>
                          {fcNodes.length > 1 && (
                            <button className="btn btn-danger btn-small" onClick={handleDeleteNode}>
                              Delete Node
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Flowchart preview */}
                  <div style={{
                    overflowX: 'auto',
                    padding: '1.5rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1rem',
                    minHeight: '150px'
                  }}>
                    {fcNodes.length > 0 && (
                      <FlowchartRenderer
                        nodes={fcNodes}
                        edges={fcEdges}
                        selectedNodeId={fcSelectedNodeId}
                        onSelectNode={setFcSelectedNodeId}
                      />
                    )}
                  </div>

                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                    <button className="btn btn-secondary" onClick={closeFlowchartModal}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveFlowchart}
                      disabled={!fcName.trim()}
                    >
                      {editingFlowchart ? 'Update' : 'Save'} Flowchart
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)'}}>
            <h3>Select a team to view scouting data</h3>
            <p>Or create a new enemy team to start tracking their drafts and tendencies.</p>
          </div>
        )}
      </div>

      {modalImage && (
        <div className="image-modal" onClick={() => setModalImage(null)}>
          <button className="close-btn" onClick={() => setModalImage(null)}>×</button>
          <img
            src={`/api/scouting/uploads/${modalImage.filename}`}
            alt={modalImage.original_name}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default Scouting;
