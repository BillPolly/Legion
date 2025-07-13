#!/usr/bin/env node

import readline from 'readline';
import { Agent } from './Agent.js';
import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import { AgentWebSocketServer } from './websocket-server.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Silent console logger that captures output during initialization
 */
class SilentConsole {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
  }

  silence() {
    console.log = (...args) => this.logs.push(args);
    console.error = (...args) => this.errors.push(args);
    console.warn = (...args) => this.errors.push(args);
    console.info = (...args) => this.logs.push(args);
  }

  restore() {
    Object.assign(console, this.originalConsole);
  }
}

/**
 * Convert jsEnvoy tool to agent format
 */
function convertToolToAgentFormat(tool, moduleName) {
  const identifier = `${moduleName}_${tool.name}`;
  const abilities = [tool.description];
  const instructions = [`Use this tool to ${tool.description}`];
  
  // Get functions from tool - handle both singular and plural methods
  let functions = [];
  if (typeof tool.getAllToolDescriptions === 'function') {
    const toolDescs = tool.getAllToolDescriptions();
    functions = toolDescs.map(desc => ({
      name: desc.function.name,
      purpose: desc.function.description,
      arguments: Object.keys(desc.function.parameters.properties || {}),
      response: 'object'
    }));
  } else if (typeof tool.getToolDescription === 'function') {
    const toolDesc = tool.getToolDescription();
    functions = [{
      name: toolDesc.function.name,
      purpose: toolDesc.function.description,
      arguments: Object.keys(toolDesc.function.parameters.properties || {}),
      response: 'object'
    }];
  }
  
  // Create agent-compatible tool
  return {
    name: tool.name,
    identifier,
    abilities,
    instructions,
    functions,
    // Keep reference to original tool for execution
    invoke: tool.invoke?.bind(tool),
    safeInvoke: tool.safeInvoke?.bind(tool),
    setExecutingAgent: () => {} // Required by Agent
  };
}

/**
 * Load all tools generically using ModuleFactory
 */
