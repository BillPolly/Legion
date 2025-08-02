/**
 * AiurActorsApp - Main application entry point
 * Orchestrates the creation and coordination of all UI components and actors
 */
import { ClientCommandActor } from '../actors/ClientCommandActor2.js';
import { UIUpdateActor } from '../actors/UIUpdateActor2.js';
import { ToolsActor, TerminalActor, SessionActor, VariablesActor } from '../actors/SimpleActors.js';
import { createWebSocketBridge, ProtocolTypes } from '/legion/websocket-actor-protocol/index.js';
import { AppLayout } from '../components/app/AppLayout.js';

export class AiurActorsApp {
  constructor(config) {
    this.validateConfig(config);
    
    this.config = config;
    this.initialized = false;
    this.appLayout = null;  // Main layout component
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
      
      // Create the app layout (which creates all components)
      this.createAppLayout();
      
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
   * Create the app layout component
   * This creates the entire component hierarchy
   */
  createAppLayout() {
    const { dom, componentFactory, actorSpace, options = {} } = this.config;
    
    // Create the app layout component
    this.appLayout = new AppLayout(dom, {
      title: options.title || 'Aiur Actors',
      componentFactory,
      actorSpace,
      app: this,
      terminalConfig: options.terminal,
      toolsPanelConfig: options.toolsPanel,
      sessionPanelConfig: options.sessionPanel,
      variablesPanelConfig: options.variablesPanel
    });
    
    // Initialize the layout (which creates all child components)
    this.appLayout.initialize();
  }
  
  /**
   * Get a component from the hierarchy
   */
  getComponent(path) {
    if (!this.appLayout) return null;
    
    const parts = path.split('.');
    let current = this.appLayout;
    
    for (const part of parts) {
      if (current && current.getChild) {
        current = current.getChild(part);
      } else {
        return null;
      }
    }
    
    return current;
  }
  
  /**
   * Get the terminal component (convenience method)
   */
  getTerminal() {
    return this.appLayout?.getTerminal();
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
    
    // Create specialized actors using the new BaseActor pattern
    this.actors.toolsActor = new ToolsActor(this);
    actorSpace.register(this.actors.toolsActor, 'tools-actor');
    
    this.actors.terminalActor = new TerminalActor(this);
    actorSpace.register(this.actors.terminalActor, 'terminal-actor');
    
    this.actors.sessionActor = new SessionActor(this);
    actorSpace.register(this.actors.sessionActor, 'session-actor');
    
    this.actors.variablesActor = new VariablesActor(this);
    actorSpace.register(this.actors.variablesActor, 'variables-actor');
    
    // WebSocket bridge will be created when connection is established
    this.actors.websocketBridge = null;
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
        // Create WebSocket bridge with Aiur protocol
        this.actors.websocketBridge = createWebSocketBridge(ProtocolTypes.AIUR, {
          actorSpace: this.config.actorSpace
        });
        this.config.actorSpace.register(this.actors.websocketBridge, 'websocket-bridge');
        
        // Set the websocket for sending (but don't let it attach handlers)
        this.actors.websocketBridge.websocket = this.websocket;
        
        // Trigger the open handler
        this.actors.websocketBridge.handleOpen();
      };
      
      this.websocket.onmessage = (event) => {
        // Pass messages to the bridge
        if (this.actors.websocketBridge) {
          this.actors.websocketBridge.handleMessage(event);
        }
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
   * Load initial modules (called when session is created)
   */
  loadInitialModules() {
    // Request available tools through the bridge
    if (this.actors.websocketBridge) {
      this.actors.websocketBridge.receive({
        type: 'listTools',
        payload: {}
      });
      console.log('Requested tools list from Aiur');
    }
  }

  /**
   * Update tools list in the UI
   */
  updateToolsList(tools) {
    console.log('Updating tools list:', tools);
    // Update the tools panel component through its model
    const toolsPanel = this.getComponent('leftSidebar.toolsPanel');
    if (toolsPanel && toolsPanel.model) {
      toolsPanel.model.setTools(tools || []);
    }
  }

  /**
   * Display tool execution result
   */
  displayToolResult(result) {
    console.log('Tool result:', result);
    // Display in terminal
    const terminal = this.getTerminal();
    if (terminal) {
      // Check if result has special formatting
      if (result && typeof result === 'object') {
        if (result.tools) {
          // Tools list response
          this.updateToolsList(result.tools);
          const toolNames = result.tools.map(t => t.name).join(', ');
          terminal.viewModel.appendOutput(`Available tools: ${toolNames}`);
        } else {
          // Generic result
          terminal.viewModel.appendOutput(JSON.stringify(result, null, 2));
        }
      } else {
        terminal.viewModel.appendOutput(String(result));
      }
    }
  }

  /**
   * Display tool execution error
   */
  displayToolError(error) {
    console.error('Tool error:', error);
    // Display in terminal
    const terminal = this.getTerminal();
    if (terminal) {
      const errorMsg = error.message || error.toString();
      terminal.viewModel.appendOutput(`Error: ${errorMsg}`, 'error');
    }
  }

  /**
   * Execute a command from the terminal
   */
  executeCommand(command) {
    if (!this.actors.websocketBridge) {
      console.error('WebSocket bridge not ready');
      return Promise.reject(new Error('Not connected to server'));
    }
    
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}`;
      
      // Send command through the bridge
      this.actors.websocketBridge.receive({
        type: 'execute',
        payload: { command },
        requestId,
        resolve,
        reject
      });
      
      // Provide immediate feedback
      resolve(`Executing: ${command}`);
    });
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
    
    // Destroy the app layout (which destroys all components)
    if (this.appLayout && this.appLayout.destroy) {
      this.appLayout.destroy();
    }
    
    // Clear references
    this.appLayout = null;
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