/**
 * @fileoverview LogStorage - Handles storage and retrieval of log messages
 */

import { generateId } from '../utils/index.js';

export class LogStorage {
  constructor(storageProvider) {
    this.storageProvider = storageProvider;
  }

  /**
   * Log a message to storage
   * @param {Object} logMessage - Log message object
   * @param {string} logMessage.sessionId - Session ID
   * @param {string} logMessage.processId - Process ID
   * @param {string} logMessage.source - Log source (stdout, stderr, system, frontend)
   * @param {string} logMessage.message - Log message content
   * @param {Date} [logMessage.timestamp] - Message timestamp
   * @returns {Promise<boolean>} True if logged successfully
   */
  async logMessage(logMessage) {
    const logEntry = {
      logId: generateId(),
      sessionId: logMessage.sessionId,
      processId: logMessage.processId,
      source: logMessage.source,
      message: logMessage.message,
      timestamp: logMessage.timestamp || new Date(),
      createdAt: new Date()
    };

    await this.storageProvider.store('logs', logEntry);
    return true;
  }

  /**
   * Get all logs for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object[]>} Array of log entries
   */
  async getLogsBySession(sessionId) {
    return await this.storageProvider.query('logs', { sessionId });
  }

  /**
   * Get all logs for a specific process
   * @param {string} processId - Process ID
   * @returns {Promise<Object[]>} Array of log entries
   */
  async getLogsByProcess(processId) {
    return await this.storageProvider.query('logs', { processId });
  }

  /**
   * Get logs within a time range
   * @param {string} sessionId - Session ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<Object[]>} Array of log entries
   */
  async getLogsInTimeRange(sessionId, startTime, endTime) {
    const allLogs = await this.storageProvider.query('logs', { sessionId });
    
    // Filter by time range (storage provider may not support complex queries)
    return allLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= startTime && logTime <= endTime;
    });
  }

  /**
   * Get logs by source type
   * @param {string} sessionId - Session ID
   * @param {string} source - Source type (stdout, stderr, system, frontend)
   * @returns {Promise<Object[]>} Array of log entries
   */
  async getLogsBySource(sessionId, source) {
    return await this.storageProvider.query('logs', { sessionId, source });
  }

  /**
   * Search logs by keyword
   * @param {string} sessionId - Session ID
   * @param {string} keyword - Search keyword
   * @returns {Promise<Object[]>} Array of matching log entries
   */
  async searchLogs(sessionId, keyword) {
    const allLogs = await this.storageProvider.query('logs', { sessionId });
    
    // Simple text search (can be enhanced with search provider later)
    const searchTerm = keyword.toLowerCase();
    return allLogs.filter(log => 
      log.message.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Get log count for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<number>} Number of log entries
   */
  async getLogCount(sessionId) {
    const logs = await this.storageProvider.query('logs', { sessionId });
    return logs.length;
  }

  /**
   * Get log statistics by source type
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Statistics object
   */
  async getLogStats(sessionId) {
    const logs = await this.storageProvider.query('logs', { sessionId });
    
    const stats = {
      total: logs.length,
      stdout: 0,
      stderr: 0,
      system: 0,
      frontend: 0
    };

    for (const log of logs) {
      if (stats.hasOwnProperty(log.source)) {
        stats[log.source]++;
      }
    }

    return stats;
  }

  /**
   * Delete all logs for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteLogsBySession(sessionId) {
    await this.storageProvider.delete('logs', { sessionId });
    return true;
  }

  /**
   * Clean up old log entries
   * @param {number} [retentionDays=30] - Days to retain logs
   * @returns {Promise<number>} Number of logs deleted
   */
  async cleanupOldLogs(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get all logs and filter by age
    const allLogs = await this.storageProvider.query('logs', {});
    
    let deletedCount = 0;
    for (const log of allLogs) {
      const logDate = new Date(log.createdAt);
      if (logDate < cutoffDate) {
        await this.storageProvider.delete('logs', { logId: log.logId });
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Batch log multiple messages efficiently
   * @param {Object[]} messages - Array of log messages
   * @returns {Promise<boolean>} True if all messages logged
   */
  async batchLogMessages(messages) {
    const promises = messages.map(message => this.logMessage(message));
    await Promise.all(promises);
    return true;
  }

  /**
   * Get recent logs with limit
   * @param {string} sessionId - Session ID
   * @param {number} [limit=100] - Maximum number of logs to return
   * @returns {Promise<Object[]>} Array of recent log entries
   */
  async getRecentLogs(sessionId, limit = 100) {
    const logs = await this.storageProvider.query('logs', { sessionId });
    
    // Sort by timestamp descending and limit results
    return logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
}