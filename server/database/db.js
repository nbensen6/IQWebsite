const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'iq.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'player' CHECK(role IN ('admin', 'player', 'viewer')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Player profiles
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    summoner_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('Top', 'Jungle', 'Mid', 'ADC', 'Support')),
    champion_pool TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Match stats from CSV imports
  CREATE TABLE IF NOT EXISTS match_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT NOT NULL,
    match_date DATE NOT NULL,
    champion TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    cs INTEGER DEFAULT 0,
    vision_score INTEGER DEFAULT 0,
    damage INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    result TEXT CHECK(result IN ('Win', 'Loss', 'win', 'loss'))
  );

  -- Champion notes (per user)
  CREATE TABLE IF NOT EXISTS champion_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    champion_id TEXT NOT NULL,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, champion_id)
  );

  -- General notes
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT 'General',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Team announcements
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log('Database initialized successfully');

module.exports = db;
