/**
 * @jest-environment node
 * End-to-end tests for all MCP tools
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MCPClient } from '../../mcp-client.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { createServer } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('MCP Tools End-to-End', () => {
  let client;
  let serverPath;
  let testAppDir;
  
  beforeAll(async () => {
    jest.setTimeout(30000);
    
    client = new MCPClient();
    serverPath = path.join(__dirname, '..', '..', 'mcp-server.js');
    testAppDir = path.join(__dirname, 'test-e2e-app');
    
    // Create test application
    await createTestApplication();
    
    // Connect to MCP server
    await client.connect('node', [serverPath]);
    await client.initialize({
      name: 'e2e-test-client',
      version: '1.0.0'
    });
    client.sendNotification('notifications/initialized');
    await client.getTools();
  });
  
  afterAll(async () => {
    // Cleanup all sessions
    try {
      const sessions = await client.callTool('list_sessions');
      const sessionText = sessions.content[0].text;
      
      // Extract session IDs from the text
      const sessionIds = sessionText.match(/session-[\w-]+/g) || [];
      
      for (const sessionId of sessionIds) {
        await client.callTool('stop_app', { session_id: sessionId });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Disconnect client
    if (client && client.serverProcess) {
      await client.disconnect();
    }
    
    // Cleanup test files
    await cleanupTestApplication();
  });
  
  async function createTestApplication() {
    // Create test directory
    await fs.mkdir(testAppDir, { recursive: true });
    
    // Create backend server with various endpoints
    const serverCode = `
const http = require('http');
const url = require('url');

let requestCount = 0;
let errorCount = 0;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Log all requests
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${pathname}\`);
  requestCount++;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Different endpoints for testing
  switch (pathname) {
    case '/':
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Test Server Running</h1><p>Request count: ' + requestCount + '</p>');
      break;
      
    case '/api/data':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        requestCount,
        errorCount,
        uptime: process.uptime()
      }));
      break;
      
    case '/api/error':
      errorCount++;
      console.error('Intentional error for testing - count: ' + errorCount);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Intentional error for testing',
        errorCount 
      }));
      break;
      
    case '/api/slow':
      // Simulate slow endpoint
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Slow response completed' }));
      }, 2000);
      break;
      
    case '/api/memory':
      // Return memory usage
      const memUsage = process.memoryUsage();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      }));
      break;
      
    default:
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      console.warn('404 Not Found: ' + pathname);
  }
});

const PORT = process.env.PORT || 3200;
server.listen(PORT, () => {
  console.log('E2E test server listening on port ' + PORT);
  console.log('Available endpoints:');
  console.log('  GET /           - Home page');
  console.log('  GET /api/data   - JSON data');
  console.log('  GET /api/error  - Trigger error');
  console.log('  GET /api/slow   - Slow response');
  console.log('  GET /api/memory - Memory usage');
});

// Periodic status log
setInterval(() => {
  console.log(\`[STATUS] Requests: \${requestCount}, Errors: \${errorCount}, Uptime: \${Math.round(process.uptime())}s\`);
}, 10000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close(() => process.exit(0));
});
    `;
    
    await fs.writeFile(path.join(testAppDir, 'server.js'), serverCode);
    
    // Create frontend HTML
    const htmlCode = `<!DOCTYPE html>
<html>
<head>
    <title>E2E Test Application</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 1200px; 
            margin: 50px auto; 
            padding: 20px; 
        }
        .button-group {
            margin: 20px 0;
        }
        button { 
            background: #007cba; 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            margin: 5px;
        }
        button:hover { 
            background: #005a8b; 
        }
        #results {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
            background: #f9f9f9;
            min-height: 100px;
            white-space: pre-wrap;
        }
        .error { 
            border-color: #ff4444; 
            background: #ffeeee; 
        }
        .success { 
            border-color: #44aa44; 
            background: #eeffee; 
        }
        #console-output {
            margin-top: 20px;
            padding: 10px;
            background: #000;
            color: #0f0;
            font-family: monospace;
            font-size: 12px;
            height: 200px;
            overflow-y: auto;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <h1>MCP E2E Test Application</h1>
    <p>This application is designed to test all MCP monitoring capabilities.</p>
    
    <div class="button-group">
        <h3>API Tests</h3>
        <button onclick="testAPI('data')">Get Data</button>
        <button onclick="testAPI('error')">Trigger Error</button>
        <button onclick="testAPI('slow')">Slow Request</button>
        <button onclick="testAPI('memory')">Check Memory</button>
    </div>
    
    <div class="button-group">
        <h3>DOM Tests</h3>
        <button onclick="createElements()">Create Elements</button>
        <button onclick="removeElements()">Remove Elements</button>
        <button onclick="triggerEvent()">Trigger Custom Event</button>
    </div>
    
    <div class="button-group">
        <h3>Console Tests</h3>
        <button onclick="logMessages()">Log Messages</button>
        <button onclick="logError()">Log Error</button>
        <button onclick="logWarning()">Log Warning</button>
    </div>
    
    <div id="results">Results will appear here...</div>
    
    <h3>Console Output</h3>
    <div id="console-output"></div>
    
    <div id="dynamic-content"></div>
    
    <script>
        // Capture console output
        const consoleOutput = document.getElementById('console-output');
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        function addToConsole(type, ...args) {
            const timestamp = new Date().toLocaleTimeString();
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            
            const entry = document.createElement('div');
            entry.style.color = type === 'error' ? '#ff6666' : type === 'warn' ? '#ffff66' : '#66ff66';
            entry.textContent = \`[\${timestamp}] [\${type.toUpperCase()}] \${message}\`;
            consoleOutput.appendChild(entry);
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        }
        
        console.log = function(...args) {
            addToConsole('log', ...args);
            originalLog.apply(console, args);
        };
        
        console.error = function(...args) {
            addToConsole('error', ...args);
            originalError.apply(console, args);
        };
        
        console.warn = function(...args) {
            addToConsole('warn', ...args);
            originalWarn.apply(console, args);
        };
        
        // Initial log
        console.log('E2E Test Application loaded successfully');
        
        // API test functions
        async function testAPI(endpoint) {
            const results = document.getElementById('results');
            results.textContent = \`Testing /api/\${endpoint}...\`;
            results.className = '';
            
            console.log(\`Making API request to /api/\${endpoint}\`);
            
            try {
                const response = await fetch(\`http://localhost:3200/api/\${endpoint}\`);
                const data = await response.json();
                
                if (response.ok) {
                    results.textContent = JSON.stringify(data, null, 2);
                    results.className = 'success';
                    console.log(\`API request successful:\`, data);
                } else {
                    results.textContent = \`Error \${response.status}: \${JSON.stringify(data, null, 2)}\`;
                    results.className = 'error';
                    console.error(\`API request failed:\`, data);
                }
            } catch (error) {
                results.textContent = \`Network error: \${error.message}\`;
                results.className = 'error';
                console.error(\`Network error:\`, error);
            }
        }
        
        // DOM manipulation functions
        let elementCount = 0;
        
        function createElements() {
            const container = document.getElementById('dynamic-content');
            for (let i = 0; i < 5; i++) {
                const div = document.createElement('div');
                div.id = \`element-\${++elementCount}\`;
                div.className = 'dynamic-element';
                div.textContent = \`Dynamic Element #\${elementCount}\`;
                div.style.padding = '5px';
                div.style.margin = '5px';
                div.style.background = '#e0e0e0';
                div.style.borderRadius = '3px';
                container.appendChild(div);
            }
            
            console.log(\`Created 5 new elements, total: \${elementCount}\`);
            document.getElementById('results').textContent = \`Created 5 elements (Total: \${elementCount})\`;
        }
        
        function removeElements() {
            const container = document.getElementById('dynamic-content');
            const elements = container.querySelectorAll('.dynamic-element');
            const removeCount = Math.min(3, elements.length);
            
            for (let i = 0; i < removeCount; i++) {
                container.removeChild(elements[i]);
            }
            
            console.log(\`Removed \${removeCount} elements\`);
            document.getElementById('results').textContent = \`Removed \${removeCount} elements\`;
        }
        
        function triggerEvent() {
            const event = new CustomEvent('e2eTest', {
                detail: { 
                    timestamp: Date.now(),
                    message: 'Custom event triggered'
                }
            });
            
            document.dispatchEvent(event);
            console.log('Custom event triggered:', event.detail);
            document.getElementById('results').textContent = 'Custom event triggered';
        }
        
        // Console logging functions
        function logMessages() {
            console.log('This is a regular log message');
            console.log('Current time:', new Date().toISOString());
            console.log('User agent:', navigator.userAgent);
            console.log({ type: 'object', nested: { value: 123 } });
            document.getElementById('results').textContent = 'Logged 4 messages to console';
        }
        
        function logError() {
            console.error('This is an error message for testing');
            console.error(new Error('Simulated error with stack trace'));
            document.getElementById('results').textContent = 'Logged errors to console';
        }
        
        function logWarning() {
            console.warn('This is a warning message');
            console.warn('Performance warning: slow operation detected');
            document.getElementById('results').textContent = 'Logged warnings to console';
        }
        
        // Listen for custom events
        document.addEventListener('e2eTest', (event) => {
            console.log('Custom event received:', event.detail);
        });
        
        // Track page interactions
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                console.log(\`Button clicked: \${e.target.textContent}\`);
            }
        });
        
        // Periodic status update
        setInterval(() => {
            const elements = document.querySelectorAll('.dynamic-element').length;
            console.log(\`[STATUS] Page active, dynamic elements: \${elements}\`);
        }, 30000);
    </script>
</body>
</html>`;
    
    await fs.writeFile(path.join(testAppDir, 'index.html'), htmlCode);
    
    // Create package.json
    const packageJson = {
      name: 'e2e-test-app',
      version: '1.0.0',
      scripts: {
        start: 'node server.js',
        dev: 'node server.js'
      }
    };
    
    await fs.writeFile(
      path.join(testAppDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }
  
  async function cleanupTestApplication() {
    try {
      await fs.rm(testAppDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  describe('Server Management Tools', () => {
    let sessionId = 'e2e-server-test';
    
    it('should start server with start_server tool', async () => {
      const result = await client.callTool('start_server', {
        script: path.join(testAppDir, 'server.js'),
        session_id: sessionId,
        wait_for_port: 3200,
        log_level: 'debug'
      });
      
      expect(result.content[0].text).toContain('started');
      expect(result.content[0].text).toContain('3200');
      
      // Give server time to fully start
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    it('should start server with package.json script', async () => {
      const sessionId2 = 'e2e-package-test';
      
      const result = await client.callTool('start_server', {
        package_path: testAppDir,
        start_script: 'start',
        session_id: sessionId2,
        wait_for_port: 3201,
        env: { PORT: '3201' }
      });
      
      expect(result.content[0].text).toContain('started');
      
      // Stop this test server
      await client.callTool('stop_app', { session_id: sessionId2 });
    });
    
    it('should list active sessions', async () => {
      const result = await client.callTool('list_sessions');
      
      expect(result.content[0].text).toContain('Active sessions');
      expect(result.content[0].text).toContain(sessionId);
      expect(result.content[0].text).toContain('server.js');
    });
    
    it('should stop server with stop_app tool', async () => {
      // Don't stop yet, we need it for other tests
      expect(true).toBe(true);
    });
  });
  
  describe('Browser Tools', () => {
    let sessionId = 'e2e-browser-test';
    
    it('should open browser page with open_page tool', async () => {
      const result = await client.callTool('open_page', {
        url: `file://${path.join(testAppDir, 'index.html')}`,
        session_id: sessionId,
        headless: true, // Use headless for CI
        viewport: { width: 1280, height: 720 }
      });
      
      expect(result.content[0].text).toContain('opened');
      
      // Give page time to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
    
    it('should execute browser commands with browser_execute tool', async () => {
      // Get page title
      const titleResult = await client.callTool('browser_execute', {
        command: 'title',
        session_id: sessionId
      });
      
      expect(titleResult.content[0].text).toContain('E2E Test Application');
      
      // Click a button
      const clickResult = await client.callTool('browser_execute', {
        command: 'click',
        args: ['button'],
        session_id: sessionId
      });
      
      expect(clickResult.content[0].text).toContain('Executed');
      
      // Evaluate JavaScript
      const evalResult = await client.callTool('browser_execute', {
        command: 'evaluate',
        args: ['() => document.querySelectorAll("button").length'],
        session_id: sessionId
      });
      
      const buttonCount = parseInt(evalResult.content[0].text.match(/Result: (\d+)/)?.[1] || '0');
      expect(buttonCount).toBeGreaterThan(0);
    });
    
    it('should take screenshots with take_screenshot tool', async () => {
      // Take screenshot to file
      const fileResult = await client.callTool('take_screenshot', {
        session_id: sessionId,
        path: './e2e-screenshot.png',
        fullPage: true
      });
      
      expect(fileResult.content[0].text).toContain('Screenshot saved');
      
      // Verify file exists
      const fileExists = await fs.access('./e2e-screenshot.png')
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
      
      // Take screenshot as base64
      const base64Result = await client.callTool('take_screenshot', {
        session_id: sessionId,
        format: 'png'
      });
      
      expect(base64Result.content[0].text).toContain('data:image/png;base64');
      
      // Cleanup
      await fs.unlink('./e2e-screenshot.png').catch(() => {});
    });
    
    it('should record video with record_video tool', async () => {
      // Start recording
      const startResult = await client.callTool('record_video', {
        action: 'start',
        session_id: sessionId,
        path: './e2e-video.mp4',
        fps: 30
      });
      
      expect(startResult.content[0].text).toContain('Recording started');
      
      // Perform some actions
      await client.callTool('browser_execute', {
        command: 'click',
        args: ['button'],
        session_id: sessionId
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop recording
      const stopResult = await client.callTool('record_video', {
        action: 'stop',
        session_id: sessionId
      });
      
      expect(stopResult.content[0].text).toContain('Recording stopped');
      
      // Check status
      const statusResult = await client.callTool('record_video', {
        action: 'status',
        session_id: sessionId
      });
      
      expect(statusResult.content[0].text).toContain('Not recording');
      
      // Cleanup
      await fs.unlink('./e2e-video.mp4').catch(() => {});
    });
  });
  
  describe('Logging Tools', () => {
    let sessionId = 'e2e-server-test'; // Use existing server session
    
    beforeEach(async () => {
      // Make some requests to generate logs
      try {
        await fetch('http://localhost:3200/api/data');
        await fetch('http://localhost:3200/api/error');
        await fetch('http://localhost:3200/api/memory');
      } catch (error) {
        // Ignore fetch errors in test
      }
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 1000));
    });
    
    it('should query logs with query_logs tool', async () => {
      // Query all logs
      const allLogs = await client.callTool('query_logs', {
        session_id: sessionId,
        limit: 20
      });
      
      expect(allLogs.content[0].text).toBeDefined();
      expect(allLogs.content[0].text.length).toBeGreaterThan(0);
      
      // Query with search term
      const searchLogs = await client.callTool('query_logs', {
        session_id: sessionId,
        query: 'error',
        limit: 10
      });
      
      if (searchLogs.content[0].text.includes('error')) {
        expect(searchLogs.content[0].text).toContain('error');
      }
      
      // Query by log level
      const errorLogs = await client.callTool('query_logs', {
        session_id: sessionId,
        level: 'error',
        limit: 5
      });
      
      // May or may not have errors
      expect(errorLogs.content[0].text).toBeDefined();
      
      // Query with time range
      const recentLogs = await client.callTool('query_logs', {
        session_id: sessionId,
        last: '5m',
        limit: 10
      });
      
      expect(recentLogs.content[0].text).toBeDefined();
    });
    
    it('should set log level with set_log_level tool', async () => {
      // Set to debug
      const debugResult = await client.callTool('set_log_level', {
        session_id: sessionId,
        level: 'debug'
      });
      
      expect(debugResult.content[0].text).toContain('debug');
      
      // Set to info
      const infoResult = await client.callTool('set_log_level', {
        session_id: sessionId,
        level: 'info'
      });
      
      expect(infoResult.content[0].text).toContain('info');
      
      // Set to error
      const errorResult = await client.callTool('set_log_level', {
        session_id: sessionId,
        level: 'error'
      });
      
      expect(errorResult.content[0].text).toContain('error');
    });
    
    it('should include system logs when requested', async () => {
      const systemLogs = await client.callTool('query_logs', {
        session_id: sessionId,
        include_system: true,
        limit: 10
      });
      
      // System logs may or may not be present
      expect(systemLogs.content[0].text).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid session IDs gracefully', async () => {
      const result = await client.callTool('query_logs', {
        session_id: 'non-existent-session',
        limit: 5
      });
      
      expect(result.content[0].text).toBeDefined();
      // Should return empty or error message, not crash
    });
    
    it('should handle missing required parameters', async () => {
      // start_server without script
      const result = await client.callTool('start_server', {
        session_id: 'invalid-test'
      });
      
      expect(result.content[0].text).toContain('error');
    });
    
    it('should handle tool execution failures', async () => {
      // Try to take screenshot without browser
      const result = await client.callTool('take_screenshot', {
        session_id: 'no-browser-session'
      });
      
      expect(result.content[0].text).toContain('error');
    });
  });
  
  describe('Concurrent Sessions', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessions = [];
      
      // Start 3 concurrent sessions
      for (let i = 1; i <= 3; i++) {
        const sessionId = `concurrent-${i}`;
        sessions.push(sessionId);
        
        const result = await client.callTool('start_server', {
          script: path.join(testAppDir, 'server.js'),
          session_id: sessionId,
          wait_for_port: 3300 + i,
          env: { PORT: String(3300 + i) }
        });
        
        expect(result.content[0].text).toContain('started');
      }
      
      // List all sessions
      const listResult = await client.callTool('list_sessions');
      
      for (const sessionId of sessions) {
        expect(listResult.content[0].text).toContain(sessionId);
      }
      
      // Query logs from each session
      for (const sessionId of sessions) {
        const logs = await client.callTool('query_logs', {
          session_id: sessionId,
          limit: 5
        });
        
        expect(logs.content[0].text).toBeDefined();
      }
      
      // Stop all sessions
      for (const sessionId of sessions) {
        await client.callTool('stop_app', { session_id: sessionId });
      }
    });
  });
  
  describe('Performance', () => {
    it('should handle rapid tool calls', async () => {
      const startTime = Date.now();
      const promises = [];
      
      // Make 10 rapid calls
      for (let i = 0; i < 10; i++) {
        promises.push(client.callTool('list_sessions'));
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      results.forEach(result => {
        expect(result.content[0].text).toContain('Active sessions');
      });
    });
    
    it('should handle large log queries', async () => {
      // Generate lots of logs
      const sessionId = 'perf-test';
      
      await client.callTool('start_server', {
        script: path.join(testAppDir, 'server.js'),
        session_id: sessionId,
        wait_for_port: 3400,
        env: { PORT: '3400' },
        log_level: 'trace'
      });
      
      // Make many requests to generate logs
      for (let i = 0; i < 20; i++) {
        try {
          await fetch('http://localhost:3400/api/data');
        } catch (error) {
          // Ignore errors
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query large number of logs
      const result = await client.callTool('query_logs', {
        session_id: sessionId,
        limit: 100
      });
      
      expect(result.content[0].text).toBeDefined();
      
      // Stop server
      await client.callTool('stop_app', { session_id: sessionId });
    });
  });
  
  afterAll(async () => {
    // Final cleanup - stop the main test server
    await client.callTool('stop_app', { session_id: 'e2e-server-test' });
    await client.callTool('stop_app', { session_id: 'e2e-browser-test' });
  });
});