/**
 * @jest-environment node
 */

import { SessionManager } from '../../handlers/SessionManager.js';
import { ToolHandler } from '../../handlers/ToolHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Full MCP Workflow Integration', () => {
  let sessionManager;
  let toolHandler;
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    toolHandler = new ToolHandler(sessionManager);
  });
  
  afterEach(async () => {
    await sessionManager.endAllSessions();
    await toolHandler.cleanup();
  });

  describe('Tool integration tests', () => {
    test('should handle basic session management', async () => {
      // Test list_sessions (should show "No active sessions" initially)
      const sessionsResult = await toolHandler.executeTool('list_sessions', {});
      expect(sessionsResult.content[0].text).toBe('No active sessions');
      
      // Test set_log_level
      const logResult = await toolHandler.executeTool('set_log_level', {
        session_id: 'test-session',
        level: 'debug'
      });
      expect(logResult.content[0].text).toContain('Log level set');
    });
    
    test('should handle query_logs for non-existent session', async () => {
      // Query logs for a session that doesn't exist
      const logsResult = await toolHandler.executeTool('query_logs', {
        session_id: 'nonexistent-session',
        limit: 10
      });
      expect(logsResult.content).toBeDefined();
      expect(logsResult.content[0].type).toBe('text');
    });
    
    test('should handle stop_app for non-existent session', async () => {
      // Try to stop a session that doesn't exist
      const stopResult = await toolHandler.executeTool('stop_app', {
        session_id: 'nonexistent-session'
      });
      expect(stopResult.content).toBeDefined();
      expect(stopResult.content[0].type).toBe('text');
    });
    
    test('should validate tool arguments', async () => {
      // Test missing required arguments for start_app
      const missingResult = await toolHandler.executeTool('start_app', {});
      expect(missingResult.isError).toBe(true);
      expect(missingResult.content[0].text).toContain('Missing required parameter "script"');
      
      // Test invalid script path
      const invalidResult = await toolHandler.executeTool('start_app', {
        script: '/nonexistent/path/script.js'
      });
      expect(invalidResult.isError).toBe(true);
      expect(invalidResult.content[0].text).toContain('Script file not found');
    });
    
    test('should handle set_log_level with different levels', async () => {
      const levels = ['debug', 'info', 'warn', 'error'];
      
      for (const level of levels) {
        const result = await toolHandler.executeTool('set_log_level', {
          session_id: 'test-session',
          level: level
        });
        expect(result.content[0].text).toContain(`Log level set to: ${level}`);
      }
    });
  });
});