/**
 * Todo routes
 * /api/todos/*
 */

import express from 'express';
import Todo from '../models/Todo.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All todo routes require authentication
router.use(authenticate);

/**
 * GET /api/todos
 * Get all todos for current user
 */
router.get('/', (req, res) => {
  try {
    const todos = Todo.findByUserId(req.user.id);
    console.log(`GET /api/todos - Found ${todos.length} todos for user ${req.user.id}`);
    res.json(todos);
  } catch (error) {
    console.error('Get todos error:', error);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

/**
 * GET /api/todos/:id
 * Get a specific todo
 */
router.get('/:id', (req, res) => {
  try {
    const todo = Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Check ownership
    if (!Todo.belongsToUser(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`GET /api/todos/${req.params.id}`);
    res.json(todo);
  } catch (error) {
    console.error('Get todo error:', error);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

/**
 * POST /api/todos
 * Create a new todo
 */
router.post('/', (req, res) => {
  try {
    const { title } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const todo = Todo.create({
      userId: req.user.id,
      title: title.trim()
    });

    console.log(`POST /api/todos - Created todo: ${title}`);
    res.status(201).json(todo);
  } catch (error) {
    console.error('Create todo error:', error);
    res.status(500).json({ error: 'Failed to create todo' });
  }
});

/**
 * PUT /api/todos/:id
 * Update a todo
 */
router.put('/:id', (req, res) => {
  try {
    const todo = Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Check ownership
    if (!Todo.belongsToUser(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, completed } = req.body;

    // Validation
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    const updatedTodo = Todo.update(req.params.id, {
      title: title !== undefined ? title.trim() : undefined,
      completed
    });

    console.log(`PUT /api/todos/${req.params.id} - Updated todo`);
    res.json(updatedTodo);
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

/**
 * DELETE /api/todos/:id
 * Delete a todo
 */
router.delete('/:id', (req, res) => {
  try {
    const todo = Todo.findById(req.params.id);

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Check ownership
    if (!Todo.belongsToUser(req.params.id, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const deleted = Todo.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    console.log(`DELETE /api/todos/${req.params.id} - Deleted todo`);
    res.json({ message: 'Todo deleted', todo });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

export default router;
