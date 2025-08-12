/**
 * Test WebSocket server for Sidewinder tests
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class TestServer extends EventEmitter {
  constructor(port = 0) {
    super();
    this.port = port;
    this.wss = null;
    this.clients = new Map();
    this.events = [];
    this.isListening = false;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });
      
      this.wss.on('connection', (ws, req) => {
        this.handleConnection(ws, req);
      });
      
      this.wss.on('listening', () => {
        this.port = this.wss.address().port;
        this.isListening = true;
        this.emit('listening', this.port);
        resolve(this.port);
      });
      
      this.wss.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  handleConnection(ws, req) {
    let sessionId = null;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle identification
        if (message.type === 'identify') {
          sessionId = message.sessionId;
          this.clients.set(sessionId, {
            ws,
            pid: message.pid,
            profile: message.profile,
            hooks: message.hooks
          });
          
          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'identified',
            sessionId
          }));
          
          this.emit('client-connected', {
            sessionId,
            pid: message.pid,
            profile: message.profile
          });
        }
        
        // Store and emit all events
        this.events.push({
          sessionId,
          message,
          timestamp: Date.now()
        });
        
        this.emit('message', {
          sessionId,
          message
        });
        
        // Emit specific event types
        if (message.type) {
          this.emit(`event:${message.type}`, {
            sessionId,
            message
          });
        }
      } catch (error) {
        this.emit('parse-error', { error, data });
      }
    });
    
    ws.on('close', () => {
      if (sessionId) {
        this.clients.delete(sessionId);
        this.emit('client-disconnected', sessionId);
      }
    });
    
    ws.on('error', (error) => {
      this.emit('client-error', { sessionId, error });
    });
  }

  getEvents(filter = {}) {
    let filtered = [...this.events];
    
    if (filter.type) {
      filtered = filtered.filter(e => e.message.type === filter.type);
    }
    
    if (filter.sessionId) {
      filtered = filtered.filter(e => e.sessionId === filter.sessionId);
    }
    
    if (filter.since) {
      filtered = filtered.filter(e => e.timestamp > filter.since);
    }
    
    return filtered.map(e => e.message);
  }

  async waitForEvent(type, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(`event:${type}`, handler);
        reject(new Error(`Timeout waiting for event: ${type}`));
      }, timeout);
      
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data.message);
      };
      
      this.once(`event:${type}`, handler);
    });
  }

  async waitForClient(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('client-connected', handler);
        reject(new Error('Timeout waiting for client connection'));
      }, timeout);
      
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      
      this.once('client-connected', handler);
    });
  }

  sendToClient(sessionId, message) {
    const client = this.clients.get(sessionId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcast(message) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === 1) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        // Close all client connections
        this.clients.forEach(client => {
          if (client.ws) {
            client.ws.close();
          }
        });
        
        this.wss.close(() => {
          this.isListening = false;
          this.emit('stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  clearEvents() {
    this.events = [];
  }
}