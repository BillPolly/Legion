# FullStackMonitor Comprehensive Test Plan

## Overview
This document outlines the complete testing strategy for the FullStackMonitor package with its dual-agent WebSocket architecture. Both backend (Sidewinder) and frontend (Browser) monitoring use WebSocket-based agents that connect to a unified server on port 9901.

## Architecture Summary
FullStackMonitor orchestrates monitoring of full-stack applications by:
1. Running a unified WebSocket server on port 9901 with path-based routing:
   - `/sidewinder` - Backend Node.js agent connections
   - `/browser` - Frontend browser agent connections
2. Injecting monitoring agents into both backend processes and browser pages
3. Processing all monitoring data from both agents via WebSocket messages
4. Storing all logs and events via direct calls to LegionLogManager
5. Correlating backend and frontend events using correlation IDs propagated through both agents

## Agent Architecture
- **Sidewinder Agent** (`src/sidewinder-agent.cjs`): CommonJS module injected via Node.js --require flag
- **Browser Agent** (`src/browser-agent.js`): JavaScript code injected into web pages
- Both agents establish WebSocket connections and send monitoring data in real-time
- Agents are self-contained within the FullStackMonitor package (no external dependencies)

## Test Structure
```
__tests__/
├── unit/
│   ├── FullStackMonitor.test.js
│   ├── AgentServer.test.js
│   ├── SidewinderMessageHandler.test.js
│   ├── BrowserMessageHandler.test.js
│   ├── AgentInjection.test.js
│   └── CorrelationTracking.test.js
├── integration/
│   ├── SidewinderAgentIntegration.test.js
│   ├── BrowserAgentIntegration.test.js
│   ├── DualAgentCommunication.test.js
│   ├── LogManagerIntegration.test.js
│   └── CrossStackCorrelation.test.js
├── e2e/
│   ├── FullStackMonitoring.test.js
│   ├── MultiAgentSessions.test.js
│   └── RealApplicationMonitoring.test.js
└── utils/
    ├── TestResourceManager.js
    ├── MockSidewinderAgent.js
    ├── MockBrowserAgent.js
    ├── TestAgentServer.js
    └── TestApplicationFactory.js
```

## 1. Unit Tests

### 1.1 FullStackMonitor Core (`unit/FullStackMonitor.test.js`)

#### Test: Factory Pattern Creation
```javascript
describe('FullStackMonitor Creation', () => {
  it('should create instance via async factory with ResourceManager')
  it('should throw error if ResourceManager is not provided')
  it('should start unified agent server on port 9901')
  it('should handle agent server startup failure gracefully')
  it('should create session in LogManager during initialization')
  it('should initialize both LogManager and BrowserMonitor')
})
```

#### Test: Agent Injection Methods
```javascript
describe('Agent Injection', () => {
  it('should inject Sidewinder agent into Node.js process')
  it('should pass correct environment variables to Sidewinder')
  it('should inject Browser agent into Puppeteer page')
  it('should configure Browser agent with correct WebSocket settings')
  it('should handle missing agent files gracefully')
})
```

### 1.2 Agent Server (`unit/AgentServer.test.js`)

#### Test: Unified WebSocket Server
```javascript
describe('Agent WebSocket Server', () => {
  it('should start WebSocket server on specified port')
  it('should accept connections at /sidewinder path')
  it('should accept connections at /browser path')
  it('should reject connections at unknown paths')
  it('should maintain separate client maps for each agent type')
  it('should send welcome message to connected agents')
  it('should handle concurrent connections from both agent types')
})
```

#### Test: Connection Management
```javascript
describe('Agent Connection Management', () => {
  it('should generate unique client IDs for Sidewinder agents')
  it('should generate unique client IDs for Browser agents')
  it('should track multiple Sidewinder connections in sidewinderClients Map')
  it('should track multiple Browser connections in browserClients Map')
  it('should clean up on agent disconnection')
  it('should log agent connections and disconnections')
  it('should handle WebSocket errors without crashing')
})
```

### 1.3 Sidewinder Message Handler (`unit/SidewinderMessageHandler.test.js`)

