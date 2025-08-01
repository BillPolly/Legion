/**
 * AiurActorsApp - Main application entry point
 * Orchestrates the creation and coordination of all UI components and actors
 */
import { ClientCommandActor } from '../actors/ClientCommandActor.js';
import { UIUpdateActor } from '../actors/UIUpdateActor.js';

export class AiurActorsApp {
  constructor(config) {
    this.validateConfig(config);
    
    this.config = config;
    this.initialized = false;
    this.components = {};
    this.actors = {};
    this.errorState = false;
    this.websocket = null;
    this.channel = null;
  }

  /**
   * Validate required configuration
   * @private
   */
  validateConfig(config) {
    if (!config.dom) {
      throw new Error('DOM container is required');
    }
    if (!config.componentFactory) {
      throw new Error('ComponentFactory is required');
    }
    if (!config.actorSpace) {
      throw new Error('ActorSpace is required');
    }
  }

  /**
   * Initialize the application
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      // Setup actors first
      this.setupActors();
      
      // Create UI components
      this.createComponents();
      
      // Setup WebSocket connection if configured
      if (this.config.options?.websocketUrl) {
        this.setupWebSocketConnection();
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Create all UI components
   */
  createComponents() {
    const { dom, componentFactory, actorSpace, options = {} } = this.config;
    
    // Terminal component
    const terminalEl = dom.querySelector('#terminal');
    if (!terminalEl) {
      throw new Error('Terminal container not found');
    }
    
    this.components.terminal = componentFactory.createTerminal({
      dom: terminalEl,
      actorSpace,
      config: options.terminal
    });
    
    // Tools panel
    const toolsEl = dom.querySelector('#tools-panel');
    if (!toolsEl) {
      throw new Error('Tools panel container not found');
    }
    
    this.components.toolsPanel = componentFactory.createToolsPanel({
      dom: toolsEl,
      actorSpace,
      config: options.toolsPanel
    });
    
    // Session panel
    const sessionEl = dom.querySelector('#session-panel');
    if (!sessionEl) {
      throw new Error('Session panel container not found');
    }
    
    this.components.sessionPanel = componentFactory.createSessionPanel({
      dom: sessionEl,
      actorSpace,
      config: options.sessionPanel
    });
    
    // Variables panel
    const variablesEl = dom.querySelector('#variables-panel');
    if (!variablesEl) {
      throw new Error('Variables panel container not found');
    }
    
    this.components.variablesPanel = componentFactory.createVariablesPanel({
      dom: variablesEl,
      actorSpace,
      config: options.variablesPanel
    });
  }

  /**
   * Setup actor system
   */
  setupActors() {
    const { actorSpace } = this.config;
    
    // Create and register command actor
    this.actors.commandActor = new ClientCommandActor();
    actorSpace.register(this.actors.commandActor, 'command-actor');
    
    // Create and register UI update actor
    this.actors.uiActor = new UIUpdateActor();
    actorSpace.register(this.actors.uiActor, 'ui-actor');
    
    // Create mock actors for tools, sessions, and variables
    // These will be replaced with real implementations later
    const mockActor = {
      isActor: true,
      receive: (message) => {
        console.log('Mock actor received:', message);
      }
    };
    
    this.actors.toolsActor = { ...mockActor, name: 'tools-actor' };
    actorSpace.register(this.actors.toolsActor, 'tools-actor');
    
    this.actors.sessionsActor = { ...mockActor, name: 'sessions-actor' };
    actorSpace.register(this.actors.sessionsActor, 'sessions-actor');
    
    this.actors.variablesActor = { ...mockActor, name: 'variables-actor' };
    actorSpace.register(this.actors.variablesActor, 'variables-actor');
  }

  /**
   * Setup WebSocket connection
   */
  setupWebSocketConnection() {
    const { websocketUrl, onConnectionError } = this.config.options;
    
    try {
      this.websocket = new WebSocket(websocketUrl);
      
      this.websocket.onerror = (error) => {
        if (onConnectionError) {
          onConnectionError(error);
        }
        this.handleError(error);
      };
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected to:', websocketUrl);
        // Create channel for actor communication
        this.channel = this.config.actorSpace.createChannel(this.websocket);
      };
      
      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.channel = null;
      };
    } catch (error) {
      if (onConnectionError) {
        onConnectionError(error);
      }
      throw error;
    }
  }

  /**
   * Start the application
   */
  start() {
    if (!this.initialized) {
      throw new Error('App must be initialized before starting');
    }
    
    // Start any necessary processes
    console.log('AiurActorsApp started');
    
    // Call ready callback if provided
    if (this.config.onReady) {
      this.config.onReady(this);
    }
  }

  /**
   * Stop the application
   */
  stop() {
    console.log('AiurActorsApp stopping...');
    
    // Close WebSocket connection
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
    
    // Additional cleanup
  }

  /**
   * Destroy the application and cleanup all resources
   */
  destroy() {
    // Stop first
    this.stop();
    
    // Destroy all components
    Object.values(this.components).forEach(component => {
      if (component && component.destroy) {
        component.destroy();
      }
    });
    
    // Clear references
    this.components = {};
    this.actors = {};
    
    // Destroy actor space
    if (this.config.actorSpace && this.config.actorSpace.destroy) {
      this.config.actorSpace.destroy();
    }
  }

  /**
   * Handle errors
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    console.error('AiurActorsApp error:', error);
    
    this.errorState = true;
    
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * Recover from error state
   * @returns {Promise<void>}
   */
  async recover() {
    console.log('Attempting to recover from error state...');
    
    this.errorState = false;
    
    // Re-initialize if needed
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get a component by name
   * @param {string} name - Component name
   * @returns {Object|undefined} Component instance
   */
  getComponent(name) {
    return this.components[name];
  }

  /**
   * Get an actor by key
   * @param {string} key - Actor key
   * @returns {Object|undefined} Actor instance
   */
  getActor(key) {
    return this.config.actorSpace.getActor(key);
  }

  /**
   * Execute a command through the command actor
   * @param {string} command - Command to execute
   * @returns {string} Request ID
   */
  executeCommand(command) {
    const commandActor = this.getActor('command-actor');
    if (!commandActor) {
      throw new Error('Command actor not found');
    }
    
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    commandActor.receive({
      type: 'execute',
      command,
      requestId
    });
    
    return requestId;
  }

  /**
   * Get application state
   * @returns {Object} Current application state
   */
  getState() {
    return {
      initialized: this.initialized,
      errorState: this.errorState,
      connected: this.websocket && this.websocket.readyState === WebSocket.OPEN,
      components: Object.keys(this.components),
      actors: Object.keys(this.actors)
    };
  }
}