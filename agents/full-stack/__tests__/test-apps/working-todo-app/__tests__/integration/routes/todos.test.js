/**
 * Integration tests for todos routes
 * Uses real database (in-memory) and real HTTP server - NO MOCKS
 */

import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../src/server.js';
import { initializeSchema, resetDatabase, closeDatabase, clearDatabase } from '../../../src/db/database.js';

describe('Todos Routes - Integration Tests', () => {
  let authToken;
  let userId;

  beforeEach(async () => {
    // Use in-memory database for tests
    process.env.DB_PATH = ':memory:';
    resetDatabase();
    initializeSchema();
    clearDatabase();

    // Create and login a test user
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    authToken = response.body.token;
    userId = response.body.user.id;
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('POST /api/todos', () => {
    test('should create a new todo', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Todo'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Todo');
      expect(response.body.completed).toBe(false);
      expect(response.body.user_id).toBe(userId);
    });

    test('should reject todo creation without authentication', async () => {
      const response = await request(app)
        .post('/api/todos')
        .send({
          title: 'Test Todo'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject todo creation without title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });

    test('should reject todo creation with empty title', async () => {
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '   '
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title is required');
    });
  });

  describe('GET /api/todos', () => {
    beforeEach(async () => {
      // Create some test todos
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Todo 1' });

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Todo 2' });

      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Todo 3' });
    });

    test('should get all todos for authenticated user', async () => {
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);

      const titles = response.body.map(t => t.title);
      expect(titles).toContain('Todo 1');
      expect(titles).toContain('Todo 2');
      expect(titles).toContain('Todo 3');
    });

    test('should only return todos for authenticated user', async () => {
      // Create another user
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@example.com',
          password: 'password123',
          name: 'Another User'
        });

      const authToken2 = response2.body.token;

      // Create todo for second user
      await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ title: 'Another User Todo' });

      // Get todos for first user
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);

      const titles = response.body.map(t => t.title);
      expect(titles).not.toContain('Another User Todo');
    });

    test('should reject get todos without authentication', async () => {
      const response = await request(app)
        .get('/api/todos');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should return empty array for user with no todos', async () => {
      // Create new user
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'empty@example.com',
          password: 'password123',
          name: 'Empty User'
        });

      const authToken2 = response2.body.token;

      // Get todos
      const response = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken2}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('PUT /api/todos/:id', () => {
    let todoId;

    beforeEach(async () => {
      // Create a test todo
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Todo' });

      todoId = response.body.id;
    });

    test('should update todo title', async () => {
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.completed).toBe(false);
    });

    test('should update todo completed status', async () => {
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true });

      expect(response.status).toBe(200);
      expect(response.body.completed).toBe(true);
      expect(response.body.title).toBe('Test Todo');
    });

    test('should update both title and completed', async () => {
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          completed: true
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.completed).toBe(true);
    });

    test('should reject update without authentication', async () => {
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject update of non-existent todo', async () => {
      const response = await request(app)
        .put('/api/todos/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Todo not found');
    });

    test('should reject update of another user\'s todo', async () => {
      // Create another user
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@example.com',
          password: 'password123',
          name: 'Another User'
        });

      const authToken2 = response2.body.token;

      // Try to update first user's todo with second user's token
      const response = await request(app)
        .put(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send({ title: 'Hacked Title' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/todos/:id', () => {
    let todoId;

    beforeEach(async () => {
      // Create a test todo
      const response = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Todo' });

      todoId = response.body.id;
    });

    test('should delete todo', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Todo deleted');

      // Verify todo is deleted
      const getResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body).toHaveLength(0);
    });

    test('should reject delete without authentication', async () => {
      const response = await request(app)
        .delete(`/api/todos/${todoId}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject delete of non-existent todo', async () => {
      const response = await request(app)
        .delete('/api/todos/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Todo not found');
    });

    test('should reject delete of another user\'s todo', async () => {
      // Create another user
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@example.com',
          password: 'password123',
          name: 'Another User'
        });

      const authToken2 = response2.body.token;

      // Try to delete first user's todo with second user's token
      const response = await request(app)
        .delete(`/api/todos/${todoId}`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');

      // Verify todo still exists
      const getResponse = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body).toHaveLength(1);
    });
  });
});