async function loadTools(resourceManager, moduleFactory) {
  const tools = [];
  
  try {
    // Import all module classes from @jsenvoy/tools package
    const toolsPackage = await import('@jsenvoy/tools');
    
    // Get all module classes (they end with 'Module')
    const moduleClasses = Object.values(toolsPackage).filter(
      exportedItem => typeof exportedItem === 'function' && 
                      exportedItem.name && 
                      exportedItem.name.endsWith('Module')
    );
    
    console.log(`Found ${moduleClasses.length} module classes to load`);
    
    // Use ModuleFactory to create all modules generically
    for (const ModuleClass of moduleClasses) {
      try {
        console.log(`Loading module: ${ModuleClass.name}`);
        
        // Use ModuleFactory to create module with dependency injection
        const moduleInstance = moduleFactory.createModule(ModuleClass);
        
        // Get tools from the module
        const moduleTools = moduleInstance.getTools ? moduleInstance.getTools() : [];
        
        // Convert tools to agent format
        for (const tool of moduleTools) {
          const moduleName = ModuleClass.name.replace('Module', '').toLowerCase();
          tools.push(convertToolToAgentFormat(tool, moduleName));
        }
        
        console.log(`Loaded ${moduleTools.length} tools from ${ModuleClass.name}`);
        
      } catch (error) {
        console.warn(`Failed to load module ${ModuleClass.name}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Failed to load tools package:', error.message);
    console.error('Make sure @jsenvoy/tools is properly installed');
  }
  
  console.log(`Total tools loaded: ${tools.length}`);
  return tools;
}

/**
 * Initialize the agent and all dependencies
 */
async function initializeAgent() {
  // Silence console during initialization
  const silentConsole = new SilentConsole();
  silentConsole.silence();
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize(); // This loads .env file
    
    // Create module factory
    const moduleFactory = new ModuleFactory(resourceManager);
    
    // Register default resources for file operations
    resourceManager.register('basePath', process.cwd());
    resourceManager.register('encoding', 'utf8');
    resourceManager.register('createDirectories', true);
    resourceManager.register('permissions', 0o755);
    
    // Register GitHub resources (optional - will be ignored if not available)
    resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT || '');
    resourceManager.register('GITHUB_ORG', process.env.GITHUB_ORG || '');
    resourceManager.register('GITHUB_USER', process.env.GITHUB_USER || '');
    
    // Load tools
    const tools = await loadTools(resourceManager, moduleFactory);
    
    // Get API key from environment (ResourceManager loads .env)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      silentConsole.restore();
      console.error('Error: OPENAI_API_KEY not found in environment.');
      console.error('Please create a .env file in the project root with:');
      console.error('OPENAI_API_KEY=your-api-key-here');
      process.exit(1);
    }
    
    // Create agent configuration
    const config = {
      name: 'jsEnvoy Assistant',
      bio: 'A conversational AI assistant with access to various tools. I maintain context across messages and help with file operations, calculations, web tasks, and more. I respond naturally and wait for your next message.',
      tools,
      modelConfig: {
        provider: process.env.MODEL_PROVIDER || 'OPEN_AI',
        model: process.env.MODEL_NAME || 'gpt-4',
        apiKey: apiKey
      },
      showToolUsage: true,
      steps: [
        'Respond naturally to the user message',
        'Remember context from previous messages in our conversation',
        'Use tools when they would be helpful',
        'Keep responses conversational and friendly',
        'Always mark task_completed as true to continue the conversation'
      ],
      _debugMode: false
    };
    
    // Create agent
    const agent = new Agent(config);
    
    // Restore console
    silentConsole.restore();
    
    return { agent, toolCount: tools.length };
  } catch (error) {
    silentConsole.restore();
    throw error;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    server: false,
    port: 3001,
    host: 'localhost'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--server':
      case '-s':
        options.server = true;
        break;
      case '--port':
      case '-p':
        options.port = parseInt(args[++i]) || 3001;
        break;
      case '--host':
      case '-h':
        options.host = args[++i] || 'localhost';
        break;
      case '--help':
        console.log(`
jsEnvoy Agent CLI

Usage:
  node cli.js [options]

Options:
  --server, -s       Start in WebSocket server mode
  --port, -p <port>  WebSocket server port (default: 3001)
  --host, -h <host>  WebSocket server host (default: localhost)
  --help             Show this help message

Examples:
  node cli.js                    # Interactive CLI mode
  node cli.js --server           # WebSocket server mode
  node cli.js --server -p 8080   # WebSocket server on port 8080
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Start WebSocket server mode
 */
async function startServerMode(options) {
  console.log('Initializing jsEnvoy Agent for WebSocket server...');
  
  let agent, toolCount;
  try {
    const result = await initializeAgent();
    agent = result.agent;
    toolCount = result.toolCount;
  } catch (error) {
    console.error('Failed to initialize agent:', error.message);
    process.exit(1);
  }
  
  console.log(`Loaded ${toolCount} tools`);
  
  // Create and start WebSocket server
  const server = new AgentWebSocketServer(agent, {
    port: options.port,
    host: options.host
  });

  try {
    await server.start();
    console.log(`WebSocket server started on ${options.host}:${options.port}`);
    console.log('Agent ready to receive WebSocket connections');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down WebSocket server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down WebSocket server...');
      await server.stop();
      process.exit(0);
    });

    // Keep the process alive by waiting indefinitely
    await new Promise(() => {}); // Never resolves, keeps process running

  } catch (error) {
    console.error('Failed to start WebSocket server:', error.message);
    process.exit(1);
  }
}

/**
 * Start interactive CLI mode
 */
async function startInteractiveMode() {
  // Initialize everything before creating readline
  console.log('Initializing jsEnvoy Agent...');
  
  let agent, toolCount;
  try {
    const result = await initializeAgent();
    agent = result.agent;
    toolCount = result.toolCount;
  } catch (error) {
    console.error('Failed to initialize agent:', error.message);
    process.exit(1);
  }
  
  console.log(`\nLoaded ${toolCount} tools`);
  console.log('Agent ready! Type your message (or "exit" to quit)\n');
  
  // Only create readline after all initialization is complete
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    terminal: false  // Prevents double character echo issue
  });
  
  // Show initial prompt
  rl.prompt();
  
  // Handle user input
  rl.on('line', async (input) => {
    const trimmed = input.trim();
    
    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log('\nGoodbye!');
      rl.close();
      process.exit(0);
    }
    
    if (trimmed) {
      console.log(); // Empty line for spacing
      
      try {
        // Get response from agent
        const response = await agent.run(trimmed);
        
        // Print the response
        if (response && response.message) {
          console.log(response.message);
        } else if (typeof response === 'string') {
          console.log(response);
        } else {
          console.log(JSON.stringify(response));
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
      
      console.log(); // Empty line before next prompt
    }
    
    // Show next prompt
    rl.prompt();
  });
  
  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log('\n\nGoodbye!');
    process.exit(0);
  });
}

/**
 * Main CLI function
 */
async function main() {
  const options = parseArgs();
  
  if (options.server) {
    await startServerMode(options);
  } else {
    await startInteractiveMode();
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});