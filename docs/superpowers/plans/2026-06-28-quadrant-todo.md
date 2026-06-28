# 四象限 Todo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Todo 应用改造为艾森豪威尔矩阵四象限布局，用 important + urgent 双布尔维度替代 priority 字段。

**Architecture:** 数据库层做表迁移，后端 API 适配新字段并新增 stats 端点，前端改为 2×2 网格布局，输入区改为双开关。

**Tech Stack:** Node.js, Express, better-sqlite3, 原生 HTML/CSS/JS, Google Fonts (Ma Shan Zheng, Noto Serif, IBM Plex Mono)

---

### Task 1: 数据库迁移

**Files:**
- Modify: `D:\todo-app\server\db.js`

- [ ] **Step 1: 创建新表并迁移数据**

在 db.js 的初始化代码中，将原来的 `CREATE TABLE IF NOT EXISTS todos` 替换为迁移逻辑：

```javascript
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

const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").get();
if (tableInfo) {
  db.exec(`
    INSERT INTO todos_new (id, title, completed, important, urgent, due_date, sort_order, created_at)
    SELECT id, title, completed,
      CASE WHEN priority = 'high' THEN 1 ELSE 0 END as important,
      CASE WHEN priority IN ('high', 'medium') THEN 1 ELSE 0 END as urgent,
      due_date, sort_order, created_at
    FROM todos
  `);
  db.exec('DROP TABLE todos');
}

db.exec('ALTER TABLE todos_new RENAME TO todos');
```

- [ ] **Step 2: 修改 CRUD 函数**

更新 `createTodo` 和 `updateTodo` 函数，将 `priority` 参数改为 `important` + `urgent`：

```javascript
createTodo({ title, important = 0, urgent = 0, due_date = null }) {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM todos').get();
  const stmt = db.prepare('INSERT INTO todos (title, important, urgent, due_date, sort_order) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(title, important, urgent, due_date, maxOrder.next);
  return this.getTodoById(result.lastInsertRowid);
},
```

- [ ] **Step 3: 添加 stats 查询函数**

```javascript
getStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM todos').get().count;
  const completed = db.prepare('SELECT COUNT(*) as count FROM todos WHERE completed = 1').get().count;
  const quadrants = {
    q1: db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE important = 1 AND urgent = 1').get(),
    q2: db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE important = 1 AND urgent = 0').get(),
    q3: db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE important = 0 AND urgent = 1').get(),
    q4: db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed FROM todos WHERE important = 0 AND urgent = 0').get(),
  };
  return { total, completed, quadrants };
},
```

- [ ] **Step 4: 删除旧数据库文件，重启验证**

删除 `D:\todo-app\todos.db`，启动服务器验证新表创建成功。

Run: `node server/index.js`
Expected: 服务器启动无报错，`todos.db` 自动重新创建

- [ ] **Step 5: Commit**

```bash
git add server/db.js
git commit -m "feat: migrate todos table from priority to important+urgent"
```

---

### Task 2: 更新 API 路由

**Files:**
- Modify: `D:\todo-app\server\routes\todos.js`

- [ ] **Step 1: 修改 POST 和 PUT 路由的字段**

将 `router.post` 和 `router.put('/:id')` 中的 `priority` 改为 `important` + `urgent`：

```javascript
router.post('/', (req, res) => {
  try {
    const { title, important, urgent, due_date } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: '标题不能为空' });
    }

    const todo = db.createTodo({
      title: title.trim(),
      important: important ? 1 : 0,
      urgent: urgent ? 1 : 0,
      due_date: due_date || null
    });

    res.status(201).json({ todo });
  } catch (error) {
    res.status(500).json({ error: '创建 Todo 失败' });
  }
});
```

- [ ] **Step 2: 新增 stats 端点**

在 `router.delete` 之前添加：

```javascript
router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '获取统计失败' });
  }
});
```

- [ ] **Step 3: 测试 API**

Run: `Invoke-WebRequest -Uri http://localhost:3000/api/todos/stats -UseBasicParsing | Select-Object -ExpandProperty Content`
Expected: 返回包含 total, completed, quadrants 的 JSON

- [ ] **Step 4: Commit**

```bash
git add server/routes/todos.js
git commit -m "feat: update API for important+urgent fields, add stats endpoint"
```

---

### Task 3: 更新前端 HTML

**Files:**
- Modify: `D:\todo-app\public\index.html`

