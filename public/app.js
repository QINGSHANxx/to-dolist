const API_URL = '/api/todos';

let todos = [];
let currentFilter = 'all';
let draggedItem = null;
let stats = { total: 0, completed: 0 };

const todoInput = document.getElementById('todo-input');
const dueDateInput = document.getElementById('due-date-input');
const addBtn = document.getElementById('add-btn');
const toggleImportant = document.getElementById('toggle-important');
const toggleUrgent = document.getElementById('toggle-urgent');
const emptyState = document.getElementById('empty-state');
const tabs = document.querySelectorAll('.tab');

async function fetchTodos() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    todos = data.todos || [];
    renderTodos();
  } catch (error) {
    console.error('Failed to fetch todos:', error);
  }
}

async function fetchStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    stats = await response.json();
    updateStatsSummary();
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

function updateStatsSummary() {
  const el = document.getElementById('stats-summary');
  if (stats.total === 0) {
    el.textContent = '';
  } else {
    el.textContent = `共 ${stats.total} 项 · 已完成 ${stats.completed} 项`;
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
        important: toggleImportant.dataset.active === '1' ? 1 : 0,
        urgent: toggleUrgent.dataset.active === '1' ? 1 : 0,
        due_date: dueDateInput.value || null
      })
    });

    if (response.ok) {
      todoInput.value = '';
      dueDateInput.value = '';
      toggleImportant.dataset.active = '0';
      toggleUrgent.dataset.active = '0';
      updateToggleStyles();
      await fetchTodos();
      await fetchStats();
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
    await fetchStats();
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

async function deleteTodo(id) {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    await fetchTodos();
    await fetchStats();
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
    await fetchStats();
  } catch (error) {
    console.error('Failed to update todo:', error);
  }
}

async function reorderTodos(orderedIds) {
  try {
    await fetch(`${API_URL}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
  } catch (error) {
    console.error('Failed to reorder:', error);
  }
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dateStr);
  return dueDate < today;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getFilteredTodos() {
  switch (currentFilter) {
    case 'active':
      return todos.filter(t => !t.completed);
    case 'completed':
      return todos.filter(t => t.completed);
    default:
      return todos;
  }
}

function getQuadrant(todo) {
  if (todo.important && todo.urgent) return 'q1';
  if (todo.important && !todo.urgent) return 'q2';
  if (!todo.important && todo.urgent) return 'q3';
  return 'q4';
}

function getQuadrantLabel(q) {
  const labels = { q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4' };
  return labels[q] || '';
}

function renderTodoItem(todo) {
  const li = document.createElement('li');
  li.className = `todo-item${todo.completed ? ' completed' : ''}`;
  li.draggable = true;
  li.dataset.id = todo.id;

  const overdueClass = isOverdue(todo.due_date) && !todo.completed ? ' overdue' : '';
  const dateDisplay = todo.due_date
    ? `<span class="due-date${overdueClass}">${formatDate(todo.due_date)}</span>`
    : '';

  li.innerHTML = `
    <span class="material-icons drag-handle">drag_indicator</span>
    <div class="todo-checkbox${todo.completed ? ' checked' : ''}" data-action="toggle"></div>
    <div class="todo-content">
      <div class="todo-title">${escapeHtml(todo.title)}</div>
      <div class="todo-meta">
        ${dateDisplay}
      </div>
    </div>
    <div class="todo-actions">
      <button class="action-btn edit" data-action="edit" title="编辑">
        <span class="material-icons">edit</span>
      </button>
      <button class="action-btn delete" data-action="delete" title="删除">
        <span class="material-icons">delete</span>
      </button>
    </div>
  `;

  setupDragEvents(li);
  setupItemEvents(li, todo);
  return li;
}

function renderTodos() {
  const filtered = getFilteredTodos();
  const quadrants = { q1: [], q2: [], q3: [], q4: [] };

  filtered.forEach(todo => {
    quadrants[getQuadrant(todo)].push(todo);
  });

  Object.keys(quadrants).forEach(q => {
    const list = document.getElementById(`${q}-list`);
    const count = document.getElementById(`${q}-count`);
    list.innerHTML = '';
    count.textContent = quadrants[q].length;

    quadrants[q].forEach(todo => {
      list.appendChild(renderTodoItem(todo));
    });
  });

  const hasAny = filtered.length > 0;
  emptyState.classList.toggle('visible', !hasAny);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateToggleStyles() {
  toggleImportant.style.borderColor = toggleImportant.dataset.active === '1' ? 'var(--ink)' : 'var(--line)';
  toggleImportant.style.background = toggleImportant.dataset.active === '1' ? 'rgba(26,26,26,0.05)' : 'transparent';
  toggleImportant.style.color = toggleImportant.dataset.active === '1' ? 'var(--ink)' : 'var(--gray)';

  toggleUrgent.style.borderColor = toggleUrgent.dataset.active === '1' ? 'var(--ink)' : 'var(--line)';
  toggleUrgent.style.background = toggleUrgent.dataset.active === '1' ? 'rgba(26,26,26,0.05)' : 'transparent';
  toggleUrgent.style.color = toggleUrgent.dataset.active === '1' ? 'var(--ink)' : 'var(--gray)';
}

function setupDragEvents(li) {
  li.addEventListener('dragstart', (e) => {
    draggedItem = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    draggedItem = null;
    document.querySelectorAll('.todo-item').forEach(item => {
      item.style.borderTop = '';
    });
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedItem && draggedItem !== li) {
      const rect = li.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;

      document.querySelectorAll('.todo-item').forEach(item => {
        item.style.borderTop = '';
      });

      if (e.clientY < midY) {
        li.style.borderTop = '2px solid #C41E3A';
      } else {
        li.style.borderTop = '2px solid transparent';
      }
    }
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === li) return;

    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const parent = li.parentNode;

    if (e.clientY < midY) {
      parent.insertBefore(draggedItem, li);
    } else {
      parent.insertBefore(draggedItem, li.nextSibling);
    }

    const newOrder = Array.from(todoList.children).map(item => parseInt(item.dataset.id));
    reorderTodos(newOrder);

    document.querySelectorAll('.todo-item').forEach(item => {
      item.style.borderTop = '';
    });
  });
}

function setupItemEvents(li, todo) {
  const checkbox = li.querySelector('[data-action="toggle"]');
  checkbox.addEventListener('click', () => {
    toggleTodo(todo.id, !todo.completed);
  });

  const editBtn = li.querySelector('[data-action="edit"]');
  editBtn.addEventListener('click', () => {
    startEditing(li, todo);
  });

  const deleteBtn = li.querySelector('[data-action="delete"]');
  deleteBtn.addEventListener('click', () => {
    if (confirm('确定删除？')) {
      deleteTodo(todo.id);
    }
  });

  const titleEl = li.querySelector('.todo-title');
  titleEl.addEventListener('dblclick', () => {
    startEditing(li, todo);
  });
}

function startEditing(li, todo) {
  const titleEl = li.querySelector('.todo-title');
  const currentTitle = todo.title;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-title-input';
  input.value = currentTitle;

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
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = currentTitle;
      input.blur();
    }
  });
}

addBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTodo();
  }
});

toggleImportant.addEventListener('click', () => {
  toggleImportant.dataset.active = toggleImportant.dataset.active === '1' ? '0' : '1';
  updateToggleStyles();
});

toggleUrgent.addEventListener('click', () => {
  toggleUrgent.dataset.active = toggleUrgent.dataset.active === '1' ? '0' : '1';
  updateToggleStyles();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderTodos();
  });
});

updateToggleStyles();
fetchTodos();
fetchStats();
