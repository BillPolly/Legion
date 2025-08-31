/**
 * Working server - bypass ResourceManager initialization hang
 * This server works around the ResourceManager.getInstance() hang
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock ResourceManager that doesn't hang
class MockResourceManager {
  constructor() {
    this.resources = new Map();
    // Add some basic mock resources
    this.resources.set('env.MONOREPO_ROOT', '/Users/williampearson/Documents/p/agents/Legion');
    this.resources.set('env.NODE_ENV', 'development');
  }
  
  get(key) {
    return this.resources.get(key);
  }
  
  static async getInstance() {
    return new MockResourceManager();
  }
}

// Mock services for actors
const mockServices = {
  resourceManager: new MockResourceManager(),
  toolRegistry: null // Will be null, actors should handle gracefully
};

// Simplified ServerPlannerActor that doesn't hang
class WorkingServerPlannerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.isReady = false;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Working server planner actor connected');
    
    // Send ready immediately without hanging initialization
    setTimeout(() => {
      this.remoteActor.receive('ready', {
        timestamp: new Date().toISOString(),
        working: true,
        message: 'Server is working but DecentPlanner initialization skipped to avoid hang'
      });
      this.isReady = true;
    }, 500);
  }

  receive(messageType, data) {
    console.log('📨 Working server received:', messageType, data);
    
    switch (messageType) {
      case 'plan-informal':
        // Send a helpful mock response
        setTimeout(() => {
          this.remoteActor.receive('plan-result', {
            success: false,
            error: 'ResourceManager initialization hang detected - running in working mode',
            message: 'The server is working but ResourceManager.getInstance() hangs during initialization. This needs to be fixed.',
            suggestions: [
              'Check MongoDB connection',
              'Check LLM client initialization', 
              'Check environment variables',
              'Debug ResourceManager.getInstance() hang'
            ],
            working: true
          });
        }, 100);
        break;
        
      default:
        console.log('Working mode - message handled:', messageType);
        if (this.remoteActor) {
          this.remoteActor.receive('info', {
            message: `Working mode - ${messageType} received but functionality limited due to ResourceManager hang`,
            working: true
          });
        }
    }
  }
}

async function startWorkingServer() {
  console.log('🚀 Starting Working Decent Planner UI Server...');
  console.log('⚠️  This server bypasses the ResourceManager hang issue');
  
  const app = express();
  const port = 8083;
  
  // Basic middleware
  app.use(express.json());
  app.use(express.static('public'));
  
  // Serve src directory
  app.use('/src', express.static('./src'));
  
  // Create HTTP server
  const server = app.listen(port, () => {
    console.log(`✅ Working server running on http://localhost:${port}`);
  });
  
  // WebSocket server for actor communication
  const wss = new WebSocketServer({ server });
  const clients = new Set();
  
  wss.on('connection', (ws) => {
    console.log('🔌 Client connected');
    clients.add(ws);
    
    // Create server actor
    const serverActor = new WorkingServerPlannerActor(mockServices);
    
    // Mock remote actor for server
    const mockRemoteActor = {
      receive: (type, payload) => {
        console.log('📤 Sending to client:', type);
        ws.send(JSON.stringify({ type, payload }));
      }
    };
    
    serverActor.setRemoteActor(mockRemoteActor);
    
    // Handle messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received from client:', message.type);
        serverActor.receive(message.type, message.payload);
      } catch (error) {
        console.error('❌ Error parsing client message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 Client disconnected');
      clients.delete(ws);
    });
  });
  
  // Planner route
  app.get('/planner', async (req, res) => {
    try {
      // Read the client actor file to get the HTML template
      const clientPath = path.join(__dirname, 'src/client/actors/ClientPlannerActor.js');
      const clientExists = await fs.access(clientPath).then(() => true).catch(() => false);
      
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🧠 Decent Planner (Working Mode)</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 20px; 
                    background: #f5f5f5;
                }
                .container { 
                    max-width: 1200px; 
                    margin: 0 auto; 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .status { 
                    padding: 15px; 
                    border-radius: 5px; 
                    margin: 15px 0;
                }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                button { 
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 5px;
                    cursor: pointer;
                    margin: 5px;
                }
                button:hover { background: #0056b3; }
                button:disabled { background: #6c757d; cursor: not-allowed; }
                .log { 
                    background: #f8f9fa; 
                    border: 1px solid #dee2e6; 
                    padding: 15px; 
                    border-radius: 5px;
                    font-family: monospace;
                    white-space: pre-wrap;
                    max-height: 300px;
                    overflow-y: auto;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🧠 Decent Planner - Working Mode</h1>
                
                <div class="status success">
                    ✅ Server is running and WebSocket connection is working!
                </div>
                
                <div class="status warning">
                    ⚠️ Running in Working Mode: ResourceManager.getInstance() hangs during initialization.
                    This demonstrates the server framework and UI are functional, but the DecentPlanner 
                    initialization needs to be debugged.
                </div>
                
                <h2>Connection Test</h2>
                <button onclick="testConnection()">Test WebSocket Connection</button>
                <button onclick="testPlanning()" id="planBtn">Test Planning (Will Show Error)</button>
                
                <div id="connectionStatus" class="status" style="display:none;"></div>
                
                <h2>Debug Information</h2>
                <div class="log" id="debugLog">Server started successfully...
Client file exists: ${clientExists}
WebSocket server listening...
                </div>
                
                <h2>Issue Analysis</h2>
                <div class="status error">
                    <strong>Root Cause:</strong> ResourceManager.getInstance() hangs during initialization.<br>
                    <strong>Location:</strong> BaseServer.initialize() → ResourceManager.getInstance()<br>
                    <strong>Impact:</strong> Prevents proper DecentPlanner initialization<br>
                    <strong>Next Steps:</strong> Debug ResourceManager to identify hanging operation
                </div>
            </div>
            
            <script>
                let ws = null;
                let connected = false;
                
                function connectWebSocket() {
                    ws = new WebSocket(\`ws://\${location.host}\`);
                    
                    ws.onopen = () => {
                        connected = true;
                        appendLog('✅ WebSocket connected');
                        updateConnectionStatus('Connected to server', 'success');
                    };
                    
                    ws.onmessage = (event) => {
                        const message = JSON.parse(event.data);
                        appendLog(\`📨 Received: \${message.type}\`);
                        appendLog(\`   Data: \${JSON.stringify(message.payload, null, 2)}\`);
                        
                        if (message.type === 'ready') {
                            updateConnectionStatus('Server actor ready!', 'success');
                        } else if (message.type === 'plan-result') {
                            updateConnectionStatus(\`Planning result: \${message.payload.success ? 'Success' : 'Error'}\`, 
                                message.payload.success ? 'success' : 'error');
                        }
                    };
                    
                    ws.onclose = () => {
                        connected = false;
                        appendLog('❌ WebSocket disconnected');
                        updateConnectionStatus('Disconnected from server', 'error');
                    };
                    
                    ws.onerror = (error) => {
                        appendLog(\`❌ WebSocket error: \${error}\`);
                        updateConnectionStatus('WebSocket error', 'error');
                    };
                }
                
                function testConnection() {
                    if (!connected) {
                        appendLog('🔌 Connecting to WebSocket...');
                        connectWebSocket();
                    } else {
                        appendLog('✅ Already connected!');
                        updateConnectionStatus('Already connected', 'success');
                    }
                }
                
                function testPlanning() {
                    if (!connected) {
                        updateConnectionStatus('Not connected - click Test Connection first', 'error');
                        return;
                    }
                    
                    appendLog('📝 Sending planning request...');
                    ws.send(JSON.stringify({
                        type: 'plan-informal',
                        payload: {
                            goal: 'Test planning request',
                            context: { test: true }
                        }
                    }));
                    
                    document.getElementById('planBtn').disabled = true;
                    setTimeout(() => {
                        document.getElementById('planBtn').disabled = false;
                    }, 2000);
                }
                
                function appendLog(message) {
                    const log = document.getElementById('debugLog');
                    log.textContent += '\\n' + new Date().toLocaleTimeString() + ': ' + message;
                    log.scrollTop = log.scrollHeight;
                }
                
                function updateConnectionStatus(message, type) {
                    const status = document.getElementById('connectionStatus');
                    status.textContent = message;
                    status.className = \`status \${type}\`;
                    status.style.display = 'block';
                }
                
                // Auto-connect on page load
                setTimeout(() => {
                    testConnection();
                }, 1000);
            </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error serving planner page:', error);
      res.status(500).send('Server error');
    }
  });
  
  console.log('📱 Open http://localhost:8083/planner to test the working UI');
  console.log('🔍 This demonstrates the server framework works - the issue is ResourceManager hang');
}

startWorkingServer().catch(error => {
  console.error('❌ Failed to start working server:', error);
  process.exit(1);
});