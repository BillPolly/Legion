/**
 * Unit tests for Todo model
 * Uses real database (in-memory) - NO MOCKS for database
 */

import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import Todo from '../../../src/models/Todo.js';
import User from '../../../src/models/User.js';
import { getDatabase, initializeSchema, closeDatabase, resetDatabase, clearDatabase } from '../../../src/db/database.js';

describe('Todo Model - Unit Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Use in-memory database for tests
    process.env.DB_PATH = ':memory:';
    resetDatabase();  // Close and reset db singleton
    initializeSchema();
    clearDatabase();

    // Create a test user for todo operations
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User'
    });
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('create()', () => {
    test('should create a new todo', () => {
      const todo = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      expect(todo).toBeDefined();
      expect(todo.id).toBeDefined();
      expect(todo.user_id).toBe(testUser.id);
      expect(todo.title).toBe('Test Todo');
      expect(todo.completed).toBe(false);
      expect(todo.created_at).toBeDefined();
    });

    test('should create todo with completed defaulting to false', () => {
      const todo = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      expect(todo.completed).toBe(false);
    });
  });

  describe('findById()', () => {
    test('should find todo by ID', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const todo = Todo.findById(created.id);
      expect(todo).toBeDefined();
      expect(todo.id).toBe(created.id);
      expect(todo.title).toBe('Test Todo');
      expect(todo.user_id).toBe(testUser.id);
    });

    test('should return undefined for non-existent ID', () => {
      const todo = Todo.findById(99999);
      expect(todo).toBeUndefined();
    });

    test('should convert completed to boolean', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const todo = Todo.findById(created.id);
      expect(typeof todo.completed).toBe('boolean');
      expect(todo.completed).toBe(false);
    });
  });

  describe('findByUserId()', () => {
    test('should find all todos for a user', () => {
      Todo.create({ userId: testUser.id, title: 'Todo 1' });
      Todo.create({ userId: testUser.id, title: 'Todo 2' });
      Todo.create({ userId: testUser.id, title: 'Todo 3' });

      const todos = Todo.findByUserId(testUser.id);
      expect(todos).toHaveLength(3);

      // Verify all todos are present
      const titles = todos.map(t => t.title);
      expect(titles).toContain('Todo 1');
      expect(titles).toContain('Todo 2');
      expect(titles).toContain('Todo 3');
    });

    test('should return empty array for user with no todos', async () => {
      const anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123',
        name: 'Another User'
      });

      const todos = Todo.findByUserId(anotherUser.id);
      expect(todos).toEqual([]);
    });

    test('should only return todos for specified user', async () => {
      const anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123',
        name: 'Another User'
      });

      Todo.create({ userId: testUser.id, title: 'User 1 Todo' });
      Todo.create({ userId: anotherUser.id, title: 'User 2 Todo' });

      const todos = Todo.findByUserId(testUser.id);
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('User 1 Todo');
    });

    test('should convert completed to boolean for all todos', () => {
      Todo.create({ userId: testUser.id, title: 'Todo 1' });
      Todo.create({ userId: testUser.id, title: 'Todo 2' });

      const todos = Todo.findByUserId(testUser.id);
      todos.forEach(todo => {
        expect(typeof todo.completed).toBe('boolean');
      });
    });
  });

  describe('update()', () => {
    test('should update todo title', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Original Title'
      });

      const updated = Todo.update(created.id, { title: 'Updated Title' });
      expect(updated.title).toBe('Updated Title');
      expect(updated.completed).toBe(false);
    });

    test('should update todo completed status', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const updated = Todo.update(created.id, { completed: true });
      expect(updated.completed).toBe(true);
      expect(updated.title).toBe('Test Todo');
    });

    test('should update both title and completed', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Original Title'
      });

      const updated = Todo.update(created.id, {
        title: 'Updated Title',
        completed: true
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.completed).toBe(true);
    });

    test('should return unchanged todo if no updates provided', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const updated = Todo.update(created.id, {});
      expect(updated.title).toBe('Test Todo');
      expect(updated.completed).toBe(false);
    });
  });

  describe('delete()', () => {
    test('should delete todo', () => {
      const created = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const result = Todo.delete(created.id);
      expect(result).toBe(true);

      const todo = Todo.findById(created.id);
      expect(todo).toBeUndefined();
    });

    test('should return false for non-existent ID', () => {
      const result = Todo.delete(99999);
      expect(result).toBe(false);
    });
  });

  describe('belongsToUser()', () => {
    test('should return true if todo belongs to user', () => {
      const todo = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const belongs = Todo.belongsToUser(todo.id, testUser.id);
      expect(belongs).toBe(true);
    });

    test('should return false if todo does not belong to user', async () => {
      const anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123',
        name: 'Another User'
      });

      const todo = Todo.create({
        userId: testUser.id,
        title: 'Test Todo'
      });

      const belongs = Todo.belongsToUser(todo.id, anotherUser.id);
      expect(belongs).toBe(false);
    });

    test('should return false for non-existent todo', () => {
      const belongs = Todo.belongsToUser(99999, testUser.id);
      expect(belongs).toBe(false);
    });
  });
});
