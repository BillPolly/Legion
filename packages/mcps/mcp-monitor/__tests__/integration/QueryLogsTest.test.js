/**
 * @jest-environment node
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Query Logs Integration Test', () => {
  let client;
  const SESSION_ID = 'query-logs-test';

  beforeEach(async () => {
    client = new MCPClient();
    await client.connect('node', [path.join(__dirname, '../../mcp-server.js')]);
    await client.initialize({ name: 'query-logs-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
  });

  afterEach(async () => {
    if (client) {
      // Try to clean up the session
      try {
        await client.callTool('stop_app', { session_id: SESSION_ID });
      } catch (e) {
        // Ignore cleanup errors
      }
      await client.disconnect();
    }
  });

  describe('Log querying functionality', () => {
    test('should handle query_logs for non-existent session', async () => {
      const result = await client.callTool('query_logs', {
        session_id: 'nonexistent-session',
        limit: 5
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      // Should handle gracefully without crashing
    });
    
    test('should handle query_logs with different parameters', async () => {
      // Test with limit
      const result1 = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: 10
      });
      expect(result1.content).toBeDefined();
      
      // Test with level filter
      const result2 = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'info'
      });
      expect(result2.content).toBeDefined();
      
      // Test with search term
      const result3 = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        search: 'test'
      });
      expect(result3.content).toBeDefined();
    });
    
    test('should validate query_logs parameters', async () => {
      // Test with invalid limit
      const result1 = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        limit: -1
      });
      expect(result1.content).toBeDefined();
      
      // Test with invalid level
      const result2 = await client.callTool('query_logs', {
        session_id: SESSION_ID,
        level: 'invalid-level'
      });
      expect(result2.content).toBeDefined();
    });
    
    test('should handle list_sessions', async () => {
      const result = await client.callTool('list_sessions', {});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      // Initially should show "No active sessions"
      expect(result.content[0].text).toBe('No active sessions');
    });
  });
});