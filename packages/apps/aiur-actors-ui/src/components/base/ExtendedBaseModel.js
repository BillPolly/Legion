/**
 * Extended base model with terminal-specific functionality
 */
import { BaseModel } from './BaseModel.js';

export class ExtendedBaseModel extends BaseModel {
  constructor() {
    super();
    
    // Command history
    this.commandHistory = [];
    this.maxHistorySize = 1000;
    this.historyIndex = -1;
    
    // Output buffer
    this.outputBuffer = [];
    
    // Session state
    this.sessionId = null;
    this.sessionState = null;
    
    // Actor integration
    this.actorSpace = null;
    
    // Connection state
    this.connected = false;
  }

  // Command history methods
  addToHistory(command) {
    this.commandHistory.push({
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      command,
      timestamp: Date.now()
    });
    
    // Enforce max size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
    
    // Reset history navigation
    this.historyIndex = this.commandHistory.length;
    
    // Notify listeners
    this.notify('historyAdded', { command });
  }

  navigateHistory(direction) {
    if (this.commandHistory.length === 0) {
      return '';
    }
    
    this.historyIndex += direction;
    
    // Clamp to bounds
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
      return ''; // End of history
    }
    
    return this.commandHistory[this.historyIndex].command;
  }

  // Output buffer methods
  addOutput(content, type = 'info') {
    const output = {
      id: `out-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      timestamp: Date.now()
    };
    this.outputBuffer.push(output);
    this.notify('outputAdded', output);
  }

  getOutputBuffer() {
    return this.outputBuffer;
  }

  clearOutput() {
    this.outputBuffer = [];
    this.notify('outputCleared', {});
  }

  // Actor integration
  setActorSpace(actorSpace) {
    this.actorSpace = actorSpace;
  }

  sendToActor(actorId, message) {
    if (!this.actorSpace) {
      throw new Error('No actor space configured');
    }
    
    const actor = this.actorSpace.getActor(actorId);
    if (!actor) {
      throw new Error(`Actor not found: ${actorId}`);
    }
    
    actor.receive(message);
  }

  // Session management
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  getSessionId() {
    return this.sessionId;
  }

  setSessionState(state) {
    this.sessionState = state;
  }

  getSessionState() {
    return this.sessionState;
  }

  // Connection state
  setConnected(connected) {
    const oldConnected = this.connected;
    this.connected = connected;
    if (oldConnected !== connected) {
      this.notify('connectionChanged', { connected });
    }
  }

  isConnected() {
    return this.connected;
  }

  // Validation
  validate() {
    const errors = [];
    const warnings = [];
    
    // Add validation logic as needed
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // State export/import
  exportState() {
    return {
      commandHistory: this.commandHistory,
      outputBuffer: this.outputBuffer,
      sessionId: this.sessionId,
      sessionState: this.sessionState,
      connected: this.connected,
      timestamp: Date.now()
    };
  }

  importState(state) {
    if (state.commandHistory) {
      this.commandHistory = state.commandHistory;
      this.historyIndex = this.commandHistory.length;
    }
    
    if (state.outputBuffer) {
      this.outputBuffer = state.outputBuffer;
    }
    
    if (state.sessionId !== undefined) {
      this.sessionId = state.sessionId;
    }
    
    if (state.sessionState !== undefined) {
      this.sessionState = state.sessionState;
    }
    
    if (state.connected !== undefined) {
      this.connected = state.connected;
    }
  }
}