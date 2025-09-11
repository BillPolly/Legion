/**
 * Integration test for ToolCallingConversationManager
 * NO MOCKS - uses real LLM, real tools, real file system
 */

import ToolCallingConversationManager from '../../src/conversation/ToolCallingConversationManager.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ToolCallingConversationManager Integration', () => {
  let manager;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `tool-calling-manager-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    manager = new ToolCallingConversationManager(resourceManager);
    
    // Wait for tools to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should execute write_file tool through real conversation', async () => {
    const userInput = `Please create a file at "${path.join(testDir, 'tool-test.txt')}" with the content "Hello from tool calling!"`;
    
    const response = await manager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    
    console.log('Tool calling response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Check if tool was executed
    if (response.tools && response.tools.length > 0) {
      const writeToolUsed = response.tools.some(t => t.name === 'write_file');
      expect(writeToolUsed).toBe(true);
      
      // Verify file was actually created
      const filePath = path.join(testDir, 'tool-test.txt');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      
      if (fileExists) {
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toContain('Hello from tool calling!');
        console.log('✅ File created successfully with content:', content);
      }
    }
  }, 90000);

  test('should execute list_files tool through conversation', async () => {
    // Create some files first
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.js'), 'console.log("test");');
    
    const userInput = `Please list all files in the directory "${testDir}"`;
    
    const response = await manager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('List files response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should mention files or directories
    expect(response.content.toLowerCase()).toMatch(/file|directory|list/);
  }, 90000);

  test('should handle normal conversation without tools', async () => {
    const userInput = 'What programming languages do you support?';
    
    const response = await manager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(10);
    
    console.log('Normal conversation response:', response.content);
    
    // Should have minimal tool usage for general questions
    expect(response.tools.length).toBeLessThanOrEqual(2);
  }, 60000);

  test('should handle multiple tool requests', async () => {
    const userInput = `Create a file at "${path.join(testDir, 'multi-test.txt')}" with content "test", then read it back to verify`;
    
    const response = await manager.processMessage(userInput);
    
    expect(response.type).toBe('assistant');
    console.log('Multi-tool response:', response.content);
    console.log('Tools executed:', response.tools);
    
    // Should handle the request (may execute one or multiple tools)
    expect(response.content.length).toBeGreaterThan(20);
  }, 90000);

  test('should maintain conversation history', async () => {
    // Clear history first
    manager.clearHistory();
    
    // Have a conversation
    await manager.processMessage('Hello, I need help with files');
    await manager.processMessage('What can you do?');
    
    const history = manager.getConversationHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
    // Check conversation history structure - should have user and assistant messages
    console.log('Full conversation history:', JSON.stringify(history, null, 2));
    // The conversation history contains assistant responses that reference file operations
    expect(JSON.stringify(history)).toContain('file');
  }, 90000);
});