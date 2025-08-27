/**
 * @fileoverview Simple Express.js application example
 * Demonstrates using node-runner to manage an Express server
 */

import express from 'express';
import { NodeRunnerModule } from '../src/NodeRunnerModule.js';
import { MockStorageProvider } from '../__tests__/utils/MockStorageProvider.js';
import { LogStorage } from '../src/storage/LogStorage.js';
import { SessionManager } from '../src/managers/SessionManager.js';
import { ProcessManager } from '../src/managers/ProcessManager.js';
import { LogSearch } from '../src/search/LogSearch.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a simple Express application for testing
 */
async function createExpressApp() {
  const appDir = path.join(__dirname, 'test-express-app');
  
  // Create directory
  await fs.mkdir(appDir, { recursive: true });
  
  // Create Express app file
  const appCode = `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for logging
app.use((req, res, next) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path}\`);
  next();
});

// Routes
app.get('/', (req, res) => {
  console.log('Home page requested');
  res.json({ message: 'Hello from Express!', timestamp: new Date() });
});

app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/error', (req, res) => {
  console.error('Error endpoint hit - simulating error');
  res.status(500).json({ error: 'Simulated error for testing' });
});

app.get('/data', (req, res) => {
  console.log('Data endpoint requested');
  const data = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    value: Math.random() * 100,
    timestamp: new Date()
  }));
  res.json(data);
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).json({ error: err.message });
});

// Start server
app.listen(port, () => {
  console.log(\`Express server running on port \${port}\`);
  console.log('Server ready to accept requests');
  
  // Simulate some periodic logs
  setInterval(() => {
    console.log(\`Server stats: Memory usage: \${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`);
  }, 5000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
