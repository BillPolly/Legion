#!/usr/bin/env node

import readline from 'readline';
import { Agent } from './Agent.js';
import { ResourceManager, ModuleFactory } from '@jsenvoy/modules';
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
  
  // Get functions from tool
  let functions = [];
  if (typeof tool.getAllToolDescriptions === 'function') {
    const toolDescs = tool.getAllToolDescriptions();
    functions = toolDescs.map(desc => ({
      name: desc.function.name,
      purpose: desc.function.description,
      arguments: Object.keys(desc.function.parameters.properties || {}),
      response: 'object'
    }));
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
 * Load all tools from general-tools package
 */
async function loadTools(resourceManager, moduleFactory) {
  const tools = [];
  
  try {
    // Find tools package (in general-tools directory)
    const toolsPath = path.resolve(__dirname, '../../general-tools/src');
    const entries = await fs.readdir(toolsPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          // Try to import the module
          const modulePath = path.join(toolsPath, entry.name, 'index.js');
          const moduleExports = await import(`file://${modulePath}`);
          const ModuleClass = moduleExports.default;
          
          if (ModuleClass) {
            // Create instance with proper dependencies
            const instance = new ModuleClass({ resourceManager, moduleFactory });
            const moduleTools = instance.getTools ? instance.getTools() : [];
            
            // Convert each tool to agent format
            for (const tool of moduleTools) {
              tools.push(convertToolToAgentFormat(tool, entry.name));
            }
          }
        } catch (error) {
          // Skip modules that fail to load silently
        }
      }
    }
  } catch (error) {
    // Silently handle error
  }
  
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
    
    // Register default resources
    resourceManager.register('basePath', process.cwd());
    resourceManager.register('encoding', 'utf8');
    resourceManager.register('createDirectories', true);
    
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
 * Main CLI function
 */
async function main() {
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
    prompt: '> '
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

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});