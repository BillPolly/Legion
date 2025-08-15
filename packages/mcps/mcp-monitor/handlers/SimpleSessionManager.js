/**
 * Simple SessionManager - Just a thin wrapper around FullStackMonitor instances
 * NO storage provider, NO actors, NO complexity - just FullStackMonitor!
 */

import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/tools-registry';

export class SimpleSessionManager {
  constructor(wsAgentPort = 9901) {
    this.wsAgentPort = wsAgentPort;  // Store the WebSocket port
    this.monitor = null;  // Single monitor instance
    this.activeSessions = new Set(); // Track active session IDs for listing
  }
  
  /**
   * Get the single FullStackMonitor instance (create if needed)
   */
  async getMonitor() {
    if (!this.monitor) {
      // Use the singleton ResourceManager instance from @legion/tools-registry
      const resourceManager = ResourceManager.getInstance();
      
      // Pass the wsAgentPort to FullStackMonitor
      this.monitor = await FullStackMonitor.create(resourceManager, {
        wsAgentPort: this.wsAgentPort
      });
    }
    
    return this.monitor;
  }
  
  /**
   * Track a session as active (called when starting an app or opening a page)
   */
  addSession(sessionId) {
    this.activeSessions.add(sessionId);
  }
  
  /**
   * Remove a session from tracking
   */
  removeSession(sessionId) {
    this.activeSessions.delete(sessionId);
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