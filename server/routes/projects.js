const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all projects for user
router.get('/', (req, res) => {
  try {
    const { category, status } = req.query;

    let query = 'SELECT * FROM projects WHERE user_id = ?';
    const params = [req.user.id];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC';

    const projects = db.prepare(query).all(...params);
    res.json({ projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with related tasks and events
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = db.prepare(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC'
    ).all(project.id);

    const events = db.prepare(
      'SELECT * FROM events WHERE project_id = ? ORDER BY start_time ASC'
    ).all(project.id);

    res.json({ project, tasks, events });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { name, description, category, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const result = db.prepare(`
      INSERT INTO projects (user_id, name, description, category, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      name,
      description || null,
      category || 'personal',
      status || 'active'
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const { name, description, category, status } = req.body;

    const existing = db.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    db.prepare(`
      UPDATE projects
      SET name = ?, description = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      category || existing.category,
      status || existing.status,
      req.params.id,
      req.user.id
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
