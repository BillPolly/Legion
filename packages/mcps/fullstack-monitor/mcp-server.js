#!/usr/bin/env node

/**
 * MCP Server for FullStack Monitor
 * Provides MCP (Model Context Protocol) interface to fullstack monitoring capabilities
 */

import { SessionManager } from './handlers/SessionManager.js';
import { SimplifiedToolHandler } from './handlers/SimplifiedToolHandler.js';

class MCPFullStackMonitorServer {
  constructor() {
    this.sessionManager = new SessionManager();
    this.toolHandler = new SimplifiedToolHandler(this.sessionManager);
    
    // MCP Protocol state
    this.capabilities = {
      tools: {},
      logging: {},
      prompts: {}
    };
    
    // Setup cleanup
    this.setupCleanup();
  }
  
  /**
   * Start the MCP server
   */
  async start() {
    console.error('Starting FullStack Monitor MCP Server...');
    
    // Setup stdio for MCP communication
    process.stdin.setEncoding('utf8');
    process.stdout.setEncoding('utf8');
    
    // Handle incoming messages
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete messages (one per line)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim()).catch(error => {
            console.error('Error handling message:', error);
          });
        }
      }
    });
    
    process.stdin.on('end', () => {
      this.shutdown();
    });
    
    // Send server info on start
    console.error('MCP Server ready for connections');
  }
  
  /**
   * Handle incoming MCP message
   */
  async handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);
      const response = await this.processMessage(message);
      
      if (response) {
        this.sendMessage(response);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error response if we have an ID
      try {
        const parsed = JSON.parse(messageStr);
        if (parsed.id) {
          this.sendMessage({
            jsonrpc: '2.0',
            id: parsed.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: error.message
            }
          });
        }
      } catch (parseError) {
        // Can't send response without ID
        console.error('Could not parse message for error response');
      }
    }
  }
  
  /**
   * Process MCP message and return response
   */
  async processMessage(message) {
    const { jsonrpc, id, method, params } = message;
    
    if (jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }
    
    try {
      let result;
      
      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
          
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(params);
          break;
          
        case 'notifications/initialized':
          // No response needed for notifications
          return null;
          
        case 'ping':
          result = { status: 'pong' };
          break;
          
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found',
              data: method
            }
          };
      }
      
      return {
        jsonrpc: '2.0',
        id,
        result
      };
      
    } catch (error) {
      console.error(`Error in method ${method}:`, error);
      
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      };
    }
  }
  
  /**
   * Handle initialize request
   */
  async handleInitialize(params) {
    console.error('Client connecting:', params?.clientInfo?.name || 'Unknown');
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
      serverInfo: {
        name: 'fullstack-monitor',
        version: '1.0.0'
      }
    };
  }
  
  /**
   * Handle tools/list request
   */
  async handleToolsList() {
    const tools = this.toolHandler.getAllTools();
    console.error(`Listing ${tools.length} available tools`);
    
    return {
      tools
    };
  }
  
  /**
   * Handle tools/call request
   */
  async handleToolCall(params) {
    const { name, arguments: args } = params;
    console.error(`Executing tool: ${name}`);
    
    try {
      const result = await this.toolHandler.executeTool(name, args || {});
      return result;
      
    } catch (error) {
      console.error(`Tool execution failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send message to client
   */
  sendMessage(message) {
    const messageStr = JSON.stringify(message);
    process.stdout.write(messageStr + '\n');
  }
  
  /**
   * Setup cleanup handlers
   */
  setupCleanup() {
    const cleanup = async () => {
      console.error('Shutting down MCP server...');
      await this.sessionManager.endAllSessions();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('SIGQUIT', cleanup);
    
    // Cleanup idle sessions periodically
    setInterval(() => {
      this.sessionManager.cleanupInactiveSessions().catch(error => {
        console.error('Error cleaning up sessions:', error);
      });
    }, 10 * 60 * 1000); // Every 10 minutes
  }
  
  /**
   * Shutdown the server
   */
  async shutdown() {
    console.error('Client disconnected, shutting down...');
    await this.sessionManager.endAllSessions();
    process.exit(0);
  }
}

// Start the server
const server = new MCPFullStackMonitorServer();
server.start().catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});