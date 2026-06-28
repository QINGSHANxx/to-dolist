const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const todos = db.getAllTodos();
    res.json({ todos });
  } catch (error) {
    res.status(500).json({ error: '获取 Todo 列表失败' });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: '获取统计失败' });
  }
});

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

router.put('/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds 必须是数组' });
    }

    db.reorderTodos(orderedIds);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '排序失败' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const todo = db.updateTodo(parseInt(id), fields);

    if (!todo) {
      return res.status(404).json({ error: 'Todo 不存在' });
    }

    res.json({ todo });
  } catch (error) {
    res.status(500).json({ error: '更新 Todo 失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteTodo(parseInt(id));

    if (!deleted) {
      return res.status(404).json({ error: 'Todo 不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除 Todo 失败' });
  }
});

module.exports = router;
