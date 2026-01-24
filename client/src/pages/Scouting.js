import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const NOTE_CATEGORIES = ['General', 'Draft Tendencies', 'Playstyle', 'Weaknesses', 'Player Notes'];

function Scouting() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('images');
  const [teamNotes, setTeamNotes] = useState([]);
  const [teamImages, setTeamImages] = useState([]);

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

  useEffect(() => {
    fetchTeams();
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

  const fetchTeamData = useCallback(async (teamId) => {
    try {
      const [notesRes, imagesRes] = await Promise.all([
        api.get(`/scouting/teams/${teamId}/notes`),
        api.get(`/scouting/teams/${teamId}/images`)
      ]);
      setTeamNotes(notesRes.data);
      setTeamImages(imagesRes.data);
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
                className={`team-tab ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes ({teamNotes.length})
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
