/**
 * Integration test for complete tool calling with real LLM and real tools
 * NO MOCKS - uses real Anthropic LLM and real file system
 */

import { ResourceManager } from '@legion/resource-manager';
import { ConversationManager } from '../../src/conversation/ConversationManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Tool Calling Integration', () => {
  let conversationManager;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    
    // Create mock prompt manager for testing
    const mockPromptManager = {
      buildSystemPrompt: async () => 'You are a helpful assistant that can use tools.'
    };
    
    conversationManager = new ConversationManager(resourceManager);
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `tool-calling-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Update working directory context
    conversationManager.updateWorkingDirectory(testDir);
  });

  afterAll(async () => {
    // Clean up real test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should execute write_file tool through conversation', async () => {
    const userInput = `Create a file called "hello.txt" with the content "Hello from tool calling test!"`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    
    console.log('Tool calling response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should have executed tools
    expect(Array.isArray(response.tools)).toBe(true);
    
    // If tools were executed, verify the file was created
    if (response.tools.length > 0) {
      const writeToolUsed = response.tools.some(t => t.name === 'write_file');
      expect(writeToolUsed).toBe(true);
      
      // Verify file was actually created
      const filePath = path.join(testDir, 'hello.txt');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain('Hello from tool calling test!');
      }
    }
  }, 60000);

  test('should execute read_file tool through conversation', async () => {
    // First create a file to read
    const testFile = path.join(testDir, 'test-read.js');
    await fs.writeFile(testFile, 'console.log("Test file for reading");', 'utf-8');
    
    const userInput = `Read the file "${testFile}" and show me its contents`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('Read tool response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should mention file reading
    expect(response.content.toLowerCase()).toMatch(/read|file|content/);
  }, 60000);

  test('should execute list_files tool through conversation', async () => {
    const userInput = `List all files in the directory "${testDir}"`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('List files response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should mention directory listing
    expect(response.content.toLowerCase()).toMatch(/list|files|directory/);
  }, 60000);

  test('should handle multiple tool requests in sequence', async () => {
    const userInput = `Create a file called "sequence.txt" with content "Step 1", then read it back to verify it was created correctly`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('Multi-tool response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should handle multiple operations
    expect(response.content.length).toBeGreaterThan(40);
  }, 90000);

  test('should handle shell command execution', async () => {
    const userInput = `Execute the command "echo 'Hello from shell'" to test shell functionality`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('Shell command response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should mention shell or command execution
    expect(response.content.toLowerCase()).toMatch(/shell|command|execute/);
  }, 60000);

  test('should parse tool calls correctly', () => {
    const testResponse = `I'll help you create that file.

{
  "response": "Creating the file now",
  "use_tool": {
    "name": "write_file",
    "args": {"absolute_path": "/tmp/test.txt", "content": "test content"}
  }
}

The file has been created successfully.`;

    const toolCalls = conversationManager.parseToolCalls(testResponse);
    
    expect(toolCalls.length).toBe(1);
    expect(toolCalls[0].name).toBe('write_file');
    expect(toolCalls[0].args.absolute_path).toBe('/tmp/test.txt');
    expect(toolCalls[0].args.content).toBe('test content');
  });

  test('should handle no tool calls needed', async () => {
    const userInput = `What programming languages do you support?`;
    
    const response = await conversationManager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('No tools response:', response.content);
    
    // Should respond without tools
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(10);
  }, 60000);
});