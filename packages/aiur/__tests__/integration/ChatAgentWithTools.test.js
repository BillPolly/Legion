/**
 * Test ChatAgent with tool calling capabilities
 * This test verifies that ChatAgent can use tools to perform actions
 * like writing files
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import { ChatAgent } from '../../src/agents/ChatAgent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ChatAgent with Tools Test', () => {
  let resourceManager;
  let moduleLoader;
  let chatAgent;
  let receivedMessages = [];
  const testFile = path.join(__dirname, '../tmp/test-hello-world.txt');
  
  beforeAll(async () => {
    // Initialize ResourceManager - it will load .env automatically
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Initialize ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
    
    // Load the file module to provide tools
    const { default: FileModule } = await import('../../../general-tools/src/file/FileModule.js');
    await moduleLoader.loadModuleByName('file', FileModule);
    
    // Verify file module loaded
    const loadedModules = moduleLoader.getLoadedModuleNames();
    expect(loadedModules).toContain('file');
    
    // Verify we have file tools
    const tools = await moduleLoader.getAllTools();
    console.log('Loaded modules:', loadedModules);
    console.log('Available tools:', tools.map(t => t.name));
    
    // File module exposes a single multi-function tool called 'file_operations'
    const fileOperationsTool = tools.find(t => t.name === 'file_operations');
    expect(fileOperationsTool).toBeDefined();
  });
  
  afterAll(async () => {
    if (chatAgent) {
      chatAgent.destroy();
    }
    
    // Clean up test file
    try {
      await fs.unlink(testFile);
      console.log('Cleaned up test file');
    } catch (error) {
      // File might not exist
    }
  });
  
  it('should create ChatAgent with tools access', async () => {
    // Create ChatAgent with ResourceManager and ModuleLoader
    chatAgent = new ChatAgent({
      sessionId: 'test-session-tools',
      resourceManager: resourceManager,
      moduleLoader: moduleLoader,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022'
    });
    
    // Initialize the agent
    await chatAgent.initialize();
    
    expect(chatAgent).toBeDefined();
    expect(chatAgent.llmClient).toBeDefined();
    expect(chatAgent.moduleLoader).toBeDefined();
  });
  
  it('should list available tools', async () => {
    const tools = await chatAgent.getAvailableTools();
    
    expect(tools).toBeDefined();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
    
    // Check for file operations tool (multi-function tool)
    const fileOperationsTool = tools.find(t => t.name === 'file_operations');
    expect(fileOperationsTool).toBeDefined();
    expect(fileOperationsTool.description).toBeDefined();
    expect(fileOperationsTool.input_schema).toBeDefined();
    
    console.log(`ChatAgent has ${tools.length} tools available`);
    console.log('File operations tool:', fileOperationsTool);
  });
  
  it('should use tools to write "hello world" to a file', async () => {
    // Mock the emit function to capture responses
    chatAgent.emit = (eventName, data) => {
      console.log(`ChatAgent emitted: ${eventName}`, 
        eventName === 'tool_executed' ? data : data.content || data.type);
      receivedMessages.push({ event: eventName, data });
    };
    
    // Create tmp directory if it doesn't exist
    const tmpDir = path.dirname(testFile);
    try {
      await fs.mkdir(tmpDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Ask ChatAgent to write hello world to a file
    const prompt = `Please write the text "hello world" to a file at this path: ${testFile}
    Use the file_operations tool with operation: 'write' to do this. Just write exactly "hello world" with no additional text.`;
    
    await chatAgent.processMessage(prompt);
    
    // Check that tool was executed
    const toolExecuted = receivedMessages.find(m => m.event === 'tool_executed');
    expect(toolExecuted).toBeDefined();
    expect(toolExecuted.data.tool).toBe('file_operations');
    expect(toolExecuted.data.success).toBe(true);
    
    // Check we got a response
    const responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.data.type).toBe('chat_response');
    
    // Verify the file was actually created
    const fileContent = await fs.readFile(testFile, 'utf-8');
    expect(fileContent).toBe('hello world');
    
    console.log('File written successfully with content:', fileContent);
    console.log('ChatAgent response:', responseEvent.data.content);
  }, 60000); // 60 second timeout for tool execution
  
  it('should handle multiple tool calls in sequence', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    const testFile2 = path.join(__dirname, '../tmp/test-numbers.txt');
    
    // Ask to write to a different file
    const prompt = `Please do the following:
    1. Write "42" to the file: ${testFile2}
    2. Then read the file back and tell me what number is in it.
    Use the file_operations tool with operation: 'write' and then operation: 'read'.`;
    
    await chatAgent.processMessage(prompt);
    
    // Check that tools were executed
    const toolEvents = receivedMessages.filter(m => m.event === 'tool_executed');
    expect(toolEvents.length).toBeGreaterThanOrEqual(1); // At least write, possibly read too
    
    // Check the file was created
    const fileContent = await fs.readFile(testFile2, 'utf-8');
    expect(fileContent).toBe('42');
    
    // Check response mentions the number
    const responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.data.content).toContain('42');
    
    // Clean up
    await fs.unlink(testFile2);
    
    console.log('Multiple tools executed successfully');
  }, 60000);
});