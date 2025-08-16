#!/usr/bin/env node

import { SimpleSessionManager } from './handlers/SimpleSessionManager.js';
import { SimpleToolHandler } from './handlers/SimpleToolHandler.js';
import { findAvailablePortSync } from './utils/portFinder.js';
import FileLogger from './logger.js';
import { getResourceManager } from '../../resource-manager/src/index.js';
import MongoQueryModule from '../../mongo-query/src/index.js';

class MCPServer {
  constructor() {
    // Find available port first
    this.wsAgentPort = findAvailablePortSync(9901);
    
    // Initialize logger with port
    this.logger = new FileLogger(this.wsAgentPort);
    
    // Pass port to session manager
    this.sessionManager = new SimpleSessionManager(this.wsAgentPort);
    
    // Initialize tool handler first
    this.toolHandler = new SimpleToolHandler(this.sessionManager, this.logger);
    
    // Log startup info
    this.logger.info(`MCP Server starting with WebSocket port: ${this.wsAgentPort}`);
    
    // Track if MongoDB is initialized
    this.mongoInitialized = false;
    
    // Create the monitor ONCE at startup
    this.initializeMonitor();
    
    // Initialize MongoDB in the background
    this.initializeMongoDB().then(() => {
      this.mongoInitialized = true;
      this.logger.info('MongoDB initialization completed, tool should be available');
    }).catch(err => {
      this.logger.error('MongoDB initialization failed', { error: err.message });
    });
  }
  
  async initializeMonitor() {
    try {
      // Create the single monitor instance for this MCP server
      const monitor = await this.sessionManager.getMonitor('mcp-server');
      this.logger.info(`Monitor initialized with WebSocket port: ${this.wsAgentPort}`);
    } catch (error) {
      this.logger.error('Failed to initialize monitor', { 
        error: error.message, 
        stack: error.stack 
      });
    }
  }
  
  async initializeMongoDB() {
    try {
      this.logger.info('Starting MongoDB module initialization...');
      
      // Initialize MongoDB Query Module
      const resourceManager = await getResourceManager();
      this.logger.info('ResourceManager obtained');
      
      // Check if MongoDB URL exists
      const mongoUrl = resourceManager.get('env.MONGODB_URL');
      if (!mongoUrl) {
        this.logger.warn('MONGODB_URL not found in environment - MongoDB tool will not be available');
        return;
      }
      
      this.mongoModule = await MongoQueryModule.create(resourceManager);
      this.logger.info('MongoDB module created');
      
      this.mongoTool = this.mongoModule.getTool('mongo_query');
      this.logger.info('MongoDB tool retrieved from module', { toolName: this.mongoTool?.name });
      
      // Update tool handler with mongo tool using setter
      this.toolHandler.setMongoTool(this.mongoTool);
      
      this.logger.info('MongoDB Query Module initialized successfully - db_query tool available');
    } catch (error) {
      this.logger.error('Failed to initialize MongoDB module', { 
        error: error.message, 
        stack: error.stack 
      });
      // Don't crash the server if MongoDB fails
      this.logger.warn('MongoDB tool will not be available');
    }
  }
  
  async start() {
    process.stdin.setEncoding('utf8');
    process.stdout.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim()).catch(console.error);
        }
      }
    });
    
    process.stdin.on('end', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
  }
  
  async handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);
      this.logger.info(`Received message: ${message.method || 'unknown'}`, { 
        method: message.method, 
        params: message.params 
      });
      
      const response = await this.processMessage(message);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
        this.logger.debug('Sent response', { 
          method: message.method,
          hasResult: !!response.result,
          hasError: !!response.error 
        });
      }
    } catch (error) {
      this.logger.error('Error handling message', { 
        error: error.message, 
        stack: error.stack,
        message: messageStr 
      });
      
      try {
        const parsed = JSON.parse(messageStr);
        if (parsed.id) {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: parsed.id,
            error: { code: -32603, message: error.message }
          }) + '\n');
        }
      } catch (parseError) {
        this.logger.error('Failed to parse message for error response', { 
          error: parseError.message 
        });
      }
    }
  }
  
  async processMessage(message) {
    const { jsonrpc, id, method, params } = message;
    
    if (jsonrpc !== '2.0') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    }
    
    let result;
    
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, logging: {}, prompts: {} },
          serverInfo: { name: 'fullstack-monitor', version: '1.0.0' }
        };
        break;
        
      case 'tools/list':
        result = { tools: this.toolHandler.getAllTools() };
        break;
        
      case 'tools/call':
        result = await this.toolHandler.executeTool(params.name, params.arguments || {});
        break;
        
      case 'notifications/initialized':
        return null;
        
      case 'ping':
        result = { status: 'pong' };
        break;
        
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
    }
    
    return { jsonrpc: '2.0', id, result };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  
  // Handle clean shutdown
  process.on('SIGINT', () => {
    server.logger.info('MCP Server received SIGINT');
    server.logger.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    server.logger.info('MCP Server received SIGTERM');
    server.logger.close();
    process.exit(0);
  });
  
  process.on('uncaughtException', (err) => {
    server.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    server.logger.close();
    process.exit(1);
  });
  
  server.start();
}