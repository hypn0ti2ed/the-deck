const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all events for user
router.get('/', (req, res) => {
  try {
    const { project_id, start_after, start_before } = req.query;

    let query = 'SELECT * FROM events WHERE user_id = ?';
    const params = [req.user.id];

    if (project_id) {
      query += ' AND project_id = ?';
      params.push(project_id);
    }

    if (start_after) {
      query += ' AND start_time >= ?';
      params.push(start_after);
    }

    if (start_before) {
      query += ' AND start_time <= ?';
      params.push(start_before);
    }

    query += ' ORDER BY start_time ASC';

    const events = db.prepare(query).all(...params);
    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event
router.get('/:id', (req, res) => {
  try {
    const event = db.prepare(
      'SELECT * FROM events WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create event
router.post('/', (req, res) => {
  try {
    const { title, description, project_id, start_time, end_time, all_day } = req.body;

    if (!title || !start_time) {
      return res.status(400).json({ error: 'Event title and start time are required' });
    }

    // Verify project belongs to user if provided
    if (project_id) {
      const project = db.prepare(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?'
      ).get(project_id, req.user.id);

      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    const result = db.prepare(`
      INSERT INTO events (user_id, project_id, title, description, start_time, end_time, all_day)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      project_id || null,
      title,
      description || null,
      start_time,
      end_time || null,
      all_day ? 1 : 0
    );

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update event
router.put('/:id', (req, res) => {
  try {
    const { title, description, project_id, start_time, end_time, all_day } = req.body;

    const existing = db.prepare(
      'SELECT * FROM events WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Verify project belongs to user if changing
    if (project_id !== undefined && project_id !== null) {
      const project = db.prepare(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?'
      ).get(project_id, req.user.id);

      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
    }

    db.prepare(`
      UPDATE events
      SET title = ?, description = ?, project_id = ?, start_time = ?, end_time = ?, all_day = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title || existing.title,
      description !== undefined ? description : existing.description,
      project_id !== undefined ? project_id : existing.project_id,
      start_time || existing.start_time,
      end_time !== undefined ? end_time : existing.end_time,
      all_day !== undefined ? (all_day ? 1 : 0) : existing.all_day,
      req.params.id,
      req.user.id
    );

    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare(
      'SELECT * FROM events WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    db.prepare('DELETE FROM events WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
