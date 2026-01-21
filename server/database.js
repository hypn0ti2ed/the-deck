const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/deck.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT CHECK(category IN ('personal', 'professional', 'academic')) DEFAULT 'personal',
      status TEXT CHECK(status IN ('active', 'completed', 'on-hold')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER,
      event_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('pending', 'in-progress', 'completed')) DEFAULT 'pending',
      due_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      project_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      all_day BOOLEAN DEFAULT 0,
      source TEXT DEFAULT 'local',
      external_id TEXT,
      calendar_account_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (calendar_account_id) REFERENCES calendar_accounts(id) ON DELETE CASCADE
    );

    -- User OAuth configurations (per-user OAuth app credentials)
    CREATE TABLE IF NOT EXISTS user_oauth_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('google', 'outlook')),
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, provider)
    );

    -- Calendar accounts table (for Google/Outlook sync)
    CREATE TABLE IF NOT EXISTS calendar_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('google', 'outlook')),
      email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at DATETIME,
      calendar_id TEXT,
      enabled BOOLEAN DEFAULT 1,
      last_synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, provider, email)
    );

    -- Ideas table
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      audio_path TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
    CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_accounts_user ON calendar_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_external ON events(external_id, calendar_account_id);
    CREATE INDEX IF NOT EXISTS idx_user_oauth_configs ON user_oauth_configs(user_id, provider);
  `);

  // Migration: Add new columns to events if they don't exist
  const eventColumns = db.prepare("PRAGMA table_info(events)").all();
  const hasSource = eventColumns.some(col => col.name === 'source');
  if (!hasSource) {
    db.exec("ALTER TABLE events ADD COLUMN source TEXT DEFAULT 'local'");
    db.exec("ALTER TABLE events ADD COLUMN external_id TEXT");
    db.exec("ALTER TABLE events ADD COLUMN calendar_account_id INTEGER REFERENCES calendar_accounts(id) ON DELETE CASCADE");
    console.log('Migration: Added sync columns to events table');
  }

  // Migration: Add event_id column to tasks if it doesn't exist
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
  const hasEventId = taskColumns.some(col => col.name === 'event_id');
  if (!hasEventId) {
    db.exec('ALTER TABLE tasks ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE SET NULL');
    console.log('Migration: Added event_id column to tasks table');
  }

  console.log('Database initialized successfully');
}

module.exports = { db, initializeDatabase };
