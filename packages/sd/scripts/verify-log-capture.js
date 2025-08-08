#!/usr/bin/env node

/**
 * Verify that LiveTestingAgent actually captures and correlates logs
 */

import { promises as fs } from 'fs';
import { SDInitializer } from '../src/utils/SDInitializer.js';
import { LiveTestingAgent } from '../src/agents/LiveTestingAgent.js';
import { LogAnalyzer } from '../src/utils/LogAnalyzer.js';
import { TraceCorrelator } from '../src/utils/TraceCorrelator.js';
import { WebSocket } from 'ws';

async function verifyLogCapture() {
  console.log('🔍 Verifying Log Capture and Correlation\n');
  console.log('=' .repeat(50) + '\n');
  
  // Initialize
  const init = new SDInitializer();
  const rm = await init.initializeForLiveTest();
  const llmClient = rm.get('llmClient');
  
  console.log('✅ LLM Client initialized\n');
  
  const liveTesting = new LiveTestingAgent({ llmClient });
  const logAnalyzer = new LogAnalyzer();
  const traceCorrelator = new TraceCorrelator();
  
  const projectPath = `/tmp/test-logging-${Date.now()}`;
  
  // Create a test Express app with explicit logging and correlation IDs
  console.log('📝 Creating test application...');
  console.log(`   Path: ${projectPath}\n`);
  
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(`${projectPath}/src`, { recursive: true });
  
  // Write a test app with correlation tracking
  const appCode = `
const express = require('express');
const app = express();
const PORT = 4444;

// Correlation ID middleware
let requestCount = 0;
app.use((req, res, next) => {
  const correlationId = \`req-\${Date.now()}-\${++requestCount}\`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Log request with correlation ID
  console.log(\`[REQUEST] correlation-id: \${correlationId} method: \${req.method} path: \${req.path} timestamp: \${Date.now()}\`);
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(\`[RESPONSE] correlation-id: \${correlationId} status: \${res.statusCode} duration: \${duration}ms\`);
  });
  
  req.startTime = Date.now();
  next();
});

// Test endpoints
app.get('/', (req, res) => {
  console.log(\`[HANDLER] correlation-id: \${req.correlationId} - Processing homepage request\`);
  res.send(\`
    <h1>Test App</h1>
    <button onclick="testApi()">Test API</button>
    <div id="time"></div>
    <script>
      function testApi() {
        console.log('[FRONTEND] User clicked button at ' + Date.now());
        fetch('/api/test')
          .then(r => r.json())
          .then(data => {
            console.log('[FRONTEND] Received response:', data);
          });
      }
      
      setInterval(() => {
        const time = new Date().toISOString();
        document.getElementById('time').innerText = time;
        console.log('[FRONTEND] Time updated: ' + time);
      }, 1000);
      
      console.log('[FRONTEND] Page loaded at ' + Date.now());
    </script>
  \`);
});

app.get('/api/test', (req, res) => {
  console.log(\`[API] correlation-id: \${req.correlationId} - Processing API request\`);
  
  // Simulate some processing
  setTimeout(() => {
    console.log(\`[DATABASE] correlation-id: \${req.correlationId} - Query executed\`);
    res.json({ 
      success: true, 
      timestamp: Date.now(),
      correlationId: req.correlationId 
    });
  }, 50);
});

app.use((err, req, res, next) => {
  console.error(\`[ERROR] correlation-id: \${req.correlationId} - Error: \${err.message}\`);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(\`[SERVER] Server started on port \${PORT} at \${Date.now()}\`);
});
`;

  await fs.writeFile(`${projectPath}/src/index.js`, appCode);
  
  // Write package.json
  await fs.writeFile(`${projectPath}/package.json`, JSON.stringify({
    name: 'test-log-capture',
    type: 'commonjs',
    main: 'src/index.js',
    dependencies: {
      express: '^4.18.0'
    }
  }, null, 2));
  
  // Install dependencies
  console.log('📦 Installing dependencies...');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('npm install', { cwd: projectPath });
    console.log('✅ Dependencies installed\n');
  } catch (error) {
    console.log('⚠️  Could not install dependencies, continuing anyway...\n');
  }
  
  // Start the application
  console.log('🚀 Starting application with LiveTestingAgent...');
  const startResult = await liveTesting.receive({
    type: 'start_application',
    payload: { projectPath, port: 4444 }
  });
  
  if (!startResult.success) {
    console.error('❌ Failed to start application:', startResult.error);
    return;
  }
  
  console.log('✅ Application started');
  console.log(`   PID: ${startResult.data.pid}`);
  console.log(`   Port: ${startResult.data.port}`);
  console.log(`   Log WebSocket: ws://localhost:${startResult.data.logPort}\n`);
  
  // Connect to log WebSocket
  console.log('📡 Connecting to log stream...');
  const logWs = new WebSocket(`ws://localhost:${startResult.data.logPort}`);
  const capturedLogs = [];
  
  await new Promise((resolve, reject) => {
    logWs.on('open', () => {
      console.log('✅ Connected to log stream\n');
      resolve();
    });
    
    logWs.on('message', (data) => {
      const logData = JSON.parse(data.toString());
      if (logData.type === 'logs' && logData.data) {
        logData.data.forEach(log => {
          capturedLogs.push(log);
          logAnalyzer.addLogs([log]);
          
          // Extract correlation ID and add to correlator
          const correlationId = traceCorrelator.detectLayer(log) !== 'unknown' ?
            log.message?.match(/correlation-id:\s*([^\s]+)/)?.[1] : null;
          
          if (correlationId) {
            traceCorrelator.addEvent(correlationId, log);
          }
        });
      }
    });
    
    logWs.on('error', reject);
    setTimeout(resolve, 2000);
  });
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test the endpoints
  console.log('🧪 Testing endpoints...\n');
  
  // Test 1: Homepage
  console.log('  1. Testing homepage...');
  const response1 = await fetch('http://localhost:4444/');
  console.log(`     Status: ${response1.status}`);
  const html = await response1.text();
  console.log(`     Has button: ${html.includes('Test API') ? '✅' : '❌'}`);
  
  // Test 2: API endpoint
  console.log('\n  2. Testing API endpoint...');
  const response2 = await fetch('http://localhost:4444/api/test');
  const apiData = await response2.json();
  console.log(`     Status: ${response2.status}`);
  console.log(`     Correlation ID: ${apiData.correlationId}`);
  console.log(`     Success: ${apiData.success ? '✅' : '❌'}`);
  
  // Wait for logs to be captured
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Analyze captured logs
  console.log('\n📊 Analyzing Captured Logs...\n');
  console.log(`  Total logs captured: ${capturedLogs.length}`);
  
  // Check log types
  const logTypes = {};
  capturedLogs.forEach(log => {
    const type = log.type || 'unknown';
    logTypes[type] = (logTypes[type] || 0) + 1;
  });
  console.log(`  Log types: ${JSON.stringify(logTypes)}`);
  
  // Check for correlation IDs
  const correlationIds = new Set();
  capturedLogs.forEach(log => {
    const match = log.message?.match(/correlation-id:\s*([^\s]+)/);
    if (match) {
      correlationIds.add(match[1]);
    }
  });
  console.log(`  Unique correlation IDs: ${correlationIds.size}`);
  
  // Check LogAnalyzer
  console.log('\n🔬 LogAnalyzer Results:');
  const perfSummary = logAnalyzer.getPerformanceSummary();
  console.log(`  Total logs analyzed: ${perfSummary.totalLogs}`);
  console.log(`  Errors: ${perfSummary.errors}`);
  console.log(`  Warnings: ${perfSummary.warnings}`);
  
  if (perfSummary.responseTime) {
    console.log(`  Response times:`);
    console.log(`    Min: ${perfSummary.responseTime.min}ms`);
    console.log(`    Max: ${perfSummary.responseTime.max}ms`);
    console.log(`    Avg: ${perfSummary.responseTime.avg.toFixed(2)}ms`);
  }
  
  // Check TraceCorrelator
  console.log('\n🔗 TraceCorrelator Results:');
  const traceSummary = traceCorrelator.getSummary();
  console.log(`  Total traces: ${traceSummary.totalTraces}`);
  console.log(`  Total events: ${traceSummary.totalEvents}`);
  console.log(`  Avg events per trace: ${traceSummary.avgEventsPerTrace.toFixed(2)}`);
  console.log(`  Layer distribution: ${JSON.stringify(traceSummary.layerDistribution)}`);
  
  // Show a specific trace
  if (correlationIds.size > 0) {
    const firstCorrelationId = Array.from(correlationIds)[0];
    console.log(`\n📍 Sample Trace (${firstCorrelationId}):`);
    
    const trace = traceCorrelator.getTrace(firstCorrelationId);
    if (trace) {
      console.log(`  Duration: ${trace.duration}ms`);
      console.log(`  Events: ${trace.eventCount}`);
      console.log(`  Layers involved: ${Object.keys(trace.layerCounts).join(', ')}`);
      
      // Show trace diagram
      const diagram = traceCorrelator.generateTextDiagram(firstCorrelationId);
      console.log('\n' + diagram);
    }
  }
  
  // Test runtime analysis
  console.log('\n🎯 Testing Runtime Analysis...');
  const analysisResult = await liveTesting.receive({
    type: 'analyze_runtime',
    payload: { projectPath }
  });
  
  if (analysisResult.success) {
    const { analysis, llmAnalysis } = analysisResult.data;
    console.log(`  Analysis successful: ✅`);
    console.log(`  Health status: ${llmAnalysis?.healthStatus || 'unknown'}`);
    console.log(`  Issues detected: ${llmAnalysis?.issues?.length || 0}`);
    console.log(`  Requires fixes: ${analysisResult.data.requiresFixes ? 'Yes' : 'No'}`);
  } else {
    console.log(`  Analysis failed: ❌`);
  }
  
  // Stop the application
  console.log('\n🛑 Stopping application...');
  await liveTesting.receive({
    type: 'stop_application',
    payload: { projectPath }
  });
  
  logWs.close();
  
  // Final verification
  console.log('\n' + '=' .repeat(50));
  console.log('📋 VERIFICATION RESULTS\n');
  
  const checks = {
    'Application started': startResult.success,
    'Logs captured': capturedLogs.length > 0,
    'Correlation IDs found': correlationIds.size > 0,
    'Traces correlated': traceSummary.totalTraces > 0,
    'Performance metrics extracted': !!perfSummary.responseTime,
    'Runtime analysis worked': analysisResult.success
  };
  
  let allPassed = true;
  Object.entries(checks).forEach(([check, passed]) => {
    console.log(`  ${check}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) allPassed = false;
  });
  
  console.log('\n' + '=' .repeat(50));
  console.log(allPassed ? 
    '✅ ALL CHECKS PASSED - Log capture and correlation is working!' :
    '⚠️  SOME CHECKS FAILED - Log capture may not be working properly'
  );
  console.log('=' .repeat(50) + '\n');
}

// Run the verification
verifyLogCapture().catch(console.error);