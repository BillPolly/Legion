/**
 * SessionStore - Manages sessions and process lifecycle for FullStackMonitor
 * Designed to be completely silent (no console output) to prevent infinite recursion
 */

import { EventEmitter } from 'events';

export class SessionStore extends EventEmitter {
  constructor(storageProvider) {
    super();
    this.storageProvider = storageProvider;
    this.currentSession = null;
    this.processes = new Map(); // processId -> processInfo
  }

  /**
   * Create a new monitoring session
   */
  async createSession(name, metadata = {}) {
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || 'fullstack-monitoring',
      startTime: new Date(),
      metadata: {
        type: 'fullstack',
        monitors: ['sidewinder-agent', 'browser-agent'],
        ...metadata
      },
      status: 'active'
    };

    this.currentSession = session;
    
    // Store session in storage provider
    if (this.storageProvider) {
      await this.storageProvider.createSession(session);
    }

    // Emit event without console logging
    this.emit('session-created', session);
    
    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * End current session
   */
  async endSession() {
    if (!this.currentSession) {
      return null;
    }

    const endTime = new Date();
    const duration = endTime - this.currentSession.startTime;
    
    const completedSession = {
      ...this.currentSession,
      endTime,
      duration,
      status: 'completed',
      processCount: this.processes.size
    };

    // Update in storage
    if (this.storageProvider) {
      await this.storageProvider.updateSession(completedSession);
    }

    // Emit event
    this.emit('session-ended', completedSession);
    
    // Clean up
    const sessionId = this.currentSession.id;
    this.currentSession = null;
    this.processes.clear();
    
    return completedSession;
  }

  /**
   * Track a new process in the session
   */
  async trackProcess(processInfo) {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const process = {
      processId: processInfo.processId || processInfo.pid,
      sessionId: this.currentSession.id,
      command: processInfo.command || processInfo.argv?.join(' ') || 'unknown',
      startTime: new Date(),
      status: 'running',
      completed: false,
      ...processInfo
    };

    this.processes.set(process.processId, process);

    // Store in storage provider
    if (this.storageProvider) {
      await this.storageProvider.addProcess(this.currentSession.id, process);
    }

    // Emit event
    this.emit('process-started', process);
    
    return process;
  }

  /**
   * Mark process as completed
   */
  async completeProcess(processId, exitInfo = {}) {
    const process = this.processes.get(processId);
    if (!process) {
      return null;
    }

    const completedProcess = {
      ...process,
      endTime: new Date(),
      status: 'completed',
      completed: true,
      exitCode: exitInfo.exitCode || 0,
      ...exitInfo
    };

    this.processes.set(processId, completedProcess);

    // Update in storage
    if (this.storageProvider) {
      await this.storageProvider.completeProcess(
        this.currentSession.id,
        processId,
        exitInfo
      );
    }

    // Emit event
    this.emit('process-completed', completedProcess);
    
    return completedProcess;
  }

  /**
   * Get all processes in current session
   */
  getSessionProcesses() {
    return Array.from(this.processes.values());
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    if (!this.currentSession) {
      return null;
    }

    const processes = Array.from(this.processes.values());
    const runningProcesses = processes.filter(p => p.status === 'running');
    const completedProcesses = processes.filter(p => p.status === 'completed');

    return {
      sessionId: this.currentSession.id,
      name: this.currentSession.name,
      startTime: this.currentSession.startTime,
      duration: this.currentSession.startTime ? 
        Date.now() - this.currentSession.startTime : 0,
      totalProcesses: processes.length,
      runningProcesses: runningProcesses.length,
      completedProcesses: completedProcesses.length,
      status: this.currentSession.status
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.currentSession) {
      await this.endSession();
    }
    this.removeAllListeners();
  }
}