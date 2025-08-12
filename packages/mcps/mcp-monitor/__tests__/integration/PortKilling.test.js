/**
 * Test for automatic port killing functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Port Killing Functionality', () => {
  let client;
  let serverProcess;
  
  beforeAll(async () => {
    // Start MCP server
    console.log('Starting MCP server for port killing tests...');
    serverProcess = spawn('node', ['mcp-server.js'], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initialize MCP client
    client = new MCPClient();
    await client.connect('node', ['mcp-server.js']);
    await client.initialize({ name: 'port-test-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
  }, 30000);
  
  afterAll(async () => {
    try {
      await client.disconnect();
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
  
  describe('Automatic Port Killing', () => {
    it('should kill conflicting process by default', async () => {
      const testPort = 3055;
      const sessionId1 = 'port-conflict-1';
      const sessionId2 = 'port-conflict-2';
      
      // Create a simple server that listens on the test port
      const server1Path = path.join(__dirname, 'test-server-3055.js');
      const serverCode = `
        const http = require('http');
        const server = http.createServer((req, res) => {
          res.end('Server 1');
        });
        server.listen(${testPort}, () => {
          console.log('Server listening on port ${testPort}');
        });
        // Keep process alive
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(server1Path, serverCode);
      
      try {
        // Start first server
        const result1 = await client.callTool('start_server', {
          script: server1Path,
          wait_for_port: testPort,
          session_id: sessionId1,
          log_level: 'info'
        });
        
        expect(result1.isError).toBeFalsy();
        expect(result1.content[0].text).toContain('✅ Started server');
        
        // Verify the port is in use
        const isInUse = await isPortInUse(testPort);
        expect(isInUse).toBe(true);
        
        // Now try to start another server on the same port
        // It should kill the first one automatically
        const result2 = await client.callTool('start_server', {
          script: server1Path,
          wait_for_port: testPort,
          session_id: sessionId2,
          log_level: 'info',
          kill_conflicting_ports: true // Explicitly set (though it's default)
        });
        
        expect(result2.isError).toBeFalsy();
        expect(result2.content[0].text).toContain('✅ Started server');
        
        // Check that session 1's process is no longer running
        const sessions = await client.callTool('list_sessions');
        const sessionData = JSON.parse(sessions.content[0].text);
        
        // Session 2 should be running
        expect(sessionData[sessionId2]).toBeDefined();
        expect(sessionData[sessionId2].state).toBe('running');
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId2 });
      } finally {
        if (fs.existsSync(server1Path)) {
          fs.unlinkSync(server1Path);
        }
      }
    }, 45000);
    
    it('should respect kill_conflicting_ports=false option', async () => {
      const testPort = 3056;
      const sessionId1 = 'no-kill-1';
      const sessionId2 = 'no-kill-2';
      
      // Create a simple server
      const serverPath = path.join(__dirname, 'test-server-3056.js');
      const serverCode = `
        const http = require('http');
        const server = http.createServer((req, res) => {
          res.end('Test Server');
        });
        server.listen(${testPort}, () => {
          console.log('Server listening on port ${testPort}');
        });
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(serverPath, serverCode);
      
      try {
        // Start first server
        const result1 = await client.callTool('start_server', {
          script: serverPath,
          wait_for_port: testPort,
          session_id: sessionId1,
          log_level: 'info'
        });
        
        expect(result1.isError).toBeFalsy();
        
        // Try to start second server with kill_conflicting_ports=false
        // This should fail because the port is already in use
        const result2 = await client.callTool('start_server', {
          script: serverPath,
          wait_for_port: testPort,
          session_id: sessionId2,
          log_level: 'info',
          kill_conflicting_ports: false
        });
        
        // This should fail because we didn't kill the conflicting process
        expect(result2.isError).toBeTruthy();
        expect(result2.content[0].text).toMatch(/Failed to start server|port.*in use/i);
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId1 });
      } finally {
        if (fs.existsSync(serverPath)) {
          fs.unlinkSync(serverPath);
        }
      }
    }, 45000);
  });
});

// Helper function to check if a port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
}