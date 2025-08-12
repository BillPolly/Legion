/**
 * @jest-environment node
 * Integration tests for MCP protocol communication between server and client
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MCP Protocol Integration', () => {
  let client;
  let serverPath;
  
  beforeEach(() => {
    client = new MCPClient();
    serverPath = path.join(__dirname, '..', '..', 'mcp-server.js');
  });
  
  afterEach(async () => {
    if (client && client.serverProcess) {
      await client.disconnect();
    }
    
    // Cleanup any test files
    const testFiles = [
      './test-screenshot.png',
      './test-video.mp4',
      './test-app/server.js',
      './test-app/index.html'
    ];
    
    for (const file of testFiles) {
      await fs.unlink(file).catch(() => {});
    }
    
    await fs.rmdir('./test-app').catch(() => {});
  });
  
  describe('Connection Lifecycle', () => {
    it('should establish full MCP connection', async () => {
      jest.setTimeout(10000);
      
      // Connect to server
      await client.connect('node', [serverPath]);
      expect(client.serverProcess).toBeDefined();
      
      // Initialize
      const initResult = await client.initialize({
        name: 'integration-test',
        version: '1.0.0'
      });
      
      expect(initResult).toMatchObject({
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'fullstack-monitor',
          version: '1.0.0'
        }
      });
      
      // Send initialized notification
      client.sendNotification('notifications/initialized');
      
      // Get tools
      const tools = await client.getTools();
      expect(tools.length).toBeGreaterThan(0);
      
      // Verify specific tools exist
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('start_server');
      expect(toolNames).toContain('query_logs');
      expect(toolNames).toContain('list_sessions');
    });
    
    it('should handle graceful disconnect', async () => {
      jest.setTimeout(10000);
      
      await client.connect('node', [serverPath]);
      await client.initialize();
      
      const disconnectPromise = client.disconnect();
      await expect(disconnectPromise).resolves.not.toThrow();
      
      expect(client.serverProcess.killed).toBe(true);
    });
  });
  
  describe('Tool Execution', () => {
    beforeEach(async () => {
      jest.setTimeout(15000);
      await client.connect('node', [serverPath]);
      await client.initialize();
      client.sendNotification('notifications/initialized');
      await client.getTools();
    });
    
    it('should list sessions', async () => {
      const result = await client.callTool('list_sessions');
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Active sessions')
          })
        ])
      });
    });
    
    it('should start and stop a server session', async () => {
      // Create a simple test server file
      const testServerCode = `
        const http = require('http');
        const server = http.createServer((req, res) => {
          console.log('Request received:', req.url);
          res.writeHead(200);
          res.end('Test server response');
        });
        server.listen(3099, () => {
          console.log('Test server listening on port 3099');
        });
        process.on('SIGTERM', () => {
          server.close(() => process.exit(0));
        });
      `;
      
      await fs.mkdir('./test-app', { recursive: true });
      await fs.writeFile('./test-app/server.js', testServerCode);
      
      // Start server
      const startResult = await client.callTool('start_server', {
        script: './test-app/server.js',
        session_id: 'integration-test',
        wait_for_port: 3099
      });
      
      expect(startResult.content[0].text).toContain('started');
      
      // Query logs
      const logsResult = await client.callTool('query_logs', {
        session_id: 'integration-test',
        limit: 5
      });
      
      expect(logsResult.content[0].text).toBeDefined();
      
      // Stop server
      const stopResult = await client.callTool('stop_app', {
        session_id: 'integration-test'
      });
      
      expect(stopResult.content[0].text).toContain('stopped');
    });
    
    it('should handle set_log_level tool', async () => {
      const result = await client.callTool('set_log_level', {
        session_id: 'test-session',
        level: 'debug'
      });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Log level')
          })
        ])
      });
    });
    
    it('should handle tool errors gracefully', async () => {
      // Try to query logs for non-existent session
      const result = await client.callTool('query_logs', {
        session_id: 'non-existent-session',
        limit: 10
      });
      
      // Should return result (possibly empty) not throw
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text'
          })
        ])
      });
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      jest.setTimeout(10000);
      await client.connect('node', [serverPath]);
      await client.initialize();
    });
    
    it('should handle unknown tool', async () => {
      await expect(
        client.callTool('unknown_tool', {})
      ).rejects.toThrow();
    });
    
    it('should handle invalid tool arguments', async () => {
      // Call start_server without required arguments
      const result = await client.callTool('start_server', {});
      
      // Should return error result
      expect(result.content[0].text).toContain('error');
    });
    
    it('should handle server crash and restart', async () => {
      jest.setTimeout(15000);
      
      // Force kill the server
      client.serverProcess.kill('SIGKILL');
      
      // Wait for exit
      await new Promise(resolve => {
        client.once('serverExit', resolve);
      });
      
      // Should be able to reconnect
      await client.connect('node', [serverPath]);
      await client.initialize();
      
      const tools = await client.getTools();
      expect(tools.length).toBeGreaterThan(0);
    });
  });
  
  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      jest.setTimeout(15000);
      await client.connect('node', [serverPath]);
      await client.initialize();
      client.sendNotification('notifications/initialized');
    });
    
    it('should handle multiple concurrent tool calls', async () => {
      const promises = [
        client.callTool('list_sessions'),
        client.callTool('list_sessions'),
        client.callTool('list_sessions')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.content[0].text).toContain('Active sessions');
      });
    });
    
    it('should handle rapid sequential messages', async () => {
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await client.callTool('list_sessions');
        results.push(result);
      }
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.content[0].text).toBeDefined();
      });
    });
  });
  
  describe('Protocol Compliance', () => {
    beforeEach(async () => {
      jest.setTimeout(10000);
      await client.connect('node', [serverPath]);
    });
    
    it('should follow JSON-RPC 2.0 specification', async () => {
      // Intercept stdin to check message format
      const originalWrite = client.serverProcess.stdin.write;
      const sentMessages = [];
      
      client.serverProcess.stdin.write = function(data) {
        sentMessages.push(JSON.parse(data.replace('\n', '')));
        return originalWrite.call(this, data);
      };
      
      await client.initialize();
      await client.getTools();
      client.sendNotification('notifications/initialized');
      
      // Check all sent messages
      sentMessages.forEach(msg => {
        expect(msg.jsonrpc).toBe('2.0');
        
        if (msg.method === 'notifications/initialized') {
          // Notifications should not have id
          expect(msg.id).toBeUndefined();
        } else if (msg.method) {
          // Requests should have id
          expect(msg.id).toBeDefined();
          expect(typeof msg.id).toBe('number');
        }
      });
    });
    
    it('should handle all MCP standard methods', async () => {
      // Initialize
      const initResult = await client.initialize();
      expect(initResult.protocolVersion).toBeDefined();
      
      // Tools list
      const tools = await client.getTools();
      expect(Array.isArray(tools)).toBe(true);
      
      // Tool call
      const callResult = await client.callTool('list_sessions');
      expect(callResult.content).toBeDefined();
      
      // Notification (no response expected)
      expect(() => {
        client.sendNotification('notifications/initialized');
      }).not.toThrow();
    });
  });
  
  describe('Session Management', () => {
    beforeEach(async () => {
      jest.setTimeout(15000);
      await client.connect('node', [serverPath]);
      await client.initialize();
      client.sendNotification('notifications/initialized');
    });
    
    it('should manage multiple sessions', async () => {
      // Create test app
      const testServerCode = `
        const http = require('http');
        const port = process.argv[2] || 3100;
        http.createServer((req, res) => {
          res.end('Server ' + port);
        }).listen(port, () => {
          console.log('Server on port ' + port);
        });
      `;
      
      await fs.mkdir('./test-app', { recursive: true });
      await fs.writeFile('./test-app/server.js', testServerCode);
      
      // Start multiple sessions
      const session1 = await client.callTool('start_server', {
        script: './test-app/server.js',
        session_id: 'session-1',
        wait_for_port: 3101,
        env: { PORT: '3101' }
      });
      
      const session2 = await client.callTool('start_server', {
        script: './test-app/server.js', 
        session_id: 'session-2',
        wait_for_port: 3102,
        env: { PORT: '3102' }
      });
      
      // List sessions
      const sessions = await client.callTool('list_sessions');
      expect(sessions.content[0].text).toContain('session-1');
      expect(sessions.content[0].text).toContain('session-2');
      
      // Stop sessions
      await client.callTool('stop_app', { session_id: 'session-1' });
      await client.callTool('stop_app', { session_id: 'session-2' });
    });
    
    it('should handle session cleanup on disconnect', async () => {
      // Start a session
      await fs.mkdir('./test-app', { recursive: true });
      await fs.writeFile('./test-app/server.js', 
        'console.log("Test server"); setTimeout(() => {}, 100000);'
      );
      
      await client.callTool('start_server', {
        script: './test-app/server.js',
        session_id: 'cleanup-test'
      });
      
      // Disconnect should cleanup sessions
      await client.disconnect();
      
      // Reconnect and check
      await client.connect('node', [serverPath]);
      await client.initialize();
      
      const sessions = await client.callTool('list_sessions');
      expect(sessions.content[0].text).not.toContain('cleanup-test');
    });
  });
});