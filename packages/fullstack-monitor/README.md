# FullStack Monitor

Complete full-stack monitoring orchestrator that combines `log-manager` and `browser-monitor` packages to provide unified observability for AI code-building agents.

## Features

- 🔄 **Unified Monitoring**: Single interface for backend and frontend monitoring
- 🔗 **Correlation Tracking**: Automatic correlation between browser and server events
- 🎯 **Debug Scenarios**: Execute and analyze multi-step debugging workflows
- 📊 **Aggregated Statistics**: Combined metrics from all monitoring sources
- 🚀 **Real-time Events**: Stream events from both browser and backend
- 🤖 **AI-Friendly**: Perfect for AI agents debugging full-stack applications

## Architecture

```
FullStackMonitor (Orchestrator)
├── LegionLogManager (Backend)
│   ├── Process Monitoring
│   ├── Log Collection
│   └── Search & Analysis
├── BrowserMonitor (Frontend)
│   ├── Browser Automation
│   ├── Console Capture
│   └── Network Interception
└── Correlation Engine
    ├── ID Tracking
    ├── Event Linking
    └── Analysis
```

## Installation

```bash
npm install @legion/fullstack-monitor

# Dependencies
npm install @legion/log-manager @legion/browser-monitor
```

## Quick Start

```javascript
import { FullStackMonitor } from '@legion/fullstack-monitor';

// Create monitor
const monitor = await FullStackMonitor.create(resourceManager);

// Monitor full-stack app
const app = await monitor.monitorFullStackApp({
  backend: {
    script: 'server.js',
    name: 'api-server',
    port: 3001
  },
  frontend: {
    url: 'http://localhost:3000',
    browserOptions: { headless: true }
  }
});

// Track correlations
monitor.on('correlation-detected', (data) => {
  console.log(`Correlation: ${data.correlationId}`);
  // Links frontend request to backend processing
});

// Execute debug scenario
const results = await monitor.debugScenario([
  { action: 'navigate', url: '/login' },
  { action: 'type', selector: '#email', text: 'user@example.com' },
  { action: 'click', selector: '#submit' }
]);

// Analyze results
results.forEach(result => {
  if (result.correlationId) {
    console.log('Backend logs:', result.backendLogs);
    console.log('Frontend logs:', result.frontendLogs);
  }
});
```

## Core Components

### FullStackMonitor

Main orchestrator class that coordinates all monitoring activities.

```javascript
const monitor = await FullStackMonitor.create(resourceManager);
```

### Full-Stack Application Monitoring

Monitor both backend and frontend simultaneously:

```javascript
const app = await monitor.monitorFullStackApp({
  backend: {
    script: 'path/to/server.js',   // Script to run
    name: 'backend-server',         // Process name
    port: 3001,                     // Port to wait for
    timeout: 30000,                 // Startup timeout
    args: ['--dev']                 // Process arguments
  },
  frontend: {
    url: 'http://localhost:3000',   // URL to monitor
    browserOptions: {
      headless: false,              // Show browser
      devtools: true                // Open devtools
    }
  }
});

// Returns:
{
  backend: { /* process info */ },
  browser: { /* page info */ },
  session: { /* session info */ }
}
```

### Debug Scenarios

Execute multi-step debugging workflows:

```javascript
const scenario = [
  { action: 'navigate', url: '/dashboard' },
  { action: 'click', selector: '#refresh-btn' },
  { action: 'waitFor', selector: '.data-loaded' },
  { action: 'type', selector: '#search', text: 'error' },
  { action: 'screenshot', options: { path: 'debug.png' } }
];

const results = await monitor.debugScenario(scenario);

// Each result contains:
{
  step: { /* original step */ },
  success: true/false,
  correlationId: 'correlation-123',  // If detected
  backendLogs: [],                   // Related backend logs
  frontendLogs: [],                  // Related frontend logs
  analysis: {                       // AI-friendly analysis
    summary: 'Step completed',
    insights: [
      { type: 'backend-errors', count: 2, messages: [...] },
      { type: 'slow-request', duration: 1500 }
    ]
  }
}
```

### Correlation Tracking

Automatically tracks correlations between frontend and backend:

```javascript
// Manual correlation tracking
await monitor.trackCorrelation('correlation-123', {
  frontend: { url: '/api/users', method: 'GET' },
  backend: { endpoint: '/users', status: 200 }
});

// Get all logs for a correlation
const logs = await monitor.getCorrelatedLogs('correlation-123');
console.log(logs);
// {
//   backend: [...],     // Backend logs with this ID
//   frontend: [...],    // Frontend console logs
//   network: [...],     // Network requests
//   correlation: {...}  // Correlation metadata
// }
```

### Real-time Events

Monitor events in real-time:

```javascript
// Frontend events
monitor.on('browser-console', (log) => {
  console.log(`Browser: ${log.text}`);
});

monitor.on('browser-request', (request) => {
  console.log(`Request: ${request.url}`);
});

monitor.on('browser-error', (error) => {
  console.error(`Browser Error: ${error.message}`);
});

// Backend events
monitor.on('backend-log', (log) => {
  console.log(`Backend [${log.level}]: ${log.message}`);
});

// Correlation events
monitor.on('correlation-detected', (data) => {
  console.log(`Correlation ${data.correlationId} detected`);
});
```

