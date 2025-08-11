/**
 * MonitorActorSpace - Central ActorSpace for fullstack monitoring
 * Manages all monitoring actors and their communication
 */

import { ActorSpace } from '@legion/shared/actors/src/ActorSpace.js';
import { generateGuid } from '@legion/shared/utils/src/index.js';

export class MonitorActorSpace extends ActorSpace {
  constructor(sessionId = null) {
    const spaceId = sessionId || `monitor-${generateGuid()}`;
    super(spaceId);
    
    this.sessionId = sessionId || spaceId;
    this.actors = new Map();
    this.browserConnections = new Map(); // pageId -> Channel
    this.nodeConnections = new Map();    // processId -> Channel
    
    console.log(`[MonitorActorSpace] Created with session: ${this.sessionId}`);
  }
  
  /**
   * Register a monitoring actor
   */
  registerMonitorActor(actor, actorType) {
    const guid = `${this.spaceId}-${actorType}`;
    this.register(actor, guid);
    this.actors.set(actorType, { actor, guid });
    
    console.log(`[MonitorActorSpace] Registered ${actorType} actor with GUID: ${guid}`);
    return guid;
  }
  
  /**
   * Get a monitoring actor by type
   */
  getMonitorActor(actorType) {
    const entry = this.actors.get(actorType);
    return entry ? entry.actor : null;
  }
  
  /**
   * Handle browser agent connection
   */
  async handleBrowserConnection(websocket, pageId) {
    console.log(`[MonitorActorSpace] Browser agent connecting: ${pageId}`);
    
    // Send handshake with actor GUIDs
    const handshake = {
      type: 'actor_handshake',
      serverActors: {
        browserMonitor: `${this.spaceId}-browserMonitor`,
        logManager: `${this.spaceId}-logManager`,
        correlation: `${this.spaceId}-correlation`
      },
      sessionId: this.sessionId
    };
    
    websocket.send(JSON.stringify(handshake));
    
    // Wait for client handshake response
    return new Promise((resolve) => {
      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'actor_handshake_ack') {
            websocket.removeEventListener('message', handleMessage);
            
            // Create Channel for this connection
            const channel = this.addChannel(websocket);
            this.browserConnections.set(pageId, channel);
            
            // Create RemoteActors for browser agents
            const remotePageAgent = channel.makeRemote(message.clientActors.pageAgent);
            
            // Give RemoteActor to BrowserMonitorActor
            const browserMonitor = this.getMonitorActor('browserMonitor');
            if (browserMonitor && browserMonitor.addPageAgent) {
              browserMonitor.addPageAgent(pageId, remotePageAgent);
            }
            
            console.log(`[MonitorActorSpace] Browser agent connected: ${pageId}`);
            resolve({ channel, remotePageAgent });
          }
        } catch (error) {
          console.error('[MonitorActorSpace] Error handling browser handshake:', error);
        }
      };
      
      websocket.addEventListener('message', handleMessage);
    });
  }
  
  /**
   * Handle Node.js agent connection (Sidewinder)
   */
  async handleNodeConnection(websocket, processId) {
    console.log(`[MonitorActorSpace] Node agent connecting: ${processId}`);
    
    // Send handshake with actor GUIDs
    const handshake = {
      type: 'actor_handshake',
      serverActors: {
        sidewinder: `${this.spaceId}-sidewinder`,
        logManager: `${this.spaceId}-logManager`,
        correlation: `${this.spaceId}-correlation`
      },
      sessionId: this.sessionId
    };
    
    websocket.send(JSON.stringify(handshake));
    
    // Wait for client handshake response
    return new Promise((resolve) => {
      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'actor_handshake_ack') {
            websocket.removeEventListener('message', handleMessage);
            
            // Create Channel for this connection
            const channel = this.addChannel(websocket);
            this.nodeConnections.set(processId, channel);
            
            // Create RemoteActors for Node agents
            const remoteSidewinderAgent = channel.makeRemote(message.clientActors.sidewinderAgent);
            
            // Give RemoteActor to SidewinderActor
            const sidewinder = this.getMonitorActor('sidewinder');
            if (sidewinder && sidewinder.addNodeAgent) {
              sidewinder.addNodeAgent(processId, remoteSidewinderAgent);
            }
            
            console.log(`[MonitorActorSpace] Node agent connected: ${processId}`);
            resolve({ channel, remoteSidewinderAgent });
          }
        } catch (error) {
          console.error('[MonitorActorSpace] Error handling Node handshake:', error);
        }
      };
      
      websocket.addEventListener('message', handleMessage);
    });
  }
  
  /**
   * Broadcast a message to all actors
   */
  broadcastToActors(message) {
    this.actors.forEach(({ actor }) => {
      if (actor && actor.receive) {
        actor.receive(message);
      }
    });
  }
  
  /**
   * Clean up connections
   */
  cleanup() {
    // Close all browser connections
    this.browserConnections.forEach((channel, pageId) => {
      console.log(`[MonitorActorSpace] Closing browser connection: ${pageId}`);
      channel.close();
    });
    this.browserConnections.clear();
    
    // Close all Node connections
    this.nodeConnections.forEach((channel, processId) => {
      console.log(`[MonitorActorSpace] Closing Node connection: ${processId}`);
      channel.close();
    });
    this.nodeConnections.clear();
    
    // Clear actors map (the Map we created in the constructor)
    if (this.actors instanceof Map) {
      this.actors.clear();
    }
    
    // Call parent cleanup
    this.destroy();
  }
}