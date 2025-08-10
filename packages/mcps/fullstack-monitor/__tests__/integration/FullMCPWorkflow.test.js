/**
 * @jest-environment node
 */

import { StandaloneSessionManager } from '../../handlers/StandaloneSessionManager.js';
import { ToolHandler } from '../../handlers/ToolHandler.js';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Full MCP Workflow Integration', () => {
  let sessionManager;
  let toolHandler;
  let testAppDir;
  let backendScript;
  let frontendFile;
  
  beforeAll(() => {
    // Create test application files
    testAppDir = path.join(__dirname, 'test-workflow-app');
    try {
      mkdirSync(testAppDir, { recursive: true });
    } catch (err) {
      // Directory already exists
    }
    
    // Create backend test server
    backendScript = path.join(testAppDir, 'server.js');
    writeFileSync(backendScript, `
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url}\`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.url === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Test API response' }));
  } else if (req.url === '/api/error') {
    console.error('Test error occurred');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Test error for debugging' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3006, () => {
  console.log('Test server listening on port 3006');
});
`);
    
    // Create frontend HTML page
    frontendFile = path.join(testAppDir, 'index.html');
    writeFileSync(frontendFile, `
<!DOCTYPE html>
<html>
<head>
    <title>MCP Integration Test App</title>
</head>
<body>
    <h1>MCP Integration Test</h1>
    <button id="test-btn">Test API</button>
    <button id="error-btn">Trigger Error</button>
    <div id="results"></div>
    
    <script>
        console.log('Test app loaded for integration testing');
        
        document.getElementById('test-btn').onclick = async () => {
            console.log('Testing API call...');
            try {
                const response = await fetch('http://localhost:3006/api/test');
                const data = await response.json();
                document.getElementById('results').innerHTML = '<p>Success: ' + data.message + '</p>';
                console.log('API test successful:', data);
            } catch (error) {
                console.error('API test failed:', error);
                document.getElementById('results').innerHTML = '<p>Error: ' + error.message + '</p>';
            }
        };
    </script>
</body>
</html>
`);
  });
  
  beforeEach(() => {
    sessionManager = new StandaloneSessionManager();
    toolHandler = new ToolHandler(sessionManager);
  });
  
  afterEach(async () => {
    await sessionManager.endAllSessions();
  });
  
  describe('Full workflow integration', () => {
    test('should complete full monitoring workflow', async () => {
      const sessionId = 'integration-test-session';
      const frontendUrl = 'file://' + frontendFile;
      
      // Step 1: Start full-stack monitoring
      const startResult = await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        backend_name: 'integration-test-server',
        backend_port: 3006,
        frontend_url: frontendUrl,
        headless: true,
        session_id: sessionId
      });
      
      expect(startResult.content[0].text).toContain('Full-stack monitoring started successfully');
      expect(startResult.content[0].text).toContain('integration-test-server');
      expect(startResult.content[0].text).toContain(sessionId);
      
      // Verify session was created
      expect(sessionManager.hasSession(sessionId)).toBe(true);
      
      // Step 2: Get monitoring statistics
      const statsResult = await toolHandler.executeTool('get_monitoring_stats', {
        session_id: sessionId
      });
      
      expect(statsResult.content[0].text).toContain('Monitoring Statistics');
      expect(statsResult.content[0].text).toContain(sessionId);
      
      // Step 3: Execute a debug scenario
      const debugResult = await toolHandler.executeTool('execute_debug_scenario', {
        steps: [
          { action: 'screenshot', options: { fullPage: true } },
          { action: 'click', selector: '#test-btn' },
          { action: 'waitFor', selector: '#results' }
        ],
        session_id: sessionId
      });
      
      expect(debugResult.content[0].text).toContain('Debug scenario completed');
      expect(debugResult.content[0].text).toContain('3/3 steps successful');
      
      // Step 4: Search logs for activity
      const searchResult = await toolHandler.executeTool('search_logs', {
        query: 'server',
        mode: 'keyword',
        source: 'all',
        session_id: sessionId
      });
      
      expect(searchResult.content[0].text).toContain('Log Search Results');
      expect(searchResult.content[0].text).toContain('server');
      
      // Step 5: List all sessions
      const sessionsResult = await toolHandler.executeTool('list_sessions', {});
      
      expect(sessionsResult.content[0].text).toContain('list_sessions completed successfully');
      expect(sessionsResult.content[0].text).toContain('"count": 1');
      
      // Step 6: Stop monitoring
      const stopResult = await toolHandler.executeTool('stop_monitoring', {
        session_id: sessionId
      });
      
      expect(stopResult.content[0].text).toContain('Monitoring stopped');
      expect(stopResult.content[0].text).toContain(sessionId);
      
      // Verify session was cleaned up
      expect(sessionManager.hasSession(sessionId)).toBe(false);
    }, 30000);
    
    test('should handle multiple concurrent sessions', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const frontendUrl = 'file://' + frontendFile;
      
      // Start two monitoring sessions
      await Promise.all([
        toolHandler.executeTool('start_fullstack_monitoring', {
          backend_script: backendScript,
          backend_name: 'test-server-1',
          backend_port: 3006,
          frontend_url: frontendUrl,
          session_id: session1
        }),
        toolHandler.executeTool('start_fullstack_monitoring', {
          backend_script: backendScript,
          backend_name: 'test-server-2',
          backend_port: 3006,
          frontend_url: frontendUrl,
          session_id: session2
        })
      ]);
      
      // Verify both sessions exist
      expect(sessionManager.hasSession(session1)).toBe(true);
      expect(sessionManager.hasSession(session2)).toBe(true);
      
      // Get stats from both sessions
      const [stats1, stats2] = await Promise.all([
        toolHandler.executeTool('get_monitoring_stats', { session_id: session1 }),
        toolHandler.executeTool('get_monitoring_stats', { session_id: session2 })
      ]);
      
      expect(stats1.content[0].text).toContain(session1);
      expect(stats2.content[0].text).toContain(session2);
      
      // List sessions should show both
      const listResult = await toolHandler.executeTool('list_sessions', {});
      expect(listResult.content[0].text).toContain('"count": 2');
      
      // Stop one session
      await toolHandler.executeTool('stop_monitoring', { session_id: session1 });
      
      expect(sessionManager.hasSession(session1)).toBe(false);
      expect(sessionManager.hasSession(session2)).toBe(true);
      
      // Stop remaining session
      await toolHandler.executeTool('stop_monitoring', { session_id: session2 });
      
      expect(sessionManager.hasSession(session2)).toBe(false);
    });
    
    test('should handle error analysis workflow', async () => {
      const sessionId = 'error-analysis-session';
      const frontendUrl = 'file://' + frontendFile;
      
      // Start monitoring
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        backend_name: 'error-test-server',
        frontend_url: frontendUrl,
        session_id: sessionId
      });
      
      // Analyze a specific error
      const errorResult = await toolHandler.executeTool('analyze_error', {
        error_message: 'Test error',
        time_range: '5m',
        session_id: sessionId
      });
      
      expect(errorResult.content[0].text).toContain('Error Analysis');
      expect(errorResult.content[0].text).toContain('Test error');
      
      // Get recent errors
      const recentResult = await toolHandler.executeTool('get_recent_errors', {
        minutes: 10,
        session_id: sessionId
      });
      
      expect(recentResult.content[0].text).toContain('Recent Errors');
      
      // Get correlations (should handle empty correlation ID gracefully)
      const corrResult = await toolHandler.executeTool('get_correlations', {
        correlation_id: 'non-existent-correlation',
        session_id: sessionId
      });
      
      expect(corrResult.content[0].text).toContain('Correlation Analysis');
      
      // Clean up
      await toolHandler.executeTool('stop_monitoring', { session_id: sessionId });
    });
    
    test('should handle session limits properly', async () => {
      const frontendUrl = 'file://' + frontendFile;
      
      // Create maximum number of sessions (3)
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        frontend_url: frontendUrl,
        session_id: 'session-1'
      });
      
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        frontend_url: frontendUrl,
        session_id: 'session-2'
      });
      
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        frontend_url: frontendUrl,
        session_id: 'session-3'
      });
      
      expect(sessionManager.getActiveSessions().length).toBe(3);
      
      // Creating a 4th session should clean up the oldest
      await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: backendScript,
        frontend_url: frontendUrl,
        session_id: 'session-4'
      });
      
      expect(sessionManager.getActiveSessions().length).toBe(3);
      expect(sessionManager.hasSession('session-1')).toBe(false); // Oldest should be gone
      expect(sessionManager.hasSession('session-4')).toBe(true);   // Newest should exist
      
      // Clean up remaining sessions
      await sessionManager.endAllSessions();
    });
    
    test('should validate tool arguments properly', async () => {
      // Test missing required arguments
      const missingResult = await toolHandler.executeTool('start_fullstack_monitoring', {
        // Missing backend_script and frontend_url
        session_id: 'test'
      });
      
      expect(missingResult.isError).toBe(true);
      expect(missingResult.content[0].text).toContain('Missing required field');
      
      // Test invalid argument types
      const invalidResult = await toolHandler.executeTool('start_fullstack_monitoring', {
        backend_script: './test.js',
        frontend_url: 'http://localhost:3000',
        backend_port: 'not-a-number' // Should be number
      });
      
      expect(invalidResult.isError).toBe(true);
      expect(invalidResult.content[0].text).toContain('should be number');
      
      // Test unknown tool
      const unknownResult = await toolHandler.executeTool('unknown_tool', {});
      
      expect(unknownResult.isError).toBe(true);
      expect(unknownResult.content[0].text).toContain('Unknown tool: unknown_tool');
    });
  });
  
  describe('Tool coverage verification', () => {
    test('should have all expected tools available', () => {
      const tools = toolHandler.getAllTools();
      const toolNames = tools.map(t => t.name);
      
      const expectedTools = [
        'start_fullstack_monitoring',
        'stop_monitoring',
        'get_monitoring_stats',
        'list_sessions',
        'execute_debug_scenario',
        'debug_user_flow',
        'take_screenshot',
        'search_logs',
        'get_correlations',
        'analyze_error',
        'get_recent_errors',
        'trace_request'
      ];
      
      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }
      
      expect(tools.length).toBe(expectedTools.length);
    });
    
    test('should have properly formatted tool schemas', () => {
      const tools = toolHandler.getAllTools();
      
      for (const tool of tools) {
        expect(tool).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.objectContaining({
            type: 'object',
            properties: expect.any(Object)
          })
        });
        
        // Verify required fields are arrays if they exist
        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        }
      }
    });
  });
});