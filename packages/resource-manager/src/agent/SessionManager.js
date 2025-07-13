/**
 * SessionManager handles conversation sessions for agent resources
 * Provides session creation, management, cleanup, and persistence
 */
class SessionManager {
  constructor(options = {}) {
    this.options = {
      maxSessions: 1000,
      sessionTimeout: 3600000, // 1 hour
      cleanupInterval: 300000,  // 5 minutes
      persistSessions: false,
      ...options
    };
    
    this.sessions = new Map();
    this.cleanupInterval = null;
    this.sessionCounter = 0;
    
    this.startCleanup();
  }

  /**
   * Create a new session
   * @param {string} sessionId - Optional session ID (auto-generated if not provided)
   * @param {Object} initialContext - Initial context for the session
   * @returns {Object} Session object
   */
  createSession(sessionId = null, initialContext = {}) {
    // Generate session ID if not provided
    if (!sessionId) {
      sessionId = this.generateSessionId();
    }
    
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session '${sessionId}' already exists`);
    }
    
    // Check session limit
    if (this.sessions.size >= this.options.maxSessions) {
      this.cleanupOldSessions();
      
      if (this.sessions.size >= this.options.maxSessions) {
        throw new Error(`Maximum session limit (${this.options.maxSessions}) reached`);
      }
    }
    
    const session = {
      id: sessionId,
      messages: [],
      context: { ...initialContext },
      metadata: {
        created: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        totalTokens: 0
      },
      state: 'active'
    };
    
    this.sessions.set(sessionId, session);
    console.log(`Created session '${sessionId}'`);
    
    return session;
  }

  /**
   * Get an existing session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null if not found
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Update last activity
      session.metadata.lastActivity = new Date();
      return session;
    }
    
    return null;
  }

  /**
   * Get session or create if it doesn't exist
   * @param {string} sessionId - Session ID
   * @param {Object} initialContext - Initial context if creating new session
   * @returns {Object} Session object
   */
  getOrCreateSession(sessionId, initialContext = {}) {
    let session = this.getSession(sessionId);
    
    if (!session) {
      session = this.createSession(sessionId, initialContext);
    }
    
    return session;
  }

  /**
   * Add message to session
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message object
   * @returns {boolean} Success status
   */
  addMessage(sessionId, message) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      console.warn(`Attempted to add message to non-existent session '${sessionId}'`);
      return false;
    }
    
    // Validate message format
    if (!message.role || !message.content) {
      throw new Error('Message must have role and content properties');
    }
    
    // Add timestamp to message
    const timestampedMessage = {
      ...message,
      timestamp: new Date()
    };
    
    session.messages.push(timestampedMessage);
    session.metadata.messageCount++;
    session.metadata.lastActivity = new Date();
    
    // Update token count if provided
    if (message.tokens) {
      session.metadata.totalTokens += message.tokens;
    }
    
    return true;
  }

  /**
   * Update session context
   * @param {string} sessionId - Session ID
   * @param {Object} contextUpdate - Context updates
   * @returns {boolean} Success status
   */
  updateContext(sessionId, contextUpdate) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return false;
    }
    
    session.context = { ...session.context, ...contextUpdate };
    session.metadata.lastActivity = new Date();
    
    return true;
  }

  /**
   * Get session messages with optional filtering
   * @param {string} sessionId - Session ID
   * @param {Object} options - Filtering options
   * @returns {Array|null} Array of messages or null if session not found
   */
  getMessages(sessionId, options = {}) {
    const session = this.getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    let messages = [...session.messages];
    
    // Apply filters
    if (options.limit) {
      messages = messages.slice(-options.limit);
    }
    
    if (options.since) {
      messages = messages.filter(msg => msg.timestamp > options.since);
    }
    
    if (options.role) {
      messages = messages.filter(msg => msg.role === options.role);
    }
    
    return messages;
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success status
   */
  deleteSession(sessionId) {
    const existed = this.sessions.has(sessionId);
    
    if (existed) {
      this.sessions.delete(sessionId);
      console.log(`Deleted session '${sessionId}'`);
    }
    
    return existed;
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    const count = this.sessions.size;
    this.sessions.clear();
    console.log(`Cleared ${count} sessions`);
  }

  /**
   * Get session statistics
   * @param {string} sessionId - Optional specific session ID
   * @returns {Object} Session statistics
   */
  getStatistics(sessionId = null) {
    if (sessionId) {
      const session = this.getSession(sessionId);
      if (!session) {
        return null;
      }
      
      return {
        id: session.id,
        messageCount: session.metadata.messageCount,
        totalTokens: session.metadata.totalTokens,
        created: session.metadata.created,
        lastActivity: session.metadata.lastActivity,
        duration: Date.now() - session.metadata.created.getTime(),
        state: session.state
      };
    }
    
    // Global statistics
    const now = Date.now();
    let totalMessages = 0;
    let totalTokens = 0;
    let activeSessions = 0;
    let oldestSession = null;
    let newestSession = null;
    
    for (const session of this.sessions.values()) {
      totalMessages += session.metadata.messageCount;
      totalTokens += session.metadata.totalTokens;
      
      const isActive = (now - session.metadata.lastActivity.getTime()) < this.options.sessionTimeout;
      if (isActive) {
        activeSessions++;
      }
      
      if (!oldestSession || session.metadata.created < oldestSession) {
        oldestSession = session.metadata.created;
      }
      
      if (!newestSession || session.metadata.created > newestSession) {
        newestSession = session.metadata.created;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalMessages,
      totalTokens,
      averageMessagesPerSession: this.sessions.size > 0 ? Math.round(totalMessages / this.sessions.size) : 0,
      oldestSession,
      newestSession,
      maxSessions: this.options.maxSessions,
      sessionTimeout: this.options.sessionTimeout
    };
  }

  /**
   * List all session IDs with optional filtering
   * @param {Object} options - Filtering options
   * @returns {Array} Array of session IDs
   */
  listSessions(options = {}) {
    const { includeInactive = true, sortBy = 'lastActivity' } = options;
    const now = Date.now();
    
    let sessions = Array.from(this.sessions.values());
    
    // Filter by activity if requested
    if (!includeInactive) {
      sessions = sessions.filter(session => {
        const timeSinceActivity = now - session.metadata.lastActivity.getTime();
        return timeSinceActivity < this.options.sessionTimeout;
      });
    }
    
    // Sort sessions
    sessions.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return b.metadata.created - a.metadata.created;
        case 'lastActivity':
          return b.metadata.lastActivity - a.metadata.lastActivity;
        case 'messageCount':
          return b.metadata.messageCount - a.metadata.messageCount;
        case 'id':
          return a.id.localeCompare(b.id);
        default:
          return 0;
      }
    });
    
    return sessions.map(session => session.id);
  }

  /**
   * Cleanup old and inactive sessions
   */
  cleanupOldSessions() {
    const now = Date.now();
    const sessionsToDelete = [];
    
    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now - session.metadata.lastActivity.getTime();
      
      if (timeSinceActivity > this.options.sessionTimeout) {
        sessionsToDelete.push(sessionId);
      }
    }
    
    for (const sessionId of sessionsToDelete) {
      this.deleteSession(sessionId);
    }
    
    if (sessionsToDelete.length > 0) {
      console.log(`Cleaned up ${sessionsToDelete.length} inactive sessions`);
    }
  }

  /**
   * Generate a unique session ID
   * @private
   */
  generateSessionId() {
    this.sessionCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.sessionCounter.toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    
    return `sess_${timestamp}_${counter}_${random}`;
  }

  /**
   * Start automatic cleanup
   * @private
   */
  startCleanup() {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldSessions();
    }, this.options.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Export session data
   * @param {string} sessionId - Optional specific session ID
   * @returns {Object|Array} Session data
   */
  exportSessions(sessionId = null) {
    if (sessionId) {
      const session = this.getSession(sessionId);
      return session ? { ...session } : null;
    }
    
    // Export all sessions
    const exported = [];
    for (const session of this.sessions.values()) {
      exported.push({ ...session });
    }
    
    return exported;
  }

  /**
   * Import session data
   * @param {Object|Array} sessionData - Session data to import
   * @param {Object} options - Import options
   */
  importSessions(sessionData, options = {}) {
    const { overwrite = false, validateMessages = true } = options;
    
    const sessionsToImport = Array.isArray(sessionData) ? sessionData : [sessionData];
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const sessionData of sessionsToImport) {
      if (!sessionData.id) {
        console.warn('Skipping session import: missing ID');
        skippedCount++;
        continue;
      }
      
      if (this.sessions.has(sessionData.id) && !overwrite) {
        console.warn(`Skipping session import: '${sessionData.id}' already exists`);
        skippedCount++;
        continue;
      }
      
      // Validate session structure
      if (validateMessages && sessionData.messages) {
        const validMessages = sessionData.messages.filter(msg => 
          msg.role && msg.content
        );
        
        if (validMessages.length !== sessionData.messages.length) {
          console.warn(`Session '${sessionData.id}': filtered out invalid messages`);
          sessionData.messages = validMessages;
        }
      }
      
      this.sessions.set(sessionData.id, { ...sessionData });
      importedCount++;
    }
    
    console.log(`Imported ${importedCount} sessions, skipped ${skippedCount}`);
    return { imported: importedCount, skipped: skippedCount };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopCleanup();
    this.clearAllSessions();
  }
}

export default SessionManager;