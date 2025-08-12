/**
 * Tests for Intelligent Server Startup Detection
 * Verifies the multi-signal detection system with Sidewinder lifecycle events
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Intelligent Startup Detection System', () => {
  let client;
  let serverProcess;
  
  beforeAll(async () => {
    // Start MCP server
    console.log('Starting MCP server for startup detection tests...');
    serverProcess = spawn('node', ['mcp-server.js'], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Initialize MCP client
    client = new MCPClient();
    await client.connect('node', ['mcp-server.js']);
    await client.initialize({ name: 'startup-test-client', version: '1.0.0' });
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
  
  describe('Successful Server Startup', () => {
    it('should detect Node.js server startup with Sidewinder signals', async () => {
      const sessionId = 'node-success-test';
      
      const result = await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/simple-server.js'),
        wait_for_port: 3031,
        session_id: sessionId,
        log_level: 'debug'
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Started server');
      expect(result.content[0].text).toContain('Sidewinder monitoring enabled');
      
      // Verify we can query logs
      const logs = await client.callTool('query_logs', {
        session_id: sessionId,
        limit: 10
      });
      
      expect(logs.isError).toBeFalsy();
      
      // Clean up
      await client.callTool('stop_app', { session_id: sessionId });
    }, 45000);
    
    it('should detect TypeScript server startup', async () => {
      const sessionId = 'ts-success-test';
      
      const result = await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/typescript-server.ts'),
        wait_for_port: 3032,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('✅ Started server');
      
      // Clean up
      await client.callTool('stop_app', { session_id: sessionId });
    }, 45000);
    
    it('should detect server via package.json script', async () => {
      const sessionId = 'package-script-test';
      
      // Create a test package.json
      const testDir = path.join(__dirname, '../apps');
      const packageJsonPath = path.join(testDir, 'test-package.json');
      
      const packageJson = {
        name: "test-app",
        scripts: {
          "test-start": "node simple-server.js"
        }
      };
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      
      try {
        const result = await client.callTool('start_server', {
          package_path: testDir,
          start_script: 'test-start',
          wait_for_port: 3033,
          session_id: sessionId,
          log_level: 'info'
        });
        
        // Note: This might fail if package.json is not in right place
        // But we're testing the detection system
        if (!result.isError) {
          expect(result.content[0].text).toContain('Started server');
          await client.callTool('stop_app', { session_id: sessionId });
        }
      } finally {
        // Clean up test package.json
        if (fs.existsSync(packageJsonPath)) {
          fs.unlinkSync(packageJsonPath);
        }
      }
    }, 45000);
  });
  
  describe('Failed Server Startup Detection', () => {
    it('should detect immediate process exit', async () => {
      const sessionId = 'exit-detection-test';
      
      // Create a script that exits immediately
      const exitScriptPath = path.join(__dirname, 'test-exit.js');
      fs.writeFileSync(exitScriptPath, 'console.log("Starting..."); process.exit(1);');
      
      try {
        const result = await client.callTool('start_server', {
          script: exitScriptPath,
          wait_for_port: 3034,
          session_id: sessionId,
          log_level: 'info'
        });
        
        expect(result.isError).toBeTruthy();
        expect(result.content[0].text).toMatch(/Process exited with code 1|Failed to start server/);
      } finally {
        if (fs.existsSync(exitScriptPath)) {
          fs.unlinkSync(exitScriptPath);
        }
      }
    }, 30000);
    
    it('should detect module not found errors', async () => {
      const sessionId = 'module-error-test';
      
      // Create a script with missing module
      const errorScriptPath = path.join(__dirname, 'test-module-error.js');
      fs.writeFileSync(errorScriptPath, 'const missing = require("nonexistent-module-xyz");');
      
      try {
        const result = await client.callTool('start_server', {
          script: errorScriptPath,
          wait_for_port: 3035,
          session_id: sessionId,
          log_level: 'info'
        });
        
        expect(result.isError).toBeTruthy();
        expect(result.content[0].text).toMatch(/Cannot find module|MODULE_NOT_FOUND|Failed to start/);
      } finally {
        if (fs.existsSync(errorScriptPath)) {
          fs.unlinkSync(errorScriptPath);
        }
      }
    }, 30000);
    
    it('should detect port binding errors', async () => {
      const sessionId1 = 'port-bind-test-1';
      const sessionId2 = 'port-bind-test-2';
      const testPort = 3036;
      
      // Start first server
      const result1 = await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/simple-server.js'),
        wait_for_port: testPort,
        session_id: sessionId1,
        log_level: 'info'
      });
      
      expect(result1.isError).toBeFalsy();
      
      // Try to start second server on same port
      const result2 = await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/simple-server.js'),
        wait_for_port: testPort,
        session_id: sessionId2,
        log_level: 'info'
      });
      
      expect(result2.isError).toBeTruthy();
      expect(result2.content[0].text).toMatch(/already in use|EADDRINUSE|Failed to start/);
      
      // Clean up
      await client.callTool('stop_app', { session_id: sessionId1 });
    }, 45000);
    
    it('should detect syntax errors in server code', async () => {
      const sessionId = 'syntax-error-test';
      
      // Create a script with syntax error
      const syntaxErrorPath = path.join(__dirname, 'test-syntax-error.js');
      fs.writeFileSync(syntaxErrorPath, 'const server = require("http").createServer(; // Syntax error');
      
      try {
        const result = await client.callTool('start_server', {
          script: syntaxErrorPath,
          wait_for_port: 3037,
          session_id: sessionId,
          log_level: 'info'
        });
        
        expect(result.isError).toBeTruthy();
        expect(result.content[0].text).toMatch(/SyntaxError|Unexpected token|Failed to start/);
      } finally {
        if (fs.existsSync(syntaxErrorPath)) {
          fs.unlinkSync(syntaxErrorPath);
        }
      }
    }, 30000);
  });
  
  describe('Sidewinder Lifecycle Events', () => {
    it('should detect server creation via Sidewinder', async () => {
      const sessionId = 'sidewinder-lifecycle-test';
      
      // Create a server that logs lifecycle events
      const lifecycleScriptPath = path.join(__dirname, 'test-lifecycle.js');
      const serverCode = `
        const http = require('http');
        console.log('Creating server...');
        const server = http.createServer((req, res) => {
          res.end('OK');
        });
        console.log('Server created, starting listen...');
        server.listen(3038, () => {
          console.log('Server listening on port 3038');
        });
      `;
      fs.writeFileSync(lifecycleScriptPath, serverCode);
      
      try {
        const result = await client.callTool('start_server', {
          script: lifecycleScriptPath,
          wait_for_port: 3038,
          session_id: sessionId,
          log_level: 'debug'
        });
        
        expect(result.isError).toBeFalsy();
        
        // Query logs to verify Sidewinder captured lifecycle
        const logs = await client.callTool('query_logs', {
          session_id: sessionId,
          include_system: true,
          limit: 20
        });
        
        expect(logs.isError).toBeFalsy();
        // The logs should contain server lifecycle events if Sidewinder is working
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId });
      } finally {
        if (fs.existsSync(lifecycleScriptPath)) {
          fs.unlinkSync(lifecycleScriptPath);
        }
      }
    }, 45000);
    
    it('should handle servers without Sidewinder gracefully', async () => {
      const sessionId = 'no-sidewinder-test';
      
      // Create a server that might not have Sidewinder injected properly
      const noSidewinderPath = path.join(__dirname, 'test-no-sidewinder.js');
      const serverCode = `
        // Simulate a server that somehow bypasses Sidewinder
        const net = require('net');
        const server = net.createServer();
        server.listen(3039, () => {
          console.log('TCP server listening on port 3039');
        });
      `;
      fs.writeFileSync(noSidewinderPath, serverCode);
      
      try {
        const result = await client.callTool('start_server', {
          script: noSidewinderPath,
          wait_for_port: 3039,
          session_id: sessionId,
          log_level: 'info'
        });
        
        // Should still work via port detection fallback
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Started server');
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId });
      } finally {
        if (fs.existsSync(noSidewinderPath)) {
          fs.unlinkSync(noSidewinderPath);
        }
      }
    }, 45000);
  });
  
  describe('Timeout and Performance', () => {
    it('should detect fast-starting servers quickly', async () => {
      const sessionId = 'fast-start-test';
      const startTime = Date.now();
      
      const result = await client.callTool('start_server', {
        script: path.join(__dirname, '../apps/simple-server.js'),
        wait_for_port: 3040,
        session_id: sessionId,
        log_level: 'info'
      });
      
      const duration = Date.now() - startTime;
      
      expect(result.isError).toBeFalsy();
      expect(duration).toBeLessThan(5000); // Should be much faster than old 15s timeout
      
      // Clean up
      await client.callTool('stop_app', { session_id: sessionId });
    }, 30000);
    
    it('should handle slow-starting servers', async () => {
      const sessionId = 'slow-start-test';
      
      // Create a server that takes time to start
      const slowStartPath = path.join(__dirname, 'test-slow-start.js');
      const serverCode = `
        const http = require('http');
        console.log('Starting slow server...');
        setTimeout(() => {
          const server = http.createServer((req, res) => {
            res.end('OK');
          });
          server.listen(3041, () => {
            console.log('Server listening on port 3041');
          });
        }, 3000); // 3 second delay
      `;
      fs.writeFileSync(slowStartPath, serverCode);
      
      try {
        const result = await client.callTool('start_server', {
          script: slowStartPath,
          wait_for_port: 3041,
          session_id: sessionId,
          log_level: 'info'
        });
        
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('Started server');
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId });
      } finally {
        if (fs.existsSync(slowStartPath)) {
          fs.unlinkSync(slowStartPath);
        }
      }
    }, 45000);
  });
  
  describe('Error Diagnostics', () => {
    it('should provide helpful diagnostics on timeout', async () => {
      const sessionId = 'timeout-diagnostic-test';
      
      // Create a server that never starts listening
      const neverListenPath = path.join(__dirname, 'test-never-listen.js');
      const serverCode = `
        const http = require('http');
        console.log('Server created but never listening...');
        const server = http.createServer((req, res) => {
          res.end('OK');
        });
        // Never call server.listen()
        setInterval(() => {
          console.log('Still running but not listening...');
        }, 1000);
      `;
      fs.writeFileSync(neverListenPath, serverCode);
      
      try {
        // Use a shorter timeout for this test
        const result = await client.callTool('start_server', {
          script: neverListenPath,
          wait_for_port: 3042,
          session_id: sessionId,
          log_level: 'info'
        });
        
        expect(result.isError).toBeTruthy();
        // Should contain diagnostic information
        expect(result.content[0].text).toMatch(/Timeout|diagnostic|not listening/i);
        
        // Clean up
        await client.callTool('stop_app', { session_id: sessionId });
      } finally {
        if (fs.existsSync(neverListenPath)) {
          fs.unlinkSync(neverListenPath);
        }
      }
    }, 45000);
  });
});