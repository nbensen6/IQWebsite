const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.NODE_ENV === 'production'
      ? '/data/uploads'
      : path.join(__dirname, '../uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'scout-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get all enemy teams
router.get('/teams', authenticateToken, (req, res) => {
  try {
    const teams = db.prepare(`
      SELECT et.*,
        (SELECT COUNT(*) FROM scouting_notes WHERE team_id = et.id) as notes_count,
        (SELECT COUNT(*) FROM scouting_images WHERE team_id = et.id) as images_count
      FROM enemy_teams et
      ORDER BY et.updated_at DESC
    `).all();

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Create enemy team
router.post('/teams', authenticateToken, (req, res) => {
  try {
    const { name, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const result = db.prepare(`
      INSERT INTO enemy_teams (name, notes)
      VALUES (?, ?)
    `).run(name, notes || '');

    const team = db.prepare('SELECT * FROM enemy_teams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update enemy team
router.put('/teams/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { name, notes } = req.body;

    const team = db.prepare('SELECT * FROM enemy_teams WHERE id = ?').get(id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    db.prepare(`
      UPDATE enemy_teams
      SET name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name || team.name, notes !== undefined ? notes : team.notes, id);

    const updated = db.prepare('SELECT * FROM enemy_teams WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete enemy team
router.delete('/teams/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    // Delete associated images from filesystem
    const images = db.prepare('SELECT filename FROM scouting_images WHERE team_id = ?').all(id);
    const uploadDir = process.env.NODE_ENV === 'production'
      ? '/data/uploads'
      : path.join(__dirname, '../uploads');

    images.forEach(img => {
      const filepath = path.join(uploadDir, img.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    db.prepare('DELETE FROM enemy_teams WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Get notes for a team
router.get('/teams/:teamId/notes', authenticateToken, (req, res) => {
  try {
    const { teamId } = req.params;
    const notes = db.prepare(`
      SELECT sn.*, u.username as author_name
      FROM scouting_notes sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.team_id = ?
      ORDER BY sn.created_at DESC
    `).all(teamId);

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create note for a team
router.post('/teams/:teamId/notes', authenticateToken, (req, res) => {
  try {
    const { teamId } = req.params;
    const { title, content, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO scouting_notes (team_id, user_id, title, content, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(teamId, req.user.id, title, content || '', category || 'General');

    // Update team's updated_at
    db.prepare('UPDATE enemy_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(teamId);

    const note = db.prepare(`
      SELECT sn.*, u.username as author_name
      FROM scouting_notes sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
router.put('/notes/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category } = req.body;

    const note = db.prepare('SELECT * FROM scouting_notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    db.prepare(`
      UPDATE scouting_notes
      SET title = ?, content = ?, category = ?
      WHERE id = ?
    `).run(title || note.title, content !== undefined ? content : note.content, category || note.category, id);

    const updated = db.prepare(`
      SELECT sn.*, u.username as author_name
      FROM scouting_notes sn
      LEFT JOIN users u ON sn.user_id = u.id
      WHERE sn.id = ?
    `).get(id);

    res.json(updated);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/notes/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM scouting_notes WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Get images for a team
router.get('/teams/:teamId/images', authenticateToken, (req, res) => {
  try {
    const { teamId } = req.params;
    const images = db.prepare(`
      SELECT si.*, u.username as uploaded_by
      FROM scouting_images si
      LEFT JOIN users u ON si.user_id = u.id
      WHERE si.team_id = ?
      ORDER BY si.created_at DESC
    `).all(teamId);

    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Upload image for a team
router.post('/teams/:teamId/images', authenticateToken, upload.single('image'), (req, res) => {
  try {
    const { teamId } = req.params;
    const { description } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const result = db.prepare(`
      INSERT INTO scouting_images (team_id, user_id, filename, original_name, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(teamId, req.user.id, req.file.filename, req.file.originalname, description || '');

    // Update team's updated_at
    db.prepare('UPDATE enemy_teams SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(teamId);

    const image = db.prepare(`
      SELECT si.*, u.username as uploaded_by
      FROM scouting_images si
      LEFT JOIN users u ON si.user_id = u.id
      WHERE si.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(image);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image
router.delete('/images/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const image = db.prepare('SELECT * FROM scouting_images WHERE id = ?').get(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file from filesystem
    const uploadDir = process.env.NODE_ENV === 'production'
      ? '/data/uploads'
      : path.join(__dirname, '../uploads');
    const filepath = path.join(uploadDir, image.filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    db.prepare('DELETE FROM scouting_images WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Serve uploaded images
router.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const uploadDir = process.env.NODE_ENV === 'production'
    ? '/data/uploads'
    : path.join(__dirname, '../uploads');
  const filepath = path.join(uploadDir, filename);

  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

module.exports = router;
