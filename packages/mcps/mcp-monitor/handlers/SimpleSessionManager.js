/**
 * Simple SessionManager - Just a thin wrapper around FullStackMonitor instances
 * NO storage provider, NO actors, NO complexity - just FullStackMonitor!
 */

import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/tools';

export class SimpleSessionManager {
  constructor() {
    this.monitors = new Map(); // sessionId -> FullStackMonitor instance
  }
  
  /**
   * Get or create a FullStackMonitor for a session
   */
  async getMonitor(sessionId = 'default') {
    if (!this.monitors.has(sessionId)) {
      // Use the singleton ResourceManager instance from @legion/tools
      const resourceManager = ResourceManager.getInstance();
      
      const monitor = await FullStackMonitor.create(resourceManager);
      this.monitors.set(sessionId, monitor);
    }
    
    return this.monitors.get(sessionId);
  }
  
  /**
   * List all active sessions
   */
  listSessions() {
    const sessions = Array.from(this.monitors.keys());
    return {
      active: sessions,
      count: sessions.length
    };
  }
  
  /**
   * End a specific session
   */
  async endSession(sessionId) {
    const monitor = this.monitors.get(sessionId);
    if (monitor) {
      await monitor.cleanup();
      this.monitors.delete(sessionId);
      return true;
    }
    return false;
  }
  
  /**
   * End all sessions
   */
  async endAllSessions() {
    const promises = [];
    for (const [sessionId, monitor] of this.monitors) {
      promises.push(monitor.cleanup());
    }
    
    await Promise.all(promises);
    this.monitors.clear();
  }
  
  /**
   * Check if session exists
   */
  hasSession(sessionId) {
    return this.monitors.has(sessionId);
  }
}