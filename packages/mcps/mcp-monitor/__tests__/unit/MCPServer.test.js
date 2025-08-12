/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPFullStackMonitorServer } from '../../mcp-server.js';
import { EventEmitter } from 'events';

// Mock process.stdin and stdout
class MockStdin extends EventEmitter {
  constructor() {
    super();
    this.encoding = 'utf8';
  }
  
  setEncoding(encoding) {
    this.encoding = encoding;
  }
  
  pause() {}
  resume() {}
}

class MockStdout extends EventEmitter {
  constructor() {
    super();
    this.encoding = 'utf8';
    this.written = [];
  }
  
  setEncoding(encoding) {
    this.encoding = encoding;
  }
  
  write(data) {
    this.written.push(data);
    this.emit('data', data);
  }
  
  getWritten() {
    return this.written;
  }
  
  getLastMessage() {
    if (this.written.length === 0) return null;
    const lastWrite = this.written[this.written.length - 1];
    const lines = lastWrite.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  }
}

describe('MCPFullStackMonitorServer', () => {
  let server;
  let mockStdin;
  let mockStdout;
  let mockStderr;
  let originalWrite;
  let originalStderrWrite;
  
  beforeEach(() => {
    // Create mocks
    mockStdin = new MockStdin();
    mockStdout = new MockStdout();
    
    // Mock console.error for stderr
    mockStderr = { write: jest.fn() };
    originalStderrWrite = process.stderr.write;
    process.stderr.write = mockStderr.write;
    
    // Save and mock stdout.write
    originalWrite = process.stdout.write;
    process.stdout.write = jest.fn((data) => {
      mockStdout.write(data);
      return true;
    });
    
    // Create server instance (don't start it yet)
    server = new MCPFullStackMonitorServer();
  });
  
  afterEach(async () => {
    // Cleanup server
    if (server) {
      await server.sessionManager.endAllSessions();
    }
    
    // Restore original functions
    process.stdout.write = originalWrite;
    process.stderr.write = originalStderrWrite;
  });
  
  describe('Server Initialization', () => {
    it('should create server with proper initial state', () => {
      expect(server.sessionManager).toBeDefined();
      expect(server.toolHandler).toBeDefined();
      expect(server.capabilities).toEqual({
        tools: {},
        logging: {},
        prompts: {}
      });
    });
    
    it('should start server and setup stdio handling', async () => {
      // Mock stdin event listeners
      const stdinOn = jest.spyOn(process.stdin, 'on');
      const stdinSetEncoding = jest.spyOn(process.stdin, 'setEncoding');
      
      await server.start();
      
      expect(stdinSetEncoding).toHaveBeenCalledWith('utf8');
      expect(stdinOn).toHaveBeenCalledWith('data', expect.any(Function));
      expect(stdinOn).toHaveBeenCalledWith('end', expect.any(Function));
      
      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining('Starting FullStack Monitor MCP Server')
      );
      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining('MCP Server ready for connections')
      );
      
      stdinOn.mockRestore();
      stdinSetEncoding.mockRestore();
    });
  });
  
  describe('Message Processing', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should handle initialize request', async () => {
      const request = {
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
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
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
    
    it('should handle tools/list request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
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
    
    it('should handle tools/call request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_sessions',
          arguments: {}
        }
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.any(String)
            })
          ])
        })
      });
    });
    
    it('should handle ping request', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 4,
        method: 'ping',
        params: {}
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: { status: 'pong' }
      });
    });
    
    it('should handle notifications without response', async () => {
      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      };
      
      const writtenBefore = mockStdout.written.length;
      await server.handleMessage(JSON.stringify(notification));
      const writtenAfter = mockStdout.written.length;
      
      // No response should be sent for notifications
      expect(writtenAfter).toBe(writtenBefore);
    });
    
    it('should handle invalid JSON with error response', async () => {
      await server.handleMessage('invalid json');
      
      // Should log error but not crash
      expect(mockStderr.write).toHaveBeenCalledWith(
        expect.stringContaining('Error processing message')
      );
    });
    
    it('should handle method not found error', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 5,
        method: 'unknown/method',
        params: {}
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
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
      const request = {
        jsonrpc: '1.0', // Invalid version
        id: 6,
        method: 'ping',
        params: {}
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
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
  
  describe('Tool Execution', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should execute start_server tool', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'start_server',
          arguments: {
            script: './test-app/server.js',
            session_id: 'test-session'
          }
        }
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 10,
        result: expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'text'
            })
          ])
        })
      });
    });
    
    it('should handle tool execution errors gracefully', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };
      
      await server.handleMessage(JSON.stringify(request));
      
      const response = mockStdout.getLastMessage();
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 11,
        error: expect.objectContaining({
          code: -32603,
          message: 'Internal error'
        })
      });
    });
  });
  
  describe('Stream Processing', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should handle messages split across multiple data chunks', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 20,
        method: 'ping',
        params: {}
      };
      
      const message = JSON.stringify(request);
      const part1 = message.substring(0, message.length / 2);
      const part2 = message.substring(message.length / 2) + '\n';
      
      // Send in two parts
      mockStdin.emit('data', part1);
      mockStdin.emit('data', part2);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = mockStdout.getLastMessage();
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 20,
        result: { status: 'pong' }
      });
    });
    
    it('should handle multiple messages in one chunk', async () => {
      const request1 = JSON.stringify({
        jsonrpc: '2.0',
        id: 21,
        method: 'ping',
        params: {}
      });
      
      const request2 = JSON.stringify({
        jsonrpc: '2.0',
        id: 22,
        method: 'ping',
        params: {}
      });
      
      // Send both messages at once
      mockStdin.emit('data', request1 + '\n' + request2 + '\n');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have two responses
      const written = mockStdout.getWritten();
      const responses = written
        .join('')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
      
      expect(responses).toHaveLength(2);
      expect(responses[0].id).toBe(21);
      expect(responses[1].id).toBe(22);
    });
  });
  
  describe('Cleanup and Shutdown', () => {
    beforeEach(async () => {
      await server.start();
    });
    
    it('should handle stdin end event', () => {
      const shutdownSpy = jest.spyOn(server, 'shutdown');
      mockStdin.emit('end');
      expect(shutdownSpy).toHaveBeenCalled();
    });
    
    it('should cleanup sessions on shutdown', async () => {
      const endSpy = jest.spyOn(server.sessionManager, 'endAllSessions');
      await server.shutdown();
      expect(endSpy).toHaveBeenCalled();
    });
    
    it('should cleanup resources on process signals', () => {
      const cleanupSpy = jest.spyOn(server.sessionManager, 'endAllSessions');
      
      // Test SIGINT
      process.emit('SIGINT');
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      
      // Note: We can't easily test SIGTERM and SIGQUIT without actually terminating
    });
  });
});