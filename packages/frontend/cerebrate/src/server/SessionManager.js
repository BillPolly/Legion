import { v4 as uuidv4 } from 'uuid';

/**
 * Session Manager for Cerebrate WebSocket debug server
 * Handles session creation, expiration, cleanup, and command tracking
 */
export class SessionManager {
  
  constructor(options = {}) {
    this.sessions = new Map();
    this.config = {
      defaultExpirationMinutes: options.expirationMinutes || 240, // 4 hours default
      maxSessions: options.maxSessions || 100,
      maxConcurrentCommands: options.maxConcurrentCommands || 5,
      disconnectedSessionGracePeriodMinutes: options.disconnectedGracePeriod || 5,
      ...options
    };
    
    // Default capabilities for new sessions
    this.defaultCapabilities = [
      'dom_inspection',
      'code_analysis',
      'error_debugging',
      'performance_audit'
    ];

    // Statistics tracking
    this.statistics = {
      total_sessions_created: 0,
      total_commands_executed: 0
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Create a new debug session
   * @param {Object} options - Session creation options
   * @returns {string} - Session ID
   */
  createSession(options = {}) {
    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error('Maximum session limit exceeded');
    }

    const sessionId = `session-${uuidv4()}`;
    const now = new Date();
    const expirationMinutes = options.expirationMinutes ?? this.config.defaultExpirationMinutes;
    const expiresAt = new Date(now.getTime() + (expirationMinutes * 60 * 1000));

    const session = {
      id: sessionId,
      created_at: now,
      expires_at: expiresAt,
      last_activity: now,
      capabilities: options.capabilities || [...this.defaultCapabilities],
      active_commands: [],
      connected: true,
      disconnected_at: null,
      total_commands_executed: 0,
      metadata: options.metadata || {}
    };

    this.sessions.set(sessionId, session);
    this.statistics.total_sessions_created++;

    return sessionId;
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object|null} - Session object or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Check if session exists
   * @param {string} sessionId - Session ID
   * @returns {boolean} - True if session exists
   */
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Check if session is expired
   * @param {string} sessionId - Session ID
   * @returns {boolean} - True if session is expired
   */
  isSessionExpired(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return true;
    }

    return new Date() > session.expires_at;
  }

  /**
   * Update session activity timestamp and extend expiration
   * @param {string} sessionId - Session ID
   */
  updateActivity(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }

    const now = new Date();
    session.last_activity = now;
    
    // Extend expiration by default period from now
    session.expires_at = new Date(now.getTime() + (this.config.defaultExpirationMinutes * 60 * 1000));
  }

  /**
   * Mark session as disconnected
   * @param {string} sessionId - Session ID
   */
  disconnectSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.connected = false;
    session.disconnected_at = new Date();
    
    // Clear all active commands
    session.active_commands = [];
  }

  /**
   * Add active command to session
   * @param {string} sessionId - Session ID
   * @param {string} commandId - Command ID
   * @param {string} commandName - Command name
   */
  addActiveCommand(sessionId, commandId, commandName) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check concurrent command limit
    if (session.active_commands.length >= this.config.maxConcurrentCommands) {
      throw new Error('Maximum concurrent commands limit exceeded');
    }

    const command = {
      command_id: commandId,
      command_name: commandName,
      started_at: new Date()
    };

    session.active_commands.push(command);
    this.updateActivity(sessionId);
  }

  /**
   * Complete and remove command from session
   * @param {string} sessionId - Session ID
   * @param {string} commandId - Command ID
   */
  completeCommand(sessionId, commandId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }

    const commandIndex = session.active_commands.findIndex(
      cmd => cmd.command_id === commandId
    );

    if (commandIndex !== -1) {
      session.active_commands.splice(commandIndex, 1);
      session.total_commands_executed++;
      this.statistics.total_commands_executed++;
      this.updateActivity(sessionId);
    }
  }

  /**
   * Get active command by ID
   * @param {string} sessionId - Session ID
   * @param {string} commandId - Command ID
   * @returns {Object|null} - Command object or null if not found
   */
  getActiveCommand(sessionId, commandId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return session.active_commands.find(cmd => cmd.command_id === commandId) || null;
  }

  /**
   * Get all active sessions
   * @returns {Array} - Array of active session objects
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(session => session.connected);
  }

  /**
   * Get count of active sessions
   * @returns {number} - Number of active sessions
   */
  getActiveSessionCount() {
    return this.getActiveSessions().length;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = new Date();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expires_at) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });
  }

  /**
   * Clean up disconnected sessions after grace period
   */
  cleanupDisconnectedSessions() {
    const now = new Date();
    const gracePeriodMs = this.config.disconnectedSessionGracePeriodMinutes * 60 * 1000;
    const sessionsToRemove = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session.connected && session.disconnected_at) {
        const timeSinceDisconnect = now.getTime() - session.disconnected_at.getTime();
        if (timeSinceDisconnect > gracePeriodMs) {
          sessionsToRemove.push(sessionId);
        }
      }
    }

    sessionsToRemove.forEach(sessionId => {
      this.sessions.delete(sessionId);
    });
  }

  /**
   * Get session statistics
   * @returns {Object} - Statistics object
   */
  getSessionStatistics() {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.connected);
    const disconnectedSessions = sessions.filter(s => !s.connected);
    const expiredSessions = sessions.filter(s => new Date() > s.expires_at);

    return {
      total_sessions: sessions.length,
      active_sessions: activeSessions.length,
      disconnected_sessions: disconnectedSessions.length,
      expired_sessions: expiredSessions.length,
      total_sessions_created: this.statistics.total_sessions_created,
      total_commands_executed: this.statistics.total_commands_executed
    };
  }

  /**
   * Get command execution metrics for a session
   * @param {string} sessionId - Session ID
   * @returns {Object} - Command metrics
   */
  getCommandMetrics(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      active_commands: session.active_commands.length,
      total_commands_executed: session.total_commands_executed,
      session_start_time: session.created_at,
      last_activity: session.last_activity
    };
  }

  /**
   * Start periodic cleanup of expired and disconnected sessions
   * @private
   */
  startPeriodicCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupDisconnectedSessions();
    }, 60000); // Run every minute
  }

  /**
   * Stop periodic cleanup and clean up resources
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all sessions
    this.sessions.clear();
  }

  /**
   * Destroy session manager and clean up all resources
   */
  destroy() {
    this.cleanup();
  }

  /**
   * Get session configuration
   * @returns {Object} - Configuration object
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Update session configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Export session data for monitoring/debugging
   * @returns {Object} - Exported session data
   */
  exportSessionData() {
    const sessions = Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      created_at: session.created_at,
      expires_at: session.expires_at,
      last_activity: session.last_activity,
      connected: session.connected,
      active_commands_count: session.active_commands.length,
      total_commands_executed: session.total_commands_executed
    }));

    return {
      sessions,
      statistics: this.statistics,
      configuration: this.config
    };
  }
}