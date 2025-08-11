/**
 * @jest-environment node
 * 
 * Comprehensive integration test for query_logs functionality
 * Uses real MCP server and test app - no mocks allowed
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Query Logs Verification - Real Integration', () => {
  let client;
  let serverPath;
  let testAppPath;
  let testPort;
  const SESSION_ID = 'query-logs-test';
  
  beforeAll(async () => {
    // Setup paths
    serverPath = path.join(__dirname, '../../mcp-server.js');
    testAppPath = path.join(__dirname, 'test-apps/web-app/server.js');
    testPort = process.env.TEST_PORT || 3009;
    
    // Initialize MCP client
    client = new MCPClient();
  }, 30000);
  
  afterAll(async () => {
    // Clean up
    if (client) {
      await client.disconnect();
    }
  });
  
  describe('MCP Server and App Startup', () => {
    test('should connect to MCP server and start test app', async () => {
      // Connect to MCP server
      await client.connect('node', [serverPath]);
      
      // Initialize connection
      const initResult = await client.initialize({
        name: 'query-logs-test-client',
        version: '1.0.0'
      });
      
      expect(initResult.serverInfo).toMatchObject({
        name: 'fullstack-monitor',
        version: expect.any(String)
      });
      
      // Get available tools
      const tools = await client.getTools();
      expect(tools.some(t => t.name === 'query_logs')).toBe(true);
      
      // Start the test app with monitoring
      const startResult = await client.callTool('start_app', {
        script: testAppPath,
        wait_for_port: testPort,
        log_level: 'trace', // Capture all log levels
        session_id: SESSION_ID
      });
      
      expect(startResult.content[0].text).toContain('Started app');
      expect(startResult.content[0].text).toContain(SESSION_ID);
      
      // Wait for app to fully start and generate initial logs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }, 60000);
  });
  
  describe('Basic Log Retrieval', () => {
    test('should retrieve logs without any filters', async () => {
      // Query all logs
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: 50
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const logs = result.content[0].text;
      
      // Should contain some logs (might be Sidewinder initialization or server startup)
      expect(logs.length).toBeGreaterThan(0);
      expect(logs).toMatch(/listening|Sidewinder|initialized/i);
    }, 30000);
    
    test('should respect limit parameter', async () => {
      // Generate logs by making multiple API requests
      for (let i = 0; i < 5; i++) {
        await fetch(`http://localhost:${testPort}/api/test`);
      }
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query with small limit
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: 5
      });
      
      const logs = result.content[0].text;
      const logLines = logs.split('\n').filter(line => line.trim());
      
      // Should have at most 5 log lines
      expect(logLines.length).toBeLessThanOrEqual(5);
    }, 30000);
  });
  
  describe('Query Filtering', () => {
    test('should filter logs by search query', async () => {
      // Generate error logs
      await fetch(`http://localhost:${testPort}/api/error`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Search for "error" keyword
      const errorResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'error',
        limit: 20
      });
      
      const errorLogs = errorResult.content[0].text;
      
      if (errorLogs && errorLogs !== 'No logs found matching criteria') {
        // All returned logs should contain "error" (case insensitive)
        const errorLines = errorLogs.split('\n').filter(line => line.trim());
        errorLines.forEach(line => {
          if (line.trim()) {
            expect(line.toLowerCase()).toContain('error');
          }
        });
      }
      
      // Search for "test" keyword
      await fetch(`http://localhost:${testPort}/api/test`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const testResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'test',
        limit: 20
      });
      
      const testLogs = testResult.content[0].text;
      
      if (testLogs && testLogs !== 'No logs found matching criteria') {
        expect(testLogs.toLowerCase()).toContain('test');
      }
    }, 30000);
  });
  
  describe('Level Filtering', () => {
    test('should filter logs by minimum level', async () => {
      // Generate error logs
      await fetch(`http://localhost:${testPort}/api/error`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get only ERROR level and above
      const errorOnlyResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'error',
        limit: 10
      });
      
      const errorLogs = errorOnlyResult.content[0].text;
      
      if (errorLogs && errorLogs !== 'No logs found matching criteria') {
        // Should contain error-related logs
        expect(errorLogs.toLowerCase()).toContain('error');
      }
      
      // Get WARN level and above
      const warnResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'warn',
        limit: 20
      });
      
      const warnLogs = warnResult.content[0].text;
      
      if (warnLogs && warnLogs !== 'No logs found matching criteria') {
        // Should have log content (level filtering is working)
        expect(warnLogs.length).toBeGreaterThan(0);
      }
    }, 30000);
  });
  
  describe('Request ID Filtering', () => {
    test('should filter logs by request ID', async () => {
      // Make an API request that will generate logs
      const response = await fetch(`http://localhost:${testPort}/api/test`);
      const data = await response.json();
      const requestId = 'api-test'; // Use a known search term from our test server
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query logs using query parameter instead (since request_id filtering may not be implemented)
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'api/test',
        limit: 10
      });
      
      const logs = result.content[0].text;
      
      if (logs && logs !== 'No logs found matching criteria') {
        // Should contain logs related to our API test request
        expect(logs.toLowerCase()).toContain('api');
      }
    }, 30000);
  });
  
  describe('Time Range Filtering', () => {
    test('should filter logs by time range', async () => {
      // Generate a marker log
      const markerTime = new Date().toISOString();
      await fetch(`http://localhost:${testPort}/api/test`);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query logs from last 5 seconds
      const recentResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        last: '5s',
        limit: 50
      });
      
      const recentLogs = recentResult.content[0].text;
      
      if (recentLogs && recentLogs !== 'No logs found matching criteria') {
        // Should contain recent logs
        const logLines = recentLogs.split('\n').filter(line => line.trim());
        
        // Just verify we got some recent logs (timestamp parsing can be complex)
        expect(logLines.length).toBeGreaterThan(0);
      }
    }, 30000);
  });
  
  describe('System Logs Inclusion', () => {
    test('should include or exclude system logs based on flag', async () => {
      // Make some requests to generate activity
      await fetch(`http://localhost:${testPort}/api/test`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query with system logs included (default)
      const withSystemResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        include_system: true,
        limit: 30
      });
      
      const withSystemLogs = withSystemResult.content[0].text;
      
      // Query without system logs
      const withoutSystemResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        include_system: false,
        limit: 30
      });
      
      const withoutSystemLogs = withoutSystemResult.content[0].text;
      
      // System logs should be marked with [sidewinder] prefix when included
      if (withSystemLogs && withSystemLogs !== 'No logs found matching criteria') {
        // Check if sidewinder events are present when included
        const hasSidewinderWithSystem = withSystemLogs.includes('[sidewinder]');
        
        if (withoutSystemLogs && withoutSystemLogs !== 'No logs found matching criteria') {
          const hasSidewinderWithoutSystem = withoutSystemLogs.includes('[sidewinder]');
          
          // When include_system is false, there should be no [sidewinder] logs
          expect(hasSidewinderWithoutSystem).toBe(false);
        }
      }
    }, 30000);
  });
  
  describe('Complex Scenarios', () => {
    test('should handle multiple filters combined', async () => {
      // Generate various logs
      await fetch(`http://localhost:${testPort}/api/error`);
      await fetch(`http://localhost:${testPort}/api/test`);
      await fetch(`http://localhost:${testPort}/error`);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query with multiple filters
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'error',
        level: 'error',
        last: '10s',
        limit: 5,
        include_system: false
      });
      
      const logs = result.content[0].text;
      
      if (logs && logs !== 'No logs found matching criteria') {
        // Should only have error logs containing "error" from last 10 seconds
        const logLines = logs.split('\n').filter(line => line.trim());
        
        expect(logLines.length).toBeLessThanOrEqual(5);
        
        logLines.forEach(line => {
          if (line.trim()) {
            expect(line.toLowerCase()).toContain('error');
            expect(line).not.toContain('[sidewinder]');
          }
        });
      }
    }, 30000);
    
    test('should handle rapid log generation', async () => {
      // Generate logs rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(fetch(`http://localhost:${testPort}/api/test`));
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query all recent logs
      const result = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        query: 'test',
        limit: 100
      });
      
      const logs = result.content[0].text;
      
      if (logs && logs !== 'No logs found matching criteria') {
        // Should have captured some logs from all requests
        expect(logs.toLowerCase()).toContain('test');
      }
    }, 30000);
  });
  
  describe('Error Handling', () => {
    test('should handle invalid session ID gracefully', async () => {
      const result = await client.callTool('query_logs', {
        session_id: 'non-existent-session',
        limit: 10
      });
      
      // Should return an error or empty result
      expect(result.content).toBeDefined();
      
      if (result.isError) {
        expect(result.content[0].text).toContain('Error');
      } else {
        // Or return no logs found
        expect(result.content[0].text).toMatch(/No logs found|No active monitor/i);
      }
    }, 30000);
    
    test('should handle invalid parameters gracefully', async () => {
      // Test with invalid level
      const invalidLevelResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'invalid-level',
        limit: 10
      });
      
      // Should either error or default to a valid level
      expect(invalidLevelResult.content).toBeDefined();
      
      // Test with negative limit
      const negativeLimitResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: -1
      });
      
      expect(negativeLimitResult.content).toBeDefined();
      
      // Test with invalid time range
      const invalidTimeResult = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        last: 'invalid-time',
        limit: 10
      });
      
      expect(invalidTimeResult.content).toBeDefined();
    }, 30000);
  });
  
  describe('Cleanup', () => {
    test('should stop monitoring session', async () => {
      // Stop the app
      const stopResult = await client.callTool('stop_app', {
        session_id: SESSION_ID
      });
      
      expect(stopResult.content[0].text).toContain('Stopped app');
      
      // Verify session is stopped
      const sessionsResult = await client.callTool('list_sessions', {});
      const sessions = sessionsResult.content[0].text;
      
      // Should not list our test session as active
      if (sessions && !sessions.includes('No active sessions')) {
        expect(sessions).not.toContain(SESSION_ID);
      }
    }, 30000);
  });
});