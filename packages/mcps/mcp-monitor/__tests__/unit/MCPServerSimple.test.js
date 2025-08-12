/**
 * @jest-environment node
 */

// Simplified unit tests for MCP Server focusing on core functionality

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPFullStackMonitorServer } from '../../mcp-server.js';

describe('MCPFullStackMonitorServer - Core Functionality', () => {
  let server;
  
  beforeEach(() => {
    server = new MCPFullStackMonitorServer();
  });
  
  afterEach(async () => {
    if (server) {
      await server.sessionManager.endAllSessions();
    }
  });
  
  describe('Initialization', () => {
    it('should create server with required components', () => {
      expect(server.sessionManager).toBeDefined();
      expect(server.toolHandler).toBeDefined();
      expect(server.capabilities).toEqual({
        tools: {},
        logging: {},
        prompts: {}
      });
    });
  });
  
  describe('Message Processing', () => {
    it('should process initialize message', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: expect.any(Object),
          serverInfo: {
            name: 'fullstack-monitor',
            version: '1.0.0'
          }
        }
      });
    });
    
    it('should process tools/list message', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              description: expect.any(String)
            })
          ])
        }
      });
      
      // Check for specific tools
      const tools = response.result.tools;
      const toolNames = tools.map(t => t.name);
      
      expect(toolNames).toContain('start_server');
      expect(toolNames).toContain('open_page');
      expect(toolNames).toContain('browser_execute');
      expect(toolNames).toContain('query_logs');
      expect(toolNames).toContain('set_log_level');
      expect(toolNames).toContain('stop_app');
      expect(toolNames).toContain('list_sessions');
      expect(toolNames).toContain('take_screenshot');
      expect(toolNames).toContain('record_video');
    });
    
    it('should process tools/call message', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_sessions',
          arguments: {}
        }
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: expect.any(Object)
      });
      
      // Result should have content array
      expect(response.result.content).toBeDefined();
      expect(Array.isArray(response.result.content)).toBe(true);
    });
    
    it('should process ping message', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {}
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: { status: 'pong' }
      });
    });
    
    it('should handle notifications without response', async () => {
      const message = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toBeNull();
    });
    
    it('should handle method not found', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 5,
        method: 'unknown/method',
        params: {}
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        error: {
          code: -32601,
          message: 'Method not found',
          data: 'unknown/method'
        }
      });
    });
    
    it('should handle invalid jsonrpc version', async () => {
      const message = {
        jsonrpc: '1.0',
        id: 6,
        method: 'ping',
        params: {}
      };
      
      const response = await server.processMessage(message);
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 6,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      });
    });
  });
  
  describe('Tool Handler Integration', () => {
    it('should get all available tools', async () => {
      const tools = server.toolHandler.getAllTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check tool structure
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      });
    });
    
    it('should execute list_sessions tool', async () => {
      const result = await server.toolHandler.executeTool('list_sessions', {});
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });
    
    it('should handle invalid tool execution', async () => {
      await expect(
        server.toolHandler.executeTool('invalid_tool', {})
      ).rejects.toThrow();
    });
  });
  
  describe('Session Management', () => {
    it('should have session manager initialized', () => {
      expect(server.sessionManager).toBeDefined();
      expect(server.sessionManager.sessions).toBeDefined();
      expect(server.sessionManager.monitors).toBeDefined();
    });
    
    it('should handle session cleanup', async () => {
      // Start a test session
      await server.toolHandler.executeTool('start_server', {
        script: 'echo "test"',
        session_id: 'cleanup-test'
      });
      
      // Clean up all sessions
      await server.sessionManager.endAllSessions();
      
      // Sessions should be empty
      expect(server.sessionManager.sessions.size).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle malformed messages gracefully', async () => {
      const result = await server.handleMessage('invalid json');
      
      // Should not throw, just return undefined
      expect(result).toBeUndefined();
    });
    
    it('should handle tool execution errors', async () => {
      const message = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'start_server',
          arguments: {} // Missing required script parameter
        }
      };
      
      const response = await server.processMessage(message);
      
      // Should return error response, not throw
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 10,
        error: expect.objectContaining({
          code: -32603,
          message: 'Internal error'
        })
      });
    });
  });
});