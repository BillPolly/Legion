/**
 * Log Monitoring Server
 * Collects and displays logs from external applications with real-time streaming and search
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { LegionLogManager } from '../src/LegionLogManager.js';
import { MockResourceManager, MockStorageProvider, MockSemanticSearchProvider } from '../__tests__/utils/TestUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Legion Log Manager
const resourceManager = new MockResourceManager();
const storageProvider = new MockStorageProvider();
const semanticProvider = new MockSemanticSearchProvider();

resourceManager.set('StorageProvider', storageProvider);
resourceManager.set('SemanticSearchProvider', semanticProvider);

const logManager = await LegionLogManager.create(resourceManager);

// Create monitoring session
const monitoringSession = await logManager.createSession({
  name: 'Application Monitoring Session',
  description: 'Monitoring multiple external applications'
});

const SESSION_ID = monitoringSession.sessionId;

console.log('🔍 Log Monitoring Server');
console.log('========================');
console.log(`📊 Session ID: ${SESSION_ID}`);

// Track monitored processes
const monitoredProcesses = new Map();
const correlationMap = new Map(); // Track request correlations across apps

// Express server for dashboard
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket server for real-time streaming to dashboard
const wss = new WebSocketServer({ port: 8081 });
const dashboardClients = new Set();

wss.on('connection', (ws) => {
  console.log('📱 Dashboard client connected');
  dashboardClients.add(ws);
  
  // Send initial state
  ws.send(JSON.stringify({
    type: 'init',
    sessionId: SESSION_ID,
    processes: Array.from(monitoredProcesses.keys()),
    stats: getStatistics()
  }));
  
  ws.on('close', () => {
    dashboardClients.delete(ws);
    console.log('📱 Dashboard client disconnected');
  });
});

// Broadcast to all dashboard clients
function broadcastToDashboard(message) {
  const data = JSON.stringify(message);
  dashboardClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// Log processor - captures and processes logs from external apps
function processLog(source, processId, message, level = 'info') {
  const logEntry = {
    sessionId: SESSION_ID,
    processId,
    source,
    message,
    level,
    timestamp: new Date()
  };
  
  // Store in LogManager
  logManager.logMessage(logEntry);
  
  // Check for correlation patterns (request IDs, trace IDs, etc.)
  const correlationPattern = /\[(req-[\d-]+|trace-[\d-]+|correlation-[\d-]+)\]/g;
  const matches = message.match(correlationPattern);
  
  if (matches) {
    matches.forEach(match => {
      const correlationId = match.slice(1, -1);
      if (!correlationMap.has(correlationId)) {
        correlationMap.set(correlationId, []);
      }
      correlationMap.get(correlationId).push({
        ...logEntry,
        processId,
        source
      });
    });
  }
  
  // Broadcast to dashboard
  broadcastToDashboard({
    type: 'log',
    data: logEntry,
    correlationIds: matches ? matches.map(m => m.slice(1, -1)) : []
  });
  
  // Auto-index for semantic search
  if (semanticProvider) {
    logManager.logSearch.indexLog(logEntry).catch(console.error);
  }
}

// Monitor an external Node.js application
function monitorNodeApp(scriptPath, args = [], appName = 'node-app') {
  console.log(`🚀 Starting monitored app: ${appName}`);
  
  const child = spawn('node', [scriptPath, ...args], {
    cwd: path.dirname(scriptPath),
    env: { ...process.env, MONITORED: 'true' }
  });
  
  const processInfo = {
    pid: child.pid,
    name: appName,
    script: scriptPath,
    startTime: new Date(),
    status: 'running',
    child
  };
  
  monitoredProcesses.set(appName, processInfo);
  
  // Capture stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      // Try to parse structured logs
      try {
        const parsed = JSON.parse(line);
        processLog('stdout', appName, parsed.message || line, parsed.level || 'info');
      } catch {
        // Plain text log
        const level = detectLogLevel(line);
        processLog('stdout', appName, line, level);
      }
    });
  });
  
  // Capture stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      processLog('stderr', appName, line, 'error');
    });
  });
  
  // Handle process exit
  child.on('exit', (code) => {
    console.log(`⚠️ ${appName} exited with code ${code}`);
    processInfo.status = 'stopped';
    processInfo.exitCode = code;
    processLog('system', appName, `Process exited with code ${code}`, code === 0 ? 'info' : 'error');
    
    broadcastToDashboard({
      type: 'process-exit',
      processId: appName,
      exitCode: code
    });
  });
  
  return processInfo;
}

// Detect log level from message content
function detectLogLevel(message) {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) return 'error';
  if (lower.includes('warn') || lower.includes('warning')) return 'warn';
  if (lower.includes('debug') || lower.includes('trace')) return 'debug';
  return 'info';
}

// API Endpoints

// Get monitoring statistics
app.get('/api/stats', async (req, res) => {
  res.json(getStatistics());
});

// Search logs
app.get('/api/search', async (req, res) => {
  const { query, mode = 'keyword', limit = 100 } = req.query;
  
  const result = await logManager.searchLogs({
    query,
    sessionId: SESSION_ID,
    mode,
    limit: parseInt(limit)
  });
  
  res.json(result);
});

// Get correlated logs
app.get('/api/correlations/:id', (req, res) => {
  const correlationId = req.params.id;
  const logs = correlationMap.get(correlationId) || [];
  
  res.json({
    correlationId,
    logs,
    processCount: new Set(logs.map(l => l.processId)).size
  });
});

// Get all correlations
app.get('/api/correlations', (req, res) => {
  const correlations = Array.from(correlationMap.entries()).map(([id, logs]) => ({
    id,
    logCount: logs.length,
    processes: [...new Set(logs.map(l => l.processId))],
    firstSeen: logs[0]?.timestamp,
    lastSeen: logs[logs.length - 1]?.timestamp
  }));
  
  res.json(correlations);
});

// Get recent logs
app.get('/api/logs/recent', async (req, res) => {
  const { limit = 100, process } = req.query;
  
  const logs = await storageProvider.query('logs', 
    process ? { sessionId: SESSION_ID, processId: process } : { sessionId: SESSION_ID }
  );
  
  const sortedLogs = logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, parseInt(limit));
  
  res.json(sortedLogs);
});

// Get process list
app.get('/api/processes', (req, res) => {
  const processes = Array.from(monitoredProcesses.entries()).map(([name, info]) => ({
    name,
    pid: info.pid,
    status: info.status,
    startTime: info.startTime,
    exitCode: info.exitCode
  }));
  
  res.json(processes);
});

// Start monitoring a new process
app.post('/api/monitor/start', (req, res) => {
  const { script, args = [], name } = req.body;
  
  try {
    const processInfo = monitorNodeApp(script, args, name || path.basename(script));
    res.json({
      success: true,
      processId: processInfo.name,
      pid: processInfo.pid
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop monitoring a process
app.post('/api/monitor/stop', (req, res) => {
  const { processId } = req.body;
  
  const processInfo = monitoredProcesses.get(processId);
  if (!processInfo) {
    return res.status(404).json({
      success: false,
      error: 'Process not found'
    });
  }
  
  if (processInfo.child && processInfo.status === 'running') {
    processInfo.child.kill();
    processInfo.status = 'stopped';
  }
  
  res.json({
    success: true,
    processId
  });
});

// Export logs
app.get('/api/export', async (req, res) => {
  const { format = 'json', process } = req.query;
  
  const logs = await storageProvider.query('logs',
    process ? { sessionId: SESSION_ID, processId: process } : { sessionId: SESSION_ID }
  );
  
  if (format === 'json') {
    res.json(logs);
  } else if (format === 'csv') {
    const csv = [
      'Timestamp,Process,Source,Level,Message',
      ...logs.map(log => 
        `"${log.timestamp}","${log.processId}","${log.source}","${log.level}","${log.message.replace(/"/g, '""')}"`
      )
    ].join('\n');
    
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="logs.csv"');
    res.send(csv);
  }
});

// Statistics helper
function getStatistics() {
  const logs = storageProvider.data.get('logs') || new Map();
  const logArray = Array.from(logs.values());
  
  const stats = {
    totalLogs: logArray.length,
    processes: monitoredProcesses.size,
    correlations: correlationMap.size,
    logsByLevel: {},
    logsByProcess: {},
    errorsLast5Min: 0,
    logsPerMinute: 0
  };
  
  // Count by level and process
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const oneMinAgo = now - 60 * 1000;
  
  logArray.forEach(log => {
    // By level
    stats.logsByLevel[log.level] = (stats.logsByLevel[log.level] || 0) + 1;
    
    // By process
    stats.logsByProcess[log.processId] = (stats.logsByProcess[log.processId] || 0) + 1;
    
    // Recent errors
    const logTime = new Date(log.timestamp).getTime();
    if (log.level === 'error' && logTime > fiveMinAgo) {
      stats.errorsLast5Min++;
    }
    
    // Logs per minute
    if (logTime > oneMinAgo) {
      stats.logsPerMinute++;
    }
  });
  
  return stats;
}

// Start the monitoring server
const PORT = 3334;
app.listen(PORT, () => {
  console.log(`\n✅ Monitoring Server running at http://localhost:${PORT}`);
  console.log(`📊 WebSocket streaming on ws://localhost:8081`);
  console.log(`\n📝 Open http://localhost:${PORT} to view the monitoring dashboard`);
});

// Auto-start sample applications if requested
if (process.argv.includes('--with-samples')) {
  setTimeout(() => {
    console.log('\n🎯 Starting sample applications...\n');
    
    // Start sample web server
    monitorNodeApp(
      path.join(__dirname, 'sample-apps', 'web-server.js'),
      [],
      'sample-web-server'
    );
    
    // Start sample worker
    setTimeout(() => {
      monitorNodeApp(
        path.join(__dirname, 'sample-apps', 'worker.js'),
        [],
        'sample-worker'
      );
    }, 1000);
    
    // Start sample client after a delay
    setTimeout(() => {
      monitorNodeApp(
        path.join(__dirname, 'sample-apps', 'client.js'),
        [],
        'sample-client'
      );
    }, 2000);
  }, 1000);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down monitoring server...');
  
  // Stop all monitored processes
  monitoredProcesses.forEach((info, name) => {
    if (info.child && info.status === 'running') {
      console.log(`Stopping ${name}...`);
      info.child.kill();
    }
  });
  
  // Cleanup
  await logManager.endSession(SESSION_ID);
  await logManager.cleanup();
  
  process.exit(0);
});