/**
 * @jest-environment node
 */

import { ToolHandler } from '../../handlers/ToolHandler.js';

// Simple mock SessionManager without jest
class MockSessionManager {
  constructor() {
    this.initializeCallCount = 0;
    this.endCallCount = 0;
    this.cleanupCallCount = 0;
  }
  
  async initializeSidewinderServer() {
    this.initializeCallCount++;
    return Promise.resolve();
  }
  
  async endAllSessions() {
    this.endCallCount++;
    return Promise.resolve();
  }
  
  async cleanupSidewinder() {
    this.cleanupCallCount++;
    return Promise.resolve();
  }
}

describe('ToolHandler', () => {
  let toolHandler;
  let sessionManager;
  
  beforeEach(() => {
    sessionManager = new MockSessionManager();
    toolHandler = new ToolHandler(sessionManager);
  });
  
  describe('initialization', () => {
    test('should create instance with session manager', () => {
      expect(toolHandler.sessionManager).toBe(sessionManager);
      expect(toolHandler.tools).toBeDefined();
      expect(toolHandler._sidewinderInitialized).toBe(false);
    });
    
    test('should get all tool definitions', () => {
      const tools = toolHandler.getAllTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check for core tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('start_app');
      expect(toolNames).toContain('query_logs');
      expect(toolNames).toContain('list_sessions');
      expect(toolNames).toContain('stop_app');
      expect(toolNames).toContain('take_screenshot');
    });
    
    test('should have proper tool definitions format', () => {
      const tools = toolHandler.getAllTools();
      
      for (const tool of tools) {
        expect(tool).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object)
        });
        
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });
  
  describe('tool execution', () => {
    test('should handle unknown tool', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
    });
    
    test('should initialize Sidewinder on first tool execution', async () => {
      expect(sessionManager.initializeCallCount).toBe(0);
      
      await toolHandler.executeTool('unknown_tool', {});
      
      expect(sessionManager.initializeCallCount).toBe(1);
      expect(toolHandler._sidewinderInitialized).toBe(true);
    });
  });
  
  describe('cleanup', () => {
    test('should cleanup resources', async () => {
      // Test that cleanup method exists and can be called without errors
      await expect(toolHandler.cleanup()).resolves.toBeUndefined();
      
      // Note: Actual cleanup verification requires integration testing
      // The unit test verifies the method can be called successfully
    });
  });
  
  describe('result formatting', () => {
    test('should format error results correctly', async () => {
      const result = await toolHandler.executeTool('unknown_tool', {});
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.any(String)
          })
        ]),
        isError: true
      });
    });
  });
});