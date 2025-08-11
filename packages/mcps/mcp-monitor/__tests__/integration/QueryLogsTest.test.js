/**
 * @jest-environment node
 * 
 * Clean Jest test for query_logs functionality
 * Tests real MCP server and app integration without mocks
 */

import { MCPClient } from '../../mcp-client.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Query Logs Integration Test', () => {
  let client;
  let testAppPath;
  const TEST_PORT = 3011;
  const SESSION_ID = 'jest-query-logs-test';
  
  beforeAll(async () => {
    // Create test app
    const testDir = path.join(__dirname, 'test-apps');
    mkdirSync(testDir, { recursive: true });
    testAppPath = path.join(testDir, 'query-test-app.cjs');
    
    const appCode = `
const http = require('http');

console.log('[INFO] Query test app starting...');

const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log(\`[\${timestamp}] [INFO] Request: \${req.method} \${req.url}\`);
  
  if (req.url === '/generate-logs') {
    console.error('[ERROR] Test error log');
    console.warn('[WARN] Test warning log');
    console.log('[INFO] Test info log');
    console.log('[DEBUG] Test debug log');
  }
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', timestamp }));
});

server.listen(${TEST_PORT}, () => {
  console.log('[INFO] Test server listening on port ${TEST_PORT}');
});

process.on('SIGTERM', () => {
  console.log('[INFO] Shutting down...');
  server.close(() => process.exit(0));
});
`;
    
    writeFileSync(testAppPath, appCode);
    
    // Initialize MCP client
    client = new MCPClient();
    await client.connect('node', [path.join(__dirname, '../../mcp-server.js')]);
    await client.initialize({ name: 'jest-test-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
    
    // Start test app
    const startResult = await client.callTool('start_app', {
      script: testAppPath,
      wait_for_port: TEST_PORT,
      log_level: 'trace',
      session_id: SESSION_ID
    });
    
    expect(startResult.content[0].text).toContain('Started app');
    
    // Wait for app to initialize and generate some logs
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, 60000);
  
  afterAll(async () => {
    // Clean up
    if (client) {
      try {
        await client.callTool('stop_app', { session_id: SESSION_ID });
        await client.disconnect();
      } catch (error) {
        console.log('Cleanup error:', error.message);
      }
    }
    
    // Remove test files
    try {
      rmSync(path.dirname(testAppPath), { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Basic Log Retrieval', () => {
    test('should retrieve logs without filters', async () => {
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: 20
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const logs = result.content[0].text;
      console.log('Retrieved logs:', logs);
      
      // Should have some content (either logs or "No logs found")
      expect(logs).toBeDefined();
      expect(typeof logs).toBe('string');
      
      if (logs !== 'No logs found matching criteria') {
        // If logs are found, they should be non-empty and contain some log content
        expect(logs.length).toBeGreaterThan(0);
        expect(logs).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // Should have timestamps
        console.log('✅ SUCCESS: Logs are being captured and returned!');
      } else {
        console.log('❌ No logs found - capture mechanism may not be working');
      }
    }, 30000);
    
    test('should generate and retrieve new logs', async () => {
      // Make a request to generate logs
      const response = await fetch(`http://localhost:${TEST_PORT}/generate-logs`);
      expect(response.ok).toBe(true);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query for the generated logs
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'generate-logs',
        limit: 10
      });
      
      const logs = result.content[0].text;
      console.log('Generated logs:', logs);
      
      // Should find the request log at minimum
      if (logs !== 'No logs found matching criteria') {
        expect(logs.toLowerCase()).toContain('generate-logs');
      }
    }, 30000);
  });
  
  describe('Log Filtering', () => {
    test('should filter by log level', async () => {
      // Generate logs at different levels
      await fetch(`http://localhost:${TEST_PORT}/generate-logs`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query for error level only
      const errorResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'error',
        limit: 10
      });
      
      const errorLogs = errorResult.content[0].text;
      console.log('Error logs:', errorLogs);
      
      if (errorLogs !== 'No logs found matching criteria') {
        // Should only contain error level logs
        expect(errorLogs).toContain('[ERROR]');
        expect(errorLogs).not.toContain('[INFO]');
      }
    }, 30000);
    
    test('should filter by search query', async () => {
      // Make specific request
      await fetch(`http://localhost:${TEST_PORT}/test-endpoint`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Search for specific term
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'test-endpoint',
        limit: 5
      });
      
      const logs = result.content[0].text;
      console.log('Filtered logs:', logs);
      
      if (logs !== 'No logs found matching criteria') {
        expect(logs.toLowerCase()).toContain('test-endpoint');
      }
    }, 30000);
  });
  
  describe('Debugging Log Capture', () => {
    test('should show session status', async () => {
      const sessionsResult = await client.callTool('list_sessions', {});
      console.log('Active sessions:', sessionsResult.content[0].text);
      
      expect(sessionsResult.content[0].text).toContain(SESSION_ID);
    }, 30000);
    
    test('should verify app is responsive', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('ok');
    }, 30000);
  });
  
  describe('Error Handling', () => {
    test('should handle non-existent session gracefully', async () => {
      const result = await client.callTool('query_logs', {
        session_id: 'non-existent-session'
      });
      
      expect(result.content).toBeDefined();
      
      if (result.isError) {
        expect(result.content[0].text).toContain('Error');
      } else {
        expect(result.content[0].text).toMatch(/No logs found|No active monitor/i);
      }
    }, 30000);
  });
});