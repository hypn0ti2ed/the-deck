const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Global search across all entities
router.get('/', (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search projects
    const projects = db.prepare(`
      SELECT id, name, description, category, status, 'project' as type
      FROM projects
      WHERE user_id = ? AND (name LIKE ? OR description LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 10
    `).all(req.user.id, searchTerm, searchTerm);

    // Search tasks
    const tasks = db.prepare(`
      SELECT id, title, description, priority, status, 'task' as type
      FROM tasks
      WHERE user_id = ? AND (title LIKE ? OR description LIKE ?)
      ORDER BY created_at DESC
      LIMIT 10
    `).all(req.user.id, searchTerm, searchTerm);

    // Search events
    const events = db.prepare(`
      SELECT id, title, description, start_time, 'event' as type
      FROM events
      WHERE user_id = ? AND (title LIKE ? OR description LIKE ?)
      ORDER BY start_time DESC
      LIMIT 10
    `).all(req.user.id, searchTerm, searchTerm);

    // Search ideas
    const ideas = db.prepare(`
      SELECT id, title, content, category, 'idea' as type
      FROM ideas
      WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
      ORDER BY created_at DESC
      LIMIT 10
    `).all(req.user.id, searchTerm, searchTerm);

    res.json({
      query: q,
      results: {
        projects,
        tasks,
        events,
        ideas
      },
      total: projects.length + tasks.length + events.length + ideas.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
