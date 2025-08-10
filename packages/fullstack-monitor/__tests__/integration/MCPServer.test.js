/**
 * @jest-environment node
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MCP Server Integration', () => {
  let mcpServer;
  let testAppDir;
  let backendScript;
  let frontendFile;
  
  beforeAll(async () => {
    // Create test application
    testAppDir = path.join(__dirname, 'test-mcp-app');
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  
  if (req.url === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Test API response', timestamp: new Date().toISOString() }));
  } else if (req.url === '/api/error') {
    console.error('Test error occurred');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Test error for debugging' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3005, () => {
  console.log('Test server listening on port 3005');
});
`);
    
    // Create frontend HTML page
    frontendFile = path.join(testAppDir, 'index.html');
    writeFileSync(frontendFile, `
<!DOCTYPE html>
<html>
<head>
    <title>MCP Test App</title>
</head>
<body>
    <h1>MCP Full-Stack Monitor Test</h1>
    <button id="test-btn">Test API</button>
    <button id="error-btn">Trigger Error</button>
    <div id="results"></div>
    
    <script>
        console.log('Test app loaded');
        
        document.getElementById('test-btn').onclick = async () => {
            console.log('Testing API...');
            try {
                const response = await fetch('http://localhost:3005/api/test');
                const data = await response.json();
                document.getElementById('results').innerHTML = '<p>Success: ' + data.message + '</p>';
                console.log('API test successful:', data);
            } catch (error) {
                console.error('API test failed:', error);
                document.getElementById('results').innerHTML = '<p>Error: ' + error.message + '</p>';
            }
        };
        
        document.getElementById('error-btn').onclick = async () => {
            console.log('Triggering error...');
            try {
                const response = await fetch('http://localhost:3005/api/error');
                const data = await response.json();
                console.error('Expected error response:', data);
            } catch (error) {
                console.error('Error request failed:', error);
            }
        };
    </script>
</body>
</html>
`);
  });
  
  afterAll(async () => {
    if (mcpServer && !mcpServer.killed) {
      mcpServer.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        mcpServer.once('exit', resolve);
        setTimeout(resolve, 2000); // Fallback timeout
      });
    }
  });
  
  describe('MCP Protocol', () => {
    test('should start MCP server and handle initialization', async () => {
      const mcpServerPath = path.join(__dirname, '../../mcps/fullstack-monitor/mcp-server.js');
      
      mcpServer = spawn('node', [mcpServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
      });
      
      // Send initialize message
      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'jest-test-client',
            version: '1.0.0'
          }
        }
      };
      
      const responsePromise = new Promise((resolve, reject) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for response'));
        }, 10000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 1) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines (stderr messages)
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'fullstack-monitor',
            version: '1.0.0'
          }
        }
      });
    }, 15000);
    
    test('should list available tools', async () => {
      const listMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 2) {
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(listMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBe(13);
      
      const toolNames = response.result.tools.map(t => t.name);
      expect(toolNames).toContain('start_fullstack_monitoring');
      expect(toolNames).toContain('search_logs');
      expect(toolNames).toContain('execute_debug_scenario');
    }, 10000);
    
    test('should start full-stack monitoring', async () => {
      const frontendUrl = 'file://' + frontendFile;
      
      const startMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'start_fullstack_monitoring',
          arguments: {
            backend_script: backendScript,
            backend_name: 'test-server',
            backend_port: 3005,
            frontend_url: frontendUrl,
            headless: true,
            session_id: 'test-session'
          }
        }
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          resolve({ timeout: true });
        }, 30000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 3) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(startMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.timeout).toBeFalsy();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Full-stack monitoring started successfully');
    }, 35000);
    
    test('should execute debug scenario', async () => {
      // Wait a moment for monitoring to be fully set up
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const debugMessage = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'execute_debug_scenario',
          arguments: {
            steps: [
              { action: 'screenshot', options: { fullPage: true } },
              { action: 'click', selector: '#test-btn' },
              { action: 'waitFor', selector: '#results' }
            ],
            session_id: 'test-session'
          }
        }
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          resolve({ timeout: true });
        }, 20000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 4) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(debugMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.timeout).toBeFalsy();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Debug scenario completed');
    }, 25000);
    
    test('should search logs', async () => {
      const searchMessage = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'search_logs',
          arguments: {
            query: 'Test',
            mode: 'keyword',
            session_id: 'test-session'
          }
        }
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          resolve({ timeout: true });
        }, 10000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 5) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(searchMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.timeout).toBeFalsy();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Log Search Results');
    }, 15000);
    
    test('should get monitoring statistics', async () => {
      const statsMessage = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'get_monitoring_stats',
          arguments: {
            session_id: 'test-session'
          }
        }
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          resolve({ timeout: true });
        }, 10000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 6) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(statsMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.timeout).toBeFalsy();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Monitoring Statistics');
    }, 15000);
    
    test('should stop monitoring session', async () => {
      const stopMessage = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'stop_monitoring',
          arguments: {
            session_id: 'test-session'
          }
        }
      };
      
      const responsePromise = new Promise((resolve) => {
        let buffer = '';
        const timeout = setTimeout(() => {
          resolve({ timeout: true });
        }, 10000);
        
        mcpServer.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line);
                if (response.id === 7) {
                  clearTimeout(timeout);
                  resolve(response);
                  return;
                }
              } catch (err) {
                // Ignore non-JSON lines
              }
            }
          }
        });
      });
      
      mcpServer.stdin.write(JSON.stringify(stopMessage) + '\n');
      
      const response = await responsePromise;
      
      expect(response.timeout).toBeFalsy();
      expect(response.result.content).toBeDefined();
      expect(response.result.content[0].text).toContain('Monitoring stopped');
    }, 15000);
  });
});