# Browser Monitor

Browser automation and monitoring package for full-stack observability. Complements the `log-manager` package to provide complete visibility into both frontend and backend behavior.

## Features

- 🌐 **Browser Automation**: Support for Puppeteer and Playwright
- 📝 **Console Capture**: Capture all browser console messages
- 🔍 **Network Interception**: Track all network requests/responses
- 🔗 **Correlation Tracking**: Automatic correlation ID injection
- 📸 **Visual Capture**: Screenshots and page information
- 🎯 **Session Management**: Organize monitoring by sessions
- 📊 **Statistics**: Real-time metrics and monitoring
- 🔌 **Legion Integration**: Works seamlessly with Legion framework

## Architecture

```
BrowserMonitor (Core)
├── Browser Lifecycle Management
├── Page Monitoring
│   ├── Console Capture
│   ├── Network Interception
│   └── Error Tracking
├── Session Management
├── Correlation Injection
└── Event Emission
```

## Installation

```bash
npm install @legion/browser-monitor

# Install browser driver (choose one)
npm install puppeteer
# OR
npm install playwright
```

## Quick Start

```javascript
import { BrowserMonitor } from '@legion/browser-monitor';

// With ResourceManager (Legion)
const monitor = await BrowserMonitor.create(resourceManager);

// Launch browser
const browser = await monitor.launch({
  headless: true,
  devtools: false
});

// Create session
const session = await monitor.createSession({
  name: 'debug-session',
  metadata: { userId: '123' }
});

// Monitor a page
const page = await monitor.monitorPage('https://example.com', session.id);

// Capture events
monitor.on('console-message', (log) => {
  console.log(`Browser console: ${log.text}`);
});

monitor.on('network-request', (request) => {
  console.log(`API call: ${request.method} ${request.url}`);
  if (request.correlationId) {
    console.log(`Correlation ID: ${request.correlationId}`);
  }
});

// Interact with page
await page.click('#submit-button');
await page.type('#search-input', 'test query');
await page.screenshot({ path: 'screenshot.png' });

// Get statistics
const stats = monitor.getStatistics();
console.log(`Total requests: ${stats.totalNetworkRequests}`);
console.log(`Console messages: ${stats.totalConsoleMessages}`);

// Clean up
await monitor.close();
```

## Core Components

### BrowserMonitor

Main class that manages browser lifecycle and page monitoring.

```javascript
const monitor = await BrowserMonitor.create(resourceManager);
```

**Configuration via ResourceManager:**
- `BROWSER_TYPE`: 'puppeteer' or 'playwright' (default: 'puppeteer')
- `BROWSER_HEADLESS`: true/false (default: true)

### Session Management

Organize monitoring activities into sessions:

```javascript
const session = await monitor.createSession({
  name: 'user-journey-test',
  metadata: {
    testId: 'test-123',
    environment: 'staging'
  }
});

// All pages monitored with this session ID will be grouped
const page1 = await monitor.monitorPage(url1, session.id);
const page2 = await monitor.monitorPage(url2, session.id);

// Get all logs for the session
const logs = monitor.getSessionLogs(session.id);
const requests = monitor.getSessionRequests(session.id);

// End session and cleanup
await monitor.endSession(session.id);
```

### Page Monitoring

Enhanced page object with monitoring capabilities:

```javascript
const page = await monitor.monitorPage('https://app.com', sessionId);

// Navigation
await page.navigate('https://app.com/login');

// Interaction
await page.click('#login-button');
await page.type('#username', 'user@example.com');
await page.waitForSelector('.dashboard');

// Capture
const screenshot = await page.screenshot();
const title = await page.evaluate(() => document.title);
```

### Console Capture

Automatically captures all console output:

```javascript
monitor.on('console-message', (log) => {
  console.log(`[${log.type}] ${log.text}`);
  // log.type: 'log' | 'warn' | 'error' | 'info' | 'debug'
  // log.args: Array of arguments
  // log.timestamp: Date
});
```

### Network Interception

Track all network activity:

```javascript
monitor.on('network-request', (request) => {
  console.log(`${request.method} ${request.url}`);
  console.log(`Headers:`, request.headers);
  console.log(`Correlation ID:`, request.correlationId);
});

monitor.on('network-response', (response) => {
  console.log(`Response: ${response.status} for ${response.url}`);
});
```

### Correlation Tracking

Automatically injects correlation IDs into requests:

```javascript
// Injected monitoring script adds correlation IDs to all fetch requests
// Frontend request:
fetch('/api/data') // Automatically gets X-Correlation-ID header

// The correlation ID can be tracked across:
// 1. Browser console logs
// 2. Network requests
// 3. Backend logs (via log-manager)
```

### Error Tracking

Capture page errors and unhandled rejections:

