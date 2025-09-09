#!/usr/bin/env node

import { SimpleSessionManager } from './handlers/SimpleSessionManager.js';
import { SimpleToolHandler } from './handlers/SimpleToolHandler.js';
import { findAvailablePortSync } from './utils/portFinder.js';
import FileLogger from './logger.js';
import { getResourceManager } from '../../resource-manager/src/index.js';
import { PictureAnalysisModule } from '../../modules/picture-analysis/src/index.js';

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
    
    // Track if tools are initialized
    this.pictureAnalysisInitialized = false;
    
    // Create the monitor ONCE at startup
    this.initializeMonitor();
    
    // Initialize Picture Analysis in the background
    this.initializePictureAnalysis().then(() => {
      this.pictureAnalysisInitialized = true;
      this.logger.info('Picture Analysis initialization completed, tool should be available');
    }).catch(err => {
      this.logger.error('Picture Analysis initialization failed', { error: err.message });
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
  
  
  async initializePictureAnalysis() {
    try {
      this.logger.info('Starting Picture Analysis module initialization...');
      
      // Initialize Picture Analysis Module
      const resourceManager = await getResourceManager();
      this.logger.info('ResourceManager obtained for Picture Analysis');
      
      // Check if we have an API key for vision (Anthropic or OpenAI)
      const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
      const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
      
      if (!anthropicKey && !openaiKey) {
        this.logger.warn('No vision API keys found (ANTHROPIC_API_KEY or OPENAI_API_KEY) - Picture Analysis tool will not be available');
        return;
      }
      
      // Determine which provider to use
      const provider = anthropicKey ? 'anthropic' : 'openai';
      const model = anthropicKey ? 'claude-3-5-sonnet-20241022' : 'gpt-4o';
      
      this.pictureAnalysisModule = await PictureAnalysisModule.create(resourceManager, { provider, model });
      this.logger.info(`Picture Analysis module created with ${provider} provider`);
      
      this.pictureAnalysisTool = this.pictureAnalysisModule.getTool('analyse_picture');
      this.logger.info('Picture Analysis tool retrieved from module', { toolName: this.pictureAnalysisTool?.name });
      
      // Update tool handler with picture analysis tool using setter
      this.toolHandler.setPictureAnalysisTool(this.pictureAnalysisTool);
      
      this.logger.info('Picture Analysis Module initialized successfully - analyse_picture tool available');
    } catch (error) {
      this.logger.error('Failed to initialize Picture Analysis module', { 
        error: error.message, 
        stack: error.stack 
      });
      // Don't crash the server if Picture Analysis fails
      this.logger.warn('Picture Analysis tool will not be available');
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