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
    setExecutingAgent: (agent) => {
      if (typeof tool.setExecutingAgent === 'function') {
        tool.setExecutingAgent(agent);
      }
    }
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
          // Skip modules that fail to load
          console.error(`Failed to load module ${entry.name}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error loading tools:', error);
  }
  
  return tools;
}

/**
 * Main CLI function
 */
async function main() {
  process.stdout.write('Initializing jsEnvoy Agent...\n\n');
  
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
  process.stdout.write(`Loaded ${tools.length} tools\n\n`);
  
  // Get API key from environment (ResourceManager loads .env)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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
    // Don't include responseStructure to keep responses conversational
    _debugMode: false
  };
  
  // Create agent
  const agent = new Agent(config);
  
  // Create readline interface with proper terminal settings
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\n> ',
    terminal: true,
    historySize: 100
  });
  
  process.stdout.write('Agent ready! Type your message (or "exit" to quit)\n');
  
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
      // Pause readline while processing
      rl.pause();
      
      // Show a simple processing indicator without spinner
      process.stdout.write('\nThinking...\r');
      
      try {
        // Get response from agent but don't let it complete the conversation
        const response = await agent.run(trimmed);
        
        // Clear the "Thinking..." message
        process.stdout.write('\x1b[2K\r');
        
        // Print the response
        if (response && response.message) {
          console.log(response.message);
        } else if (typeof response === 'string') {
          console.log(response);
        } else {
          console.log(JSON.stringify(response));
        }
        
        // Keep the conversation going by not marking the overall session as complete
        // The agent maintains conversation history internally
      } catch (error) {
        // Clear the "Thinking..." message
        process.stdout.write('\x1b[2K\r');
        console.error('Error:', error.message);
        if (agent._debugMode) {
          console.error(error.stack);
        }
      }
      
      // Resume readline
      rl.resume();
    }
    
    // Always prompt for the next input
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