const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper: Create or update event for a task with a due date
function syncTaskEvent(task, userId) {
  if (!task.due_date) {
    // No due date - delete associated event if exists
    if (task.event_id) {
      db.prepare('DELETE FROM events WHERE id = ?').run(task.event_id);
      db.prepare('UPDATE tasks SET event_id = NULL WHERE id = ?').run(task.id);
    }
    return null;
  }

  const eventTitle = `Task Due: ${task.title}`;
  const eventDescription = task.description || `Task "${task.title}" is due`;

  if (task.event_id) {
    // Update existing event
    db.prepare(`
      UPDATE events
      SET title = ?, description = ?, start_time = ?, project_id = ?, all_day = 1
      WHERE id = ?
    `).run(eventTitle, eventDescription, task.due_date, task.project_id, task.event_id);
    return task.event_id;
  } else {
    // Create new event
    const result = db.prepare(`
      INSERT INTO events (user_id, project_id, title, description, start_time, all_day)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(userId, task.project_id, eventTitle, eventDescription, task.due_date);

    const eventId = result.lastInsertRowid;
    db.prepare('UPDATE tasks SET event_id = ? WHERE id = ?').run(eventId, task.id);
    return eventId;
  }
}

// Get all tasks for user
router.get('/', (req, res) => {
  try {
    const { project_id, status, priority, due_before, due_after } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (project_id) {
      query += ' AND project_id = ?';
      params.push(project_id);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    if (due_before) {
      query += ' AND due_date <= ?';
      params.push(due_before);
    }

    if (due_after) {
      query += ' AND due_date >= ?';
      params.push(due_after);
    }

    query += ' ORDER BY due_date ASC, priority DESC, created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/:id', (req, res) => {
  try {
    const task = db.prepare(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create task
router.post('/', (req, res) => {
  try {
    const { title, description, project_id, priority, status, due_date } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
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
      INSERT INTO tasks (user_id, project_id, title, description, priority, status, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      project_id || null,
      title,
      description || null,
      priority || 'medium',
      status || 'pending',
      due_date || null
    );

    let task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

    // Create associated calendar event if due date is set
    if (due_date) {
      syncTaskEvent(task, req.user.id);
      task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
    }

    res.status(201).json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', (req, res) => {
  try {
    const { title, description, project_id, priority, status, due_date } = req.body;

    const existing = db.prepare(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
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

    const newTitle = title || existing.title;
    const newDescription = description !== undefined ? description : existing.description;
    const newProjectId = project_id !== undefined ? project_id : existing.project_id;
    const newDueDate = due_date !== undefined ? due_date : existing.due_date;

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, project_id = ?, priority = ?, status = ?, due_date = ?
      WHERE id = ? AND user_id = ?
    `).run(
      newTitle,
      newDescription,
      newProjectId,
      priority || existing.priority,
      status || existing.status,
      newDueDate,
      req.params.id,
      req.user.id
    );

    let task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    // Sync associated calendar event
    syncTaskEvent(task, req.user.id);
    task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);

    res.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare(
      'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Delete associated event if exists
    if (existing.event_id) {
      db.prepare('DELETE FROM events WHERE id = ?').run(existing.event_id);
    }

    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.user.id
    );

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
