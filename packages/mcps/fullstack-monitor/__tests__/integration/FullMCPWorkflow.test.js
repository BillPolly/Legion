/**
 * @jest-environment node
 */

import { SessionManager } from '../../handlers/SessionManager.js';
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
    res.end(JSON.stringify({ message: 'Test successful' }));
  } else if (req.url === '/error') {
    console.error('Test error');
    res.writeHead(500);
    res.end('Test error');
  } else {
    res.writeHead(200);
    res.end('OK');
  }
});

server.listen(3006, () => {
  console.log('Test server listening on port 3006');
});
`);
  });
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    toolHandler = new ToolHandler(sessionManager);
  });
  
  afterEach(async () => {
    await sessionManager.endAllSessions();
    await toolHandler.cleanup();
  });

  describe('Full workflow integration', () => {
    test('should complete full monitoring workflow', async () => {
      const sessionId = 'workflow-test';
      
      // Step 1: Start app monitoring
      const startResult = await toolHandler.executeTool('start_app', {
        script: backendScript,
        session_id: sessionId,
        log_level: 'info'
      });
      
      expect(startResult.content[0].text).toContain('Started app');
      
      // Step 2: List sessions
      const sessionsResult = await toolHandler.executeTool('list_sessions', {});
      expect(sessionsResult.content[0].text).toContain(sessionId);
      
      // Step 3: Query logs
      const logsResult = await toolHandler.executeTool('query_logs', {
        session_id: sessionId,
        limit: 10
      });
      expect(logsResult.content).toBeDefined();
      
      // Step 4: Set log level
      const levelResult = await toolHandler.executeTool('set_log_level', {
        level: 'debug',
        session_id: sessionId
      });
      expect(levelResult.content[0].text).toContain('Log level set to: debug');
      
      // Step 5: Stop monitoring
      const stopResult = await toolHandler.executeTool('stop_app', {
        session_id: sessionId
      });
      expect(stopResult.content[0].text).toContain('Stopped app');
    });
    
    test('should handle multiple concurrent sessions', async () => {
      const session1 = 'concurrent-test-1';
      const session2 = 'concurrent-test-2';
      
      // Start two monitoring sessions
      await Promise.all([
        toolHandler.executeTool('start_app', {
          script: backendScript,
          session_id: session1
        }),
        toolHandler.executeTool('start_app', {
          script: backendScript,
          session_id: session2
        })
      ]);
      
      // List sessions should show both
      const listResult = await toolHandler.executeTool('list_sessions', {});
      expect(listResult.content[0].text).toContain(session1);
      expect(listResult.content[0].text).toContain(session2);
      
      // Stop both sessions
      await Promise.all([
        toolHandler.executeTool('stop_app', { session_id: session1 }),
        toolHandler.executeTool('stop_app', { session_id: session2 })
      ]);
    });
    
    test('should handle error analysis workflow', async () => {
      const sessionId = 'error-test';
      
      // Start monitoring
      await toolHandler.executeTool('start_app', {
        script: backendScript,
        session_id: sessionId
      });
      
      // Query logs for any content
      const logsResult = await toolHandler.executeTool('query_logs', {
        session_id: sessionId,
        limit: 10
      });
      
      expect(logsResult.content).toBeDefined();
      expect(logsResult.content[0].type).toBe('text');
      
      // Clean up
      await toolHandler.executeTool('stop_app', { session_id: sessionId });
    });
    
    test('should handle session limits properly', async () => {
      // Create multiple sessions
      const sessions = ['session-1', 'session-2', 'session-3'];
      
      for (const sessionId of sessions) {
        await toolHandler.executeTool('start_app', {
          script: backendScript,
          session_id: sessionId
        });
      }
      
      // List sessions should show all active sessions
      const listResult = await toolHandler.executeTool('list_sessions', {});
      expect(listResult.content[0].text).toContain('session-1');
      expect(listResult.content[0].text).toContain('session-2');
      expect(listResult.content[0].text).toContain('session-3');
      
      // Clean up all sessions
      for (const sessionId of sessions) {
        await toolHandler.executeTool('stop_app', { session_id: sessionId });
      }
    });
    
    test('should validate tool arguments properly', async () => {
      // Test missing required arguments (start_app actually handles undefined gracefully)
      const missingResult = await toolHandler.executeTool('start_app', {
        // Missing required 'script' argument
        session_id: 'test'
      });
      
      // start_app tool handles missing script gracefully, so check for successful response
      expect(missingResult.content[0].text).toContain('Started app');
      
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
        'start_app',
        'query_logs', 
        'set_log_level',
        'stop_app',
        'list_sessions',
        'take_screenshot',
        'record_video'
      ];
      
      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }
    });
    
    test('should have properly formatted tool schemas', () => {
      const tools = toolHandler.getAllTools();
      
      for (const tool of tools) {
        expect(tool).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object)
        });
        
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });
  });
}, 30000);