`;

  await fs.writeFile(path.join(appDir, 'server.js'), appCode);
  
  // Create package.json
  const packageJson = {
    name: 'test-express-app',
    version: '1.0.0',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'node server.js'
    },
    dependencies: {
      express: '^4.18.0'
    }
  };
  
  await fs.writeFile(
    path.join(appDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  return appDir;
}

/**
 * Main example demonstrating node-runner with Express
 */
async function runExample() {
  console.log('🚀 Node Runner - Express.js Example\n');
  console.log('Setting up Express application...');
  
  // Create test Express app
  const appDir = await createExpressApp();
  console.log(`✅ Created Express app in: ${appDir}\n`);
  
  // Initialize node-runner module
  console.log('Initializing Node Runner module...');
  const mockStorage = new MockStorageProvider();
  const logStorage = new LogStorage(mockStorage);
  const sessionManager = new SessionManager(mockStorage);
  const processManager = new ProcessManager(logStorage, sessionManager);
  const logSearch = new LogSearch(null, logStorage);
  
  const module = new NodeRunnerModule({
    processManager,
    sessionManager,
    logStorage,
    logSearch,
    serverManager: null
  });
  
  // Get tools
  const tools = module.getTools();
  const [runTool, stopTool, searchTool, listTool, healthTool] = tools;
  console.log('✅ Module initialized with', tools.length, 'tools\n');
  
  // Listen to events
  runTool.on('progress', ({ percentage, status }) => {
    console.log(`  [Progress ${percentage}%] ${status}`);
  });
  
  runTool.on('info', ({ message }) => {
    console.log(`  [Info] ${message}`);
  });
  
  try {
    // Step 1: Start the Express server
    console.log('📦 Step 1: Starting Express server...');
    const runResult = await runTool.execute({
      projectPath: appDir,
      command: 'node server.js',
      description: 'Express.js demo server',
      env: { PORT: '3001' }
    });
    
    if (!runResult.success) {
      throw new Error(`Failed to start server: ${runResult.error}`);
    }
    
    console.log(`✅ Server started successfully!`);
    console.log(`   Session ID: ${runResult.sessionId}`);
    console.log(`   Process ID: ${runResult.processId}`);
    console.log(`   PID: ${runResult.pid}\n`);
    
    // Wait for server to generate some logs
    console.log('⏳ Waiting for server to generate logs...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Check system health
    console.log('📊 Step 2: Checking system health...');
    const healthResult = await healthTool.execute({});
    
    if (healthResult.success) {
      console.log('✅ System Health:');
      console.log(`   Status: ${healthResult.health.status}`);
      console.log(`   Running processes: ${healthResult.health.processes.running}`);
      console.log(`   Active sessions: ${healthResult.health.sessions.active}`);
      console.log(`   Memory usage: ${healthResult.health.memory.percentage}%\n`);
    }
    
    // Step 3: Search for logs
    console.log('🔍 Step 3: Searching logs...');
    
    // Search for server startup logs
    const startupLogs = await searchTool.execute({
      query: 'server',
      searchMode: 'keyword',
      sessionId: runResult.sessionId
    });
    
    console.log(`✅ Found ${startupLogs.totalResults} logs containing "server"`);
    if (startupLogs.logs.length > 0) {
      console.log('   Sample logs:');
      startupLogs.logs.slice(0, 3).forEach(log => {
        console.log(`   - ${log.message}`);
      });
    }
    
    // Search for any errors using regex
    console.log('\n🔍 Searching for errors with regex...');
    const errorLogs = await searchTool.execute({
      query: 'error|Error|ERROR',
      searchMode: 'regex',
      sessionId: runResult.sessionId
    });
    
    console.log(`✅ Found ${errorLogs.totalResults} error-related logs\n`);
    
    // Step 4: List sessions
    console.log('📋 Step 4: Listing active sessions...');
    const sessions = await listTool.execute({
      status: 'active'
    });
    
    console.log(`✅ Active sessions: ${sessions.totalCount}`);
    sessions.sessions.forEach(session => {
      console.log(`   - ${session.sessionId}: ${session.command} (${session.status})`);
    });
    
    // Step 5: Get session statistics
    console.log('\n📈 Step 5: Getting session statistics...');
    const stats = await sessionManager.getSessionStatistics(runResult.sessionId);
    console.log('✅ Session Statistics:');
    console.log(`   Total processes: ${stats.totalProcesses}`);
    console.log(`   Total logs: ${stats.totalLogs}`);
    console.log(`   Duration: ${stats.duration}ms\n`);
    
    // Step 6: Wait a bit more to see periodic logs
    console.log('⏳ Observing server logs for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Search for memory usage logs
    const memoryLogs = await searchTool.execute({
      query: 'Memory usage',
      sessionId: runResult.sessionId
    });
    
    console.log(`✅ Found ${memoryLogs.totalResults} memory usage logs\n`);
    
    // Step 7: Stop the server
    console.log('🛑 Step 7: Stopping Express server...');
    const stopResult = await stopTool.execute({
      mode: 'session',
      sessionId: runResult.sessionId
    });
    
    if (stopResult.success) {
      console.log('✅ Server stopped successfully');
      console.log(`   Terminated ${stopResult.terminated.length} process(es)\n`);
    }
    
    // Step 8: Final session check
    console.log('📋 Step 8: Final session status...');
    const finalSessions = await listTool.execute({
      status: 'completed'
    });
    
    console.log(`✅ Completed sessions: ${finalSessions.totalCount}`);
    
    // Get final logs count
    const allLogs = await logStorage.getLogsBySession(runResult.sessionId);
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total logs captured: ${allLogs.length}`);
    console.log(`   Session completed successfully!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to stop all processes
    console.log('\n🧹 Cleaning up...');
    await stopTool.execute({ mode: 'all' });
  }
  
  // Clean up
  console.log('🧹 Cleaning up test files...');
  await fs.rm(appDir, { recursive: true, force: true });
  console.log('✅ Cleanup complete\n');
  
  console.log('🎉 Example completed successfully!');
  console.log('This demonstrated:');
  console.log('  • Starting an Express.js server');
  console.log('  • Capturing and searching logs');
  console.log('  • Managing sessions');
  console.log('  • Monitoring system health');
  console.log('  • Graceful shutdown\n');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample().catch(console.error);
}

export { runExample, createExpressApp };