#### Test: Message Processing
```javascript
describe('Sidewinder Message Processing', () => {
  it('should handle "identify" message and log agent connection')
  it('should handle "console" messages with all log levels')
  it('should handle "processStart" and add process to session')
  it('should handle "uncaughtException" and store as error log')
  it('should handle "unhandledRejection" messages')
  it('should handle "processExit" and complete process in session')
  it('should handle "server-lifecycle" events (listening, error)')
  it('should extract and track correlation IDs from messages')
  it('should store all messages via direct LogManager calls')
})
```

### 1.4 Browser Message Handler (`unit/BrowserMessageHandler.test.js`)

#### Test: Browser Message Processing
```javascript
describe('Browser Message Processing', () => {
  it('should handle "identify" message with page URL and user agent')
  it('should handle "console" messages from browser')
  it('should handle "network" messages with request/response/error subtypes')
  it('should handle "error" messages with stack traces')
  it('should handle "unhandledrejection" messages')
  it('should handle "dom-mutation" summary messages')
  it('should handle "user-interaction" events')
  it('should handle "visibility" change events')
  it('should extract correlation IDs from console and network messages')
  it('should store all messages via direct LogManager calls')
})
```

### 1.5 Agent Injection (`unit/AgentInjection.test.js`)

#### Test: Sidewinder Agent Injection
```javascript
describe('Sidewinder Agent Injection', () => {
  it('should construct correct node command with -r flag')
  it('should verify agent file exists before injection')
  it('should set SIDEWINDER_SESSION_ID environment variable')
  it('should set SIDEWINDER_WS_PORT environment variable')
  it('should set SIDEWINDER_WS_HOST environment variable')
  it('should set SIDEWINDER_DEBUG environment variable when debug enabled')
  it('should return child process handle')
})
```

#### Test: Browser Agent Injection
```javascript
describe('Browser Agent Injection', () => {
  it('should read browser agent JavaScript file')
  it('should inject configuration variables before agent code')
  it('should set __BROWSER_AGENT_PORT__ window variable')
  it('should set __BROWSER_AGENT_HOST__ window variable')
  it('should set __BROWSER_AGENT_SESSION__ window variable')
  it('should set __BROWSER_AGENT_PAGE_ID__ window variable')
  it('should conditionally enable interaction tracking')
  it('should conditionally enable mutation tracking')
  it('should use evaluateOnNewDocument for injection')
})
```

### 1.6 Correlation Tracking (`unit/CorrelationTracking.test.js`)

#### Test: Cross-Agent Correlation
```javascript
describe('Dual-Agent Correlation', () => {
  it('should track correlations from Sidewinder backend messages')
  it('should track correlations from Browser frontend messages')
  it('should match correlation IDs between agents')
  it('should store both frontend and backend data in correlation')
  it('should handle multiple backend events for same correlation')
  it('should track firstSeen and lastSeen timestamps')
  it('should increment correlationsDetected counter')
  it('should retrieve correlation by ID')
  it('should search logs by correlation ID across both agents')
})
```

## 2. Integration Tests

### 2.1 Sidewinder Agent Integration (`integration/SidewinderAgentIntegration.test.js`)

#### Test: Real Sidewinder Agent Connection
```javascript
describe('Sidewinder Agent WebSocket Integration', () => {
  beforeEach(async () => {
    // Start FullStackMonitor with agent server
    // Inject Sidewinder agent into test process
  })
  
  it('should establish WebSocket connection to /sidewinder')
  it('should send identify message on connection')
  it('should send processStart with correct PID and args')
  it('should capture and send console.log messages')
  it('should capture and send console.error messages')
  it('should intercept http.createServer and send server-lifecycle events')
  it('should send processExit on SIGTERM')
  it('should handle WebSocket reconnection on disconnect')
  it('should queue messages when disconnected')
})
```

### 2.2 Browser Agent Integration (`integration/BrowserAgentIntegration.test.js`)

