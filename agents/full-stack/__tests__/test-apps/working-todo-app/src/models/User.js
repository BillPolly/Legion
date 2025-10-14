/**
 * User model
 * Handles user data operations with SQLite
 */

import bcrypt from 'bcrypt';
import { getDatabase } from '../db/database.js';

const SALT_ROUNDS = 10;

export class User {
  /**
   * Create a new user
   */
  static async create({ email, password, name }) {
    const db = getDatabase();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const stmt = db.prepare(`
      INSERT INTO users (email, password, name)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(email.toLowerCase(), hashedPassword, name);

    return {
      id: result.lastInsertRowid,
      email: email.toLowerCase(),
      name
    };
  }

  /**
   * Find user by email (case-insensitive)
   */
  static findByEmail(email) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, email, password, name, created_at
      FROM users
      WHERE email = ? COLLATE NOCASE
    `);

    return stmt.get(email.toLowerCase());
  }

  /**
   * Find user by ID
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, email, name, created_at
      FROM users
      WHERE id = ?
    `);

    return stmt.get(id);
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update user
   */
  static update(id, { name }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?
      WHERE id = ?
    `);

    stmt.run(name, id);
    return User.findById(id);
  }

  /**
   * Delete user
   */
  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
  }
}

export default User;
