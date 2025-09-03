/**
 * WebSocketActorManager - Manages WebSocket connection and actor communication
 * Implements the actor handshake protocol and coordinates client-side actors
 */

import { ActorSpace, Channel } from '/legion/shared/actors/src/index.js';
import { ClientToolRegistryActor } from './ClientToolRegistryActor.js';
import { ClientDatabaseActor } from './ClientDatabaseActor.js';
import { ClientSemanticSearchActor } from './ClientSemanticSearchActor.js';
import { ClientPlanningActor } from './ClientPlanningActor.js';
import { ClientPlanExecutionActor } from './ClientPlanExecutionActor.js';

export class WebSocketActorManager {
  constructor(toolRegistryBrowser) {
    this.toolRegistryBrowser = toolRegistryBrowser;
    this.websocket = null;
    this.actorSpace = null;
    this.channel = null;
    this.actors = {};
    this.remoteActors = {};
    this.isConnected = false;
    this.connectionPromise = null;
  }

  async connect(websocketUrl) {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._establishConnection(websocketUrl);
    return this.connectionPromise;
  }

  async _establishConnection(websocketUrl) {
    try {
      console.log('🔗 Connecting to WebSocket actor system:', websocketUrl);
      
      // Create WebSocket connection
      this.websocket = new WebSocket(websocketUrl);
      
      // Create ActorSpace
      this.actorSpace = new ActorSpace('client-' + Date.now());
      
      // Create client actors
      this.actors.tools = new ClientToolRegistryActor(this.toolRegistryBrowser);
      this.actors.database = new ClientDatabaseActor(this.toolRegistryBrowser);
      this.actors.search = new ClientSemanticSearchActor(this.toolRegistryBrowser);
      this.actors.planning = new ClientPlanningActor(this.toolRegistryBrowser);
      this.actors.execution = new ClientPlanExecutionActor(this.toolRegistryBrowser);
      
      // Generate unique GUIDs for client actors
      const clientActorGuids = {
        tools: `${this.actorSpace.spaceId}-tools`,
        database: `${this.actorSpace.spaceId}-database`,
        search: `${this.actorSpace.spaceId}-search`,
        planning: `${this.actorSpace.spaceId}-planning`,
        execution: `${this.actorSpace.spaceId}-execution`
      };
      
      // Register actors in ActorSpace
      this.actorSpace.register(this.actors.tools, clientActorGuids.tools);
      this.actorSpace.register(this.actors.database, clientActorGuids.database);
      this.actorSpace.register(this.actors.search, clientActorGuids.search);
      this.actorSpace.register(this.actors.planning, clientActorGuids.planning);
      this.actorSpace.register(this.actors.execution, clientActorGuids.execution);
      
      // Wait for WebSocket to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);
        
        this.websocket.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket connected');
          resolve();
        };
        
        this.websocket.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket connection error:', error);
          reject(error);
        };
      });
      
      // Set up message handling
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        this.toolRegistryBrowser.updateState?.('connectionStatus', 'disconnected');
      };
      
      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.toolRegistryBrowser.updateState?.('connectionStatus', 'error');
      };
      
      // Initiate actor handshake
      console.log('🤝 Initiating actor handshake...');
      this.websocket.send(JSON.stringify({
        type: 'actor_handshake',
        clientActors: clientActorGuids
      }));
      
      // Wait for handshake completion
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Actor handshake timeout'));
        }, 10000);
        
        this.handshakeResolver = (success) => {
          clearTimeout(timeout);
          if (success) {
            resolve();
          } else {
            reject(new Error('Actor handshake failed'));
          }
        };
      });
      
    } catch (error) {
      console.error('❌ Failed to establish WebSocket actor connection:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  handleMessage(message) {
    const { type } = message;
    
    switch (type) {
      case 'actor_handshake_ack':
        this.handleHandshakeAck(message);
        break;
        
      default:
        // Let ActorSpace handle regular actor messages
        if (this.actorSpace && this.channel) {
          this.actorSpace.handleIncomingMessage(message);
        }
    }
  }

  handleHandshakeAck(message) {
    try {
      console.log('🤝 Received handshake acknowledgment:', message);
      
      const { serverActors } = message;
      
      // Create Channel for WebSocket communication
      this.channel = this.actorSpace.addChannel(this.websocket);
      
      // Create remote actors for server actors
      this.remoteActors.tools = this.channel.makeRemote(serverActors.tools);
      this.remoteActors.database = this.channel.makeRemote(serverActors.database);
      this.remoteActors.search = this.channel.makeRemote(serverActors.search);
      this.remoteActors.planning = this.channel.makeRemote(serverActors.planning);
      this.remoteActors.execution = this.channel.makeRemote(serverActors.execution);
      
      // Connect client actors to their remote counterparts
      this.actors.tools.setRemoteActor(this.remoteActors.tools);
      this.actors.database.setRemoteActor(this.remoteActors.database);
      this.actors.search.setRemoteActor(this.remoteActors.search);
      this.actors.planning.setRemoteActor(this.remoteActors.planning);
      this.actors.execution.setRemoteActor(this.remoteActors.execution);
      
      // Mark as connected
      this.isConnected = true;
      this.toolRegistryBrowser.updateState?.('connectionStatus', 'connected');
      
      console.log('✅ Actor handshake completed successfully');
      console.log('🎯 Client actors connected to server actors');
      
      // Resolve handshake promise
      if (this.handshakeResolver) {
        this.handshakeResolver(true);
      }
      
    } catch (error) {
      console.error('❌ Error handling handshake acknowledgment:', error);
      if (this.handshakeResolver) {
        this.handshakeResolver(false);
      }
    }
  }

  // Public API for the main application
  getToolActor() {
    return this.actors.tools;
  }

  getToolRegistryActor() {
    return this.actors.tools;
  }

  getDatabaseActor() {
    return this.actors.database;
  }

  getSearchActor() {
    return this.actors.search;
  }

  getPlanningActor() {
    return this.actors.planning;
  }

  getExecutionActor() {
    return this.actors.execution;
  }

  isActorSystemConnected() {
    return this.isConnected;
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
    }
    this.isConnected = false;
    this.connectionPromise = null;
  }

  // Convenience methods to access actor functionality
  loadTools() {
    if (this.actors.tools) {
      this.actors.tools.loadTools();
    }
  }

  loadModules() {
    if (this.actors.tools) {
      this.actors.tools.loadModules(); // Now uses searchModules('') internally
    }
  }
  
  searchModules(query = '', options = {}) {
    if (this.actors.tools) {
      this.actors.tools.searchModules(query, options);
    }
  }

  loadAllModules() {
    if (this.actors.tools) {
      this.actors.tools.loadAllModules();
    }
  }

  getRegistryStats() {
    if (this.actors.tools) {
      this.actors.tools.getRegistryStats();
    }
  }

  executeTool(toolName, params) {
    if (this.actors.tools) {
      this.actors.tools.executeTool(toolName, params);
    }
  }

  searchTools(query, options = {}) {
    if (this.actors.search) {
      this.actors.search.searchTools(query, options);
    }
  }

  getDatabaseStats() {
    if (this.actors.database) {
      this.actors.database.getStats();
    }
  }

  clearDatabase() {
    if (this.actors.tools) {
      this.actors.tools.clearDatabase();
    }
  }

  loadSingleModule(moduleName) {
    if (this.actors.tools) {
      this.actors.tools.loadSingleModule(moduleName);
    }
  }

  generatePerspectives() {
    if (this.actors.tools) {
      this.actors.tools.generatePerspectives();
    }
  }
}