#### Test: Real Browser Agent Connection
```javascript
describe('Browser Agent WebSocket Integration', () => {
  beforeEach(async () => {
    // Start FullStackMonitor with agent server
    // Launch browser with BrowserMonitor
    // Inject Browser agent into page
  })
  
  it('should establish WebSocket connection to /browser')
  it('should send identify message with page URL')
  it('should override console methods and send to WebSocket')
  it('should intercept fetch() and add correlation headers')
  it('should intercept XMLHttpRequest and add correlation headers')
  it('should capture window error events')
  it('should capture unhandledrejection events')
  it('should track visibility changes')
  it('should optionally track user interactions')
  it('should optionally track DOM mutations')
  it('should handle WebSocket reconnection')
})
```

### 2.3 Dual Agent Communication (`integration/DualAgentCommunication.test.js`)

#### Test: Concurrent Agent Operations
```javascript
describe('Dual Agent Concurrent Operations', () => {
  it('should handle simultaneous connections from both agent types')
  it('should route messages correctly based on connection path')
  it('should maintain isolation between agent client maps')
  it('should process messages from both agents in parallel')
  it('should handle one agent disconnecting without affecting the other')
  it('should correlate events from both agents in real-time')
})
```

#### Test: Agent Message Flow
```javascript
describe('Agent to LogManager Flow', () => {
  it('should store Sidewinder messages in LogManager')
  it('should store Browser messages in LogManager')
  it('should preserve message metadata from both agents')
  it('should maintain session association for all messages')
  it('should handle high message volume from both agents')
})
```

### 2.4 Cross-Stack Correlation (`integration/CrossStackCorrelation.test.js`)

#### Test: Correlation Propagation
```javascript
describe('Correlation ID Propagation', () => {
  beforeEach(async () => {
    // Start backend with Sidewinder
    // Launch browser with Browser agent
    // Set up test server with API endpoint
  })
  
  it('should generate correlation ID in browser fetch()')
  it('should add X-Correlation-ID header to requests')
  it('should log correlation ID in browser console')
  it('should receive correlation ID in backend via headers')
  it('should log correlation ID in backend console')
  it('should match correlation IDs between agents')
  it('should retrieve all logs for a correlation')
  it('should track request/response timing via correlation')
})
```

## 3. End-to-End Tests

### 3.1 Full Stack Monitoring (`e2e/FullStackMonitoring.test.js`)

#### Test: Complete Monitoring Scenario
```javascript
describe('Full Stack Monitoring E2E', () => {
  let monitor, backend, browser;
  
  beforeEach(async () => {
    monitor = await FullStackMonitor.create(resourceManager);
    
    // Start full-stack app with both agents
    const result = await monitor.monitorFullStackApp({
      backend: {
        name: 'test-api',
        script: './test-api-server.cjs',
        port: 3000
      },
      frontend: {
        url: 'http://localhost:3000',
        browserOptions: { headless: false }
      }
    });
  })
  
  it('should inject and connect Sidewinder agent to backend')
  it('should inject and connect Browser agent to frontend')
  it('should capture backend server startup via Sidewinder WebSocket')
  it('should capture browser page load via Browser WebSocket')
  it('should correlate API calls from browser to backend')
  it('should track complete request/response cycle')
  it('should capture errors from both agents')
  it('should search logs across both agents')
  it('should maintain real-time monitoring via WebSocket')
})
```

### 3.2 Multi-Agent Sessions (`e2e/MultiAgentSessions.test.js`)

#### Test: Multiple Concurrent Agents
```javascript
describe('Multi-Agent Session Management', () => {
  it('should support multiple Sidewinder agents (microservices)')
  it('should support multiple Browser agents (multiple tabs/pages)')
  it('should maintain session isolation between agent sets')
  it('should handle 10+ concurrent WebSocket connections')
  it('should correlate across multiple agent pairs')
  it('should handle agents joining and leaving dynamically')
})
```

### 3.3 Real Application Monitoring (`e2e/RealApplicationMonitoring.test.js`)

