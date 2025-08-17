/**
 * RootActorManager - Manages WebSocket connection using root actor pattern
 * Establishes a single root actor connection and manages sub-actors through it
 */

import { ActorSpace, Channel } from '/legion/shared/actors/src/index.js';
import { RootClientActor } from './RootClientActor.js';
import { ClientToolRegistryActor } from './ClientToolRegistryActor.js';
import { ClientDatabaseActor } from './ClientDatabaseActor.js';
import { ClientSemanticSearchActor } from './ClientSemanticSearchActor.js';
import { ClientPlanningActor } from './ClientPlanningActor.js';
import { ClientPlanExecutionActor } from './ClientPlanExecutionActor.js';

export class RootActorManager {
  constructor(applicationContext) {
    this.applicationContext = applicationContext;
    this.websocket = null;
    this.actorSpace = null;
    this.channel = null;
    this.rootActor = null;
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
      console.log('🔗 Connecting to WebSocket with root actor pattern:', websocketUrl);
      
      // Create WebSocket connection
      this.websocket = new WebSocket(websocketUrl);
      
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
      
      // Create ActorSpace (generic, no customization)
      this.actorSpace = new ActorSpace('client-' + Date.now());
      
      // Create root client actor
      this.rootActor = new RootClientActor();
      
      // Create and register sub-actors based on what the application needs
      await this.setupSubActors();
      
      // Register root actor with ActorSpace
      const rootActorId = `${this.actorSpace.spaceId}-root`;
      this.actorSpace.register(this.rootActor, rootActorId);
      
      // Create channel for WebSocket
      this.channel = this.actorSpace.addChannel(this.websocket);
      
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
        this.applicationContext.updateState?.('connectionStatus', 'disconnected');
      };
      
      this.websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.applicationContext.updateState?.('connectionStatus', 'error');
      };
      
      // Initiate root actor connection
      console.log('🤝 Initiating root actor connection...');
      this.websocket.send(JSON.stringify({
        type: 'root:init',
        clientRootActorId: rootActorId
      }));
      
      // Wait for root actor initialization
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Root actor initialization timeout'));
        }, 10000);
        
        this.rootInitResolver = (success) => {
          clearTimeout(timeout);
          if (success) {
            resolve();
          } else {
            reject(new Error('Root actor initialization failed'));
          }
        };
      });
      
      // Initiate handshake through root actors
      await this.rootActor.initiateHandshake();
      
      this.isConnected = true;
      this.applicationContext.updateState?.('connectionStatus', 'connected');
      
      console.log('✅ Root actor connection established');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to establish connection:', error);
      this.connectionPromise = null;
      throw error;
    }
  }

  /**
   * Set up sub-actors based on application needs
   */
  async setupSubActors() {
    // Tool Registry actors (always needed)
    const toolsActor = new ClientToolRegistryActor(this.applicationContext);
    const databaseActor = new ClientDatabaseActor(this.applicationContext);
    const searchActor = new ClientSemanticSearchActor(this.applicationContext);
    
    this.rootActor.registerSubActor('tools', toolsActor);
    this.rootActor.registerSubActor('database', databaseActor);
    this.rootActor.registerSubActor('search', searchActor);
    
    // Planning actors (conditionally added if planning interface is enabled)
    if (this.applicationContext.planningEnabled) {
      const planningActor = new ClientPlanningActor(this.applicationContext);
      const executionActor = new ClientPlanExecutionActor(this.applicationContext);
      
      this.rootActor.registerSubActor('planning', planningActor);
      this.rootActor.registerSubActor('execution', executionActor);
      
      console.log('✅ Planning actors registered');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    if (message.type === 'root:init_ack') {
      // Server acknowledged root actor initialization
      const { rootActorId } = message;
      console.log('✅ Server root actor acknowledged:', rootActorId);
      
      // Create remote root actor connection
      const remoteRootActor = this.channel.makeRemote(rootActorId);
      this.rootActor.setRemoteActor(remoteRootActor);
      
      // Resolve initialization promise
      if (this.rootInitResolver) {
        this.rootInitResolver(true);
        this.rootInitResolver = null;
      }
    }
    // All other messages are handled by ActorSpace through the root actor
  }

  /**
   * Get a specific sub-actor
   */
  getSubActor(name) {
    return this.rootActor?.subActors.get(name);
  }

  /**
   * Check if a server sub-actor is available
   */
  isServerSubActorAvailable(name) {
    return this.rootActor?.isServerSubActorAvailable(name) || false;
  }

  /**
   * Send a message through the root actor to a specific sub-actor
   */
  async sendToSubActor(subActorName, message) {
    const subActor = this.getSubActor(subActorName);
    if (subActor && subActor.remoteActor) {
      await subActor.remoteActor.send(message);
    } else {
      console.error(`Sub-actor not connected: ${subActorName}`);
    }
  }

  /**
   * Disconnect and clean up
   */
  async disconnect() {
    console.log('🔌 Disconnecting root actor manager...');
    
    if (this.rootActor) {
      await this.rootActor.cleanup();
    }
    
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
    
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Reconnect to the server
   */
  async reconnect() {
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit before reconnecting
    return this.connect(this.websocket.url);
  }
}