/**
 * SessionManagerActor - Server-side session management actor
 * Handles session lifecycle, persistence, and synchronization
 */
export class SessionManagerActor {
  constructor(dependencies = {}) {
    this.isActor = true;
    this.storage = dependencies.storage || new Map();
    this.sessions = new Map();
    this.activeSessionsByUser = new Map();
    this.autoSaveIntervals = new Map();
    this.sessionTimeouts = new Map();
    
    // Configuration
    this.config = {
      autoSaveInterval: 30000, // 30 seconds
      sessionTimeout: 3600000, // 1 hour
      maxSessionsPerUser: 10,
      maxSessionAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      ...dependencies.config
    };
  }

  /**
   * Receive and process messages
   * @param {Object} message - Incoming message
   * @returns {Object} Response
   */
  receive(message) {
    const { type, userId = 'default' } = message;
    
    switch (type) {
      case 'session.create':
        return this.handleCreateSession(message, userId);
        
      case 'session.list':
        return this.handleListSessions(message, userId);
        
      case 'session.get':
        return this.handleGetSession(message, userId);
        
      case 'session.switch':
        return this.handleSwitchSession(message, userId);
        
      case 'session.update':
        return this.handleUpdateSession(message, userId);
        
      case 'session.delete':
        return this.handleDeleteSession(message, userId);
        
      case 'session.restore':
        return this.handleRestoreSession(message, userId);
        
      case 'session.export':
        return this.handleExportSession(message, userId);
        
      case 'session.import':
        return this.handleImportSession(message, userId);
        
      case 'session.cleanup':
        return this.handleCleanupSessions(message, userId);
        
      case 'session.heartbeat':
        return this.handleHeartbeat(message, userId);
        
      case 'variable.set':
        return this.handleSetVariable(message, userId);
        
      case 'variable.get':
        return this.handleGetVariable(message, userId);
        
      case 'variable.delete':
        return this.handleDeleteVariable(message, userId);
        
      case 'command.execute':
        return this.handleCommandExecute(message, userId);
        
      case 'tool.executed':
        return this.handleToolExecuted(message, userId);
        
      default:
        return {
          type: `${type}.error`,
          requestId: message.requestId,
          error: `Unknown message type: ${type}`
        };
    }
  }

  // Session Management Handlers

