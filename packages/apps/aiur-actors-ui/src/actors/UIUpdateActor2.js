/**
 * UIUpdateActor - Routes UI update messages between components and server
 * Now inherits from BaseActor for consistent message handling
 */
import { BaseActor } from './BaseActor.js';

export class UIUpdateActor extends BaseActor {
  constructor() {
    super('UIUpdateActor');
    this.subscribers = new Map();
    this.components = new Map();
    this._requestCounter = 0;
    
    // Register UI-specific handlers
    this.registerHandler('command_input', this.handleCommandInput.bind(this));
    this.registerHandler('refresh_tools', this.handleRefreshTools.bind(this));
    this.registerHandler('refresh_sessions', this.handleRefreshSessions.bind(this));
    this.registerHandler('refresh_variables', this.handleRefreshVariables.bind(this));
    this.registerHandler('state_update', this.handleStateUpdate.bind(this));
    this.registerHandler('component_update', this.handleComponentUpdate.bind(this));
  }

  /**
   * Override connection state change to notify components
   */
  onConnectionStateChanged(connected) {
    this.broadcastToComponents({
      type: 'connectionStateChanged',
      connected
    });
  }

  /**
   * Override server connected to notify components
   */
  onServerConnected(serverInfo) {
    this.broadcastToComponents({
      type: 'serverConnected',
      serverInfo
    });
  }

  /**
   * Override session created to update state
   */
  onSessionCreated(sessionId, sessionInfo) {
    this.handleStateUpdate({
      stateType: 'session',
      data: {
        sessionId,
        created: true,
        ...sessionInfo
      }
    });
  }

  /**
   * Override tools list to update state
   */
  onToolsList(tools) {
    this.handleStateUpdate({
      stateType: 'tools',
      data: tools
    });
  }

  /**
   * Override command result to update terminal
   */
  onCommandResult(result, requestId) {
    this.handleComponentUpdate({
      component: 'terminal',
      data: {
        type: 'result',
        result,
        requestId
      }
    });
  }

  /**
   * Override tool result to update terminal
   */
  onToolResult(result, requestId) {
    this.handleComponentUpdate({
      component: 'terminal',
      data: {
        type: 'result',
        result,
        requestId
      }
    });
  }

  /**
   * Override error handlers to show in UI
   */
  onToolError(error, requestId) {
    this.handleComponentUpdate({
      component: 'terminal',
      data: {
        type: 'error',
        error,
        requestId
      }
    });
  }

  onError(error, requestId) {
    this.handleComponentUpdate({
      component: 'terminal',
      data: {
        type: 'error',
        error,
        requestId
      }
    });
  }

  /**
   * Handle command input from UI
   * @private
   */
  handleCommandInput(message) {
    const { command, args } = message;
    
    const commandActor = this._space?.getActor('command-actor');
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
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge) {
      bridge.receive({
        type: 'listTools',
        payload: {}
      });
    }
  }

  /**
   * Handle refresh sessions request
   * @private
   */
  handleRefreshSessions() {
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge) {
      bridge.receive({
        type: 'listSessions',
        payload: {}
      });
    }
  }

  /**
   * Handle refresh variables request
   * @private
   */
  handleRefreshVariables(message) {
    const { sessionId } = message;
    
    const bridge = this._space?.getActor('websocket-bridge');
    if (bridge) {
      bridge.receive({
        type: 'getVariables',
        payload: { sessionId }
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
          console.error(`${this.name}: Error in state update subscriber:`, error);
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
    } else {
      console.log(`${this.name}: Component '${component}' not found or has no onUIUpdate method`);
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
      console.log(`${this.name}: Registered component '${component.name}'`);
    }
  }

  /**
   * Unregister a UI component
   * @param {string} componentName - Component name
   */
  unregisterComponent(componentName) {
    this.components.delete(componentName);
    console.log(`${this.name}: Unregistered component '${componentName}'`);
  }

  /**
   * Broadcast update to all components
   * @param {Object} update - Update data
   */
  broadcastToComponents(update) {
    this.components.forEach((component, name) => {
      if (component.onUIUpdate) {
        try {
          component.onUIUpdate(update);
        } catch (error) {
          console.error(`${this.name}: Error updating component '${name}':`, error);
        }
      }
    });
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `ui-req-${++this._requestCounter}-${Date.now()}`;
  }

  /**
   * Clean up actor
   */
  destroy() {
    this.subscribers.clear();
    this.components.clear();
    super.destroy();
  }
}