#### Test: Production-like Scenario
```javascript
describe('Real Application Monitoring', () => {
  beforeEach(async () => {
    // Start Express app with database
    // Launch React SPA in browser
    // Inject both agents
  })
  
  it('should monitor Express route handlers via Sidewinder')
  it('should monitor React component lifecycle via Browser agent')
  it('should correlate user actions to API calls')
  it('should track database queries through correlation')
  it('should handle WebSocket reconnection during monitoring')
  it('should capture and correlate error scenarios')
  it('should generate performance metrics from both agents')
})
```

## 4. Test Utilities

### 4.1 TestResourceManager (`utils/TestResourceManager.js`)
```javascript
class TestResourceManager {
  constructor() {
    this.resources = new Map();
    // Mock StorageProvider with in-memory storage
    this.resources.set('StorageProvider', new MockStorageProvider());
  }
  
  get(key) { return this.resources.get(key); }
  set(key, value) { this.resources.set(key, value); }
}
```

### 4.2 MockSidewinderAgent (`utils/MockSidewinderAgent.js`)
```javascript
class MockSidewinderAgent {
  constructor(wsUrl = 'ws://localhost:9901/sidewinder') {
    this.ws = new WebSocket(wsUrl);
    this.connected = false;
  }
  
  async connect() {
    // Establish WebSocket connection
  }
  
  async identify(sessionId, pid) {
    this.send({ type: 'identify', sessionId, pid });
  }
  
  async sendConsole(method, args) {
    this.send({ type: 'console', method, args });
  }
  
  async sendError(error) {
    this.send({ type: 'error', error });
  }
  
  async sendProcessStart(argv, cwd) {
    this.send({ type: 'processStart', argv, cwd });
  }
}
```

### 4.3 MockBrowserAgent (`utils/MockBrowserAgent.js`)
```javascript
class MockBrowserAgent {
  constructor(wsUrl = 'ws://localhost:9901/browser') {
    this.ws = new WebSocket(wsUrl);
    this.pageId = 'page-' + Date.now();
  }
  
  async connect() {
    // Establish WebSocket connection
  }
  
  async identify(pageUrl, userAgent) {
    this.send({ 
      type: 'identify', 
      pageUrl, 
      userAgent,
      pageId: this.pageId 
    });
  }
  
  async sendConsole(method, args) {
    this.send({ type: 'console', method, args });
  }
  
  async sendNetwork(subtype, url, correlationId) {
    this.send({ 
      type: 'network', 
      subtype, 
      url, 
      correlationId 
    });
  }
  
  async sendError(message, stack) {
    this.send({ type: 'error', message, stack });
  }
}
```

### 4.4 TestAgentServer (`utils/TestAgentServer.js`)
```javascript
class TestAgentServer {
  constructor() {
    this.sidewinderAgents = [];
    this.browserAgents = [];
  }
  
  async createSidewinderAgent(scriptPath) {
    // Start process with Sidewinder injection
    // Return agent handle
  }
  
  async createBrowserAgent(url) {
    // Launch browser page with Browser agent
    // Return agent handle
  }
  
  async createFullStackPair(backendScript, frontendUrl) {
    // Create both agents as a coordinated pair
  }
}
```

## 5. Performance and Edge Cases

### Performance Tests
```javascript
describe('Agent Performance', () => {
  it('should handle 1000+ logs/second from Sidewinder agent')
  it('should handle 1000+ logs/second from Browser agent')
  it('should handle 50+ concurrent Sidewinder connections')
  it('should handle 50+ concurrent Browser connections')
  it('should route messages efficiently between agents')
  it('should maintain low latency for correlation matching')
  it('should search through 100,000+ logs efficiently')
})
```

### Edge Cases
```javascript
describe('Agent Edge Cases', () => {
  // Connection issues
  it('should handle Sidewinder agent reconnection')
  it('should handle Browser agent reconnection')
  it('should queue messages during disconnection')
  it('should handle WebSocket server restart')
  
  // Message issues
  it('should handle malformed JSON from agents')
  it('should handle extremely large messages')
  it('should handle circular references in logged objects')
  it('should handle binary WebSocket frames')
  
  // Resource issues
  it('should handle port 9901 conflicts')
  it('should handle agent injection failures')
  it('should handle missing agent files')
  it('should clean up on abnormal termination')
})
```

## 6. Test Data and Fixtures

