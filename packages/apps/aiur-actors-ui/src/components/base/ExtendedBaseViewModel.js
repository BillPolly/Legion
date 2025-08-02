/**
 * Extended base view model with actor integration
 */
import { BaseViewModel } from './BaseViewModel.js';

export class ExtendedBaseViewModel extends BaseViewModel {
  constructor(model, view, actorSpace) {
    super(model, view);
    
    this.actorSpace = actorSpace;
    this.actors = {};
    this.pendingRequests = new Map();
  }

  /**
   * Initialize the view model and actors
   */
  initialize() {
    super.initialize();
    
    // Get references to actors
    this.actors.commandActor = this.actorSpace.getActor('command-actor');
    this.actors.updateActor = this.actorSpace.getActor('ui-update-actor');
    
    // Set up actor message handling
    this.setupActorHandlers();
  }

  /**
   * Set up handlers for actor messages
   */
  setupActorHandlers() {
    // Override in subclasses to handle specific actor messages
  }

  /**
   * Execute a command through the command actor
   * @param {string} command - Command to execute
   * @returns {Promise} Promise that resolves with command result
   */
  executeCommand(command) {
    // If app is available with executeCommand, use it
    if (this.umbilical?.app?.executeCommand) {
      return this.umbilical.app.executeCommand(command);
    }
    
    // Fallback to actor-based execution
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Send to command actor
      this.actors.commandActor.receive({
        type: 'execute',
        command,
        requestId
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Command execution timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle updates from actors
   * @param {Object} update - Update data from actor
   */
  handleActorUpdate(update) {
    switch (update.type) {
      case 'output':
        this.model.addOutput(update.content, update.outputType || 'info');
        break;
        
      case 'commandResponse':
        if (this.pendingRequests.has(update.requestId)) {
          const { resolve, reject } = this.pendingRequests.get(update.requestId);
          this.pendingRequests.delete(update.requestId);
          
          if (update.error) {
            reject(new Error(update.error));
          } else {
            resolve(update.result);
          }
        }
        break;
        
      case 'sessionUpdate':
        this.updateSession(update.session);
        break;
        
      case 'toolsUpdate':
        this.model.set('availableTools', update.tools);
        break;
        
      default:
        // Handle other update types in subclasses
        break;
    }
  }

  /**
   * Handle input from the view
   * @param {string} input - User input
   */
  handleInput(input) {
    // Add to history
    this.model.addToHistory(input);
    
    // Execute command
    this.executeCommand(input).catch(error => {
      this.model.addOutput(`Error: ${error.message}`, 'error');
    });
  }

  /**
   * Navigate command history
   * @param {number} direction - Direction to navigate (-1 for back, 1 for forward)
   * @returns {string} Command from history
   */
  navigateHistory(direction) {
    return this.model.navigateHistory(direction);
  }

  /**
   * Request autocomplete suggestions
   * @param {string} partial - Partial command
   */
  requestAutocomplete(partial) {
    this.actors.commandActor.receive({
      type: 'autocomplete',
      partial
    });
  }

  /**
   * Update session information
   * @param {Object} sessionData - Session data
   */
  updateSession(sessionData) {
    if (sessionData.sessionId) {
      this.model.setSessionId(sessionData.sessionId);
    }
    if (sessionData.state) {
      this.model.setSessionState(sessionData.state);
    }
  }

  /**
   * Set connection state
   * @param {boolean} connected - Whether connected
   */
  setConnectionState(connected) {
    this.model.setConnected(connected);
  }

  /**
   * Get terminal API for external use
   * @returns {Object} Terminal API
   */
  getTerminalAPI() {
    return {
      execute: (command) => this.executeCommand(command),
      clear: () => this.model.clearOutput(),
      getHistory: () => this.model.commandHistory,
      getOutput: () => this.model.getOutputBuffer(),
      navigateHistory: (direction) => this.navigateHistory(direction),
      isConnected: () => this.model.isConnected()
    };
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    // Update view based on model changes
    switch (event) {
      case 'outputAdded':
        this.view.appendOutput(data);
        break;
        
      case 'outputCleared':
        this.view.clearOutput();
        break;
        
      case 'connectionChanged':
        this.view.updateConnectionStatus(data.connected);
        break;
        
      case 'change':
        // Handle generic property changes
        if (data.key === 'availableTools') {
          this.view.updateToolsList(data.value);
        }
        break;
        
      default:
        // Let subclasses handle other events
        break;
    }
  }

  /**
   * Clean up
   */
  destroy() {
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Clear actor references
    this.actors = {};
    
    // Call parent destroy
    super.destroy();
  }
}