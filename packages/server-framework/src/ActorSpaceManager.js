/**
 * ActorSpaceManager - Manages WebSocket connections and actor lifecycle
 * Creates and manages ActorSpace instances for each connection
 */

import { ActorSpace } from '@legion/actors';

export class ActorSpaceManager {
  constructor(services, routes) {
    this.services = services;      // Shared services for actors
    this.routes = routes;          // route -> { factory, clientFile, port }
    this.connections = new Map();  // ws -> { actorSpace, serverActor }
  }

  /**
   * Handle new WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   * @param {Request} req - HTTP request object
   */
  handleConnection(ws, req) {
    console.log(`New WebSocket connection from ${req.url}`);
    
    // Extract route from query parameters
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('route') || '/counter'; // fallback to counter for backward compatibility
    console.log(`[SERVER] Extracted route from WebSocket connection: ${route}`);
    
    // Create unique ActorSpace for this connection
    const actorSpace = new ActorSpace(`server-${Date.now()}-${Math.random()}`);
    
    // Store connection info
    const connectionInfo = {
      actorSpace,
      serverActor: null,
      channel: null,
      route: route // Store the extracted route
    };
    this.connections.set(ws, connectionInfo);
    
    // Set up message handler
    // Set up ActorSpace immediately for this connection
    this.setupActorSpace(ws);
    
    // Set up close handler
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      this.cleanup(ws);
    });
    
    // Set up error handler
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      // Connection will be cleaned up on close
    });
  }

  /**
   * Handle actor handshake message
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} message - Handshake message
   */
  handleHandshake(ws, message) {
    const { clientRootActor, route } = message;
    
    // Validate handshake
    if (!clientRootActor || !route) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid handshake: missing clientRootActor or route'
      }));
      return;
    }
    
    // Get route configuration
    const routeConfig = this.routes.get(route);
    if (!routeConfig) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown route: ${route}`
      }));
      return;
    }
    
    // Get connection info
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      console.error('Connection not found for handshake');
      return;
    }
    
    // Create server actor using factory
    const serverActor = this.createServerActor(route);
    if (!serverActor) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to create server actor for route: ${route}`
      }));
      return;
    }
    
    // Generate server actor ID
    const serverActorId = `server-root-${Date.now()}`;
    
    try {
      console.log('[SERVER] Registering server actor with ID:', serverActorId);
      // Register server actor in ActorSpace
      connectionInfo.actorSpace.register(serverActor, serverActorId);
      connectionInfo.serverActor = serverActor;
      console.log('[SERVER] Server actor registered successfully');
      
      // Set up channel for WebSocket
      console.log('[SERVER] Setting up WebSocket channel...');
      const channel = connectionInfo.actorSpace.addChannel(ws);
      connectionInfo.channel = channel;
      console.log('[SERVER] Channel created successfully');
      
      // Create remote reference to client actor
      console.log('[SERVER] Creating remote reference to client actor:', clientRootActor);
      const remoteClientActor = channel.makeRemote(clientRootActor);
      console.log('[SERVER] Remote client actor created:', remoteClientActor);
      
      // Give remote actor to server actor
      if (typeof serverActor.setRemoteActor === 'function') {
        console.log('[SERVER] Setting remote actor on server actor...');
        try {
          serverActor.setRemoteActor(remoteClientActor);
          console.log('[SERVER] Remote actor set on server actor successfully');
        } catch (error) {
          console.warn('[SERVER] Error setting remote actor on server actor:', error);
          // Continue anyway - this is not critical
        }
      } else {
        console.log('[SERVER] Server actor does not have setRemoteActor method');
      }
    } catch (error) {
      console.error(`Error during handshake setup for ${route}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Handshake setup failed: ${error.message}`
      }));
      return;
    }
    
    // Send handshake acknowledgment
    console.log('[SERVER] Sending handshake acknowledgment...');
    const handshakeAck = {
      type: 'actor_handshake_ack',
      serverRootActor: serverActorId,
      route: route
    };
    console.log('[SERVER] Handshake ack payload:', handshakeAck);
    ws.send(JSON.stringify(handshakeAck));
    
    console.log(`[SERVER] Handshake completed for route ${route}, server actor: ${serverActorId}`);
  }

  /**
   * Set up ActorSpace for a WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   */
  setupActorSpace(ws) {
    console.log('[SERVER] Setting up ActorSpace for new connection');
    
    // Get connection info
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) {
      console.error('[SERVER] Connection not found for ActorSpace setup');
      return;
    }
    
    // Determine route from stored connection info
    const route = connectionInfo.route;
    console.log('[SERVER] Using route from connection:', route);
    const serverActor = this.createServerActor(route);
    if (!serverActor) {
      console.error('[SERVER] Failed to create server actor for route:', route);
      return;
    }
    
    // Generate server actor ID
    const serverActorId = `server-root-${Date.now()}`;
    
    try {
      console.log('[SERVER] Registering server actor with ID:', serverActorId);
      // Register server actor in ActorSpace
      connectionInfo.actorSpace.register(serverActor, serverActorId);
      connectionInfo.serverActor = serverActor;
      console.log('[SERVER] Server actor registered successfully');
      
      // Set up channel for WebSocket
      console.log('[SERVER] Setting up WebSocket channel...');
      const channel = connectionInfo.actorSpace.addChannel(ws);
      connectionInfo.channel = channel;
      console.log('[SERVER] Channel created successfully');
      
      // Create remote reference to client actor
      console.log('[SERVER] Creating remote reference to client actor: client-root');
      const remoteClientActor = channel.makeRemote('client-root');
      console.log('[SERVER] Remote client actor created:', remoteClientActor);
      
      // Give remote actor to server actor
      if (typeof serverActor.setRemoteActor === 'function') {
        console.log('[SERVER] Setting remote actor on server actor...');
        try {
          serverActor.setRemoteActor(remoteClientActor);
          console.log('[SERVER] Remote actor set on server actor successfully');
        } catch (error) {
          console.warn('[SERVER] Error setting remote actor on server actor:', error);
        }
      } else {
        console.log('[SERVER] Server actor does not have setRemoteActor method');
      }
      
      // Send server actor info to client using ActorSpace protocol
      console.log('[SERVER] Sending server actor info to client via ActorSpace...');
      remoteClientActor.receive('server_actor_ready', { serverActorId });
      console.log('[SERVER] Server actor info sent to client');
      
    } catch (error) {
      console.error('[SERVER] Error during ActorSpace setup:', error);
    }
  }

  /**
   * Create server actor from factory
   * @param {string} route - Route path
   * @returns {Object|null} Server actor instance or null if route not found
   */
  createServerActor(route) {
    const routeConfig = this.routes.get(route);
    if (!routeConfig) {
      console.error(`No route configuration found for ${route}`);
      return null;
    }
    
    try {
      // Use factory to create new instance with services
      const actor = routeConfig.factory(this.services);
      return actor;
    } catch (error) {
      console.error(`Error creating server actor for ${route}:`, error);
      return null;
    }
  }

  /**
   * Clean up connection resources
   * @param {WebSocket} ws - WebSocket connection to clean up
   */
  cleanup(ws) {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      // ActorSpace cleanup happens automatically
      // Just remove from connections map
      this.connections.delete(ws);
      console.log('Connection cleaned up');
    }
  }

  /**
   * Get number of active connections
   * @returns {number} Number of active connections
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Get connection info for debugging
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Object|undefined} Connection info
   */
  getConnectionInfo(ws) {
    return this.connections.get(ws);
  }

  /**
   * Close all active WebSocket connections
   */
  closeAllConnections() {
    console.log(`Closing ${this.connections.size} active WebSocket connections`);
    for (const [ws, connectionInfo] of this.connections) {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
      this.cleanup(ws);
    }
  }
}