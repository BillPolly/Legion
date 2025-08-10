/**
 * SessionManager - Manages FullStackMonitor instances and prevents resource leaks
 */

// Dynamic import to avoid loading dependencies when using mock
let FullStackMonitor;
import { SidewinderServer } from '../servers/SidewinderServer.js';

export class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.monitors = new Map();
    this.maxSessions = 3;
    this.defaultResourceManager = this.createDefaultResourceManager();
    this.sidewinderServer = null;
    this.logLevels = new Map(); // sessionId -> log level
  }
  
  /**
   * Create a default ResourceManager for standalone usage
   */
  createDefaultResourceManager() {
    // Create a StorageProvider that supports LegionLogManager requirements
    class MockStorageProvider {
      constructor() {
        this.collections = new Map();
      }
      
      // Basic methods
      async get(key) { return null; }
      async set(key, value) { return true; }
      async delete(key) { return true; }
      async list(prefix) { return []; }
      
      // LegionLogManager required methods
      async store(collection, document) {
        if (!this.collections.has(collection)) {
          this.collections.set(collection, []);
        }
        const docs = this.collections.get(collection);
        docs.push(document);
        return document;
      }
      
      async query(collection, criteria = {}) {
        const docs = this.collections.get(collection) || [];
        
        // Simple filtering by criteria
        if (!criteria || Object.keys(criteria).length === 0) {
          return docs;
        }
        
        return docs.filter(doc => {
          return Object.entries(criteria).every(([key, value]) => {
            return doc[key] === value;
          });
        });
      }
    }

    return {
      resources: new Map([
        ['StorageProvider', new MockStorageProvider()],
        ['BROWSER_TYPE', process.env.BROWSER_TYPE || 'puppeteer'],
        ['BROWSER_HEADLESS', process.env.BROWSER_HEADLESS !== 'false'],
        ['LOG_LEVEL', process.env.LOG_LEVEL || 'info']
      ]),
      
      get(key) {
        return this.resources.get(key);
      },
      
      set(key, value) {
        this.resources.set(key, value);
      }
    };
  }
  
  /**
   * Get or create a monitor for a session
   */
  async getOrCreateMonitor(sessionId = 'default') {
    if (this.monitors.has(sessionId)) {
      return this.monitors.get(sessionId);
    }
    
    // Check session limit
    if (this.monitors.size >= this.maxSessions) {
      // Clean up oldest session
      const oldestSession = Array.from(this.monitors.keys())[0];
      await this.endSession(oldestSession);
    }
    
    // Lazy load FullStackMonitor if needed
    if (!FullStackMonitor) {
      const module = await import('../../../fullstack-monitor/src/FullStackMonitor.js');
      FullStackMonitor = module.FullStackMonitor;
    }
    
    // Create new monitor
    const monitor = await FullStackMonitor.create(this.defaultResourceManager);
    
    this.monitors.set(sessionId, monitor);
    this.sessions.set(sessionId, {
      id: sessionId,
      monitor,
      startTime: new Date(),
      active: true
    });
    
    // Set up cleanup on monitor events
    monitor.on('cleanup', () => {
      this.monitors.delete(sessionId);
      this.sessions.delete(sessionId);
    });
    
    return monitor;
  }
  
  /**
   * Get current monitor for a session
   */
  getCurrentMonitor(sessionId = 'default') {
    const monitor = this.monitors.get(sessionId);
    if (!monitor) {
      throw new Error(`No active monitoring session: ${sessionId}`);
    }
    return monitor;
  }
  
  /**
   * Check if a session exists
   */
  hasSession(sessionId) {
    return this.monitors.has(sessionId);
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      startTime: session.startTime,
      active: session.active
    }));
  }
  
  /**
   * End a specific session
   */
  async endSession(sessionId) {
    const monitor = this.monitors.get(sessionId);
    if (monitor) {
      try {
        await monitor.cleanup();
      } catch (error) {
        console.error(`Error cleaning up session ${sessionId}:`, error);
      }
      
      this.monitors.delete(sessionId);
      this.sessions.delete(sessionId);
    }
  }
  
  /**
   * End all sessions (for cleanup)
   */
  async endAllSessions() {
    const sessionIds = Array.from(this.monitors.keys());
    
    for (const sessionId of sessionIds) {
      await this.endSession(sessionId);
    }
  }
  
  /**
   * Get statistics across all sessions
   */
  getGlobalStatistics() {
    const stats = {
      activeSessions: this.monitors.size,
      totalSessions: this.sessions.size,
      monitors: []
    };
    
    for (const [sessionId, monitor] of this.monitors.entries()) {
      try {
        const monitorStats = monitor.getStatistics();
        stats.monitors.push({
          sessionId,
          ...monitorStats
        });
      } catch (error) {
        console.error(`Error getting stats for session ${sessionId}:`, error);
      }
    }
    
    return stats;
  }
  
  /**
   * Clean up inactive sessions
   */
  async cleanupInactiveSessions(maxIdleTime = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const idleTime = now - session.startTime.getTime();
      
      if (idleTime > maxIdleTime && session.active) {
        console.log(`Cleaning up idle session: ${sessionId}`);
        await this.endSession(sessionId);
      }
    }
  }
  
  /**
   * Initialize Sidewinder server
   */
  async initializeSidewinderServer(port = 9898) {
    if (!this.sidewinderServer) {
      this.sidewinderServer = new SidewinderServer(port);
      await this.sidewinderServer.start();
      
      // Listen for Sidewinder events
      this.sidewinderServer.on('event', ({ sessionId, event }) => {
        // Could emit events or process them here
        // For now, they're stored in the SidewinderServer
      });
    }
    return this.sidewinderServer;
  }
  
  /**
   * Get Sidewinder server instance
   */
  getSidewinderServer() {
    return this.sidewinderServer;
  }
  
  /**
   * Get Sidewinder events for a session
   */
  getSidewinderEvents(sessionId, filters = {}) {
    if (!this.sidewinderServer) {
      return [];
    }
    return this.sidewinderServer.getEvents(sessionId, filters);
  }
  
  /**
   * Set log level for a session
   */
  setLogLevel(sessionId, level) {
    this.logLevels.set(sessionId, level);
    
    // Send command to Sidewinder if connected
    if (this.sidewinderServer) {
      this.sidewinderServer.sendCommand(sessionId, {
        type: 'setLogLevel',
        level
      });
    }
  }
  
  /**
   * Get log level for a session
   */
  getLogLevel(sessionId) {
    return this.logLevels.get(sessionId) || 'info';
  }
  
  /**
   * Clean up Sidewinder resources
   */
  async cleanupSidewinder() {
    if (this.sidewinderServer) {
      await this.sidewinderServer.stop();
      this.sidewinderServer = null;
    }
  }
}