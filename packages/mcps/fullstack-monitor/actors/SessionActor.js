/**
 * SessionActor - Manages monitoring sessions
 * Coordinates between other actors and manages session lifecycle
 */

import { Actor } from '@legion/shared/actors/src/Actor.js';

export class SessionActor extends Actor {
  constructor(dependencies = {}) {
    super();
    
    this.actorSpace = dependencies.actorSpace;
    this.browserMonitorActor = dependencies.browserMonitorActor;
    this.sidewinderActor = dependencies.sidewinderActor;
    this.logManagerActor = dependencies.logManagerActor;
    
    this.sessions = new Map(); // sessionId -> session data
    this.activeSession = null;
    
    console.log('[SessionActor] Initialized');
  }
  
  /**
   * Receive messages from other actors or external sources
   */
  async receive(payload, envelope) {
    const { type, data } = payload;
    
    switch (type) {
      case 'create-session':
        return await this.createSession(data);
        
      case 'end-session':
        return await this.endSession(data);
        
      case 'get-session':
        return this.getSession(data);
        
      case 'list-sessions':
        return this.listSessions();
        
      case 'set-active-session':
        return this.setActiveSession(data);
        
      case 'get-session-stats':
        return await this.getSessionStats(data);
        
      case 'clear-session-data':
        return await this.clearSessionData(data);
        
      default:
        console.warn(`[SessionActor] Unknown message type: ${type}`);
    }
  }
  
  /**
   * Create a new monitoring session
   */
  async createSession(data) {
    const { sessionId, name, type, metadata } = data;
    
    const id = sessionId || `session-${Date.now()}`;
    
    // Create session in LogManagerActor
    let logSession = null;
    if (this.logManagerActor) {
      const result = await this.logManagerActor.receive({
        type: 'create-session',
        data: { name, type, metadata }
      });
      
      if (result.success) {
        logSession = result.session;
      }
    }
    
    // Create session data
    const session = {
      id,
      name: name || 'Monitoring Session',
      type: type || 'fullstack',
      metadata: metadata || {},
      logSessionId: logSession ? logSession.sessionId : null,
      startTime: new Date(),
      endTime: null,
      status: 'active',
      stats: {
        browserEvents: 0,
        sidewinderEvents: 0,
        logs: 0,
        errors: 0
      }
    };
    
    this.sessions.set(id, session);
    this.activeSession = id;
    
    console.log(`[SessionActor] Created session: ${id}`);
    
    return {
      success: true,
      session: {
        sessionId: id,
        ...session
      }
    };
  }
  
  /**
   * End a monitoring session
   */
  async endSession(data) {
    const { sessionId } = data;
    const id = sessionId || this.activeSession;
    
    if (!id || !this.sessions.has(id)) {
      return { success: false, error: 'Session not found' };
    }
    
    const session = this.sessions.get(id);
    session.endTime = new Date();
    session.status = 'ended';
    
    // Get final stats
    const stats = await this.getSessionStats({ sessionId: id });
    session.finalStats = stats;
    
    // Clear session data from other actors if requested
    if (data.clearData) {
      await this.clearSessionData({ sessionId: id });
    }
    
    console.log(`[SessionActor] Ended session: ${id}`, session.finalStats);
    
    // Set new active session if needed
    if (this.activeSession === id) {
      this.activeSession = null;
      // Find another active session
      for (const [sid, sess] of this.sessions) {
        if (sess.status === 'active') {
          this.activeSession = sid;
          break;
        }
      }
    }
    
    return {
      success: true,
      session,
      stats: session.finalStats
    };
  }
  
  /**
   * Get session information
   */
  getSession(data) {
    const { sessionId } = data;
    const id = sessionId || this.activeSession;
    
    if (!id || !this.sessions.has(id)) {
      return { success: false, error: 'Session not found' };
    }
    
    const session = this.sessions.get(id);
    return {
      success: true,
      session: {
        sessionId: id,
        ...session
      }
    };
  }
  
  /**
   * List all sessions
   */
  listSessions() {
    const sessionList = [];
    
    this.sessions.forEach((session, id) => {
      sessionList.push({
        sessionId: id,
        name: session.name,
        type: session.type,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: id === this.activeSession
      });
    });
    
    return {
      success: true,
      sessions: sessionList,
      activeSession: this.activeSession
    };
  }
  
  /**
   * Set the active session
   */
  setActiveSession(data) {
    const { sessionId } = data;
    
    if (!this.sessions.has(sessionId)) {
      return { success: false, error: 'Session not found' };
    }
    
    this.activeSession = sessionId;
    
    return {
      success: true,
      activeSession: sessionId
    };
  }
  
  /**
   * Get comprehensive stats for a session
   */
  async getSessionStats(data) {
    const { sessionId } = data;
    const id = sessionId || this.activeSession;
    
    if (!id || !this.sessions.has(id)) {
      return { success: false, error: 'Session not found' };
    }
    
    const session = this.sessions.get(id);
    const stats = { ...session.stats };
    
    // Get browser stats
    if (this.browserMonitorActor) {
      const browserStats = await this.browserMonitorActor.receive({
        type: 'get-stats'
      });
      stats.browser = browserStats;
    }
    
    // Get Sidewinder stats
    if (this.sidewinderActor) {
      const sidewinderStats = await this.sidewinderActor.receive({
        type: 'get-stats'
      });
      stats.sidewinder = sidewinderStats;
    }
    
    // Get log stats
    if (this.logManagerActor) {
      const logStats = await this.logManagerActor.receive({
        type: 'get-session-logs',
        data: { limit: 1 }
      });
      
      if (logStats.success && logStats.logs) {
        stats.totalLogs = logStats.logs.length;
        
        // Count errors
        const errorLogs = logStats.logs.filter(log => 
          log.level === 'error'
        );
        stats.errors = errorLogs.length;
      }
    }
    
    // Calculate duration
    const startTime = new Date(session.startTime);
    const endTime = session.endTime ? new Date(session.endTime) : new Date();
    stats.duration = endTime - startTime;
    stats.durationFormatted = this.formatDuration(stats.duration);
    
    return stats;
  }
  
  /**
   * Clear session data from all actors
   */
  async clearSessionData(data) {
    const { sessionId } = data;
    const id = sessionId || this.activeSession;
    
    const results = {};
    
    // Clear browser monitor stats
    if (this.browserMonitorActor) {
      await this.browserMonitorActor.receive({
        type: 'clear-stats'
      });
      results.browser = 'cleared';
    }
    
    // Clear Sidewinder events
    if (this.sidewinderActor) {
      await this.sidewinderActor.receive({
        type: 'clear-events',
        sessionId: id
      });
      results.sidewinder = 'cleared';
    }
    
    // Clear recent logs
    if (this.logManagerActor) {
      await this.logManagerActor.receive({
        type: 'clear-recent-logs'
      });
      results.logs = 'cleared';
    }
    
    return {
      success: true,
      cleared: results
    };
  }
  
  /**
   * Update session stats (called by other actors)
   */
  updateStats(sessionId, statUpdate) {
    const id = sessionId || this.activeSession;
    
    if (!id || !this.sessions.has(id)) {
      return;
    }
    
    const session = this.sessions.get(id);
    Object.assign(session.stats, statUpdate);
  }
  
  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}