import { WebSocketServer } from 'ws';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WebSocket server for the Agent
 * Provides non-blocking API for agent interaction
 */
export class AgentWebSocketServer {
  constructor(agent, options = {}) {
    this.agent = agent;
    this.port = options.port || 3001;
    this.host = options.host || 'localhost';
    this.pidFile = options.pidFile || path.join(__dirname, '..', '.agent.pid');
    this.server = null;
    this.wss = null;
    
    // Track active conversations
    this.conversations = new Map();
    this.messageId = 0;
    
    // Track clients for event streaming
    this.eventClients = new Set();
    
    // Set up agent event listeners for streaming
    this.setupAgentEventListeners();
  }

  /**
   * Start the WebSocket server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ 
          port: this.port, 
          host: this.host 
        });

        this.wss.on('connection', (ws) => {
          console.log(`[${new Date().toISOString()}] Client connected`);
          
          ws.on('message', async (data) => {
            try {
              const message = JSON.parse(data.toString());
              await this.handleMessage(ws, message);
            } catch (error) {
              console.error('Error processing message:', error);
              this.sendError(ws, 'Invalid message format', error.message);
            }
          });

          ws.on('close', () => {
            console.log(`[${new Date().toISOString()}] Client disconnected`);
            this.eventClients.delete(ws);
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.eventClients.delete(ws);
          });
        });

        this.wss.on('listening', async () => {
          console.log(`Agent WebSocket server listening on ${this.host}:${this.port}`);
          
          // Write PID file
          await this.writePidFile();
          
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          console.log('Agent WebSocket server stopped');
          this.wss = null;
          this.removePidFile();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(ws, message) {
    const { id, type, content, image, conversationId } = message;
    
    if (!id) {
      return this.sendError(ws, 'Missing message ID');
    }

    // Handle event subscription
    if (type === 'subscribe-events') {
      this.eventClients.add(ws);
      return this.sendResponse(ws, {
        id,
        success: true,
        message: 'Successfully subscribed to events',
        timestamp: new Date().toISOString()
      });
    }

    // Handle event unsubscription
    if (type === 'unsubscribe-events') {
      this.eventClients.delete(ws);
      return this.sendResponse(ws, {
        id,
        success: true,
        message: 'Successfully unsubscribed from events',
        timestamp: new Date().toISOString()
      });
    }

    if (type !== 'message') {
      return this.sendError(ws, 'Unsupported message type', null, id);
    }

    if (!content) {
      return this.sendError(ws, 'Missing message content', null, id);
    }

    try {
      console.log(`[${new Date().toISOString()}] Processing message: ${content.substring(0, 100)}...`);
      
      // Use the single agent instance for all messages (testing mode)
      console.log('Calling agent.run...');
      const response = await this.agent.run(content, image);
      console.log('Agent.run completed, response:', response);
      
      // Send response back
      this.sendResponse(ws, {
        id,
        success: true,
        response: response?.message || response || 'No response',
        conversationId: conversationId || 'default',
        timestamp: new Date().toISOString()
      });
      console.log('Response sent');

    } catch (error) {
      console.error('Error processing agent request:', error);
      this.sendError(ws, 'Agent processing error', error.message, id);
    }
  }

  /**
   * Send successful response
   */
  sendResponse(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending response:', error);
    }
  }

  /**
   * Send error response
   */
  sendError(ws, message, details = null, id = null) {
    try {
      ws.send(JSON.stringify({
        id,
        success: false,
        error: message,
        details,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending error response:', error);
    }
  }

  /**
   * Write PID file for process management
   */
  async writePidFile() {
    try {
      const pidData = {
        pid: process.pid,
        port: this.port,
        host: this.host,
        startTime: new Date().toISOString()
      };
      await writeFile(this.pidFile, JSON.stringify(pidData, null, 2));
    } catch (error) {
      console.warn('Could not write PID file:', error.message);
    }
  }

  /**
   * Remove PID file
   */
  async removePidFile() {
    try {
      await readFile(this.pidFile);
      // If file exists, try to remove it
      await unlink(this.pidFile);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Check if server is running by reading PID file
   */
  static async isRunning(pidFile) {
    try {
      const data = await readFile(pidFile || path.join(__dirname, '..', '.agent.pid'), 'utf8');
      const pidData = JSON.parse(data);
      
      // Check if process is still running
      try {
        process.kill(pidData.pid, 0); // Signal 0 just checks if process exists
        return pidData;
      } catch (error) {
        // Process not running
        return null;
      }
    } catch (error) {
      // PID file doesn't exist or is invalid
      return null;
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      running: this.wss !== null,
      port: this.port,
      host: this.host,
      connections: this.wss ? this.wss.clients.size : 0,
      conversations: this.conversations.size,
      eventClients: this.eventClients.size
    };
  }

  /**
   * Set up agent event listeners for streaming
   */
  setupAgentEventListeners() {
    if (!this.agent || typeof this.agent.on !== 'function') {
      return;
    }

    // Listen to module events from the agent
    this.agent.on('module-event', (event) => {
      this.broadcastEvent({
        type: 'module-event',
        ...event
      });
    });

    // Listen to specific module event types
    const eventTypes = ['progress', 'warning', 'error', 'info'];
    eventTypes.forEach(eventType => {
      this.agent.on(`module-${eventType}`, (event) => {
        this.broadcastEvent({
          type: `module-${eventType}`,
          ...event
        });
      });
    });
  }

  /**
   * Broadcast an event to all subscribed clients
   * @param {Object} event - Event object to broadcast
   */
  broadcastEvent(event) {
    if (this.eventClients.size === 0) {
      return;
    }

    const eventMessage = {
      type: 'event',
      event: event,
      timestamp: new Date().toISOString()
    };

    const eventString = JSON.stringify(eventMessage);
    
    // Send to all subscribed clients
    this.eventClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(eventString);
        } catch (error) {
          console.error('Error sending event to client:', error);
          this.eventClients.delete(ws);
        }
      } else {
        // Remove closed connections
        this.eventClients.delete(ws);
      }
    });
  }

  /**
   * Send a custom event to all subscribed clients
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  sendEvent(type, data) {
    this.broadcastEvent({
      type: type,
      data: data,
      source: 'websocket-server'
    });
  }
}

export default AgentWebSocketServer;