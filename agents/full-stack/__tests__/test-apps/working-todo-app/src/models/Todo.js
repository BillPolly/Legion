/**
 * Todo model
 * Handles todo CRUD operations with SQLite
 */

import { getDatabase } from '../db/database.js';

export class Todo {
  /**
   * Create a new todo
   */
  static create({ userId, title }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO todos (user_id, title, completed)
      VALUES (?, ?, 0)
    `);

    const result = stmt.run(userId, title);

    return Todo.findById(result.lastInsertRowid);
  }

  /**
   * Find todo by ID
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, user_id, title, completed, created_at, updated_at
      FROM todos
      WHERE id = ?
    `);

    const todo = stmt.get(id);
    if (todo) {
      todo.completed = Boolean(todo.completed);
    }
    return todo;
  }

  /**
   * Find all todos for a user
   */
  static findByUserId(userId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, user_id, title, completed, created_at, updated_at
      FROM todos
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    const todos = stmt.all(userId);
    return todos.map(todo => ({
      ...todo,
      completed: Boolean(todo.completed)
    }));
  }

  /**
   * Update todo
   */
  static update(id, { title, completed }) {
    const db = getDatabase();
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }

    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }

    if (updates.length === 0) {
      return Todo.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const stmt = db.prepare(`
      UPDATE todos
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);
    return Todo.findById(id);
  }

  /**
   * Delete todo
   */
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Check if todo belongs to user
   */
  static belongsToUser(id, userId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM todos
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.get(id, userId);
    return result.count > 0;
  }
}

export default Todo;
