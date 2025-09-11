import { WebSocket } from 'ws';

/**
 * Service for managing WebSocket connections
 */
class WebSocketService {
  constructor() {
    this.connections = new Set();
  }

  /**
   * Initialize WebSocket server
   * @param {Object} server - HTTP/HTTPS server instance
   */
  initialize(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      this.connections.add(ws);
      
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.connections.delete(ws);
      });
    });
  }

  /**
   * Handle incoming messages
   * @param {WebSocket} ws 
   * @param {string} message 
   */
  handleMessage(ws, message) {
    // Implement message handling logic
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} data 
   */
  broadcast(data) {
    this.connections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

export default WebSocketService;