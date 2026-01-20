const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for audio uploads
const uploadPath = process.env.UPLOAD_PATH || './data/uploads';
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadPath, req.user.id.toString());
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// Get all ideas for user
router.get('/', (req, res) => {
  try {
    const { category } = req.query;

    let query = 'SELECT * FROM ideas WHERE user_id = ?';
    const params = [req.user.id];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    const ideas = db.prepare(query).all(...params);
    res.json({ ideas });
  } catch (error) {
    console.error('Get ideas error:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

// Get single idea
router.get('/:id', (req, res) => {
  try {
    const idea = db.prepare(
      'SELECT * FROM ideas WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    res.json({ idea });
  } catch (error) {
    console.error('Get idea error:', error);
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

// Stream audio file
router.get('/:id/audio', (req, res) => {
  try {
    const idea = db.prepare(
      'SELECT * FROM ideas WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    if (!idea.audio_path) {
      return res.status(404).json({ error: 'No audio file for this idea' });
    }

    const audioPath = path.resolve(idea.audio_path);

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    res.sendFile(audioPath);
  } catch (error) {
    console.error('Get audio error:', error);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// Create idea (with optional audio upload)
router.post('/', upload.single('audio'), (req, res) => {
  try {
    const { title, content, category } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Idea title is required' });
    }

    const audio_path = req.file ? req.file.path : null;

    const result = db.prepare(`
      INSERT INTO ideas (user_id, title, content, audio_path, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      title,
      content || null,
      audio_path,
      category || null
    );

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ idea });
  } catch (error) {
    console.error('Create idea error:', error);
    res.status(500).json({ error: 'Failed to create idea' });
  }
});

// Update idea
router.put('/:id', upload.single('audio'), (req, res) => {
  try {
    const { title, content, category } = req.body;

    const existing = db.prepare(
      'SELECT * FROM ideas WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    let audio_path = existing.audio_path;

    // If new audio uploaded, delete old and use new
    if (req.file) {
      if (existing.audio_path && fs.existsSync(existing.audio_path)) {
        fs.unlinkSync(existing.audio_path);
      }
      audio_path = req.file.path;
    }

    db.prepare(`
      UPDATE ideas
      SET title = ?, content = ?, audio_path = ?, category = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title || existing.title,
      content !== undefined ? content : existing.content,
      audio_path,
      category !== undefined ? category : existing.category,
      req.params.id,
      req.user.id
    );

    const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
    res.json({ idea });
  } catch (error) {
    console.error('Update idea error:', error);
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

// Delete idea
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare(
      'SELECT * FROM ideas WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    // Delete audio file if exists
    if (existing.audio_path && fs.existsSync(existing.audio_path)) {
      fs.unlinkSync(existing.audio_path);
    }

    db.prepare('DELETE FROM ideas WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    res.json({ message: 'Idea deleted successfully' });
  } catch (error) {
    console.error('Delete idea error:', error);
    res.status(500).json({ error: 'Failed to delete idea' });
  }
});

module.exports = router;
