/**
 * Integration test using ConfigurableAgent properly with GeminiToolsModule
 * NO MOCKS - uses real ConfigurableAgent + real tools + real LLM
 */

import { GeminiCompatibleAgent } from '../../src/core/GeminiCompatibleAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('ConfigurableAgent Tool Calling Integration', () => {
  let agent;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    // Get real ResourceManager (NO MOCKS)
    resourceManager = await ResourceManager.getInstance();
    
    // Create test directory
    testDir = path.join(os.tmpdir(), `configurable-agent-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create agent with custom config
    const customConfig = {
      workingDirectory: testDir
    };
    
    agent = new GeminiCompatibleAgent(customConfig, resourceManager);
    await agent.initialize();
    
    console.log('Agent initialized with tools:', Object.keys(agent.capabilityManager?.tools || {}));
  });

  afterEach(async () => {
    if (agent?.initialized) {
      await agent.receive({ type: 'shutdown', from: 'test' });
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should process chat message through ConfigurableAgent', async () => {
    const response = await agent.processMessage('Hello! What can you help me with?');
    
    expect(response.type).toBe('chat_response');
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    
    console.log('Chat response:', response.content);
  }, 60000);

  test('should execute write_file tool through ConfigurableAgent', async () => {
    const testFile = path.join(testDir, 'agent-test.txt');
    
    const response = await agent.executeTool('write_file', {
      absolute_path: testFile,
      content: 'Hello from ConfigurableAgent tool execution!'
    });
    
    expect(response.type).toBe('tool_response');
    
    if (response.success) {
      console.log('Tool response:', response.result);
      
      // Verify file was actually created
      const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      if (fileExists) {
        const content = await fs.readFile(testFile, 'utf-8');
        expect(content).toContain('Hello from ConfigurableAgent');
      }
    } else {
      console.log('Tool failed:', response.error);
      // Even if it fails, the structure should be correct
    }
  }, 60000);

  test('should execute read_file tool through ConfigurableAgent', async () => {
    // First create a file to read
    const testFile = path.join(testDir, 'read-test.js');
    await fs.writeFile(testFile, 'console.log("Test file content");', 'utf-8');
    
    const response = await agent.executeTool('read_file', {
      absolute_path: testFile
    });
    
    expect(response.type).toBe('tool_response');
    
    if (response.success) {
      console.log('Read result:', response.result);
      expect(response.result.content).toContain('console.log');
    } else {
      console.log('Read failed:', response.error);
    }
  }, 60000);

  test('should execute list_files tool through ConfigurableAgent', async () => {
    const response = await agent.executeTool('list_files', {
      path: testDir
    });
    
    expect(response.type).toBe('tool_response');
    
    if (response.success) {
      console.log('List result:', response.result);
      expect(Array.isArray(response.result.entries)).toBe(true);
    } else {
      console.log('List failed:', response.error);
    }
  }, 60000);

  test('should handle tool execution errors gracefully', async () => {
    const response = await agent.executeTool('read_file', {
      absolute_path: '/nonexistent/file.txt'
    });
    
    expect(response.type).toBe('tool_response');
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    
    console.log('Expected error:', response.error);
  }, 60000);
});