- [ ] **Step 1: 重写 HTML 结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>待办</title>
  <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app-container">
    <header class="app-header">
      <h1 class="app-title">待办</h1>
      <div class="stats-bar">
        <span id="stats-total">共 0 项</span>
        <span class="stats-sep">·</span>
        <span id="stats-completed">已完成 0 项</span>
      </div>
    </header>

    <div class="quadrant-grid">
      <div class="quadrant quadrant-q1" data-quadrant="q1">
        <div class="quadrant-header">
          <span class="quadrant-icon">🔴</span>
          <span class="quadrant-label">立即做</span>
          <span class="quadrant-count" data-count="q1">0</span>
        </div>
        <ul class="quadrant-list" data-list="q1"></ul>
      </div>
      <div class="quadrant quadrant-q2" data-quadrant="q2">
        <div class="quadrant-header">
          <span class="quadrant-icon">🔵</span>
          <span class="quadrant-label">安排做</span>
          <span class="quadrant-count" data-count="q2">0</span>
        </div>
        <ul class="quadrant-list" data-list="q2"></ul>
      </div>
      <div class="quadrant quadrant-q3" data-quadrant="q3">
        <div class="quadrant-header">
          <span class="quadrant-icon">🟡</span>
          <span class="quadrant-label">委托做</span>
          <span class="quadrant-count" data-count="q3">0</span>
        </div>
        <ul class="quadrant-list" data-list="q3"></ul>
      </div>
      <div class="quadrant quadrant-q4" data-quadrant="q4">
        <div class="quadrant-header">
          <span class="quadrant-icon">⚪</span>
          <span class="quadrant-label">尽量删</span>
          <span class="quadrant-count" data-count="q4">0</span>
        </div>
        <ul class="quadrant-list" data-list="q4"></ul>
      </div>
    </div>

    <div class="todo-input-section">
      <input type="text" id="todo-input" placeholder="写下来，才不会忘..." maxlength="200">
      <div class="input-controls">
        <button class="toggle-btn" id="important-btn" data-field="important">重要</button>
        <button class="toggle-btn" id="urgent-btn" data-field="urgent">紧急</button>
        <input type="date" id="due-date-input">
        <button id="add-btn" class="add-btn">
          <span class="material-icons">add</span>
        </button>
      </div>
    </div>

    <div id="empty-state" class="empty-state">
      <p class="empty-text">空空如也</p>
      <p class="empty-sub">下方添一笔</p>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: restructure HTML for quadrant grid layout"
