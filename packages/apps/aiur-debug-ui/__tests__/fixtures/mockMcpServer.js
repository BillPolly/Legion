/**
 * Mock MCP server for testing
 */

import { WebSocketServer } from 'ws';

export class MockMcpServer {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.sessions = new Map();
    this.tools = options.tools || [
      {
        name: 'context_add',
        description: 'Add data to context',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            data: { type: 'object' }
          },
          required: ['name', 'data']
        }
      },
      {
        name: 'context_list',
        description: 'List context items',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
    
    this.responseDelay = options.responseDelay || 0;
    this.shouldFail = false;
    this.wss = null;
  }

  /**
   * Start the mock server
   * @returns {Promise<number>} Port number
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port });
      
      this.wss.on('connection', (ws) => {
        this.handleConnection(ws);
      });
      
      this.wss.on('listening', () => {
        this.port = this.wss.address().port;
        resolve(this.port);
      });
      
      this.wss.on('error', reject);
    });
  }

  /**
   * Stop the server
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss.close(resolve);
      });
    }
  }

  /**
   * Handle WebSocket connection
   * @param {WebSocket} ws - WebSocket connection
   */
  handleConnection(ws) {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      ws,
      context: new Map(),
      created: new Date()
    });
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message);
      } catch (error) {
        this.sendError(ws, null, 'Invalid message format');
      }
    });
    
    ws.on('close', () => {
      this.sessions.delete(sessionId);
    });
  }

  /**
   * Handle incoming message
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message object
   */
  async handleMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Add configurable delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }
    
    // Check if should fail
    if (this.shouldFail) {
      this.sendError(session.ws, message.id, 'Simulated error');
      return;
    }
    
    switch (message.method) {
      case 'tools/list':
        this.handleToolsList(session.ws, message);
        break;
        
      case 'tools/call':
        this.handleToolCall(session, message);
        break;
        
      case 'sessions/list':
        this.handleSessionsList(session.ws, message);
        break;
        
      default:
        this.sendError(session.ws, message.id, `Unknown method: ${message.method}`);
    }
  }

  /**
   * Handle tools/list request
   */
  handleToolsList(ws, message) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: this.tools
      }
    }));
  }

  /**
   * Handle tools/call request
   */
  handleToolCall(session, message) {
    const { name, arguments: args } = message.params;
    
    switch (name) {
      case 'context_add':
        session.context.set(args.name, args.data);
        this.sendToolResult(session.ws, message.id, {
          success: true,
          message: `Added ${args.name} to context`
        });
        break;
        
      case 'context_list':
        const items = Array.from(session.context.entries()).map(([name, data]) => ({
          name,
          data
        }));
        this.sendToolResult(session.ws, message.id, {
          success: true,
          items
        });
        break;
        
      default:
        this.sendError(session.ws, message.id, `Unknown tool: ${name}`);
    }
  }

  /**
   * Handle sessions/list request
   */
  handleSessionsList(ws, message) {
    const sessions = Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      created: session.created.toISOString()
    }));
    
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: { sessions }
    }));
  }

  /**
   * Send tool result
   */
  sendToolResult(ws, id, result) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      }
    }));
  }

  /**
   * Send error response
   */
  sendError(ws, id, message) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message
      }
    }));
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Simulate server failure
   */
  simulateFailure() {
    this.shouldFail = true;
  }

  /**
   * Resume normal operation
   */
  resumeNormal() {
    this.shouldFail = false;
  }

  /**
   * Set response delay
   * @param {number} delay - Delay in milliseconds
   */
  setResponseDelay(delay) {
    this.responseDelay = delay;
  }

  /**
   * Add custom tool
   * @param {Object} tool - Tool definition
   */
  addTool(tool) {
    this.tools.push(tool);
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object} Session data
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
}