  handleCreateSession(message, userId) {
    const { name, metadata = {} } = message;
    
    // Check session limit
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.config.maxSessionsPerUser) {
      // Auto-cleanup old sessions
      this.cleanupUserSessions(userId);
    }
    
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      userId,
      name: name || `Session ${userSessions.length + 1}`,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      state: 'active',
      metadata,
      variables: new Map(),
      commandHistory: [],
      toolExecutions: [],
      statistics: {
        commandCount: 0,
        toolCount: 0,
        errorCount: 0,
        duration: 0
      }
    };
    
    this.sessions.set(sessionId, session);
    this.saveSession(sessionId);
    
    // Auto-activate if first session
    if (!this.activeSessionsByUser.has(userId)) {
      this.activeSessionsByUser.set(userId, sessionId);
    }
    
    // Start auto-save
    this.startAutoSave(sessionId);
    
    return {
      type: 'session.create.response',
      requestId: message.requestId,
      session: this.serializeSession(session)
    };
  }

  handleListSessions(message, userId) {
    const userSessions = this.getUserSessions(userId);
    const activeSessionId = this.activeSessionsByUser.get(userId);
    
    return {
      type: 'session.list.response',
      requestId: message.requestId,
      sessions: userSessions.map(s => this.serializeSession(s)),
      activeSessionId
    };
  }

  handleGetSession(message, userId) {
    const { sessionId } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        type: 'session.get.response',
        requestId: message.requestId,
        error: 'Session not found'
      };
    }
    
    return {
      type: 'session.get.response',
      requestId: message.requestId,
      session: this.serializeSession(session)
    };
  }

  handleSwitchSession(message, userId) {
    const { sessionId } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        type: 'session.switch.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found'
      };
    }
    
    // Save current session before switching
    const currentSessionId = this.activeSessionsByUser.get(userId);
    if (currentSessionId && currentSessionId !== sessionId) {
      this.saveSession(currentSessionId);
    }
    
    // Switch to new session
    this.activeSessionsByUser.set(userId, sessionId);
    session.lastActivity = Date.now();
    
    // Reset timeout
    this.resetSessionTimeout(sessionId);
    
    return {
      type: 'session.switch.response',
      requestId: message.requestId,
      success: true,
      session: this.serializeSession(session)
    };
  }

  handleUpdateSession(message, userId) {
    const { sessionId, updates } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        type: 'session.update.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found'
      };
    }
    
    // Apply updates
    if (updates.name) session.name = updates.name;
    if (updates.metadata) session.metadata = { ...session.metadata, ...updates.metadata };
    if (updates.state) session.state = updates.state;
    
    session.lastActivity = Date.now();
    this.saveSession(sessionId);
    
    return {
      type: 'session.update.response',
      requestId: message.requestId,
      success: true,
      session: this.serializeSession(session)
    };
  }

  handleDeleteSession(message, userId) {
    const { sessionId } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        type: 'session.delete.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found'
      };
    }
    
    // Stop auto-save
    this.stopAutoSave(sessionId);
    
    // Clear timeout
    this.clearSessionTimeout(sessionId);
    
    // Delete from storage
    this.deleteFromStorage(sessionId);
    
    // Delete from memory
    this.sessions.delete(sessionId);
    
    // Update active session if needed
    if (this.activeSessionsByUser.get(userId) === sessionId) {
      const remainingSessions = this.getUserSessions(userId);
      if (remainingSessions.length > 0) {
        this.activeSessionsByUser.set(userId, remainingSessions[0].id);
      } else {
        this.activeSessionsByUser.delete(userId);
      }
    }
    
    return {
      type: 'session.delete.response',
      requestId: message.requestId,
      success: true
    };
  }

  handleRestoreSession(message, userId) {
    const { sessionId } = message;
    
    // Load from storage
    const sessionData = this.loadFromStorage(sessionId);
    
    if (!sessionData || sessionData.userId !== userId) {
      return {
        type: 'session.restore.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found in storage'
      };
    }
    
    // Restore to memory
    const session = this.deserializeSession(sessionData);
    this.sessions.set(sessionId, session);
    
    // Start auto-save
    this.startAutoSave(sessionId);
    
    return {
      type: 'session.restore.response',
      requestId: message.requestId,
      success: true,
      session: this.serializeSession(session)
    };
  }

  handleExportSession(message, userId) {
    const { sessionId } = message;
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return {
        type: 'session.export.response',
        requestId: message.requestId,
        error: 'Session not found'
      };
    }
    
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      session: this.serializeSession(session)
    };
    
    return {
      type: 'session.export.response',
      requestId: message.requestId,
      data: exportData
    };
  }

  handleImportSession(message, userId) {
    const { data } = message;
    
    if (!data || !data.session) {
      return {
        type: 'session.import.response',
        requestId: message.requestId,
        success: false,
        error: 'Invalid import data'
      };
    }
    
    // Check session limit
    const userSessions = this.getUserSessions(userId);
    if (userSessions.length >= this.config.maxSessionsPerUser) {
      return {
        type: 'session.import.response',
        requestId: message.requestId,
        success: false,
        error: 'Session limit reached'
      };
    }
    
    // Create new session from import
    const sessionId = this.generateSessionId();
    const session = {
      ...data.session,
      id: sessionId,
      userId,
      name: `${data.session.name} (Imported)`,
      importedAt: Date.now(),
      lastActivity: Date.now()
    };
    
    // Deserialize special fields
    if (session.variables && Array.isArray(session.variables)) {
      session.variables = new Map(session.variables);
    }
    
    this.sessions.set(sessionId, session);
    this.saveSession(sessionId);
    this.startAutoSave(sessionId);
    
    return {
      type: 'session.import.response',
      requestId: message.requestId,
      success: true,
      session: this.serializeSession(session)
    };
  }

  handleCleanupSessions(message, userId) {
    const { maxAge = this.config.maxSessionAge } = message;
    const cutoff = Date.now() - maxAge;
    const userSessions = this.getUserSessions(userId);
    const activeSessionId = this.activeSessionsByUser.get(userId);
    
    let deletedCount = 0;
    
    for (const session of userSessions) {
      if (session.lastActivity < cutoff && session.id !== activeSessionId) {
        this.sessions.delete(session.id);
        this.deleteFromStorage(session.id);
        this.stopAutoSave(session.id);
        deletedCount++;
      }
    }
    
    return {
      type: 'session.cleanup.response',
      requestId: message.requestId,
      deletedCount
    };
  }

  handleHeartbeat(message, userId) {
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        this.resetSessionTimeout(sessionId);
      }
    }
    
    return {
      type: 'session.heartbeat.response',
      requestId: message.requestId,
      sessionId
    };
  }

  // Variable Management Handlers

  handleSetVariable(message, userId) {
    const { name, value, type = 'string', scope = 'session' } = message;
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (!sessionId) {
      return {
        type: 'variable.set.response',
        requestId: message.requestId,
        success: false,
        error: 'No active session'
      };
    }
    
    const session = this.sessions.get(sessionId);
    session.variables.set(name, {
      value,
      type,
      scope,
      updatedAt: Date.now()
    });
    
    session.lastActivity = Date.now();
    
    return {
      type: 'variable.set.response',
      requestId: message.requestId,
      success: true
    };
  }

  handleGetVariable(message, userId) {
    const { name } = message;
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (!sessionId) {
      return {
        type: 'variable.get.response',
        requestId: message.requestId,
        value: null
      };
    }
    
    const session = this.sessions.get(sessionId);
    const variable = session.variables.get(name);
    
    return {
      type: 'variable.get.response',
      requestId: message.requestId,
      value: variable?.value,
      type: variable?.type,
      scope: variable?.scope
    };
  }

  handleDeleteVariable(message, userId) {
    const { name } = message;
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (!sessionId) {
      return {
        type: 'variable.delete.response',
        requestId: message.requestId,
        success: false,
        error: 'No active session'
      };
    }
    
    const session = this.sessions.get(sessionId);
    const deleted = session.variables.delete(name);
    
    if (deleted) {
      session.lastActivity = Date.now();
    }
    
    return {
      type: 'variable.delete.response',
      requestId: message.requestId,
      success: deleted
    };
  }

  // Command and Tool Execution Handlers

  handleCommandExecute(message, userId) {
    const { command } = message;
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (!sessionId) {
      return {
        type: 'command.execute.response',
        requestId: message.requestId,
        error: 'No active session'
      };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Add to history
    session.commandHistory.push({
      command,
      timestamp: Date.now(),
      requestId: message.requestId
    });
    
    // Update statistics
    session.statistics.commandCount++;
    session.lastActivity = Date.now();
    
    // Limit history size
    if (session.commandHistory.length > 1000) {
      session.commandHistory = session.commandHistory.slice(-1000);
    }
    
    return {
      type: 'command.execute.response',
      requestId: message.requestId,
      sessionId,
      historyIndex: session.commandHistory.length - 1
    };
  }

  handleToolExecuted(message, userId) {
    const { toolId, params, result, duration, error } = message;
    const sessionId = this.activeSessionsByUser.get(userId);
    
    if (!sessionId) {
      return {
        type: 'tool.executed.response',
        requestId: message.requestId,
        error: 'No active session'
      };
    }
    
    const session = this.sessions.get(sessionId);
    
    // Record execution
    const execution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toolId,
      params,
      result,
      error,
      duration,
      timestamp: Date.now()
    };
    
    session.toolExecutions.push(execution);
    
    // Update statistics
    session.statistics.toolCount++;
    if (error) {
      session.statistics.errorCount++;
    }
    session.statistics.duration += duration || 0;
    session.lastActivity = Date.now();
    
    // Limit executions size
    if (session.toolExecutions.length > 100) {
      session.toolExecutions = session.toolExecutions.slice(-100);
    }
    
    return {
      type: 'tool.executed.response',
      requestId: message.requestId,
      executionId: execution.id
    };
  }

  // Helper Methods

  getUserSessions(userId) {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  serializeSession(session) {
    return {
      ...session,
      variables: session.variables ? Array.from(session.variables.entries()) : []
    };
  }

  deserializeSession(data) {
    return {
      ...data,
      variables: new Map(data.variables || [])
    };
  }

  saveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const serialized = this.serializeSession(session);
    
    // Save to storage (mock implementation)
    if (this.storage instanceof Map) {
      this.storage.set(sessionId, serialized);
    } else if (this.storage && this.storage.set) {
      this.storage.set(sessionId, serialized);
    }
  }

  loadFromStorage(sessionId) {
    if (this.storage instanceof Map) {
      return this.storage.get(sessionId);
    } else if (this.storage && this.storage.get) {
      return this.storage.get(sessionId);
    }
    return null;
  }

  deleteFromStorage(sessionId) {
    if (this.storage instanceof Map) {
      this.storage.delete(sessionId);
    } else if (this.storage && this.storage.delete) {
      this.storage.delete(sessionId);
    }
  }

  startAutoSave(sessionId) {
    // Clear existing interval
    this.stopAutoSave(sessionId);
    
    const interval = setInterval(() => {
      if (this.sessions.has(sessionId)) {
        this.saveSession(sessionId);
      } else {
        this.stopAutoSave(sessionId);
      }
    }, this.config.autoSaveInterval);
    
    this.autoSaveIntervals.set(sessionId, interval);
  }

  stopAutoSave(sessionId) {
    const interval = this.autoSaveIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.autoSaveIntervals.delete(sessionId);
    }
  }

  resetSessionTimeout(sessionId) {
    // Clear existing timeout
    this.clearSessionTimeout(sessionId);
    
    const timeout = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.state = 'expired';
        this.saveSession(sessionId);
      }
    }, this.config.sessionTimeout);
    
    this.sessionTimeouts.set(sessionId, timeout);
  }

  clearSessionTimeout(sessionId) {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  cleanupUserSessions(userId) {
    const sessions = this.getUserSessions(userId);
    const sorted = sessions.sort((a, b) => b.lastActivity - a.lastActivity);
    
    // Keep only the most recent sessions
    const toDelete = sorted.slice(this.config.maxSessionsPerUser - 1);
    
    for (const session of toDelete) {
      this.sessions.delete(session.id);
      this.deleteFromStorage(session.id);
      this.stopAutoSave(session.id);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Stop all auto-save intervals
    for (const sessionId of this.autoSaveIntervals.keys()) {
      this.stopAutoSave(sessionId);
    }
    
    // Clear all timeouts
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    // Save all sessions
    for (const sessionId of this.sessions.keys()) {
      this.saveSession(sessionId);
    }
    
    // Clear memory
    this.sessions.clear();
    this.activeSessionsByUser.clear();
    this.autoSaveIntervals.clear();
    this.sessionTimeouts.clear();
  }
}