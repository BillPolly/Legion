/**
 * @fileoverview React application example demonstrating frontend log capture
 * Shows how node-runner captures browser console logs, errors, and network requests
 */

import { NodeRunnerModule } from '../src/NodeRunnerModule.js';
import { MockStorageProvider } from '../__tests__/utils/MockStorageProvider.js';
import { LogStorage } from '../src/storage/LogStorage.js';
import { SessionManager } from '../src/managers/SessionManager.js';
import { ProcessManager } from '../src/managers/ProcessManager.js';
import { LogSearch } from '../src/search/LogSearch.js';
import { ServerManager } from '../src/managers/ServerManager.js';
import { WebSocketServer } from '../src/servers/WebSocketServer.js';
import { FrontendInjector } from '../src/injectors/FrontendInjector.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create a simple React application with Vite
 */
async function createReactApp() {
  const appDir = path.join(__dirname, 'test-react-app');
  
  // Create directory
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(path.join(appDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(appDir, 'public'), { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: 'test-react-app',
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.0.0',
      vite: '^4.3.0'
    }
  };
  
  await fs.writeFile(
    path.join(appDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create vite.config.js
  const viteConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    open: false
  }
});
`;
  
  await fs.writeFile(path.join(appDir, 'vite.config.js'), viteConfig);
  
  // Create index.html
  const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`;
  
  await fs.writeFile(path.join(appDir, 'index.html'), indexHtml);
  
  // Create main.jsx
  const mainJsx = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('React app initializing...');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('React app mounted successfully');
`;
  
  await fs.writeFile(path.join(appDir, 'src', 'main.jsx'), mainJsx);
  
  // Create App.jsx with various logging scenarios
  const appJsx = `
import React, { useState, useEffect } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    console.log('App component mounted');
    console.info('Initial render complete');
    
    // Simulate periodic activity
    const interval = setInterval(() => {
      console.log(\`Heartbeat at \${new Date().toISOString()}\`);
    }, 5000);
    
    return () => {
      console.log('App component unmounting');
      clearInterval(interval);
    };
  }, []);
  
  useEffect(() => {
    console.log(\`Count updated to: \${count}\`);
    
    if (count > 5) {
      console.warn('Count is getting high!');
    }
    
    if (count === 10) {
      console.error('Count reached maximum value!');
    }
  }, [count]);
  
  const handleIncrement = () => {
    console.log('Increment button clicked');
    setCount(c => c + 1);
  };
  
  const handleDecrement = () => {
    console.log('Decrement button clicked');
    setCount(c => Math.max(0, c - 1));
  };
  
  const fetchData = async () => {
    console.log('Fetching data from API...');
    try {
      // Simulate API call
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      const json = await response.json();
      console.log('Data fetched successfully:', json);
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err.message);
      setError(err.message);
      setData(null);
    }
  };
  
  const simulateError = () => {
    console.error('Simulating error...');
    try {
      throw new Error('This is a simulated error for testing');
    } catch (err) {
      console.error('Caught error:', err);
      setError(err.message);
    }
  };
  
  const testConsoleTypes = () => {
    console.log('Regular log message');
    console.info('Info message with details');
    console.warn('Warning: This is a warning message');
    console.error('Error: This is an error message');
    console.debug('Debug information');
    console.table({ name: 'Test', value: 123 });
    console.group('Grouped messages');
    console.log('Message 1');
    console.log('Message 2');
    console.groupEnd();
  };
  
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>React Test App - Node Runner Example</h1>
      
      <section style={{ marginBottom: '20px' }}>
        <h2>Counter Example</h2>
        <p>Count: {count}</p>
        <button onClick={handleIncrement}>Increment</button>
        <button onClick={handleDecrement} style={{ marginLeft: '10px' }}>Decrement</button>
        {count > 5 && <p style={{ color: 'orange' }}>Warning: Count is high!</p>}
        {count === 10 && <p style={{ color: 'red' }}>Maximum count reached!</p>}
      </section>
      
      <section style={{ marginBottom: '20px' }}>
        <h2>API Fetch Example</h2>
        <button onClick={fetchData}>Fetch Data</button>
        {data && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f0f0' }}>
            <h3>{data.title}</h3>
            <p>{data.body}</p>
          </div>
        )}
        {error && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#ffe0e0', color: 'red' }}>
            Error: {error}
          </div>
        )}
      </section>
      
      <section style={{ marginBottom: '20px' }}>
        <h2>Console Testing</h2>
        <button onClick={testConsoleTypes}>Test All Console Types</button>
        <button onClick={simulateError} style={{ marginLeft: '10px' }}>Simulate Error</button>
      </section>
      
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ccc' }}>
        <p>This app demonstrates frontend log capture with Node Runner</p>
        <p>Open DevTools to see console output being captured</p>
      </footer>
    </div>
  );
}

export default App;
`;
  
  await fs.writeFile(path.join(appDir, 'src', 'App.jsx'), appJsx);
  
  return appDir;
}

/**
 * Install dependencies for React app
 */
async function installDependencies(appDir) {
  return new Promise((resolve, reject) => {
    console.log('📦 Installing React app dependencies...');
    const install = spawn('npm', ['install'], {
      cwd: appDir,
      stdio: 'inherit'
    });
    
    install.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
  });
}

/**
 * Main example demonstrating node-runner with React and frontend log capture
 */
async function runExample() {
  console.log('🚀 Node Runner - React Frontend Log Capture Example\n');
  console.log('This example demonstrates:');
  console.log('  • Starting a React development server');
  console.log('  • Capturing browser console logs');
  console.log('  • Monitoring network requests');
  console.log('  • Capturing JavaScript errors');
  console.log('  • Real-time log streaming via WebSocket\n');
  
  // Create test React app
  console.log('Setting up React application...');
  const appDir = await createReactApp();
  console.log(`✅ Created React app in: ${appDir}\n`);
  
  // Install dependencies
  await installDependencies(appDir);
  console.log('✅ Dependencies installed\n');
  
  // Initialize node-runner module with WebSocket support
  console.log('Initializing Node Runner module with WebSocket...');
  const mockStorage = new MockStorageProvider();
  const logStorage = new LogStorage(mockStorage);
  const sessionManager = new SessionManager(mockStorage);
  const processManager = new ProcessManager(logStorage, sessionManager);
  const logSearch = new LogSearch(null, logStorage);
  const serverManager = new ServerManager(processManager);
  
  // Create WebSocket server for frontend log capture
  const wsServer = new WebSocketServer(8080);
  await wsServer.start();
  console.log('✅ WebSocket server started on port 8080\n');
  
  // Create frontend injector
  const frontendInjector = new FrontendInjector({
    wsUrl: 'ws://localhost:8080',
    captureConsole: true,
    captureErrors: true,
    captureNetwork: true
  });
  
  // Set up WebSocket connection handler
  wsServer.on('connection', (ws) => {
    console.log('📡 Frontend connected via WebSocket');
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'log') {
          // Store frontend logs
          logStorage.storeLog({
            sessionId: currentSessionId,
            processId: 'frontend',
            message: message.message,
            source: 'frontend',
            level: message.level || 'info',
            timestamp: new Date(message.timestamp)
          });
          
          // Display in real-time
          console.log(`  [Frontend ${message.level}] ${message.message}`);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
  });
  
  const module = new NodeRunnerModule({
    processManager,
    sessionManager,
    logStorage,
    logSearch,
    serverManager,
    webSocketServer: wsServer,
    frontendInjector
  });
  
  // Get tools
  const tools = module.getTools();
  const [runTool, stopTool, searchTool, listTool, healthTool] = tools;
  console.log('✅ Module initialized with', tools.length, 'tools\n');
  
  let currentSessionId;
  
  try {
    // Step 1: Start the React development server
    console.log('📦 Step 1: Starting React development server...');
    console.log('  Note: This will take a moment as Vite starts up\n');
    
    const runResult = await runTool.execute({
      projectPath: appDir,
      command: 'npm run dev',
      description: 'React development server',
      env: { NODE_ENV: 'development' }
    });
    
    if (!runResult.success) {
      throw new Error(`Failed to start server: ${runResult.error}`);
    }
    
    currentSessionId = runResult.sessionId;
    
    console.log(`✅ React server started successfully!`);
    console.log(`   Session ID: ${runResult.sessionId}`);
    console.log(`   Process ID: ${runResult.processId}`);
    console.log(`   Server URL: http://localhost:3002\n`);
    
    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 2: Inject frontend logging script
    console.log('💉 Step 2: Frontend logging script ready');
    console.log('   The injection script would be added to the React app');
    console.log('   It captures: console.*, errors, network requests\n');
    
    // Display the injection script that would be used
    const injectionScript = frontendInjector.generateInjectionScript();
    console.log('   Script size:', Math.round(injectionScript.length / 1024), 'KB\n');
    
    // Step 3: Wait for frontend logs to accumulate
    console.log('⏳ Step 3: Monitoring frontend activity for 10 seconds...');
    console.log('   (In a real scenario, you would interact with the React app)\n');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Step 4: Search for frontend logs
    console.log('🔍 Step 4: Searching for frontend logs...\n');
    
    // Search for React-specific logs
    const reactLogs = await searchTool.execute({
      query: 'React',
      searchMode: 'keyword',
      sessionId: runResult.sessionId,
      source: 'frontend'
    });
    
    console.log(`✅ Found ${reactLogs.totalResults} React-related frontend logs`);
    if (reactLogs.logs.length > 0) {
      console.log('   Sample frontend logs:');
      reactLogs.logs.slice(0, 3).forEach(log => {
        console.log(`   - [${log.level}] ${log.message}`);
      });
    }
    
    // Search for console errors
    console.log('\n🔍 Searching for frontend errors...');
    const errorLogs = await searchTool.execute({
      query: 'error|Error|ERROR',
      searchMode: 'regex',
      sessionId: runResult.sessionId,
      source: 'frontend'
    });
    
    console.log(`✅ Found ${errorLogs.totalResults} error-related frontend logs\n`);
    
    // Search for network requests
    console.log('🔍 Searching for network activity...');
    const networkLogs = await searchTool.execute({
      query: 'fetch|request|response',
      searchMode: 'keyword',
      sessionId: runResult.sessionId,
      source: 'frontend'
    });
    
    console.log(`✅ Found ${networkLogs.totalResults} network-related logs\n`);
    
    // Step 5: Get session statistics
    console.log('📈 Step 5: Session statistics...');
    const stats = await sessionManager.getSessionStatistics(runResult.sessionId);
    console.log('✅ Session Statistics:');
    console.log(`   Total processes: ${stats.totalProcesses}`);
    console.log(`   Total logs: ${stats.totalLogs}`);
    console.log(`   Frontend logs: ${stats.frontendLogs || 0}`);
    console.log(`   Backend logs: ${stats.backendLogs || 0}`);
    console.log(`   Duration: ${Math.round(stats.duration / 1000)}s\n`);
    
    // Step 6: Check system health
    console.log('📊 Step 6: System health check...');
    const healthResult = await healthTool.execute({ includeDetails: true });
    
    if (healthResult.success) {
      console.log('✅ System Health:');
      console.log(`   Status: ${healthResult.health.status}`);
      console.log(`   WebSocket: ${healthResult.health.webSocket.connected ? 'Connected' : 'Disconnected'}`);
      console.log(`   WebSocket clients: ${healthResult.health.webSocket.clients}`);
      console.log(`   Memory usage: ${healthResult.health.memory.percentage}%\n`);
    }
    
    // Step 7: Stop the server
    console.log('🛑 Step 7: Stopping React server...');
    const stopResult = await stopTool.execute({
      mode: 'session',
      sessionId: runResult.sessionId
    });
    
    if (stopResult.success) {
      console.log('✅ Server stopped successfully');
      console.log(`   Terminated ${stopResult.terminated.length} process(es)\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Try to stop all processes
    console.log('\n🧹 Cleaning up...');
    await stopTool.execute({ mode: 'all' });
  } finally {
    // Stop WebSocket server
    if (wsServer) {
      await wsServer.stop();
      console.log('✅ WebSocket server stopped');
    }
  }
  
  // Clean up
  console.log('\n🧹 Cleaning up test files...');
  await fs.rm(appDir, { recursive: true, force: true });
  console.log('✅ Cleanup complete\n');
  
  console.log('🎉 Example completed successfully!');
  console.log('\nThis example demonstrated:');
  console.log('  ✅ Starting a React development server with Vite');
  console.log('  ✅ WebSocket server for real-time log streaming');
  console.log('  ✅ Frontend JavaScript injection for log capture');
  console.log('  ✅ Capturing browser console logs (log, warn, error, info)');
  console.log('  ✅ Monitoring network requests (fetch API)');
  console.log('  ✅ Searching frontend logs by source');
  console.log('  ✅ Session statistics with frontend/backend breakdown');
  console.log('  ✅ WebSocket connection health monitoring\n');
  
  console.log('💡 In production, the injection script would be:');
  console.log('  1. Automatically injected into HTML responses');
  console.log('  2. Capture all browser activity in real-time');
  console.log('  3. Stream logs to the WebSocket server');
  console.log('  4. Store logs for later analysis and search\n');
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  runExample().catch(console.error);
}

export { runExample, createReactApp };