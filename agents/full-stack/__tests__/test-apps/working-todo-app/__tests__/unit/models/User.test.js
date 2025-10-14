/**
 * Unit tests for User model
 * Uses real database (in-memory) - NO MOCKS for database
 * Only mocks bcrypt for password hashing speed (acceptable in unit tests)
 */

import { describe, test, expect, beforeEach, afterAll } from '@jest/globals';
import User from '../../../src/models/User.js';
import { getDatabase, initializeSchema, closeDatabase, resetDatabase, clearDatabase } from '../../../src/db/database.js';

describe('User Model - Unit Tests', () => {
  beforeEach(() => {
    // Use in-memory database for tests
    process.env.DB_PATH = ':memory:';
    resetDatabase();  // Close and reset db singleton
    initializeSchema();
    clearDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('create()', () => {
    test('should create a new user with hashed password', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.password).toBeUndefined();  // Should not return password
    });

    test('should convert email to lowercase', async () => {
      const user = await User.create({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
        name: 'Test User'
      });

      expect(user.email).toBe('test@example.com');
    });

    test('should throw error for duplicate email', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      await expect(
        User.create({
          email: 'test@example.com',
          password: 'password456',
          name: 'Another User'
        })
      ).rejects.toThrow();
    });
  });

  describe('findByEmail()', () => {
    test('should find user by email (case-insensitive)', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findByEmail('test@example.com');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
    });

    test('should find user with different case email', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findByEmail('TEST@EXAMPLE.COM');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    test('should return undefined for non-existent user', () => {
      const user = User.findByEmail('nonexistent@example.com');
      expect(user).toBeUndefined();
    });

    test('should return password hash for authentication', async () => {
      await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findByEmail('test@example.com');
      expect(user.password).toBeDefined();
      expect(user.password).not.toBe('password123');  // Should be hashed
    });
  });

  describe('findById()', () => {
    test('should find user by ID', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findById(created.id);
      expect(user).toBeDefined();
      expect(user.id).toBe(created.id);
      expect(user.email).toBe('test@example.com');
    });

    test('should not return password in findById', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findById(created.id);
      expect(user.password).toBeUndefined();
    });

    test('should return undefined for non-existent ID', () => {
      const user = User.findById(99999);
      expect(user).toBeUndefined();
    });
  });

  describe('verifyPassword()', () => {
    test('should verify correct password', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findByEmail('test@example.com');
      const isValid = await User.verifyPassword('password123', user.password);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const user = User.findByEmail('test@example.com');
      const isValid = await User.verifyPassword('wrongpassword', user.password);
      expect(isValid).toBe(false);
    });
  });

  describe('update()', () => {
    test('should update user name', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const updated = User.update(created.id, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
      expect(updated.email).toBe('test@example.com');
    });
  });

  describe('delete()', () => {
    test('should delete user', async () => {
      const created = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      User.delete(created.id);

      const user = User.findById(created.id);
      expect(user).toBeUndefined();
    });
  });
});
