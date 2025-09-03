/**
 * Integration test for /show command with real actor communication
 * Tests complete flow from chat input to resource handle creation
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Show Command Integration - NO MOCKS', () => {
  let testDir;
  let testFile;
  let clientActor;
  let serverActor; 
  let chatActor;
  let slashAgent;
  let resourceEvents;
  
  beforeEach(async () => {
    // Create real test file
    testDir = path.join(__dirname, '../../tmp/show-command-tests');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test-show-file.txt');
    await fs.writeFile(testFile, 'This is a test file for /show command', 'utf8');
    
    // Track resource events
    resourceEvents = [];
    
    // Import real actors
    const { ResourceClientSubActor } = await import('../../../src/client/actors/ResourceClientSubActor.js');
    const ResourceServerSubActor = (await import('../../../src/server/actors/ResourceServerSubActor.js')).default;
    const SlashCommandAgentModule = await import('../../../src/server/actors/tool-agent/SlashCommandAgent.js');
    const SlashCommandAgent = SlashCommandAgentModule.SlashCommandAgent;
    
    // Create resource actors with real file system
    clientActor = new ResourceClientSubActor();
    serverActor = new ResourceServerSubActor({ 
      fileSystem: null // Will use built-in real fs
    });
    
    // Set up bidirectional communication
    await serverActor.setRemoteActor(clientActor);
    await clientActor.setRemoteActor(serverActor);
    
    // Mock parent to capture resource:ready events
    const mockParent = {
      receive: (messageType, data) => {
        resourceEvents.push({ messageType, data });
        console.log('📨 Parent received:', messageType, 'for', data.path);
      }
    };
    clientActor.setParentActor(mockParent);
    
    // Create slash command agent with resource actor reference
    const mockToolRegistry = { listTools: jest.fn(() => []) };
    const mockLLMClient = { chat: jest.fn() };
    
    slashAgent = new SlashCommandAgent(mockToolRegistry, mockLLMClient);
    slashAgent.setResourceActor(serverActor);
  });
  
  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('/show Command Execution', () => {
    test('should process /show command and create resource handle', async () => {
      // Execute /show command through slash agent
      const mockChatAgent = { context: {}, chatHistory: [] };
      const result = await slashAgent.processSlashCommand(`/show ${testFile}`, mockChatAgent);
      
      // Should return success message
      expect(result.success).toBe(true);
      expect(result.text).toContain('Opening test-show-file.txt');
      
      // Wait for async resource creation
      await new Promise(resolve => setTimeout(resolve, 30));
      
      // Should have triggered resource:ready event
      expect(resourceEvents.length).toBe(1);
      expect(resourceEvents[0].messageType).toBe('resource:ready');
      expect(resourceEvents[0].data.path).toBe(testFile);
      expect(resourceEvents[0].data.handle.__isResourceHandle).toBe(true);
      
      // Transparent handle should work
      const handle = resourceEvents[0].data.handle;
      const content = await handle.read();
      expect(content).toBe('This is a test file for /show command');
    });

    test('should handle different file types correctly', async () => {
      // Create image file
      const imagePath = path.join(testDir, 'test.png');
      await fs.writeFile(imagePath, Buffer.from([137, 80, 78, 71])); // PNG header
      
      const mockChatAgent = { context: {}, chatHistory: [] };
      const result = await slashAgent.processSlashCommand(`/show ${imagePath}`, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('image viewer');
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const imageEvent = resourceEvents.find(e => e.data.path === imagePath);
      expect(imageEvent).toBeDefined();
      expect(imageEvent.data.handle.__resourceType).toBe('ImageHandle');
    });

    test('should handle directory paths', async () => {
      const dirPath = path.join(testDir, 'subdir');
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(path.join(dirPath, 'file-in-dir.txt'), 'content', 'utf8');
      
      const mockChatAgent = { context: {}, chatHistory: [] };
      const result = await slashAgent.processSlashCommand(`/show ${dirPath}`, mockChatAgent);
      
      expect(result.success).toBe(true);
      expect(result.text).toContain('directory viewer');
      
      await new Promise(resolve => setTimeout(resolve, 30));
      
      const dirEvent = resourceEvents.find(e => e.data.path === dirPath);
      expect(dirEvent).toBeDefined();
      expect(dirEvent.data.handle.__resourceType).toBe('DirectoryHandle');
      
      // Test directory listing
      const contents = await dirEvent.data.handle.list();
      expect(contents).toContain('file-in-dir.txt');
    });
  });

  describe('Error Handling - FAIL FAST', () => {
    test('should fail fast for missing resource actor', async () => {
      // Import inside test to avoid scope issues
      const SlashCommandAgentModule = await import('../../../src/server/actors/tool-agent/SlashCommandAgent.js');
      const SlashCommandAgent = SlashCommandAgentModule.SlashCommandAgent;
      
      // Create agent without resource actor
      const agentWithoutResource = new SlashCommandAgent({}, {});
      // Don't set resource actor
      
      const mockChatAgent = { context: {}, chatHistory: [] };
      
      const result = await agentWithoutResource.processSlashCommand('/show test.txt', mockChatAgent);
      expect(result.success).toBe(false);
      expect(result.text).toContain('resource actor - not available');
    });

    test('should fail fast for missing path argument', async () => {
      const mockChatAgent = { context: {}, chatHistory: [] };
      
      // This returns validation error, doesn't throw
      const result = await slashAgent.processSlashCommand('/show', mockChatAgent);
      expect(result.success).toBe(false);
      expect(result.text).toContain('Missing required arguments');
    });
  });
});