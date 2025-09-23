#!/usr/bin/env node

// Imports MUST come first in ES modules
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { SimpleSessionManager } from './handlers/SimpleSessionManager.js';
import { SimpleToolHandler } from './handlers/SimpleToolHandler.js';
import { findAvailablePortSync } from './utils/portFinder.js';
import FileLogger from './logger.js';
// Import Legion modules conditionally

// Now setup paths AFTER imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to find Legion root by looking for package.json with "legion" workspace
function findLegionRoot(startDir) {
  let currentDir = startDir;
  
  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // Check if this is the Legion monorepo root
        if ((packageJson.name === '@legion/monorepo' || packageJson.name === 'legion') && packageJson.workspaces) {
          return currentDir;
        }
      } catch (e) {
        // Continue searching
      }
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  // Fallback to relative path if not found
  return path.resolve(__dirname, '../../..');
}

const LEGION_ROOT = findLegionRoot(__dirname);

// Set MONOREPO_ROOT environment variable for ResourceManager
process.env.MONOREPO_ROOT = LEGION_ROOT;

// Change directory to Legion root for module resolution
if (process.cwd() !== LEGION_ROOT) {
  console.error(`[MCP Server] Changing directory from ${process.cwd()} to ${LEGION_ROOT}`);
  process.chdir(LEGION_ROOT);
}

class MCPServer {
  constructor() {
    // CRITICAL: Redirect ALL stdout to stderr IMMEDIATELY
    // This prevents FullStackMonitor from contaminating MCP protocol
    const originalStdoutWrite = process.stdout.write;
    this.mcpStarted = false;
    
    process.stdout.write = (chunk, encoding, callback) => {
      if (this.mcpStarted) {
        // After MCP starts, allow JSON-RPC through
        return originalStdoutWrite.call(process.stdout, chunk, encoding, callback);
      } else {
        // Before MCP starts, redirect everything to stderr
        return process.stderr.write(chunk, encoding, callback);
      }
    };
    
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
    this.logger.info(`Current working directory: ${process.cwd()}`);
    
    // Track if tools are initialized
    this.pictureAnalysisInitialized = false;
    
    // Initialize monitor and picture analysis in the background
    // Don't await these in constructor - let them run async
    this.initializeMonitor().catch(err => {
      this.logger.error('Monitor initialization failed', { error: err.message });
    });
    
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
      
      // Try to import dependencies
      let getResourceManager, PictureAnalysisModule;
      try {
        const resourceManagerModule = await import('@legion/resource-manager');
        getResourceManager = resourceManagerModule.getResourceManager;
      } catch (e) {
        this.logger.warn('Picture Analysis disabled: @legion/resource-manager not available');
        return;
      }
      
      try {
        const pictureAnalysisModule = await import('@legion/picture-analysis');
        PictureAnalysisModule = pictureAnalysisModule.PictureAnalysisModule;
      } catch (e) {
        this.logger.warn('Picture Analysis disabled: @legion/picture-analysis not available');
        return;
      }
      
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
    try {
      // Redirect console.log to stderr so only MCP JSON-RPC goes to stdout
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        process.stderr.write(args.join(' ') + '\n');
      };
      
      process.stdin.setEncoding('utf8');
      process.stdout.setEncoding('utf8');
      
      this.logger.info('MCP Server started - PID: ' + process.pid);
      this.logger.info('Ready for MCP protocol communication');
      
      // Now it's safe to enable MCP protocol on stdout
      this.mcpStarted = true;
      
      let buffer = '';
      process.stdin.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(line.trim()).catch((error) => {
              this.logger.error('Error handling message', { error: error.message, stack: error.stack });
            });
          }
        }
      });
      
      process.stdin.on('end', () => {
        this.logger.info('stdin ended, shutting down');
        process.exit(0);
      });
      
      process.stdin.on('error', (error) => {
        this.logger.error('stdin error', { error: error.message });
      });
      
      // Keep the process alive
      process.stdin.resume();
      
    } catch (error) {
      this.logger.error('Error in start method', { error: error.message, stack: error.stack });
      throw error;
    }
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
  let server;
  
  async function startServer() {
    try {
      server = new MCPServer();
      
      // Handle clean shutdown
      process.on('SIGINT', () => {
        if (server?.logger) {
          server.logger.info('MCP Server received SIGINT');
          server.logger.close();
        }
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        if (server?.logger) {
          server.logger.info('MCP Server received SIGTERM');
          server.logger.close();
        }
        process.exit(0);
      });
      
      process.on('uncaughtException', (err) => {
        if (server?.logger) {
          server.logger.error('Uncaught exception', { error: err.message, stack: err.stack });
          server.logger.close();
        } else {
          console.error('Uncaught exception before logger ready:', err);
        }
        process.exit(1);
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        if (server?.logger) {
          server.logger.error('Unhandled rejection', { reason: reason?.message || reason, stack: reason?.stack });
        } else {
          console.error('Unhandled rejection before logger ready:', reason);
        }
        // Don't exit on unhandled rejection, just log it
      });
      
      // Wait a bit for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await server.start();
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  }
  
  startServer().catch(error => {
    console.error('Critical error starting server:', error);
    process.exit(1);
  });
}