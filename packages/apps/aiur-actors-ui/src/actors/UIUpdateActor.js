/**
 * UIUpdateActor - Routes UI update messages between components and server
 */

export class UIUpdateActor {
  constructor() {
    this.isActor = true;
    this.subscribers = new Map();
    this.components = new Map();
    this._requestCounter = 0;
  }

  /**
   * Receive and handle messages
   * @param {Object} message - Incoming message
   */
  receive(message) {
    switch (message.type) {
      case 'command_input':
        this.handleCommandInput(message);
        break;
        
      case 'refresh_tools':
        this.handleRefreshTools(message);
        break;
        
      case 'refresh_sessions':
        this.handleRefreshSessions(message);
        break;
        
      case 'refresh_variables':
        this.handleRefreshVariables(message);
        break;
        
      case 'state_update':
        this.handleStateUpdate(message);
        break;
        
      case 'component_update':
        this.handleComponentUpdate(message);
        break;
        
      default:
        console.warn('UIUpdateActor: Unknown message type', message.type);
    }
  }

  /**
   * Handle command input from UI
   * @private
   */
  handleCommandInput(message) {
    const { command, args } = message;
    
    const commandActor = this._space.getActor('command-actor');
    if (commandActor) {
      commandActor.receive({
        type: 'execute',
        tool: command,
        args: args,
        requestId: this.generateRequestId()
      });
    }
  }

  /**
   * Handle refresh tools request
   * @private
   */
  handleRefreshTools() {
    const serverQueryActor = this._space.getActor('server-query-actor');
    if (serverQueryActor) {
      serverQueryActor.receive({
        type: 'get_tools'
      });
    }
  }

  /**
   * Handle refresh sessions request
   * @private
   */
  handleRefreshSessions() {
    const serverQueryActor = this._space.getActor('server-query-actor');
    if (serverQueryActor) {
      serverQueryActor.receive({
        type: 'get_sessions'
      });
    }
  }

  /**
   * Handle refresh variables request
   * @private
   */
  handleRefreshVariables(message) {
    const { sessionId } = message;
    
    const serverQueryActor = this._space.getActor('server-query-actor');
    if (serverQueryActor) {
      serverQueryActor.receive({
        type: 'get_variables',
        sessionId
      });
    }
  }

  /**
   * Handle state update from server
   * @private
   */
  handleStateUpdate(message) {
    const { stateType, data } = message;
    
    // Notify subscribers
    const subscribers = this.subscribers.get(stateType);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in state update subscriber:`, error);
        }
      });
    }
  }

  /**
   * Handle component-specific update
   * @private
   */
  handleComponentUpdate(message) {
    const { component, data } = message;
    
    const targetComponent = this.components.get(component);
    if (targetComponent && targetComponent.onUIUpdate) {
      targetComponent.onUIUpdate(data);
    }
  }

  /**
   * Subscribe to state updates
   * @param {string} stateType - Type of state to subscribe to
   * @param {Function} callback - Callback function
   */
  subscribe(stateType, callback) {
    if (!this.subscribers.has(stateType)) {
      this.subscribers.set(stateType, new Set());
    }
    this.subscribers.get(stateType).add(callback);
  }

  /**
   * Unsubscribe from state updates
   * @param {string} stateType - Type of state
   * @param {Function} callback - Callback function
   */
  unsubscribe(stateType, callback) {
    const subscribers = this.subscribers.get(stateType);
    if (subscribers) {
      subscribers.delete(callback);
    }
  }

  /**
   * Register a UI component
   * @param {Object} component - Component with name and onUIUpdate method
   */
  registerComponent(component) {
    if (component.name) {
      this.components.set(component.name, component);
    }
  }

  /**
   * Unregister a UI component
   * @param {string} componentName - Component name
   */
  unregisterComponent(componentName) {
    this.components.delete(componentName);
  }

  /**
   * Broadcast update to all components
   * @param {Object} update - Update data
   */
  broadcastToComponents(update) {
    this.components.forEach(component => {
      if (component.onUIUpdate) {
        try {
          component.onUIUpdate(update);
        } catch (error) {
          console.error(`Error updating component ${component.name}:`, error);
        }
      }
    });
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `ui-cmd-${++this._requestCounter}-${Date.now()}`;
  }

  /**
   * Clean up actor
   */
  destroy() {
    this.subscribers.clear();
    this.components.clear();
  }
}