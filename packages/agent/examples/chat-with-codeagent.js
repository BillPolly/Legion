#!/usr/bin/env node

/**
 * Example script showing how to use the chat agent with CodeAgent tools
 * This demonstrates the full integration of code generation capabilities
 * with the conversational AI agent.
 */

import { Agent } from '../src/Agent.js';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
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
    // Import all module classes from @legion/tools package
    const toolsPackage = await import('@legion/tools');
    
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
    console.error('Make sure @legion/tools is properly installed');
  }
  
  // Try to load CodeAgent JSON module
  try {
    const codeAgentModulePath = path.join(__dirname, '../../code-gen/code-agent/module.json');
    console.log(`Loading CodeAgent module from: ${codeAgentModulePath}`);
    
    const codeAgentModule = await moduleFactory.createJsonModule(codeAgentModulePath);
    const codeAgentTools = await codeAgentModule.getTools();
    
    // Convert CodeAgent tools to agent format
    for (const tool of codeAgentTools) {
      tools.push(convertToolToAgentFormat(tool, 'codeagent'));
    }
    
    console.log(`Loaded ${codeAgentTools.length} tools from CodeAgent module`);
    
  } catch (error) {
    console.warn('Failed to load CodeAgent module:', error.message);
    console.warn('Code generation tools will not be available');
  }
  
  console.log(`Total tools loaded: ${tools.length}`);
  return tools;
}

/**
 * Initialize the agent with all tools including CodeAgent
 */
async function initializeAgent() {
  console.log('Initializing jsEnvoy Agent with CodeAgent integration...');
  
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
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY or ANTHROPIC_API_KEY not found in environment.');
    console.error('Please create a .env file in the project root with one of:');
    console.error('OPENAI_API_KEY=your-openai-key-here');
    console.error('ANTHROPIC_API_KEY=your-anthropic-key-here');
    process.exit(1);
  }
  
  // Determine provider and model
  const provider = process.env.MODEL_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai');
  const model = process.env.MODEL_NAME || (provider === 'anthropic' ? 'claude-3-sonnet-20240229' : 'gpt-4');
  
  // Create agent configuration
  const config = {
    name: 'jsEnvoy Assistant with CodeAgent',
    bio: 'A conversational AI assistant with access to various tools including powerful code generation capabilities. I can help with file operations, calculations, web tasks, and most importantly, I can generate complete applications with frontend, backend, tests, and documentation. I can also fix code errors and improve existing code. I maintain context across messages and respond naturally.',
    tools,
    modelConfig: {
      provider,
      model,
      apiKey: apiKey
    },
    showToolUsage: true,
    steps: [
      'Respond naturally to the user message',
      'Remember context from previous messages in our conversation',
      'Use tools when they would be helpful, especially code generation for development requests',
      'Keep responses conversational and friendly',
      'Always mark task_completed as true to continue the conversation'
    ],
    _debugMode: false
  };
  
  // Create agent
  const agent = new Agent(config);
  
  console.log(`Agent initialized with ${tools.length} tools and ${provider} provider`);
  console.log('Code generation capabilities are available through CodeAgent tools!');
  
  return agent;
}

/**
 * Run example interactions
 */
async function runExamples() {
  try {
    const agent = await initializeAgent();
    
    console.log('\n' + '='.repeat(70));
    console.log('jsEnvoy Agent with CodeAgent - Example Interactions');
    console.log('='.repeat(70));
    
    // Example 1: Simple web app creation
    console.log('\n🚀 Example 1: Creating a simple web application');
    console.log('User: "Create a simple calculator web app with HTML, CSS, and JavaScript"');
    console.log('Agent response:');
    console.log('-'.repeat(50));
    
    const response1 = await agent.run('Create a simple calculator web app with HTML, CSS, and JavaScript. It should have buttons for numbers 0-9, basic operations (+, -, *, /), equals, and clear. Make it look modern with a nice design.');
    console.log(response1.message);
    
    // Example 2: API development
    console.log('\n🚀 Example 2: REST API development');
    console.log('User: "I need a REST API for a todo list application"');
    console.log('Agent response:');
    console.log('-'.repeat(50));
    
    const response2 = await agent.run('I need a REST API for a todo list application. It should have endpoints for creating, reading, updating, and deleting todos. Use Node.js with Express and include proper error handling.');
    console.log(response2.message);
    
    // Example 3: Code fixing
    console.log('\n🚀 Example 3: Code debugging and fixing');
    console.log('User: "Fix this broken JavaScript function"');
    console.log('Agent response:');
    console.log('-'.repeat(50));
    
    const response3 = await agent.run('I have a JavaScript function that\'s not working correctly. It\'s supposed to calculate the factorial of a number but it\'s returning undefined. Can you help me fix it? The function is: function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1) }');
    console.log(response3.message);
    
    // Example 4: Complex application
    console.log('\n🚀 Example 4: Complex full-stack application');
    console.log('User: "Build a complete blog application"');
    console.log('Agent response:');
    console.log('-'.repeat(50));
    
    const response4 = await agent.run('I need to build a complete blog application with user authentication, post creation, commenting system, and admin dashboard. Use Node.js for backend, React for frontend, and MongoDB for database. Include proper testing and deployment configuration.');
    console.log(response4.message);
    
    console.log('\n' + '='.repeat(70));
    console.log('Examples completed! The agent can intelligently recognize when to use');
    console.log('code generation tools and respond appropriately to development requests.');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('Error running examples:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Interactive mode for testing
 */
async function runInteractive() {
  try {
    const agent = await initializeAgent();
    
    console.log('\n' + '='.repeat(70));
    console.log('jsEnvoy Agent with CodeAgent - Interactive Mode');
    console.log('='.repeat(70));
    console.log('Type your messages below. The agent has access to code generation tools!');
    console.log('Type "exit" to quit.\n');
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'You: '
    });
    
    rl.prompt();
    
    rl.on('line', async (input) => {
      const trimmed = input.trim();
      
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        process.exit(0);
      }
      
      if (trimmed) {
        console.log('\nAgent: ');
        
        try {
          const response = await agent.run(trimmed);
          console.log(response.message);
        } catch (error) {
          console.error('Error:', error.message);
        }
        
        console.log();
      }
      
      rl.prompt();
    });
    
    rl.on('SIGINT', () => {
      console.log('\n\nGoodbye!');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error in interactive mode:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Main function
 */
async function main() {
  const mode = process.argv[2] || 'examples';
  
  switch (mode) {
    case 'examples':
      await runExamples();
      break;
    case 'interactive':
      await runInteractive();
      break;
    default:
      console.log('Usage: node chat-with-codeagent.js [examples|interactive]');
      console.log('  examples    - Run predefined examples (default)');
      console.log('  interactive - Start interactive chat mode');
      break;
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { initializeAgent, loadTools, convertToolToAgentFormat };