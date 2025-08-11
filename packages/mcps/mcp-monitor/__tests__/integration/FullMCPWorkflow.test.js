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
    
    test('should validate tool arguments for new focused tools', async () => {
      // Test missing required arguments for start_server
      const missingServerResult = await toolHandler.executeTool('start_server', {});
      expect(missingServerResult.isError).toBe(true);
      expect(missingServerResult.content[0].text).toContain('Missing required parameter "script"');
      
      // Test invalid script path for start_server
      const invalidServerResult = await toolHandler.executeTool('start_server', {
        script: '/nonexistent/path/script.js'
      });
      expect(invalidServerResult.isError).toBe(true);
      expect(invalidServerResult.content[0].text).toContain('Script file not found');
      
      // Test open_page without active server
      const noServerResult = await toolHandler.executeTool('open_page', {
        session_id: 'nonexistent-session'
      });
      expect(noServerResult.isError).toBe(true);
      expect(noServerResult.content[0].text).toContain('No active server found');
      expect(noServerResult.content[0].text).toContain('Start a server first with \'start_server\'');
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

    test('should demonstrate new focused workflow', async () => {
      // This test demonstrates the new start_server + open_page workflow
      // Note: This is a validation test - doesn't actually start servers due to test env constraints
      
      const tools = toolHandler.getAllTools();
      const toolNames = tools.map(t => t.name);
      
      // Verify new tools exist
      expect(toolNames).toContain('start_server');
      expect(toolNames).toContain('open_page');
      
      // Verify new tool schemas
      const startServerTool = tools.find(t => t.name === 'start_server');
      expect(startServerTool.inputSchema.required).toContain('script');
      expect(startServerTool.inputSchema.properties.script).toBeDefined();
      expect(startServerTool.inputSchema.properties.session_id).toBeDefined();
      expect(startServerTool.inputSchema.properties.log_level).toBeDefined();
      
      const openPageTool = tools.find(t => t.name === 'open_page');
      expect(openPageTool.inputSchema.properties.url).toBeDefined();
      expect(openPageTool.inputSchema.properties.session_id).toBeDefined();
      expect(openPageTool.inputSchema.properties.headless).toBeDefined();
      expect(openPageTool.inputSchema.properties.viewport).toBeDefined();
      
      // Verify headless defaults to false for better UX
      expect(openPageTool.inputSchema.properties.headless.default).toBe(false);
    });

    test('should demonstrate clean focused tool architecture', async () => {
      // Verify we have a clean set of focused tools
      const tools = toolHandler.getAllTools();
      const toolNames = tools.map(t => t.name);
      
      // Should have new focused tools
      expect(toolNames).toContain('start_server');
      expect(toolNames).toContain('open_page');
      
      // Should NOT have legacy start_app
      expect(toolNames).not.toContain('start_app');
      
      // Verify clean separation of concerns
      const startServerTool = tools.find(t => t.name === 'start_server');
      const openPageTool = tools.find(t => t.name === 'open_page');
      
      // start_server should be focused on server only
      expect(startServerTool.inputSchema.properties.browser_url).toBeUndefined();
      expect(startServerTool.inputSchema.properties.browser_headless).toBeUndefined();
      
      // open_page should be focused on browser only
      expect(openPageTool.inputSchema.properties.script).toBeUndefined();
      expect(openPageTool.inputSchema.properties.wait_for_port).toBeUndefined();
    });
  });
});