```

---

### Task 4: 重写前端 CSS

**Files:**
- Modify: `D:\todo-app\public\style.css`

- [ ] **Step 1: 重写完整样式**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --paper: #F8F4ED;
  --ink: #1A1A1A;
  --seal: #C41E3A;
  --indigo: #2D5F8A;
  --gold: #B8860B;
  --gray: #6B6B6B;
  --line: #E5DED3;
  --q1: #C41E3A;
  --q2: #2D5F8A;
  --q3: #B8860B;
  --q4: #6B6B6B;
}

body {
  font-family: 'Noto Serif', 'SimSun', serif;
  background: var(--paper);
  color: var(--ink);
  min-height: 100vh;
  padding: 20px;
}

.app-container {
  max-width: 800px;
  margin: 0 auto;
  background: #FFFCF7;
  border: 1px solid var(--line);
  box-shadow: 0 2px 12px rgba(26, 26, 26, 0.06);
}

.app-header {
  padding: 28px 24px 20px;
  border-bottom: 1px solid var(--line);
}

.app-title {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 36px;
  font-weight: 400;
  letter-spacing: 6px;
}

.stats-bar {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: var(--gray);
  margin-top: 6px;
  letter-spacing: 0.5px;
}

.stats-sep {
  margin: 0 6px;
}

.quadrant-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--line);
}

.quadrant {
  min-height: 160px;
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.quadrant:nth-child(odd) {
  border-right: 1px solid var(--line);
}

.quadrant-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--line);
}

.quadrant-icon {
  font-size: 14px;
}

.quadrant-label {
  font-family: 'Noto Serif', serif;
  font-size: 14px;
  font-weight: 500;
}

.quadrant-count {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: var(--gray);
  margin-left: auto;
}

.quadrant-q1 .quadrant-label { color: var(--q1); }
.quadrant-q2 .quadrant-label { color: var(--q2); }
.quadrant-q3 .quadrant-label { color: var(--q3); }
.quadrant-q4 .quadrant-label { color: var(--q4); }

.quadrant-list {
  list-style: none;
}

.quadrant-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
  cursor: grab;
}

.quadrant-item:last-child {
  border-bottom: none;
}

.quadrant-item.dragging {
  opacity: 0.3;
}

.quadrant-item.completed .item-title {
  text-decoration: line-through;
  color: var(--gray);
}

.item-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-top: 2px;
}

.item-checkbox:hover {
  border-color: var(--seal);
}

.item-checkbox.checked {
  background: var(--seal);
  border-color: var(--seal);
  transform: rotate(-8deg) scale(1.05);
}

.item-checkbox.checked::after {
  content: '印';
  color: #FFFCF7;
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 10px;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.item-due {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--gray);
  margin-top: 2px;
}

.item-due.overdue {
  color: var(--seal);
}

.item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.quadrant-item:hover .item-actions {
  opacity: 1;
}

.item-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--gray);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-btn .material-icons {
  font-size: 14px;
}

.item-btn:hover {
  color: var(--ink);
}

.item-btn.delete:hover {
  color: var(--seal);
}

.todo-input-section {
  padding: 16px 24px;
  border-bottom: 1px solid var(--line);
}

#todo-input {
  width: 100%;
  padding: 10px 0;
  border: none;
  border-bottom: 1px solid var(--line);
  font-family: 'Noto Serif', serif;
  font-size: 14px;
  background: transparent;
  color: var(--ink);
  margin-bottom: 12px;
}

#todo-input:focus {
  outline: none;
  border-bottom-color: var(--ink);
}

#todo-input::placeholder {
  color: #B0A898;
  font-style: italic;
}

.input-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toggle-btn {
  padding: 6px 14px;
  border: 1px solid var(--line);
  background: transparent;
  font-family: 'Noto Serif', serif;
  font-size: 12px;
  color: var(--gray);
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn.active-important {
  background: var(--q1);
  border-color: var(--q1);
  color: #fff;
}

.toggle-btn.active-urgent {
  background: var(--q3);
  border-color: var(--q3);
  color: #fff;
}

#due-date-input {
  padding: 6px 10px;
  border: 1px solid var(--line);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  background: transparent;
  color: var(--gray);
}

.add-btn {
  width: 34px;
  height: 34px;
  border: 1px solid var(--ink);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  transition: all 0.15s;
}

.add-btn:hover {
  background: var(--ink);
  color: #FFFCF7;
}

.add-btn .material-icons {
  font-size: 18px;
}

.empty-state {
  display: none;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
}

.empty-state.visible {
  display: flex;
}

.empty-text {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 20px;
  color: var(--line);
  letter-spacing: 4px;
}

.empty-sub {
  font-size: 12px;
  color: #C8C0B4;
  margin-top: 6px;
  font-style: italic;
}

@media (max-width: 600px) {
  .quadrant-grid {
    grid-template-columns: 1fr;
  }

  .quadrant:nth-child(odd) {
    border-right: none;
  }

  .quadrant:nth-child(1),
  .quadrant:nth-child(2),
  .quadrant:nth-child(3) {
    border-bottom: 1px solid var(--line);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat: redesign CSS for quadrant grid layout"
```

---

### Task 5: 重写前端 JS

**Files:**
- Modify: `D:\todo-app\public\app.js`

- [ ] **Step 1: 重写完整交互逻辑**

