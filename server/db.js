const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'todos.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").get();

if (tableInfo) {
  const columns = db.prepare("PRAGMA table_info(todos)").all();
  const hasPriority = columns.some(c => c.name === 'priority');

  if (hasPriority) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        important INTEGER DEFAULT 0,
        urgent INTEGER DEFAULT 0,
        due_date TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      INSERT INTO todos_new (id, title, completed, important, urgent, due_date, sort_order, created_at)
      SELECT id, title, completed,
        CASE WHEN priority = 'high' THEN 1 ELSE 0 END as important,
        CASE WHEN priority IN ('high', 'medium') THEN 1 ELSE 0 END as urgent,
        due_date, sort_order, created_at
      FROM todos
    `);

    db.exec('DROP TABLE todos');
    db.exec('ALTER TABLE todos_new RENAME TO todos');
  }
} else {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      important INTEGER DEFAULT 0,
      urgent INTEGER DEFAULT 0,
      due_date TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

module.exports = {
  getAllTodos() {
    return db.prepare('SELECT * FROM todos ORDER BY sort_order, created_at DESC').all();
  },

  getTodoById(id) {
    return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  },

  createTodo({ title, important = 0, urgent = 0, due_date = null }) {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM todos').get();
    const stmt = db.prepare('INSERT INTO todos (title, important, urgent, due_date, sort_order) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(title, important, urgent, due_date, maxOrder.next);
    return this.getTodoById(result.lastInsertRowid);
  },

  updateTodo(id, fields) {
    const todo = this.getTodoById(id);
    if (!todo) return null;

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      if (key !== 'id' && key !== 'created_at' && todo.hasOwnProperty(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) return todo;

    values.push(id);
    db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getTodoById(id);
  },

  deleteTodo(id) {
    const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return result.changes > 0;
  },

  reorderTodos(orderedIds) {
    const stmt = db.prepare('UPDATE todos SET sort_order = ? WHERE id = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index + 1, id));
    });
    transaction(orderedIds);
    return true;
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM todos').get().count;
    const completed = db.prepare('SELECT COUNT(*) as count FROM todos WHERE completed = 1').get().count;
    const quadrants = {
      q1: db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) as completed FROM todos WHERE important = 1 AND urgent = 1").get(),
      q2: db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) as completed FROM todos WHERE important = 1 AND urgent = 0").get(),
      q3: db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) as completed FROM todos WHERE important = 0 AND urgent = 1").get(),
      q4: db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) as completed FROM todos WHERE important = 0 AND urgent = 0").get(),
    };
    return { total, completed, quadrants };
  }
};
