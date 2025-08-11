/**
 * @jest-environment node
 */

import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Query Logs Verification Test', () => {
  let client;

  beforeEach(async () => {
    client = new MCPClient();
    await client.connect('node', [path.join(__dirname, '../../mcp-server.js')]);
    await client.initialize({ name: 'verification-client', version: '1.0.0' });
    client.sendNotification('notifications/initialized');
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  describe('MCP Server Connection', () => {
    test('should connect to MCP server', async () => {
      // Connection is already established in beforeEach
      expect(client).toBeDefined();
      expect(client.serverProcess).toBeDefined();
    });
    
    test('should list available tools', async () => {
      const tools = await client.getTools();
      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('query_logs');
      expect(toolNames).toContain('list_sessions');
      expect(toolNames).toContain('set_log_level');
    });
  });

  describe('Tool Functionality', () => {
    test('should execute query_logs tool', async () => {
      const result = await client.callTool('query_logs', {
        session_id: 'test-session',
        limit: 5
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
    
    test('should execute list_sessions tool', async () => {
      const result = await client.callTool('list_sessions', {});
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('No active sessions');
    });
    
    test('should execute set_log_level tool', async () => {
      const result = await client.callTool('set_log_level', {
        session_id: 'test-session',
        level: 'info'
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Log level set');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown tool gracefully', async () => {
      const result = await client.callTool('unknown_tool', {});
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Unknown tool');
    });
    
    test('should handle invalid parameters gracefully', async () => {
      const result = await client.callTool('query_logs', {
        invalid_param: 'invalid_value'
      });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });
});