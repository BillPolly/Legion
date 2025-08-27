/**
 * @fileoverview SessionManager - Manages Node.js execution sessions
 */

import { generateId } from '../utils/index.js';

export class SessionManager {
  constructor(storage) {
    this.storage = storage;
  }

  /**
   * Create a new session
   * @param {Object} sessionData - Session configuration
   * @param {string} sessionData.projectPath - Project directory path
   * @param {string} sessionData.command - Command to execute
   * @param {string} [sessionData.description] - Session description
   * @param {string[]} [sessionData.tags] - Session tags
   * @returns {Promise<Object>} Created session object
   */
  async createSession(sessionData) {
    const sessionId = generateId();
    const session = {
      sessionId,
      projectPath: sessionData.projectPath,
      command: sessionData.command,
      description: sessionData.description || '',
      tags: sessionData.tags || [],
      status: 'active',
      startTime: new Date(),
      createdAt: new Date()
    };

    // Store session in storage
    await this.storage.store('sessions', session);

    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  async getSession(sessionId) {
    const results = await this.storage.query('sessions', { sessionId });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * List sessions with optional filters
   * @param {Object} [filters] - Query filters
   * @returns {Promise<Object[]>} Array of session objects
   */
  async listSessions(filters = {}) {
    return await this.storage.query('sessions', filters);
  }

  /**
   * End a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if session was ended, false if not found
   */
  async endSession(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Update session with end time and status
    const updatedSession = {
      ...session,
      status: 'completed',
      endTime: new Date()
    };

    await this.storage.store('sessions', updatedSession);
    return true;
  }

  /**
   * Update session metadata
   * @param {string} sessionId - Session ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} True if session was updated, false if not found
   */
  async updateSession(sessionId, updates) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Merge updates with existing session
    const updatedSession = {
      ...session,
      ...updates,
      sessionId, // Ensure sessionId cannot be changed
      updatedAt: new Date()
    };

    await this.storage.store('sessions', updatedSession);
    return true;
  }

  /**
   * Clean up old completed sessions
   * @param {number} [retentionDays=30] - Days to retain completed sessions
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupOldSessions(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get all sessions
    const allSessions = await this.listSessions();
    
    let cleanedCount = 0;

    for (const session of allSessions) {
      // Only clean up completed or error sessions (not active ones)
      if (session.status === 'active') {
        continue;
      }

      // Check if session is old enough to clean up
      const endTime = session.endTime ? new Date(session.endTime) : new Date(session.createdAt);
      
      if (endTime < cutoffDate) {
        await this.storage.delete('sessions', { sessionId: session.sessionId });
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats() {
    const allSessions = await this.listSessions();
    
    const stats = {
      total: allSessions.length,
      active: 0,
      completed: 0,
      error: 0
    };

    for (const session of allSessions) {
      if (session.status === 'active') {
        stats.active++;
      } else if (session.status === 'completed') {
        stats.completed++;
      } else if (session.status === 'error') {
        stats.error++;
      }
    }

    return stats;
  }

  /**
   * Mark session as errored
   * @param {string} sessionId - Session ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<boolean>} True if session was updated, false if not found
   */
  async markSessionError(sessionId, errorMessage) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const updatedSession = {
      ...session,
      status: 'error',
      errorMessage,
      endTime: new Date()
    };

    await this.storage.store('sessions', updatedSession);
    return true;
  }
}