```javascript
monitor.on('page-error', (error) => {
  console.error(`Page error: ${error.message}`);
  console.error(`Stack: ${error.stack}`);
});
```

## Events

The BrowserMonitor emits the following events:

| Event | Description | Data |
|-------|-------------|------|
| `initialized` | Monitor initialized | `{ browserType, timestamp }` |
| `browser-launched` | Browser started | `{ browser, options, timestamp }` |
| `browser-closed` | Browser closed | `{ timestamp }` |
| `browser-crashed` | Browser crashed | `{ timestamp, message }` |
| `page-created` | Page monitored | `{ pageId, url, sessionId, timestamp }` |
| `page-closed` | Page closed | `{ pageId, sessionId, timestamp }` |
| `session-created` | Session started | `{ sessionId, name, timestamp }` |
| `session-ended` | Session ended | `{ sessionId, duration, timestamp }` |
| `console-message` | Console output | `{ pageId, sessionId, type, text, args, timestamp }` |
| `network-request` | HTTP request | `{ pageId, sessionId, url, method, headers, correlationId, timestamp }` |
| `network-response` | HTTP response | `{ pageId, sessionId, url, status, headers, timestamp }` |
| `page-error` | Page error | `{ pageId, sessionId, message, stack, timestamp }` |
| `screenshot-taken` | Screenshot captured | `{ pageId, sessionId, timestamp, options }` |
| `element-clicked` | Element clicked | `{ pageId, sessionId, selector, timestamp }` |
| `text-typed` | Text entered | `{ pageId, sessionId, selector, text, timestamp }` |

## Integration with log-manager

Combine with `log-manager` for full-stack observability:

```javascript
import { LegionLogManager } from '@legion/log-manager';
import { BrowserMonitor } from '@legion/browser-monitor';

// Create both monitors
const logManager = await LegionLogManager.create(resourceManager);
const browserMonitor = await BrowserMonitor.create(resourceManager);

// Shared session
const session = await logManager.createSession({
  name: 'full-stack-debug'
});

// Monitor backend
logManager.monitorProcess('server.js', 'backend');

// Monitor frontend
const page = await browserMonitor.monitorPage(
  'http://localhost:3000', 
  session.sessionId
);

// Correlation tracking
browserMonitor.on('network-request', async (request) => {
  if (request.correlationId) {
    // Find correlated backend logs
    const backendLogs = await logManager.searchLogs({
      query: request.correlationId,
      sessionId: session.sessionId
    });
    
    console.log('Frontend request:', request.url);
    console.log('Backend logs:', backendLogs.matches);
  }
});
```

## Statistics

Get real-time monitoring statistics:

```javascript
const stats = monitor.getStatistics();

console.log({
  activeSessions: stats.activeSessions,
  activePages: stats.activePages,
  browserConnected: stats.browserConnected,
  totalPagesCreated: stats.totalPagesCreated,
  totalSessionsCreated: stats.totalSessionsCreated,
  totalConsoleMessages: stats.totalConsoleMessages,
  totalNetworkRequests: stats.totalNetworkRequests,
  totalErrors: stats.totalErrors,
  uptime: stats.uptime
});
```

## Demo

Run the included demo:

```bash
cd packages/browser-monitor
npm run demo
```

This will:
1. Launch a browser (visible if not headless)
2. Navigate to example.com
3. Capture console logs and network requests
4. Take a screenshot
5. Display statistics

## Testing

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Use Cases

### 1. Debug User Journey
```javascript
async function debugUserJourney() {
  const session = await monitor.createSession({ name: 'login-flow' });
  const page = await monitor.monitorPage('/login', session.id);
  
  await page.type('#email', 'user@example.com');
  await page.type('#password', 'password');
  await page.click('#submit');
  
  const logs = monitor.getSessionLogs(session.id);
  const errors = logs.filter(l => l.type === 'error');
  
  if (errors.length > 0) {
    console.log('Login failed with errors:', errors);
  }
}
```

### 2. API Correlation
```javascript
monitor.on('network-request', (req) => {
  if (req.url.includes('/api/')) {
    console.log(`API Call [${req.correlationId}]:`, req.url);
    // Track this ID in backend logs
  }
});
```

### 3. Performance Monitoring
```javascript
const startTime = Date.now();
const page = await monitor.monitorPage(url, sessionId);

await page.waitForSelector('.main-content');
const loadTime = Date.now() - startTime;

const requests = monitor.getSessionRequests(sessionId);
console.log(`Page loaded in ${loadTime}ms with ${requests.length} requests`);
```

## Roadmap

- [ ] Video recording support
- [ ] HAR file generation
- [ ] Performance metrics (Core Web Vitals)
- [ ] Mobile device emulation
- [ ] Network throttling simulation
- [ ] Cookie/storage management
- [ ] Multi-tab support
- [ ] Browser extension support

## License

Part of the Legion framework