```javascript
const API_URL = '/api/todos';

let todos = [];
let importantState = 0;
let urgentState = 0;

const todoInput = document.getElementById('todo-input');
const importantBtn = document.getElementById('important-btn');
const urgentBtn = document.getElementById('urgent-btn');
const dueDateInput = document.getElementById('due-date-input');
const addBtn = document.getElementById('add-btn');
const emptyState = document.getElementById('empty-state');
const statsTotal = document.getElementById('stats-total');
const statsCompleted = document.getElementById('stats-completed');

function getQuadrant(important, urgent) {
  if (important && urgent) return 'q1';
  if (important && !urgent) return 'q2';
  if (!important && urgent) return 'q3';
  return 'q4';
}

async function fetchTodos() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    todos = data.todos || [];
    renderTodos();
    updateStats();
  } catch (error) {
    console.error('Failed to fetch todos:', error);
  }
}

async function fetchStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const stats = await response.json();
    statsTotal.textContent = `共 ${stats.total} 项`;
    statsCompleted.textContent = `已完成 ${stats.completed} 项`;
    document.querySelectorAll('.quadrant-count').forEach(el => {
      const q = el.dataset.count;
      el.textContent = stats.quadrants[q].total || 0;
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

async function addTodo() {
  const title = todoInput.value.trim();
  if (!title) return;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        important: importantState,
        urgent: urgentState,
        due_date: dueDateInput.value || null
      })
    });

    if (response.ok) {
      todoInput.value = '';
      dueDateInput.value = '';
      importantState = 0;
      urgentState = 0;
      importantBtn.className = 'toggle-btn';
      urgentBtn.className = 'toggle-btn';
      await fetchTodos();
    }
  } catch (error) {
    console.error('Failed to add todo:', error);
  }
}

async function toggleTodo(id, completed) {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: completed ? 1 : 0 })
    });
    await fetchTodos();
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

async function deleteTodo(id) {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    await fetchTodos();
  } catch (error) {
    console.error('Failed to delete todo:', error);
  }
}

async function updateTodo(id, fields) {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    await fetchTodos();
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderTodos() {
  const lists = { q1: [], q2: [], q3: [], q4: [] };

  todos.forEach(todo => {
    const q = getQuadrant(todo.important, todo.urgent);
    lists[q].push(todo);
  });

  Object.keys(lists).forEach(q => {
    const list = document.querySelector(`[data-list="${q}"]`);
    list.innerHTML = '';

    const active = lists[q].filter(t => !t.completed);
    const done = lists[q].filter(t => t.completed);
    const sorted = [...active, ...done];

    sorted.forEach(todo => {
      const li = document.createElement('li');
      li.className = `quadrant-item${todo.completed ? ' completed' : ''}`;
      li.draggable = true;
      li.dataset.id = todo.id;

      const overdueClass = isOverdue(todo.due_date) && !todo.completed ? ' overdue' : '';
      const dateDisplay = todo.due_date
        ? `<div class="item-due${overdueClass}">${formatDate(todo.due_date)}</div>`
        : '';

      li.innerHTML = `
        <div class="item-checkbox${todo.completed ? ' checked' : ''}" data-action="toggle"></div>
        <div class="item-content">
          <div class="item-title">${escapeHtml(todo.title)}</div>
          ${dateDisplay}
        </div>
        <div class="item-actions">
          <button class="item-btn edit" data-action="edit" title="编辑">
            <span class="material-icons">edit</span>
          </button>
          <button class="item-btn delete" data-action="delete" title="删除">
            <span class="material-icons">delete</span>
          </button>
        </div>
      `;

      setupItemEvents(li, todo);
      list.appendChild(li);
    });
  });

  const hasAny = todos.length > 0;
  emptyState.classList.toggle('visible', !hasAny);
}

function updateStats() {
  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  statsTotal.textContent = `共 ${total} 项`;
  statsCompleted.textContent = `已完成 ${completed} 项`;

  const counts = { q1: 0, q2: 0, q3: 0, q4: 0 };
  todos.forEach(todo => {
    counts[getQuadrant(todo.important, todo.urgent)]++;
  });
  document.querySelectorAll('.quadrant-count').forEach(el => {
    el.textContent = counts[el.dataset.count];
  });
}

function setupItemEvents(li, todo) {
  li.querySelector('[data-action="toggle"]').addEventListener('click', () => {
    toggleTodo(todo.id, !todo.completed);
  });

  li.querySelector('[data-action="edit"]').addEventListener('click', () => {
    startEditing(li, todo);
  });

  li.querySelector('[data-action="delete"]').addEventListener('click', () => {
    if (confirm('确定删除？')) {
      deleteTodo(todo.id);
    }
  });
}

function startEditing(li, todo) {
  const titleEl = li.querySelector('.item-title');
  const currentTitle = todo.title;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-title-input';
  input.value = currentTitle;
  input.style.cssText = 'width:100%;padding:2px 0;border:none;border-bottom:1px solid #C41E3A;font-family:inherit;font-size:13px;background:transparent;';

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      await updateTodo(todo.id, { title: newTitle });
    } else {
      renderTodos();
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = currentTitle;
      input.blur();
    }
  });
}

importantBtn.addEventListener('click', () => {
  importantState = importantState ? 0 : 1;
  importantBtn.className = importantState ? 'toggle-btn active-important' : 'toggle-btn';
});

urgentBtn.addEventListener('click', () => {
  urgentState = urgentState ? 0 : 1;
  urgentBtn.className = urgentState ? 'toggle-btn active-urgent' : 'toggle-btn';
});

addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

fetchTodos();
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: rewrite JS for quadrant rendering and toggle inputs"
```

---

### Task 6: 测试验证

**Files:** 无新增

- [ ] **Step 1: 启动服务器**

Run: `node server/index.js`
Expected: 服务器启动无报错

- [ ] **Step 2: 测试 API**

Run:
```
Invoke-WebRequest -Uri http://localhost:3000/api/todos/stats -UseBasicParsing | Select-Object -ExpandProperty Content
```
Expected: `{"total":0,"completed":0,"quadrants":{"q1":...}}`

- [ ] **Step 3: 测试创建任务**

Run:
```
$body = '{"title":"测试Q1","important":true,"urgent":true}'; Invoke-WebRequest -Uri http://localhost:3000/api/todos -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content
```
Expected: 返回 todo 对象，important=1, urgent=1

- [ ] **Step 4: 浏览器验证**

访问 http://localhost:3000，验证：
- 四象限网格正确显示
- 添加任务后出现在对应象限
- 统计数字正确
- 手机尺寸下垂直堆叠

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete quadrant Todo app implementation"
```
