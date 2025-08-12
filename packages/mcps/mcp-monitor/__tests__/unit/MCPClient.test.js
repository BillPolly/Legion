/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

// Mock child_process spawn
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock server process
class MockServerProcess extends EventEmitter {
  constructor() {
    super();
    this.stdin = new MockStream();
    this.stdout = new MockStream();
    this.stderr = new MockStream();
    this.killed = false;
  }
  
  kill(signal) {
    this.killed = true;
    this.emit('exit', 0);
  }
}

class MockStream extends EventEmitter {
  constructor() {
    super();
    this.written = [];
  }
  
  write(data) {
    this.written.push(data);
  }
  
  getWritten() {
    return this.written;
  }
}

describe('MCPClient', () => {
  let client;
  let mockProcess;
  
  beforeEach(() => {
    client = new MCPClient();
    mockProcess = new MockServerProcess();
    
    // Setup spawn mock to return our mock process
    spawn.mockReturnValue(mockProcess);
  });
  
  afterEach(async () => {
    if (client.serverProcess && !client.serverProcess.killed) {
      await client.disconnect();
    }
    jest.clearAllMocks();
  });
  
  describe('Connection Management', () => {
    it('should connect to MCP server', async () => {
      const connectPromise = client.connect('node', ['mcp-server.js']);
      
      // Simulate server ready message
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      
      await connectPromise;
      
      expect(spawn).toHaveBeenCalledWith('node', ['mcp-server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          NODE_OPTIONS: '--experimental-vm-modules'
        })
      });
      
      expect(client.serverProcess).toBe(mockProcess);
    });
    
    it('should handle server ready with timeout fallback', async () => {
      jest.setTimeout(5000);
      
      const connectPromise = client.connect('node', ['mcp-server.js']);
      
      // Don't send ready message, let it timeout
      await connectPromise;
      
      expect(client.serverProcess).toBe(mockProcess);
    });
    
    it('should disconnect from server', async () => {
      // Connect first
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
      
      // Now disconnect
      await client.disconnect();
      
      expect(mockProcess.killed).toBe(true);
    });
    
    it('should handle server exit', async () => {
      const exitHandler = jest.fn();
      client.on('serverExit', exitHandler);
      
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
      
      // Simulate server exit
      mockProcess.emit('exit', 1);
      
      expect(exitHandler).toHaveBeenCalledWith(1);
    });
  });
  
  describe('Message Handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
    });
    
    it('should send initialize message', async () => {
      const initPromise = client.initialize({
        name: 'test-client',
        version: '1.0.0'
      });
      
      // Check message was sent
      const sentMessages = mockProcess.stdin.getWritten();
      expect(sentMessages.length).toBe(1);
      const sentMessage = JSON.parse(sentMessages[0].replace('\n', ''));
      
      expect(sentMessage).toMatchObject({
        jsonrpc: '2.0',
        id: expect.any(Number),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      });
      
      // Simulate response
      const response = {
        jsonrpc: '2.0',
        id: sentMessage.id,
        result: {
          serverInfo: {
            name: 'fullstack-monitor',
            version: '1.0.0'
          }
        }
      };
      
      mockProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      
      const result = await initPromise;
      expect(result.serverInfo).toEqual({
        name: 'fullstack-monitor',
        version: '1.0.0'
      });
      expect(client.serverInfo).toEqual(result.serverInfo);
    });
    
    it('should get available tools', async () => {
      const toolsPromise = client.getTools();
      
      // Get sent message
      const sentMessages = mockProcess.stdin.getWritten();
      const sentMessage = JSON.parse(sentMessages[sentMessages.length - 1].replace('\n', ''));
      
      expect(sentMessage.method).toBe('tools/list');
      
      // Simulate response
      const response = {
        jsonrpc: '2.0',
        id: sentMessage.id,
        result: {
          tools: [
            { name: 'start_server', description: 'Start a server' },
            { name: 'query_logs', description: 'Query logs' }
          ]
        }
      };
      
      mockProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      
      const tools = await toolsPromise;
      expect(tools).toHaveLength(2);
      expect(client.tools).toEqual(tools);
    });
    
    it('should call a tool', async () => {
      const callPromise = client.callTool('start_server', {
        script: './server.js',
        session_id: 'test'
      });
      
      // Get sent message
      const sentMessages = mockProcess.stdin.getWritten();
      const sentMessage = JSON.parse(sentMessages[sentMessages.length - 1].replace('\n', ''));
      
      expect(sentMessage).toMatchObject({
        method: 'tools/call',
        params: {
          name: 'start_server',
          arguments: {
            script: './server.js',
            session_id: 'test'
          }
        }
      });
      
      // Simulate response
      const response = {
        jsonrpc: '2.0',
        id: sentMessage.id,
        result: {
          content: [{
            type: 'text',
            text: 'Server started successfully'
          }]
        }
      };
      
      mockProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      
      const result = await callPromise;
      expect(result.content[0].text).toBe('Server started successfully');
    });
    
    it('should send notifications', () => {
      client.sendNotification('notifications/initialized');
      
      const sentMessages = mockProcess.stdin.getWritten();
      const sentMessage = JSON.parse(sentMessages[sentMessages.length - 1].replace('\n', ''));
      
      expect(sentMessage).toMatchObject({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      });
      
      // Notifications should not have an ID
      expect(sentMessage.id).toBeUndefined();
    });
    
    it('should handle error responses', async () => {
      const callPromise = client.callTool('unknown_tool', {});
      
      // Get sent message
      const sentMessages = mockProcess.stdin.getWritten();
      const sentMessage = JSON.parse(sentMessages[sentMessages.length - 1].replace('\n', ''));
      
      // Simulate error response
      const response = {
        jsonrpc: '2.0',
        id: sentMessage.id,
        error: {
          code: -32603,
          message: 'Tool not found'
        }
      };
      
      mockProcess.stdout.emit('data', JSON.stringify(response) + '\n');
      
      await expect(callPromise).rejects.toThrow('Tool not found');
    });
    
    it('should handle message timeout', async () => {
      jest.setTimeout(35000);
      
      const callPromise = client.callTool('slow_tool', {});
      
      // Don't send response, let it timeout
      await expect(callPromise).rejects.toThrow('Timeout waiting for response to tools/call');
    }, 35000);
    
    it('should handle multiple messages in buffer', () => {
      const message1 = {
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ok' }
      };
      
      const message2 = {
        jsonrpc: '2.0',
        id: 2,
        result: { status: 'ok' }
      };
      
      // Create pending requests
      const resolver1 = { resolve: jest.fn(), reject: jest.fn(), method: 'test1' };
      const resolver2 = { resolve: jest.fn(), reject: jest.fn(), method: 'test2' };
      
      client.pendingRequests.set(1, resolver1);
      client.pendingRequests.set(2, resolver2);
      
      // Send both messages at once
      mockProcess.stdout.emit('data', 
        JSON.stringify(message1) + '\n' + 
        JSON.stringify(message2) + '\n'
      );
      
      expect(resolver1.resolve).toHaveBeenCalledWith({ status: 'ok' });
      expect(resolver2.resolve).toHaveBeenCalledWith({ status: 'ok' });
    });
    
    it('should handle partial messages in buffer', () => {
      const message = {
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ok' }
      };
      
      const resolver = { resolve: jest.fn(), reject: jest.fn(), method: 'test' };
      client.pendingRequests.set(1, resolver);
      
      const fullMessage = JSON.stringify(message);
      const part1 = fullMessage.substring(0, fullMessage.length / 2);
      const part2 = fullMessage.substring(fullMessage.length / 2) + '\n';
      
      // Send in parts
      mockProcess.stdout.emit('data', part1);
      expect(resolver.resolve).not.toHaveBeenCalled();
      
      mockProcess.stdout.emit('data', part2);
      expect(resolver.resolve).toHaveBeenCalledWith({ status: 'ok' });
    });
  });
  
  describe('Tool Discovery', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
      
      // Set up some tools
      client.tools = [
        { name: 'start_server', description: 'Start a Node.js server' },
        { name: 'stop_server', description: 'Stop the server' },
        { name: 'query_logs', description: 'Query application logs' },
        { name: 'take_screenshot', description: 'Take a screenshot' }
      ];
    });
    
    it('should get tool by name', () => {
      const tool = client.getTool('query_logs');
      expect(tool).toEqual({
        name: 'query_logs',
        description: 'Query application logs'
      });
      
      const notFound = client.getTool('unknown_tool');
      expect(notFound).toBeUndefined();
    });
    
    it('should find tools by pattern', () => {
      const serverTools = client.findTools('server');
      expect(serverTools).toHaveLength(2);
      expect(serverTools.map(t => t.name)).toEqual(['start_server', 'stop_server']);
      
      const logTools = client.findTools('log');
      expect(logTools).toHaveLength(1);
      expect(logTools[0].name).toBe('query_logs');
      
      const screenshotTools = client.findTools('SCREENSHOT');
      expect(screenshotTools).toHaveLength(1);
      expect(screenshotTools[0].name).toBe('take_screenshot');
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
    });
    
    it('should handle invalid JSON from server', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockProcess.stdout.emit('data', 'invalid json\n');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse server message'),
        'invalid json'
      );
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle server stderr output', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockProcess.stderr.emit('data', Buffer.from('Server error message\n'));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server error message')
      );
      
      consoleLogSpy.mockRestore();
    });
    
    it('should filter out ExperimentalWarning messages', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockProcess.stderr.emit('data', 
        Buffer.from('(node:1234) ExperimentalWarning: VM Modules\n')
      );
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      consoleLogSpy.mockRestore();
    });
  });
  
  describe('Event Emission', () => {
    it('should emit serverExit event', async () => {
      const connectPromise = client.connect('node', ['mcp-server.js']);
      mockProcess.stderr.emit('data', Buffer.from('MCP Server ready for connections\n'));
      await connectPromise;
      
      const exitHandler = jest.fn();
      client.on('serverExit', exitHandler);
      
      mockProcess.emit('exit', 1);
      
      expect(exitHandler).toHaveBeenCalledWith(1);
    });
    
    it('should be an EventEmitter', () => {
      expect(client).toBeInstanceOf(EventEmitter);
      
      const handler = jest.fn();
      client.on('test', handler);
      client.emit('test', 'data');
      
      expect(handler).toHaveBeenCalledWith('data');
    });
  });
});