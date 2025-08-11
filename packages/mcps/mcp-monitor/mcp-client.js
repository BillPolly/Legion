#!/usr/bin/env node

/**
 * MCP Client for FullStack Monitor
 * Simulates how Claude Code would interact with the MCP server
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

class MCPClient extends EventEmitter {
  constructor() {
    super();
    this.serverProcess = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.tools = [];
    this.serverInfo = null;
    this.buffer = '';
  }

  /**
   * Connect to MCP server
   */
  async connect(serverCommand, serverArgs = []) {
    console.log(`🔌 Starting MCP server: ${serverCommand} ${serverArgs.join(' ')}`);
    
    this.serverProcess = spawn(serverCommand, serverArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });

    // Handle server output
    this.serverProcess.stdout.on('data', (data) => {
      this.handleServerData(data);
    });

    // Handle server errors
    this.serverProcess.stderr.on('data', (data) => {
      const text = data.toString();
      if (!text.includes('ExperimentalWarning')) {
        console.log(`📢 Server: ${text.trim()}`);
      }
    });

    // Handle server exit
    this.serverProcess.on('exit', (code) => {
      console.log(`🔴 Server exited with code: ${code}`);
      this.emit('serverExit', code);
    });

    // Wait for server to be ready
    await new Promise((resolve) => {
      this.serverProcess.stderr.on('data', (data) => {
        if (data.toString().includes('MCP Server ready for connections')) {
          resolve();
        }
      });
      setTimeout(resolve, 3000); // Fallback timeout
    });

    console.log('✅ Server ready for connections');
  }

  /**
   * Handle data from server
   */
  handleServerData(data) {
    this.buffer += data.toString();
    
    // Process complete messages (one per line)
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleServerMessage(message);
        } catch (error) {
          console.error('❌ Failed to parse server message:', line);
        }
      }
    }
  }

  /**
   * Handle parsed message from server
   */
  handleServerMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject, method } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        console.log(`❌ ${method} failed:`, message.error.message);
        reject(new Error(message.error.message));
      } else {
        console.log(`✅ ${method} completed`);
        resolve(message.result);
      }
    }
  }

  /**
   * Send message to server
   */
  async sendMessage(method, params = {}) {
    const id = ++this.messageId;
    
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    console.log(`📤 Sending ${method} (ID: ${id})`);
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });
      
      this.serverProcess.stdin.write(JSON.stringify(message) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout waiting for response to ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Initialize MCP connection
   */
  async initialize(clientInfo = { name: 'mcp-client', version: '1.0.0' }) {
    console.log('🤝 Initializing MCP connection...');
    
    const result = await this.sendMessage('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo
    });
    
    this.serverInfo = result.serverInfo;
    console.log(`🎯 Connected to ${result.serverInfo.name} v${result.serverInfo.version}`);
    
    return result;
  }

  /**
   * Get available tools
   */
  async getTools() {
    console.log('🔧 Fetching available tools...');
    
    const result = await this.sendMessage('tools/list');
    this.tools = result.tools;
    
    console.log(`📋 Found ${this.tools.length} tools:`);
    this.tools.forEach(tool => {
      console.log(`  • ${tool.name}: ${tool.description}`);
    });
    
    return this.tools;
  }

  /**
   * Call a tool
   */
  async callTool(toolName, args = {}) {
    console.log(`🛠️  Calling tool: ${toolName}`);
    console.log(`   Args:`, JSON.stringify(args, null, 2));
    
    const result = await this.sendMessage('tools/call', {
      name: toolName,
      arguments: args
    });
    
    if (result.content && result.content[0]?.text) {
      console.log(`📄 Tool Result:`);
      console.log(result.content[0].text);
      
      if (result.isError) {
        console.log('⚠️  Tool reported an error');
      }
    }
    
    return result;
  }

  /**
   * Send notification (no response expected)
   */
  sendNotification(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };

    console.log(`🔔 Sending notification: ${method}`);
    this.serverProcess.stdin.write(JSON.stringify(message) + '\n');
  }

  /**
   * Disconnect from server
   */
  async disconnect() {
    console.log('🔌 Disconnecting from server...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait for server to exit
      await new Promise((resolve) => {
        this.serverProcess.once('exit', resolve);
        setTimeout(resolve, 2000); // Fallback
      });
    }
    
    console.log('✅ Disconnected');
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * List tools matching a pattern
   */
  findTools(pattern) {
    return this.tools.filter(tool => 
      tool.name.includes(pattern) || 
      tool.description.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}

/**
 * Demo scenarios showing realistic usage patterns
 */
class MCPClientDemo {
  constructor() {
    this.client = new MCPClient();
  }

  async runDemo() {
    try {
      // Connect to the MCP server
      await this.client.connect('node', ['mcp-server.js']);
      
      // Initialize connection
      await this.client.initialize({
        name: 'claude-code-simulator',
        version: '1.0.0'
      });
      
      // Send initialized notification
      this.client.sendNotification('notifications/initialized');
      
      // Get available tools
      await this.client.getTools();
      
      // Run demo scenarios
      console.log('\n🎬 Starting Demo Scenarios...\n');
      
      await this.scenario1_BasicMonitoring();
      await this.scenario2_DebuggingWorkflow();
      await this.scenario3_ErrorAnalysis();
      
      console.log('\n🎉 Demo completed successfully!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    } finally {
      await this.client.disconnect();
    }
  }

  /**
   * Scenario 1: New focused monitoring setup
   */
  async scenario1_BasicMonitoring() {
    console.log('🎬 Scenario 1: New Focused Monitoring Setup');
    
    // Create a simple test app
    this.createTestApp();
    
    // NEW: Start server only (focused approach)
    await this.client.callTool('start_server', {
      script: './test-app/server.js',
      session_id: 'demo-session',
      log_level: 'info'
    });
    
    // NEW: Open browser page (defaults to index.html)
    await this.client.callTool('open_page', {
      session_id: 'demo-session',
      headless: false  // Visible browser for demo
    });
    
    // Set log level
    await this.client.callTool('set_log_level', {
      session_id: 'demo-session',
      level: 'debug'
    });
    
    // List active sessions
    await this.client.callTool('list_sessions');
    
    console.log('✅ Scenario 1 completed\n');
  }

  /**
   * Scenario 2: Debugging workflow
   */
  async scenario2_DebuggingWorkflow() {
    console.log('🎬 Scenario 2: Debugging Workflow');
    
    // Query logs for debugging
    await this.client.callTool('query_logs', {
      session_id: 'demo-session',
      limit: 10
    });
    
    // Try to take a screenshot (may fail if no browser is running)
    await this.client.callTool('take_screenshot', {
      session_id: 'demo-session',
      path: './test-screenshot.png',
      fullPage: true
    });
    
    // Try video recording
    await this.client.callTool('record_video', {
      session_id: 'demo-session',
      action: 'start',
      path: './test-video.mp4'
    });
    
    console.log('✅ Scenario 2 completed\n');
  }

  /**
   * Scenario 3: Error analysis
   */
  async scenario3_ErrorAnalysis() {
    console.log('🎬 Scenario 3: Error Analysis');
    
    // Search logs with query_logs tool
    await this.client.callTool('query_logs', {
      search: 'server',
      limit: 10,
      session_id: 'demo-session'
    });
    
    // Query logs by level
    await this.client.callTool('query_logs', {
      level: 'error',
      limit: 5,
      session_id: 'demo-session'
    });
    
    // List active sessions
    await this.client.callTool('list_sessions');
    
    // Set log level for better debugging  
    await this.client.callTool('set_log_level', {
      session_id: 'demo-session',
      level: 'trace'
    });
    
    // Stop the app
    await this.client.callTool('stop_app', {
      session_id: 'demo-session'
    });
    
    console.log('✅ Scenario 3 completed\n');
  }


  /**
   * Create test application files
   */
  createTestApp() {
    const testDir = './test-app';
    
    // Create directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch (err) {
      // Directory already exists
    }
    
    // Create backend server
    const serverCode = `
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
    res.end(JSON.stringify({ 
      message: 'Demo API response', 
      timestamp: new Date().toISOString(),
      success: true
    }));
  } else if (req.url === '/api/error') {
    console.error('Demo error occurred for testing');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Demo error for analysis testing' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3007, () => {
  console.log('Demo server listening on port 3007');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Demo server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
`;
    
    writeFileSync(`${testDir}/server.js`, serverCode);
    
    // Create frontend HTML
    const htmlCode = `<!DOCTYPE html>
<html>
<head>
    <title>MCP Demo App</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px; }
        button:hover { background: #005a8b; }
        #result { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #f9f9f9; }
        .error { border-color: #ff4444; background: #ffeeee; }
        .success { border-color: #44aa44; background: #eeffee; }
    </style>
</head>
<body>
    <h1>MCP Full-Stack Monitor Demo</h1>
    <p>This is a test application for demonstrating MCP monitoring capabilities.</p>
    
    <button id="test-button" onclick="testAPI()">Test API Call</button>
    <button id="error-button" onclick="testError()">Test Error</button>
    
    <div id="result"></div>
    
    <script>
        console.log('Demo app loaded for MCP testing');
        
        async function testAPI() {
            console.log('Testing API call...');
            const result = document.getElementById('result');
            result.textContent = 'Making API call...';
            result.className = '';
            
            try {
                const response = await fetch('http://localhost:3007/api/test');
                const data = await response.json();
                
                result.innerHTML = \`<h3>✅ API Success</h3><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
                result.className = 'success';
                console.log('API call successful:', data);
            } catch (error) {
                result.innerHTML = \`<h3>❌ API Error</h3><p>\${error.message}</p>\`;
                result.className = 'error';
                console.error('API call failed:', error);
            }
        }
        
        async function testError() {
            console.log('Testing error endpoint...');
            const result = document.getElementById('result');
            result.textContent = 'Testing error handling...';
            result.className = '';
            
            try {
                const response = await fetch('http://localhost:3007/api/error');
                const data = await response.json();
                
                result.innerHTML = \`<h3>⚠️ Expected Error Response</h3><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
                result.className = 'error';
                console.log('Error response received:', data);
            } catch (error) {
                result.innerHTML = \`<h3>❌ Network Error</h3><p>\${error.message}</p>\`;
                result.className = 'error';
                console.error('Network error:', error);
            }
        }
        
        // Log page interactions for monitoring
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                console.log('Button clicked:', e.target.textContent);
            }
        });
    </script>
</body>
</html>`;
    
    writeFileSync(`${testDir}/index.html`, htmlCode);
    
    console.log('📁 Created test application in ./test-app/');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new MCPClientDemo();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    await demo.client.disconnect();
    process.exit(0);
  });
  
  demo.runDemo().catch(error => {
    console.error('💥 Demo crashed:', error);
    process.exit(1);
  });
}

export { MCPClient, MCPClientDemo };