### Required Test Applications

#### Backend Applications (CommonJS)
1. **simple-server.cjs** - Basic HTTP server with console logs
2. **api-server.cjs** - REST API with correlation headers
3. **crash-server.cjs** - Server that crashes after delay
4. **websocket-server.cjs** - WebSocket server for testing
5. **microservice.cjs** - Multiple services for multi-agent testing

#### Frontend Applications
1. **simple-page.html** - Basic page with console logs
2. **api-client.html** - Page that makes correlated API calls
3. **error-page.html** - Page with JavaScript errors
4. **spa-app.html** - Single-page application
5. **realtime-app.html** - WebSocket client application

### Agent Configuration Variants
```javascript
const agentConfigs = {
  // Sidewinder configurations
  sidewinderBasic: { sessionId: 'test', wsPort: 9901 },
  sidewinderDebug: { sessionId: 'test', debug: true },
  sidewinderCustomPort: { sessionId: 'test', wsPort: 9902 },
  
  // Browser configurations
  browserBasic: { sessionId: 'test', wsPort: 9901 },
  browserTracking: { 
    sessionId: 'test',
    trackInteractions: true,
    trackMutations: true
  },
  browserMinimal: {
    sessionId: 'test',
    trackInteractions: false,
    trackMutations: false
  }
};
```

## 7. Test Execution Strategy

### Environment Setup
```bash
# Before all tests
- Ensure port 9901 is available
- Clear any existing log storage
- Set NODE_OPTIONS='--experimental-vm-modules'
- Install test dependencies
```

### Test Execution Order
1. **Unit Tests** - Run in parallel for speed
2. **Integration Tests** - Run sequentially per category
3. **E2E Tests** - Run fully sequentially

### Cleanup Between Tests
```javascript
afterEach(async () => {
  // Close all WebSocket connections
  await monitor.cleanup();
  
  // Kill any spawned processes
  childProcesses.forEach(p => p.kill());
  
  // Close browser instances
  await browser.close();
  
  // Clear log storage
  await storageProvider.clear();
  
  // Reset correlation maps
  monitor.correlations.clear();
});
```

## 8. Validation Criteria

### Agent Communication
- Both agents must establish WebSocket connections
- Messages must be delivered reliably
- Reconnection must work for both agent types
- Message queuing during disconnection

### Data Integrity
- All agent messages must be stored in LogManager
- Correlation IDs must be preserved
- Timestamps must be accurate
- Session associations must be maintained

### Performance Targets
- Agent connection: < 100ms
- Message processing: < 10ms per message
- Log search: < 500ms for 10,000 logs
- Correlation matching: < 5ms

## 9. Migration Notes

### Key Differences from Previous Architecture
1. **Browser agent now uses WebSocket** (not just local events)
2. **Unified agent server** handles both agent types
3. **Path-based routing** (/sidewinder and /browser)
4. **Both agents are integrated** in the package
5. **Direct agent injection** via helper methods

### Tests to Add
- Browser agent WebSocket connection tests
- Dual-agent correlation tests
- Agent injection validation
- Path-based routing tests
- Concurrent agent handling

### Tests to Update
- Remove assumption of LogWebSocketServer
- Add Browser WebSocket agent tests
- Update correlation to work across WebSocket agents
- Add agent reconnection tests for both types

## 10. Implementation Checklist

- [ ] Delete old test files
- [ ] Create test utility classes
- [ ] Implement unit tests for core components
- [ ] Implement unit tests for both message handlers
- [ ] Implement unit tests for agent injection
- [ ] Create mock agents for both types
- [ ] Implement integration tests for each agent
- [ ] Implement dual-agent integration tests
- [ ] Implement correlation tests
- [ ] Create E2E test applications
- [ ] Implement full E2E scenarios
- [ ] Add performance tests
- [ ] Add edge case tests
- [ ] Document any deviations

---

This test plan covers the complete dual-agent WebSocket architecture where both Sidewinder (backend) and Browser (frontend) agents connect via WebSocket to the unified agent server on port 9901. All tests validate the symmetric monitoring approach and real-time correlation capabilities.