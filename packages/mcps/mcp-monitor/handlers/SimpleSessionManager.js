/**
 * Simple SessionManager - Just a thin wrapper around FullStackMonitor instances
 * NO storage provider, NO actors, NO complexity - just FullStackMonitor!
 */

import { FullStackMonitor } from '@legion/fullstack-monitor';
import { ResourceManager } from '@legion/resource-manager';

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
      // Use the singleton ResourceManager instance from @legion/resource-manager
      const resourceManager = await ResourceManager.getInstance();
      
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
    const sessions = Array.from(this.activeSessions);
    return {
      active: sessions,
      count: sessions.length
    };
  }
  
  /**
   * End a specific session
   */
  async endSession(sessionId) {
    if (this.activeSessions.has(sessionId)) {
      this.activeSessions.delete(sessionId);
      return true;
    }
    return false;
  }
  
  /**
   * End all sessions
   */
  async endAllSessions() {
    // Clear all active sessions
    this.activeSessions.clear();
    
    // Cleanup the single monitor if it exists
    if (this.monitor) {
      await this.monitor.cleanup();
      this.monitor = null;
    }
  }
  
  /**
   * Check if session exists
   */
  hasSession(sessionId) {
    return this.activeSessions.has(sessionId);
  }
}