/**
 * SidewinderServer - WebSocket server for receiving Sidewinder instrumentation data
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class SidewinderServer extends EventEmitter {
  constructor(port = 9898) {
    super();
    this.port = port;
    this.wss = null;
    this.clients = new Map(); // sessionId -> WebSocket
    this.events = new Map();   // sessionId -> events array
    this.maxEventsPerSession = 10000;
  }
  
  /**
   * Start the WebSocket server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port: this.port });
        
        this.wss.on('connection', (ws, req) => {
          this.handleConnection(ws, req);
        });
        
        this.wss.on('listening', () => {
          console.log(`[SidewinderServer] Listening on port ${this.port}`);
          resolve();
        });
        
        this.wss.on('error', (error) => {
          console.error('[SidewinderServer] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    console.log('[SidewinderServer] New connection from', req.socket.remoteAddress);
    
    let sessionId = null;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle identification
        if (message.type === 'identify') {
          sessionId = message.sessionId;
          this.clients.set(sessionId, ws);
          
          if (!this.events.has(sessionId)) {
            this.events.set(sessionId, []);
          }
          
          console.log(`[SidewinderServer] Client identified: ${sessionId} (PID: ${message.pid})`);
          
          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'identified',
            sessionId
          }));
          
          return;
        }
        
        // Store event
        if (sessionId) {
          this.storeEvent(sessionId, message);
          
          // Emit for real-time processing
          this.emit('event', {
            sessionId,
            event: message
          });
        }
      } catch (error) {
        console.error('[SidewinderServer] Failed to parse message:', error);
      }
    });
    
    ws.on('close', () => {
      if (sessionId) {
        console.log(`[SidewinderServer] Client disconnected: ${sessionId}`);
        this.clients.delete(sessionId);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`[SidewinderServer] Client error (${sessionId}):`, error.message);
    });
  }
  
  /**
   * Store event for a session
   */
  storeEvent(sessionId, event) {
    const events = this.events.get(sessionId) || [];
    
    // Add event with session context
    events.push({
      ...event,
      sessionId,
      receivedAt: Date.now()
    });
    
    // Limit stored events
    if (events.length > this.maxEventsPerSession) {
      events.shift(); // Remove oldest
    }
    
    this.events.set(sessionId, events);
  }
  
  /**
   * Get events for a session
   */
  getEvents(sessionId, filters = {}) {
    const events = this.events.get(sessionId) || [];
    
    let filtered = [...events];
    
    // Apply filters
    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    
    if (filters.requestId) {
      filtered = filtered.filter(e => 
        e.requestId === filters.requestId || 
        (e.context && e.context.requestId === filters.requestId)
      );
    }
    
    if (filters.since) {
      const cutoff = filters.since instanceof Date ? filters.since.getTime() : filters.since;
      filtered = filtered.filter(e => e.timestamp > cutoff);
    }
    
    if (filters.level) {
      filtered = filtered.filter(e => {
        const eventLevel = this.getEventLevel(e);
        return this.matchesLogLevel(eventLevel, filters.level);
      });
    }
    
    return filtered;
  }
  
  /**
   * Send command to connected client
   */
  sendCommand(sessionId, command) {
    const ws = this.clients.get(sessionId);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(command));
      return true;
    }
    return false;
  }
  
  /**
   * Broadcast command to all clients
   */
  broadcast(command) {
    this.clients.forEach((ws, sessionId) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(command));
      }
    });
  }
  
  /**
   * Clear events for a session
   */
  clearEvents(sessionId) {
    this.events.delete(sessionId);
  }
  
  /**
   * Stop the server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all connections
        this.clients.forEach(ws => {
          ws.close();
        });
        
        this.wss.close(() => {
          console.log('[SidewinderServer] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
  
  /**
   * Get log level for an event
   */
  getEventLevel(event) {
    if (event.type === 'error' || 
        (event.type === 'console' && event.method === 'error')) {
      return 'error';
    }
    
    if (event.type === 'warning' || 
        (event.type === 'console' && event.method === 'warn')) {
      return 'warn';
    }
    
    if (event.type === 'console' && 
        (event.method === 'debug' || event.method === 'trace')) {
      return 'debug';
    }
    
    return 'info';
  }
  
  /**
   * Check if event level matches minimum level
   */
  matchesLogLevel(eventLevel, minLevel) {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const eventIndex = levels.indexOf(eventLevel);
    const minIndex = levels.indexOf(minLevel);
    return eventIndex !== -1 && eventIndex <= minIndex;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const stats = {
      connectedClients: this.clients.size,
      sessions: []
    };
    
    this.events.forEach((events, sessionId) => {
      stats.sessions.push({
        sessionId,
        eventCount: events.length,
        connected: this.clients.has(sessionId)
      });
    });
    
    return stats;
  }
}