### Statistics

Get aggregated statistics from all monitors:

```javascript
const stats = monitor.getStatistics();

console.log({
  backend: {
    totalLogs: stats.backend.totalLogs,
    processes: stats.backend.processes
  },
  frontend: {
    consoleMessages: stats.frontend.totalConsoleMessages,
    networkRequests: stats.frontend.totalNetworkRequests,
    errors: stats.frontend.totalErrors
  },
  correlations: stats.correlationsDetected,
  debugScenarios: stats.debugScenariosRun,
  stepsExecuted: stats.totalStepsExecuted
});
```

## Use Cases for AI Agents

### 1. Debug User Journey

```javascript
async function debugLoginFlow() {
  const monitor = await FullStackMonitor.create(resourceManager);
  
  // Start monitoring
  await monitor.monitorFullStackApp({
    backend: { script: 'server.js', name: 'api', port: 3001 },
    frontend: { url: 'http://localhost:3000/login' }
  });
  
  // Execute login flow
  const results = await monitor.debugScenario([
    { action: 'type', selector: '#email', text: 'test@example.com' },
    { action: 'type', selector: '#password', text: 'password123' },
    { action: 'click', selector: '#login-btn' }
  ]);
  
  // Analyze failure
  const failedStep = results.find(r => !r.success);
  if (failedStep) {
    console.log('Login failed at:', failedStep.step);
    console.log('Backend errors:', failedStep.backendLogs.filter(l => l.level === 'error'));
    console.log('Browser errors:', failedStep.frontendLogs.filter(l => l.type === 'error'));
  }
}
```

### 2. Track API Performance

```javascript
monitor.on('correlation-detected', async (data) => {
  if (data.frontend && data.frontend.type === 'request') {
    const logs = await monitor.getCorrelatedLogs(data.correlationId);
    
    // Calculate end-to-end timing
    const requestTime = new Date(data.frontend.timestamp);
    const responseLogs = logs.backend.filter(l => l.message.includes('Response'));
    
    if (responseLogs.length > 0) {
      const responseTime = new Date(responseLogs[0].timestamp);
      const duration = responseTime - requestTime;
      
      console.log(`API ${data.frontend.url}: ${duration}ms`);
      
      if (duration > 1000) {
        console.warn('Slow API detected!');
        // AI agent could investigate further
      }
    }
  }
});
```

### 3. Error Correlation

```javascript
monitor.on('browser-error', async (error) => {
  console.log('Browser error detected:', error.message);
  
  // Find related backend errors
  const recentLogs = await monitor.logManager.searchLogs({
    query: 'error',
    mode: 'keyword',
    timeRange: { minutes: 1 }
  });
  
  if (recentLogs.matches.length > 0) {
    console.log('Possibly related backend errors:');
    recentLogs.matches.forEach(log => {
      console.log(`  - ${log.message}`);
    });
  }
});
```

### 4. Automated Testing

```javascript
async function testCriticalPaths() {
  const testScenarios = [
    {
      name: 'User Registration',
      steps: [
        { action: 'navigate', url: '/register' },
        { action: 'type', selector: '#email', text: 'new@example.com' },
        { action: 'type', selector: '#password', text: 'secure123' },
        { action: 'click', selector: '#register-btn' },
        { action: 'waitFor', selector: '.welcome-message' }
      ]
    },
    {
      name: 'Data Fetch',
      steps: [
        { action: 'navigate', url: '/dashboard' },
        { action: 'click', selector: '#load-data' },
        { action: 'waitFor', selector: '.data-table' }
      ]
    }
  ];
  
  for (const scenario of testScenarios) {
    console.log(`Testing: ${scenario.name}`);
    const results = await monitor.debugScenario(scenario.steps);
    
    const success = results.every(r => r.success);
    console.log(`  Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    if (!success) {
      // AI agent analyzes failure
      const failureAnalysis = analyzeTestFailure(results);
      console.log(`  Failure reason: ${failureAnalysis}`);
    }
  }
}
```

## Demo

Run the included comprehensive demo:

```bash
cd packages/fullstack-monitor
npm run demo
```

The demo will:
1. Start a sample backend server
2. Serve a sample frontend page
3. Launch browser automation
4. Execute various API calls with correlation tracking
5. Demonstrate error handling
6. Show real-time monitoring
7. Display comprehensive statistics

## Testing

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Configuration

Configure via ResourceManager:

```javascript
resourceManager.set('BROWSER_TYPE', 'playwright');     // or 'puppeteer'
resourceManager.set('BROWSER_HEADLESS', false);        // Show browser
resourceManager.set('LOG_LEVEL', 'debug');             // Logging detail
```

## Benefits for AI Code-Building Agents

1. **Complete Visibility**: See everything happening in both frontend and backend
2. **Automatic Correlation**: No manual linking needed between browser and server events
3. **Natural Debugging**: Execute scenarios just like a human would
4. **Rich Analysis**: Get insights about errors, performance, and behavior
5. **Single Interface**: One API to monitor everything

## Roadmap

- [ ] Support for mobile app monitoring
- [ ] Distributed tracing across microservices
- [ ] Performance profiling and flame graphs
- [ ] AI-powered root cause analysis
- [ ] Automatic fix suggestions
- [ ] Integration with CI/CD pipelines

## License

Part of the Legion framework