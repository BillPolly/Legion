/**
 * ROMA Agent Web Server
 * Express server with WebSocket support for real-time task execution and visualization
 * Uses Legion actor framework patterns for client-server communication
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { ResourceManager } from '@legion/resource-manager';
import ROMAServerActor from '../actors/server/ROMAServerActor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Initialize server components
let romaServerActor;
let resourceManager;

async function initializeServer() {
  console.log('🚀 Initializing ROMA Agent Web Server...');
  
  // Get ResourceManager singleton (Legion pattern)
  resourceManager = await ResourceManager.getInstance();
  
  // Create server actor (wraps ROMAAgent)
  romaServerActor = new ROMAServerActor({ resourceManager });
  
  console.log('✅ ROMA Agent Web Server ready for connections');
}

// Serve the ROMA interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>ROMA Agent - Task Execution & Visualization</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
        }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            position: relative;
        }
        
        .header h1 {
            font-size: 32px;
            margin-bottom: 8px;
            font-weight: 700;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 16px;
            margin: 0;
        }
        
        .status-badge {
            position: absolute;
            top: 25px;
            right: 30px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
        }
        
        .main-content {
            padding: 30px;
        }
        
        .grid {
            display: grid;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .grid-2 {
            grid-template-columns: 1fr 1fr;
        }
        
        .grid-3 {
            grid-template-columns: 1fr 1fr 1fr;
        }
        
        .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 1px solid rgba(0,0,0,0.05);
        }
        
        .card h3 {
            margin: 0 0 20px 0;
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .form-group {
            margin-bottom: 16px;
        }
        
        .form-label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
            color: #374151;
            font-size: 14px;
        }
        
        .form-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .form-textarea {
            resize: vertical;
            min-height: 80px;
            font-family: inherit;
        }
        
        .form-textarea.mono {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
        }
        
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: #667eea;
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: #5a67d8;
            transform: translateY(-1px);
        }
        
        .btn-primary:disabled {
            background: #d1d5db;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-secondary {
            background: #10b981;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #059669;
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        
        .btn-danger:hover {
            background: #dc2626;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
        }
        
        .stat-item {
            text-align: center;
            padding: 16px;
            background: #f8fafc;
            border-radius: 8px;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 4px;
        }
        
        .stat-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .execution-item {
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            transition: border-color 0.2s;
        }
        
        .execution-item.running {
            border-color: #667eea;
            background: #f0f4ff;
        }
        
        .execution-item.completed {
            border-color: #10b981;
            background: #f0fdf4;
        }
        
        .execution-item.error {
            border-color: #ef4444;
            background: #fef2f2;
        }
        
        .execution-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .execution-title {
            font-weight: 500;
            color: #1f2937;
        }
        
        .execution-status {
            font-size: 12px;
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }
        
        .status-running {
            background: #667eea;
            color: white;
        }
        
        .status-completed {
            background: #10b981;
            color: white;
        }
        
        .status-error {
            background: #ef4444;
            color: white;
        }
        
        .progress-bar {
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            margin: 8px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: #667eea;
            transition: width 0.3s ease;
        }
        
        .execution-meta {
            font-size: 12px;
            color: #64748b;
            margin-top: 8px;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #64748b;
            font-style: italic;
        }
        
        .scrollable {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
        }
        
        @media (max-width: 768px) {
            .grid-2, .grid-3 {
                grid-template-columns: 1fr;
            }
            
            .container {
                margin: 10px;
                border-radius: 12px;
            }
            
            .header {
                padding: 20px;
            }
            
            .main-content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div id="statusBadge" class="status-badge">🔄 Connecting...</div>
            <h1>🧠 ROMA Agent</h1>
            <p>Recursive Open Meta-Agents - Task Decomposition & Execution Platform</p>
        </div>
        
        <div class="main-content">
            <div id="app">
                <div style="text-align: center; padding: 60px; color: #64748b;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
                    <div style="font-size: 18px; margin-bottom: 8px;">Initializing ROMA Agent...</div>
                    <div style="font-size: 14px;">Connecting to agent framework...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Legion Actor Framework Integration
        console.log('🎭 Initializing ROMA Client Actor...');
        
        // This will be replaced by the actual actor framework
        // For now, implement WebSocket communication directly
        const ws = new WebSocket('ws://localhost:4020');
        const statusBadge = document.getElementById('statusBadge');
        
        let isConnected = false;
        let agentReady = false;
        
        ws.onopen = () => {
            console.log('🔗 WebSocket connected');
            isConnected = true;
            updateStatus();
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received message:', data.type);
                handleMessage(data.type, data.payload);
            } catch (error) {
                console.error('❌ Failed to parse message:', error);
            }
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            isConnected = false;
            agentReady = false;
            updateStatus();
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };
        
        function updateStatus() {
            if (!isConnected) {
                statusBadge.textContent = '❌ Disconnected';
                statusBadge.style.background = 'rgba(239, 68, 68, 0.3)';
            } else if (!agentReady) {
                statusBadge.textContent = '🔄 Initializing...';
                statusBadge.style.background = 'rgba(251, 191, 36, 0.3)';
            } else {
                statusBadge.textContent = '✅ Ready';
                statusBadge.style.background = 'rgba(16, 185, 129, 0.3)';
            }
        }
        
        function handleMessage(type, payload) {
            switch (type) {
                case 'ready':
                    agentReady = true;
                    updateStatus();
                    initializeInterface(payload);
                    break;
                case 'execution_started':
                    handleExecutionStarted(payload);
                    break;
                case 'task_progress':
                    handleTaskProgress(payload);
                    break;
                case 'execution_complete':
                    handleExecutionComplete(payload);
                    break;
                case 'execution_error':
                    handleExecutionError(payload);
                    break;
                default:
                    console.log('⚠️ Unknown message type:', type);
            }
        }
        
        function initializeInterface(readyData) {
            console.log('🎨 Initializing ROMA interface...');
            
            // This would normally be handled by ROMAClientActor
            // For now, create a simple interface
            const app = document.getElementById('app');
            app.innerHTML = \`
                <div class="grid grid-2">
                    <div class="card">
                        <h3>📋 Execute Task</h3>
                        <div class="form-group">
                            <label class="form-label">Task Description</label>
                            <textarea id="taskDescription" class="form-input form-textarea" 
                                placeholder="Describe the task you want ROMA to execute..."></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tool (optional)</label>
                            <input type="text" id="taskTool" class="form-input" 
                                placeholder="e.g., calculator, file_writer">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Parameters (JSON)</label>
                            <textarea id="taskParams" class="form-input form-textarea mono" 
                                placeholder='{"param1": "value1"}'></textarea>
                        </div>
                        <button id="executeBtn" class="btn btn-primary" style="width: 100%;">
                            🚀 Execute Task
                        </button>
                    </div>
                    
                    <div class="card">
                        <h3>📊 Agent Statistics</h3>
                        <div id="statisticsDisplay">
                            <div class="stats-grid">
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #667eea;">0</div>
                                    <div class="stat-label">Total</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #10b981;">0</div>
                                    <div class="stat-label">Success</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #ef4444;">0</div>
                                    <div class="stat-label">Failed</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value" style="color: #10b981;">0%</div>
                                    <div class="stat-label">Rate</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <h3>⚡ Active Executions</h3>
                    <div id="activeExecutions">
                        <div class="empty-state">No active executions</div>
                    </div>
                </div>
                
                <div class="card">
                    <h3>📚 Execution History</h3>
                    <div style="margin-bottom: 16px;">
                        <button id="refreshBtn" class="btn btn-secondary">🔄 Refresh</button>
                        <button id="clearBtn" class="btn btn-danger">🗑️ Clear</button>
                    </div>
                    <div id="executionHistory" class="scrollable">
                        <div class="empty-state">No execution history</div>
                    </div>
                </div>
            \`;
            
            // Bind events
            document.getElementById('executeBtn').onclick = executeTask;
            document.getElementById('refreshBtn').onclick = refreshHistory;
            document.getElementById('clearBtn').onclick = clearHistory;
            
            console.log('✅ ROMA interface ready');
        }
        
        function executeTask() {
            const description = document.getElementById('taskDescription').value.trim();
            if (!description) return;
            
            const task = {
                id: \`task_\${Date.now()}\`,
                description: description
            };
            
            const tool = document.getElementById('taskTool').value.trim();
            if (tool) task.tool = tool;
            
            const paramsText = document.getElementById('taskParams').value.trim();
            if (paramsText) {
                try {
                    task.params = JSON.parse(paramsText);
                } catch (e) {
                    alert('Invalid JSON in parameters');
                    return;
                }
            }
            
            const executionId = \`exec_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
            
            ws.send(JSON.stringify({
                type: 'execute_task',
                payload: { executionId, task }
            }));
            
            // Clear form
            document.getElementById('taskDescription').value = '';
            document.getElementById('taskTool').value = '';
            document.getElementById('taskParams').value = '';
        }
        
        function handleExecutionStarted(payload) {
            console.log('🚀 Execution started:', payload.executionId);
            // Update UI to show running execution
        }
        
        function handleTaskProgress(payload) {
            console.log('📊 Progress:', payload.executionId);
            // Update progress in UI
        }
        
        function handleExecutionComplete(payload) {
            console.log('✅ Execution completed:', payload.executionId);
            // Update UI to show completion
        }
        
        function handleExecutionError(payload) {
            console.log('❌ Execution error:', payload.executionId);
            // Update UI to show error
        }
        
        function refreshHistory() {
            console.log('🔄 Refreshing history...');
            // Request history from server
        }
        
        function clearHistory() {
            console.log('🗑️ Clearing history...');
            // Clear history display
        }
    </script>
</body>
</html>
  `);
});

// WebSocket handling for ROMA agent with actor framework
wss.on('connection', (ws) => {
  console.log('🌐 ROMA client connected');
  
  // Create a simple actor communication bridge
  // In a full implementation, this would use the Legion actor framework
  
  // Create mock client actor for server communication
  const mockClientActor = {
    receive: (messageType, data) => {
      console.log('📤 [SERVER] Sending to client:', messageType);
      ws.send(JSON.stringify({
        type: messageType,
        payload: data
      }));
    }
  };
  
  // Connect server actor to mock client
  romaServerActor.setRemoteActor(mockClientActor);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 [SERVER] Received:', data.type);
      
      // Forward to server actor
      await romaServerActor.receive(data.type, data.payload);
      
    } catch (error) {
      console.error('❌ Message handling error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: error.message }
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('🌐 ROMA client disconnected');
  });
});

// Start server
const PORT = 4020;

initializeServer().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 ROMA Agent Web Server running on http://localhost:${PORT}`);
    console.log(`🔗 Open http://localhost:${PORT} to access the ROMA Agent interface`);
    console.log('🎭 Actor framework integration ready for client connections');
  });
}).catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down ROMA Agent Web Server...');
  
  if (romaServerActor) {
    await romaServerActor.shutdown();
  }
  
  server.close(() => {
    console.log('✅ ROMA Agent Web Server shutdown complete');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  
  if (romaServerActor) {
    await romaServerActor.shutdown();
  }
  
  server.close(() => {
    console.log('✅ ROMA Agent Web Server shutdown complete');
    process.exit(0);
  });
});