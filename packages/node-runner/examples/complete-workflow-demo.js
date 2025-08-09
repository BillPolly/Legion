#!/usr/bin/env node
/**
 * @fileoverview Complete Node Runner Workflow Demonstration
 * Shows all 5 MCP tools working together in a realistic scenario
 * 
 * This example demonstrates:
 * 1. Starting multiple Node.js processes
 * 2. Monitoring system health
 * 3. Searching through logs with different modes
 * 4. Managing sessions and processes
 * 5. Graceful shutdown of all services
 */

import { NodeRunnerModule } from '../src/NodeRunnerModule.js';
import { MockStorageProvider } from '../__tests__/utils/MockStorageProvider.js';
import { LogStorage } from '../src/storage/LogStorage.js';
import { SessionManager } from '../src/managers/SessionManager.js';
import { ProcessManager } from '../src/managers/ProcessManager.js';
import { LogSearch } from '../src/search/LogSearch.js';
import { RunNodeTool } from '../src/tools/RunNodeTool.js';
import { StopNodeTool } from '../src/tools/StopNodeTool.js';
import { SearchLogsTool } from '../src/tools/SearchLogsTool.js';
import { ListSessionsTool } from '../src/tools/ListSessionsTool.js';
import { ServerHealthTool } from '../src/tools/ServerHealthTool.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowDemo {
  constructor() {
    this.module = null;
    this.tools = {};
    this.sessions = [];
    this.demoApps = [];
  }

  async initialize() {
    console.log('🚀 Initializing Node Runner Complete Workflow Demo...\n');

    // Initialize storage and managers
    const storage = new MockStorageProvider();
    const logStorage = new LogStorage(storage);
    const sessionManager = new SessionManager(storage);
    const processManager = new ProcessManager(logStorage, sessionManager);
    const logSearch = new LogSearch(null, logStorage);

    // Create NodeRunner module
    this.module = new NodeRunnerModule({
      processManager,
      sessionManager,
      logStorage,
      logSearch,
      serverManager: null
    });

    // Initialize all MCP tools
    this.tools = {
      runNode: new RunNodeTool(this.module),
      stopNode: new StopNodeTool(this.module),
      searchLogs: new SearchLogsTool(this.module),
      listSessions: new ListSessionsTool(this.module),
      serverHealth: new ServerHealthTool(this.module)
    };

    console.log('✅ Node Runner module and all tools initialized\n');
  }

  async createDemoApplications() {
    console.log('📝 Creating demo applications...');

    // Create demo directory
    const demoDir = path.join(__dirname, 'workflow-demo-apps');
    await fs.mkdir(demoDir, { recursive: true });

    // App 1: Simple web server
    const webServerCode = `
const http = require('http');
const server = http.createServer((req, res) => {
  console.log(\`\${new Date().toISOString()} - Request: \${req.method} \${req.url}\`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
  } else if (req.url === '/error') {
    console.error('Simulated error occurred!');
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from Node.js Web Server!');
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(\`🌐 Web server running on port \${port}\`);
  console.log('Available endpoints: /, /health, /error');
});

// Simulate periodic activity
setInterval(() => {
  console.log(\`⚡ Server stats: Uptime \${Math.floor(process.uptime())}s, Memory: \${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\`);
}, 5000);
`;

    // App 2: Data processing worker
    const workerCode = `
console.log('🔄 Starting data processing worker...');

let processedItems = 0;
const items = ['user-data', 'analytics', 'reports', 'exports', 'imports'];

function processItem(item) {
  console.log(\`📊 Processing: \${item}\`);
  
  // Simulate processing time
  const processingTime = Math.random() * 1000 + 500;
  
  setTimeout(() => {
    processedItems++;
    console.log(\`✅ Completed: \${item} (took \${Math.round(processingTime)}ms)\`);
    
    if (processedItems >= items.length) {
      console.log(\`🎉 All \${processedItems} items processed successfully!\`);
      process.exit(0);
    }
  }, processingTime);
}

// Process items with staggered start
items.forEach((item, index) => {
  setTimeout(() => processItem(item), index * 1000);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️ Worker received shutdown signal, finishing current tasks...');
  setTimeout(() => process.exit(0), 2000);
});
`;

    // App 3: Error-prone service (for testing error handling)
    const errorServiceCode = `
console.log('⚠️ Starting error-prone service (for testing)...');

let errors = 0;
const maxErrors = 3;

const operations = [
  () => { console.log('✅ Operation 1: Success'); },
  () => { 
    errors++;
    console.error(\`❌ Operation 2: Error \${errors}/\${maxErrors}\`);
    if (errors >= maxErrors) throw new Error('Maximum errors reached');
  },
  () => { console.log('✅ Operation 3: Success'); },
  () => { 
    console.warn('⚠️ Operation 4: Warning - resource low');
  }
];

// Run operations randomly
const interval = setInterval(() => {
  try {
    const operation = operations[Math.floor(Math.random() * operations.length)];
    operation();
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    clearInterval(interval);
    process.exit(1);
  }
}, 2000);

process.on('SIGTERM', () => {
  console.log('🛑 Error service shutting down...');
  clearInterval(interval);
  process.exit(0);
});
`;

    // Write application files
    await fs.writeFile(path.join(demoDir, 'web-server.js'), webServerCode);
    await fs.writeFile(path.join(demoDir, 'worker.js'), workerCode);
    await fs.writeFile(path.join(demoDir, 'error-service.js'), errorServiceCode);

    // Create package.json
    const packageJson = {
      name: 'workflow-demo-apps',
      version: '1.0.0',
      description: 'Demo applications for Node Runner workflow',
      main: 'web-server.js',
      scripts: {
        'start:web': 'node web-server.js',
        'start:worker': 'node worker.js',
        'start:error': 'node error-service.js'
      }
    };

    await fs.writeFile(path.join(demoDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    this.demoApps = [
      { name: 'Web Server', file: 'web-server.js', description: 'HTTP server with multiple endpoints' },
      { name: 'Data Worker', file: 'worker.js', description: 'Background data processing service' },
      { name: 'Error Service', file: 'error-service.js', description: 'Service that generates errors for testing' }
    ];

    console.log(\`✅ Created \${this.demoApps.length} demo applications in \${demoDir}\n\`);
    return demoDir;
  }

  async startApplications(demoDir) {
    console.log('🚀 Starting all demo applications...\n');

    for (const app of this.demoApps) {
      console.log(\`Starting: \${app.name} - \${app.description}\`);
      
      const result = await this.tools.runNode.execute({
        command: \`node \${app.file}\`,
        projectPath: demoDir,
        description: app.name,
        env: { 
          PORT: app.name === 'Web Server' ? '3001' : undefined 
        }
      });

      if (result.success) {
        console.log(\`✅ \${app.name} started successfully - Session: \${result.sessionId.slice(0, 8)}...\`);
        this.sessions.push({
          name: app.name,
          sessionId: result.sessionId,
          processId: result.processId
        });
      } else {
        console.log(\`❌ Failed to start \${app.name}: \${result.error}\`);
      }
    }

    console.log(\`\\n🎯 Started \${this.sessions.length} applications\\n\`);
  }

  async monitorHealth() {
    console.log('🏥 Checking system health...');
    
    const healthResult = await this.tools.serverHealth.execute({
      includeProcesses: true,
      includeSessions: true,
      includeStorage: true,
      includeSystemResources: true
    });

    if (healthResult.success) {
      console.log(\`📊 System Status: \${healthResult.overallStatus.toUpperCase()}\`);
      console.log(\`   Running Processes: \${healthResult.processes.running}\`);
      console.log(\`   Total Sessions: \${healthResult.sessions.total}\`);
      console.log(\`   Active Sessions: \${healthResult.sessions.active}\`);
      
      if (healthResult.issues && healthResult.issues.length > 0) {
        console.log('⚠️  Issues detected:');
        healthResult.issues.forEach(issue => console.log(\`   - \${issue}\`));
      }
    } else {
      console.log('❌ Health check failed');
    }
    console.log('');
  }

  async listActiveSessions() {
    console.log('📋 Listing all active sessions...');
    
    const listResult = await this.tools.listSessions.execute({
      status: 'running',
      includeStatistics: true,
      sortBy: 'startTime',
      sortOrder: 'desc'
    });

    if (listResult.success && listResult.sessions.length > 0) {
      console.log(\`Found \${listResult.sessions.length} running sessions:\`);
      
      listResult.sessions.forEach(session => {
        const startTime = new Date(session.startTime).toLocaleTimeString();
        console.log(\`   📁 \${session.description || 'Unnamed'} (ID: \${session.sessionId.slice(0, 8)}...) - Started: \${startTime}\`);
      });
    } else {
      console.log('No active sessions found');
    }
    console.log('');
  }

  async demonstrateSearchCapabilities() {
    console.log('🔍 Demonstrating log search capabilities...');
    
    // Wait for logs to accumulate
    console.log('⏳ Waiting for applications to generate logs...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Search 1: Keyword search for server activity
    console.log('\\n🔎 Search 1: Looking for server activity...');
    const serverSearch = await this.tools.searchLogs.execute({
      query: 'server',
      searchMode: 'keyword',
      limit: 5
    });

    if (serverSearch.success && serverSearch.logs.length > 0) {
      console.log(\`   Found \${serverSearch.logs.length} server-related log entries:\`);
      serverSearch.logs.slice(0, 3).forEach(log => {
        console.log(\`   📝 [\${log.source}] \${log.message.substring(0, 60)}...\`);
      });
    } else {
      console.log('   No server logs found');
    }

    // Search 2: Regex search for errors
    console.log('\\n🔎 Search 2: Looking for errors with regex...');
    const errorSearch = await this.tools.searchLogs.execute({
      query: '(error|Error|ERROR)',
      searchMode: 'regex',
      limit: 3
    });

    if (errorSearch.success && errorSearch.logs.length > 0) {
      console.log(\`   Found \${errorSearch.logs.length} error entries:\`);
      errorSearch.logs.forEach(log => {
        console.log(\`   ⚠️ [\${log.source}] \${log.message}\`);
      });
    } else {
      console.log('   No errors found yet');
    }

    // Search 3: Search within specific session
    if (this.sessions.length > 0) {
      const targetSession = this.sessions[0];
      console.log(\`\\n🔎 Search 3: Logs from '\${targetSession.name}' session...\`);
      
      const sessionSearch = await this.tools.searchLogs.execute({
        query: '.',
        searchMode: 'regex',
        sessionId: targetSession.sessionId,
        limit: 5
      });

      if (sessionSearch.success && sessionSearch.logs.length > 0) {
        console.log(\`   Found \${sessionSearch.logs.length} logs from this session:\`);
        sessionSearch.logs.slice(0, 3).forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          console.log(\`   📄 [\${time}] \${log.message}\`);
        });
      } else {
        console.log('   No session logs found yet');
      }
    }

    console.log('');
  }

  async gracefulShutdown() {
    console.log('🛑 Initiating graceful shutdown of all services...');
    
    const stopResult = await this.tools.stopNode.execute({
      stopAll: true,
      graceful: true,
      timeout: 5000
    });

    if (stopResult.success) {
      console.log(\`✅ Successfully stopped \${stopResult.stoppedProcesses.length} processes\`);
      console.log('   All applications have been gracefully terminated');
    } else {
      console.log('❌ Some processes failed to stop gracefully');
    }

    // Final health check
    console.log('\\n🏥 Final system health check...');
    await this.monitorHealth();

    // Clean up demo files
    try {
      await fs.rm(path.join(__dirname, 'workflow-demo-apps'), { recursive: true, force: true });
      console.log('🧹 Cleaned up demo files');
    } catch (error) {
      console.log('ℹ️ Demo cleanup skipped (files may not exist)');
    }

    console.log('\\n✨ Workflow demonstration completed successfully!\\n');
  }

  async run() {
    try {
      await this.initialize();
      const demoDir = await this.createDemoApplications();
      await this.startApplications(demoDir);
      
      // Let applications run and generate logs
      console.log('⏳ Allowing applications to run and generate logs...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await this.monitorHealth();
      await this.listActiveSessions();
      await this.demonstrateSearchCapabilities();
      
      console.log('⏱️ Letting services run for a bit longer...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await this.gracefulShutdown();

    } catch (error) {
      console.error('💥 Demo failed:', error.message);
      console.error(error.stack);
      
      // Attempt cleanup
      try {
        await this.tools.stopNode.execute({ stopAll: true });
      } catch (cleanupError) {
        console.error('⚠️ Cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const demo = new WorkflowDemo();
  demo.run().then(() => {
    console.log('🎉 Node Runner Complete Workflow Demo finished!');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Demo failed:', error);
    process.exit(1);
  });
}

export { WorkflowDemo };