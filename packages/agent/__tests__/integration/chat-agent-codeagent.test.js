/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { Agent } from '../../src/Agent.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock console to capture output during tests
const originalConsole = console;
const mockConsole = {
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {}
};

describe('Chat Agent with CodeAgent Integration Tests', () => {
  let agent;
  let resourceManager;
  let moduleFactory;
  
  const shouldRunTests = process.env.RUN_REAL_LLM_TESTS === 'true';
  
  beforeAll(async () => {
    if (!shouldRunTests) {
      return;
    }
    
    // Mock console during initialization
    Object.assign(console, mockConsole);
    
    try {
      // Initialize ResourceManager
      resourceManager = new ResourceManager();
      await resourceManager.initialize();
      
      // Create module factory
      moduleFactory = new ModuleFactory(resourceManager);
      
      // Register required resources
      resourceManager.register('basePath', process.cwd());
      resourceManager.register('encoding', 'utf8');
      resourceManager.register('createDirectories', true);
      resourceManager.register('permissions', 0o755);
      resourceManager.register('GITHUB_PAT', process.env.GITHUB_PAT || '');
      resourceManager.register('GITHUB_ORG', process.env.GITHUB_ORG || '');
      resourceManager.register('GITHUB_USER', process.env.GITHUB_USER || '');
      
      // Check for required API keys
      const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('Either OPENAI_API_KEY or ANTHROPIC_API_KEY is required for real LLM tests');
      }
      
      // Load tools (similar to CLI implementation)
      const tools = await loadTools(resourceManager, moduleFactory);
      
      // Create agent configuration
      const config = {
        name: 'jsEnvoy Assistant',
        bio: 'A conversational AI assistant with access to various tools including code generation capabilities. I can help with file operations, calculations, web tasks, and most importantly, I can generate complete applications with frontend, backend, tests, and documentation. I can also fix code errors and improve existing code. I maintain context across messages and respond naturally.',
        tools,
        modelConfig: {
          provider: process.env.MODEL_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai'),
          model: process.env.MODEL_NAME || (process.env.ANTHROPIC_API_KEY ? 'claude-3-sonnet-20240229' : 'gpt-4'),
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
      agent = new Agent(config);
      
      // Restore console
      Object.assign(console, originalConsole);
      
    } catch (error) {
      // Restore console on error
      Object.assign(console, originalConsole);
      throw error;
    }
  });

  /**
   * Load tools generically using ModuleFactory (same as CLI)
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
      
      // Use ModuleFactory to create all modules generically
      for (const ModuleClass of moduleClasses) {
        try {
          // Use ModuleFactory to create module with dependency injection
          const moduleInstance = moduleFactory.createModule(ModuleClass);
          
          // Get tools from the module
          const moduleTools = moduleInstance.getTools ? moduleInstance.getTools() : [];
          
          // Convert tools to agent format
          for (const tool of moduleTools) {
            const moduleName = ModuleClass.name.replace('Module', '').toLowerCase();
            tools.push(convertToolToAgentFormat(tool, moduleName));
          }
          
        } catch (error) {
          console.warn(`Failed to load module ${ModuleClass.name}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error('Failed to load tools package:', error.message);
    }
    
    // Try to load CodeAgent JSON module
    try {
      const codeAgentModulePath = path.join(__dirname, '../../../code-gen/code-agent/module.json');
      const codeAgentModule = await moduleFactory.createJsonModule(codeAgentModulePath);
      const codeAgentTools = await codeAgentModule.getTools();
      
      // Convert CodeAgent tools to agent format
      for (const tool of codeAgentTools) {
        tools.push(convertToolToAgentFormat(tool, 'codeagent'));
      }
      
    } catch (error) {
      console.warn('Failed to load CodeAgent module:', error.message);
    }
    
    return tools;
  }

  /**
   * Convert jsEnvoy tool to agent format (same as CLI)
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

  test('should recognize when to use code generation for web app request', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const userMessage = "Create a simple calculator web app with HTML, CSS, and JavaScript. It should have buttons for numbers 0-9, basic operations (+, -, *, /), equals, and clear. Make it look modern with a nice design.";
    
    console.log('🚀 Testing LLM recognition of code generation need...');
    console.log(`User message: "${userMessage}"`);
    
    const startTime = Date.now();
    const response = await agent.run(userMessage);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Agent response received in ${duration}ms`);
    
    // Verify response structure
    expect(response).toBeDefined();
    expect(typeof response.message).toBe('string');
    expect(response.message.length).toBeGreaterThan(0);
    
    // Check if the response indicates code generation activity
    const responseText = response.message.toLowerCase();
    const codeGenerationIndicators = [
      'html',
      'css',
      'javascript',
      'calculator',
      'web app',
      'create',
      'generate',
      'code',
      'file',
      'develop'
    ];
    
    const foundIndicators = codeGenerationIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(0);
    
    console.log(`📋 Response contained ${foundIndicators.length} code generation indicators: ${foundIndicators.join(', ')}`);
    console.log(`📝 Response preview: "${response.message.substring(0, 200)}..."`);
    
  }, 60000); // 60 second timeout

  test('should recognize when to use code generation for API request', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const userMessage = "I need a REST API for a todo list application. It should have endpoints for creating, reading, updating, and deleting todos. Use Node.js with Express and include proper error handling.";
    
    console.log('🚀 Testing LLM recognition of API development need...');
    console.log(`User message: "${userMessage}"`);
    
    const response = await agent.run(userMessage);
    
    expect(response).toBeDefined();
    expect(typeof response.message).toBe('string');
    
    // Check for API development indicators
    const responseText = response.message.toLowerCase();
    const apiIndicators = [
      'api',
      'rest',
      'endpoint',
      'express',
      'node',
      'server',
      'route',
      'crud',
      'todo',
      'create',
      'develop'
    ];
    
    const foundIndicators = apiIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(0);
    
    console.log(`📋 API response contained ${foundIndicators.length} development indicators: ${foundIndicators.join(', ')}`);
    
  }, 45000); // 45 second timeout

  test('should handle non-code requests appropriately', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const userMessage = "What's the weather like today? Can you tell me about the history of artificial intelligence?";
    
    console.log('🚀 Testing LLM handling of non-code request...');
    console.log(`User message: "${userMessage}"`);
    
    const response = await agent.run(userMessage);
    
    expect(response).toBeDefined();
    expect(typeof response.message).toBe('string');
    
    // Should respond naturally without trying to generate code
    const responseText = response.message.toLowerCase();
    const naturalResponseIndicators = [
      'weather',
      'artificial intelligence',
      'history',
      'help',
      'information',
      'tell',
      'explain'
    ];
    
    const foundIndicators = naturalResponseIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(0);
    
    console.log(`📋 Natural response contained ${foundIndicators.length} conversational indicators: ${foundIndicators.join(', ')}`);
    
  }, 30000); // 30 second timeout

  test('should handle code fixing requests', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const userMessage = "I have a JavaScript function that's not working correctly. It's supposed to calculate the factorial of a number but it's returning undefined. Can you help me fix it? The function is: function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1) }";
    
    console.log('🚀 Testing LLM recognition of code fixing need...');
    console.log(`User message: "${userMessage}"`);
    
    const response = await agent.run(userMessage);
    
    expect(response).toBeDefined();
    expect(typeof response.message).toBe('string');
    
    // Check for code fixing indicators
    const responseText = response.message.toLowerCase();
    const fixingIndicators = [
      'fix',
      'error',
      'function',
      'factorial',
      'javascript',
      'debug',
      'problem',
      'correct',
      'issue',
      'undefined'
    ];
    
    const foundIndicators = fixingIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(0);
    
    console.log(`📋 Code fixing response contained ${foundIndicators.length} debugging indicators: ${foundIndicators.join(', ')}`);
    
  }, 45000); // 45 second timeout

  test('should maintain conversation context across messages', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    console.log('🚀 Testing conversation context maintenance...');
    
    // First message
    const firstMessage = "Hi, I'm working on a React project and need some help.";
    console.log(`First message: "${firstMessage}"`);
    
    const firstResponse = await agent.run(firstMessage);
    expect(firstResponse).toBeDefined();
    expect(typeof firstResponse.message).toBe('string');
    
    // Second message referencing the first
    const secondMessage = "Can you help me create a component for that project?";
    console.log(`Second message: "${secondMessage}"`);
    
    const secondResponse = await agent.run(secondMessage);
    expect(secondResponse).toBeDefined();
    expect(typeof secondResponse.message).toBe('string');
    
    // Should reference React or project context
    const responseText = secondResponse.message.toLowerCase();
    const contextIndicators = [
      'react',
      'component',
      'project',
      'create',
      'help',
      'jsx',
      'frontend'
    ];
    
    const foundIndicators = contextIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(0);
    
    console.log(`📋 Context-aware response contained ${foundIndicators.length} relevant indicators: ${foundIndicators.join(', ')}`);
    console.log(`📝 First response: "${firstResponse.message.substring(0, 100)}..."`);
    console.log(`📝 Second response: "${secondResponse.message.substring(0, 100)}..."`);
    
  }, 60000); // 60 second timeout

  test('should handle complex multi-step development requests', async () => {
    if (!shouldRunTests) {
      console.log('Skipping real LLM test. Set RUN_REAL_LLM_TESTS=true to run.');
      return;
    }
    
    const userMessage = "I need to build a complete blog application with user authentication, post creation, commenting system, and admin dashboard. Use Node.js for backend, React for frontend, and MongoDB for database. Include proper testing and deployment configuration.";
    
    console.log('🚀 Testing complex multi-step development request...');
    console.log(`User message: "${userMessage}"`);
    
    const response = await agent.run(userMessage);
    
    expect(response).toBeDefined();
    expect(typeof response.message).toBe('string');
    
    // Check for comprehensive development indicators
    const responseText = response.message.toLowerCase();
    const complexIndicators = [
      'blog',
      'authentication',
      'backend',
      'frontend',
      'database',
      'mongodb',
      'react',
      'node',
      'testing',
      'deployment',
      'admin',
      'comment',
      'post',
      'application',
      'complete',
      'system'
    ];
    
    const foundIndicators = complexIndicators.filter(indicator => 
      responseText.includes(indicator)
    );
    
    expect(foundIndicators.length).toBeGreaterThan(3); // Should recognize multiple components
    
    console.log(`📋 Complex development response contained ${foundIndicators.length} technical indicators: ${foundIndicators.join(', ')}`);
    
  }, 90000); // 90 second timeout for complex requests
});