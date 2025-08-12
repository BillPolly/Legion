# FullStackMonitor Architecture & Design

## Executive Summary

FullStackMonitor is a comprehensive monitoring solution that provides unified observability for full-stack applications. It captures and correlates events from both backend processes (via Sidewinder agents) and frontend browsers (via BrowserMonitor), storing all data through the LegionLogManager for centralized querying and analysis.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FullStackMonitor                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        WebSocket Server for Agents (Port 9901)           │  │
│  │                                                          │  │
│  │  • /sidewinder - Backend agent connections               │  │
│  │  • /browser   - Frontend agent connections               │  │
│  │  • Handles agent messages and converts to logs           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Direct Method Calls (No WebSocket)          │  │
│  │                                                          │  │
│  │  ┌─────────────────┐        ┌─────────────────┐        │  │
│  │  │  BrowserMonitor  │        │  LegionLogManager│        │  │
│  │  │                  │        │                  │        │  │
│  │  │ • Injects agent  │        │ • Log storage    │        │  │
│  │  │ • Opens browser  │        │ • Session mgmt   │        │  │
│  │  │ • Manages pages  │        │ • Log search     │        │  │
│  │  └─────────────────┘        └─────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Correlation Engine & Event Processing          │  │
│  │                                                          │  │
│  │  • Tracks correlation IDs across backend/frontend        │  │
│  │  • Links related events from both agents                 │  │
│  │  • Maintains correlation maps                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Agent Connections:
┌──────────────────┐         ┌──────────────────┐
│ Sidewinder Agent │────────▶│  Port 9901       │
│ (Backend Process)│ WS      │  /sidewinder     │
│ - Console logs   │         │                  │
│ - Errors         │         │                  │
│ - Process events │         │                  │
└──────────────────┘         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  Browser Agent   │────────▶│  Port 9901       │
│  (In Webpage)    │ WS      │  /browser        │
│ - Console logs   │         │                  │
│ - Network events │         │                  │
│ - DOM mutations  │         │                  │
│ - Errors         │         │                  │
└──────────────────┘         └──────────────────┘

Browser Setup:
┌──────────────────┐         ┌──────────────────┐
│  BrowserMonitor  │────────▶│  Puppeteer/CDP   │
│                  │ Controls │                  │
│ - Opens browser  │         │  - Injects agent │
│ - Navigates page │         │  - Script runs   │
│ - Injects script │         │  - Agent connects│
└──────────────────┘         └──────────────────┘
```

## Component Details

### 1. FullStackMonitor (Main Orchestrator)

**Purpose**: Central coordinator that unifies backend and frontend monitoring into a cohesive observability platform.

**Key Responsibilities**:
- Initialize and manage all monitoring components
- Run WebSocket server for Sidewinder agents
- Process and store all monitoring data
- Correlate events across the stack
- Provide unified query interface

**Initialization Flow**:
```javascript
1. Create LegionLogManager instance (for storage)
2. Create BrowserMonitor instance (for frontend)
3. Create monitoring session in LogManager
4. Start Sidewinder WebSocket server on port 9901
5. Set up event handlers for all components
6. Begin accepting connections and events
```

### 2. Sidewinder WebSocket Server

**Purpose**: Receive monitoring data from Sidewinder agents injected into backend Node.js processes.

**Protocol**: WebSocket with JSON messages at `ws://localhost:9901/sidewinder`

**Message Types Handled**:
```javascript
{
  type: 'identify',      // Agent identification
  sessionId: string,     // Session identifier
  pid: number,          // Process ID
  profile: string,      // Monitoring profile
  hooks: string[]       // Active hooks
}

{
  type: 'console',      // Console output
  method: string,       // log, error, warn, etc.
  args: any[],         // Console arguments
  timestamp: number    // Event timestamp
}

{
  type: 'processStart', // Process initialization
  pid: number,         // Process ID
  argv: string[],      // Command line arguments
  cwd: string         // Working directory
}

{
  type: 'error' | 'uncaughtException', // Errors
  error: {
    message: string,
    stack: string,
    code: string
  }
}

{
  type: 'processExit',  // Process termination
  code: number         // Exit code
}

{
  type: 'server-lifecycle', // Server events
  event: string,           // Event name
  port?: number,          // Server port
  error?: any            // Error details
}
```

**Processing Flow**:
1. Receive WebSocket connection from Sidewinder agent
2. Assign unique client ID
3. Parse incoming JSON messages
4. Convert to LogManager format
5. Store via direct LogManager method calls
6. Track correlations if present

### 3. Browser Agent (Frontend Monitoring)

**Purpose**: JavaScript agent injected into web pages that monitors frontend activity and reports to FullStackMonitor via WebSocket.

**Similar to Sidewinder but for browsers**, the Browser Agent:
- Runs inside the web page (injected by BrowserMonitor)
- Connects to `ws://localhost:9901/browser`
- Sends monitoring data about frontend activity

**Protocol**: WebSocket with JSON messages at `ws://localhost:9901/browser`

**Message Types Sent**:
```javascript
{
  type: 'identify',
  pageUrl: string,
  userAgent: string,
  sessionId: string
}

{
  type: 'console',
  method: string,      // log, error, warn, info
  args: any[],
  timestamp: number,
  location: string     // File and line number
}

{
  type: 'network',
  method: string,      // GET, POST, etc.
  url: string,
  status?: number,
  correlationId?: string,
  timestamp: number
}

{
  type: 'error',
  message: string,
  stack: string,
  filename: string,
  lineno: number,
  colno: number
}

{
  type: 'dom-mutation',
  target: string,
  mutationType: string,
  timestamp: number
}

{
  type: 'user-interaction',
  event: string,       // click, input, scroll
  target: string,
  timestamp: number
}
```

**Injection Process**:
1. BrowserMonitor opens page via Puppeteer
2. Injects browser agent script into page
3. Agent establishes WebSocket connection to FullStackMonitor
4. Agent begins monitoring and sending events

### 4. BrowserMonitor (Browser Management)

**Purpose**: Manages browser instances and injects the browser agent into pages.

**NOT a monitoring agent itself**, but rather:
- Opens browsers using Puppeteer
- Navigates to target pages
- Injects the browser agent script
- Manages browser lifecycle

**Key Responsibilities**:
```javascript
// Opens browser and injects agent
await browserMonitor.monitorPage(url, sessionId)

// The injected script includes:
// - WebSocket connection to FullStackMonitor
// - Console override hooks
// - Network request interceptors
// - Error handlers
// - DOM mutation observers
```

### 4. LegionLogManager Integration

**Purpose**: Centralized storage and querying of all monitoring data.

**Direct Method Calls** (No WebSocket):
```javascript
// Store log entries
await this.logManager.logMessage({
  sessionId: string,
  processId?: number,
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  source: string,
  metadata?: object
})

// Manage sessions
await this.logManager.createSession(options)
await this.logManager.addProcessToSession(sessionId, processInfo)
await this.logManager.completeProcess(sessionId, processId, exitInfo)

// Query logs
await this.logManager.searchLogs({
  query: string,
  sessionId?: string,
  mode?: 'keyword' | 'regex' | 'semantic',
  limit?: number
})
```

**Storage Format**:
All events (Sidewinder, Browser, etc.) are normalized to:
```javascript
{
  logId: string,           // Unique identifier
  sessionId: string,       // Session association
  processId?: number,      // Process if applicable
  level: string,          // Log level
  message: string,        // Log message
  source: string,         // Origin (sidewinder-console, browser-console, etc.)
  timestamp: Date,        // Event time
  metadata: object        // Additional data
}
```

### 5. Correlation Engine

**Purpose**: Link related events across backend and frontend for unified tracing.

**Correlation Tracking**:
```javascript
correlations: Map<correlationId, {
  id: string,
  frontend: {
    type: string,
    level: string,
    message: string,
    timestamp: number
  },
  backend: Array<{
    message: string,
    level: string,
    timestamp: number
  }>,
  firstSeen: Date,
  lastSeen: Date
}>
```

**Correlation Detection**:
- Pattern matching: `[correlation-${id}]` in messages
- Header extraction: `X-Correlation-ID` in network requests
- Explicit correlation IDs in Sidewinder messages

## Data Flow Examples

### Example 1: Backend Console Log

```
1. Node.js app with Sidewinder: console.log('Server started')
                ↓
2. Sidewinder captures via console hook
                ↓
3. Sends WebSocket message to FullStackMonitor:
   { type: 'console', method: 'log', args: ['Server started'] }
                ↓
4. FullStackMonitor.handleSidewinderMessage() processes
                ↓
5. Calls logManager.logMessage({
     level: 'info',
     message: 'Server started',
     source: 'sidewinder-console'
   })
                ↓
6. Log stored in LogManager's StorageProvider
```

### Example 2: Correlated API Request

```
1. Browser makes API request with correlation ID header
                ↓
2. Browser Agent captures via network interceptor
                ↓
3. Browser Agent sends to FullStackMonitor via WebSocket:
   { type: 'network', url: '/api/data', correlationId: 'xyz-123' }
                ↓
4. FullStackMonitor.handleBrowserMessage() processes
                ↓
5. Backend receives request, logs with same correlation ID
                ↓
6. Sidewinder Agent captures backend log
                ↓
7. Sidewinder sends to FullStackMonitor via WebSocket:
   { type: 'console', args: ['Processing request xyz-123'] }
                ↓
8. FullStackMonitor matches correlation ID from both agents
                ↓
9. Both events linked in correlations map
                ↓
10. Query by correlation returns both frontend and backend logs
```

### Example 3: Browser Console Log

```
1. JavaScript in browser: console.error('Failed to load data')
                ↓
2. Browser Agent captures via console hook override
                ↓
3. Sends WebSocket message to FullStackMonitor:
   { type: 'console', method: 'error', args: ['Failed to load data'] }
                ↓
4. FullStackMonitor.handleBrowserMessage() processes
                ↓
5. Calls logManager.logMessage({
     level: 'error',
     message: 'Failed to load data',
     source: 'browser-console'
   })
                ↓
6. Log stored in LogManager's StorageProvider
```

### Example 4: Error Tracking

```
1. Uncaught exception in Node.js process
                ↓
2. Sidewinder captures via error hook
                ↓
3. Sends { type: 'uncaughtException', error: {...} }
                ↓
4. FullStackMonitor stores as error-level log
                ↓
5. If correlation ID present, links to related events
                ↓
6. Error queryable with full context
```

## Key Design Decisions

### 1. Direct LogManager Integration
**Decision**: FullStackMonitor calls LogManager methods directly rather than using WebSocket.

**Rationale**:
- Eliminates unnecessary network overhead
- Ensures reliable log storage
- Simplifies error handling
- Maintains single source of truth

### 2. Unified WebSocket Server for All Agents
**Decision**: FullStackMonitor runs a single WebSocket server on port 9901 with different paths for different agent types.

**Rationale**:
- Both Sidewinder (backend) and Browser agents use similar protocols
- Single port simplifies configuration
- Path-based routing (`/sidewinder`, `/browser`) separates agent types
- Consistent message handling across all agents
- Easier correlation between frontend and backend events

### 3. Correlation as First-Class Concept
**Decision**: Built-in correlation tracking with dedicated data structures.

**Rationale**:
- Essential for understanding full-stack flows
- Enables powerful debugging capabilities
- Links cause and effect across tiers
- Provides complete context for issues

### 4. Event Normalization
**Decision**: All events normalized to consistent log format.

**Rationale**:
- Unified querying across all sources
- Consistent storage and retrieval
- Simplified analysis tools
- Standard metadata structure

## Session Management

### Session Lifecycle
```
1. Session Creation
   - Generated unique session ID
   - Metadata (name, type, startTime)
   - Associated monitors

2. Process Registration
   - Sidewinder agents identify with session
   - Processes added to session
   - Multiple processes per session supported

3. Event Association
   - All logs tagged with session ID
   - Browser events linked to session
   - Correlations scoped to session

4. Session Completion
   - Processes marked complete
   - Final statistics calculated
   - Session marked as ended
```

### Multi-Session Support
- Multiple concurrent monitoring sessions
- Isolated log streams per session
- Independent correlation tracking
- Separate statistics and metrics

## Query Capabilities

### Log Search
```javascript
// Text search across all logs
await monitor.searchLogs({
  query: 'error database connection',
  sessionId: 'session-123',
  limit: 100
})

// Search by correlation ID
await monitor.getCorrelationLogs('correlation-xyz')

// Get all logs for a correlation with context
await monitor.getCorrelatedLogs('correlation-xyz')
// Returns: { backend: [...], frontend: [...], network: [...] }
```

### Statistics
```javascript
await monitor.getStatistics()
// Returns:
{
  correlationsDetected: number,
  debugScenariosRun: number,
  totalStepsExecuted: number,
  activeBackends: number,
  activeBrowsers: number,
  uptime: number
}
```

## Resource Management

### Startup
1. Create ResourceManager with dependencies
2. Initialize LegionLogManager
3. Initialize BrowserMonitor
4. Start Sidewinder WebSocket server
5. Create monitoring session
6. Set up event handlers

### Cleanup
1. Close all Sidewinder client connections
2. Stop Sidewinder WebSocket server
3. Close all browser pages
4. Stop BrowserMonitor
5. End active session
6. Cleanup LogManager
7. Clear correlation maps
8. Remove event listeners

### Resource Limits
- Maximum concurrent Sidewinder connections: Unlimited (configurable)
- Maximum correlation cache size: Unlimited (configurable)
- Log retention: Managed by LogManager
- Browser pages: Managed by BrowserMonitor

## Error Handling

### Connection Errors
- Sidewinder reconnection supported
- Graceful degradation if components unavailable
- Error logs for failed operations
- Continued operation despite partial failures

### Message Errors
- Malformed JSON logged but not fatal
- Unknown message types handled gracefully
- Invalid data sanitized before storage
- Error responses sent to clients

### Storage Errors
- Logged to console if LogManager fails
- Operation continues without storage
- Errors tracked in statistics
- Recovery attempted on next operation

## Performance Considerations

### Optimization Strategies
1. **Batching**: Group rapid sequential logs
2. **Throttling**: Limit log frequency per source
3. **Caching**: Cache correlation lookups
4. **Indexing**: Index logs by session and correlation
5. **Cleanup**: Periodic cleanup of old correlations

### Scalability
- Horizontal scaling via multiple monitor instances
- Session-based sharding
- Async processing for all I/O operations
- Event-driven architecture for efficiency

## Security Considerations

### Input Validation
- Sanitize all Sidewinder messages
- Validate correlation IDs
- Limit message sizes
- Prevent injection attacks

### Access Control
- WebSocket server bound to localhost
- No external network exposure
- Session isolation
- Read-only browser monitoring

## Agent Implementation Details

### Browser Agent Script
The browser agent is a JavaScript file that:
```javascript
// Injected into webpage by BrowserMonitor
(function() {
  // Connect to FullStackMonitor
  const ws = new WebSocket('ws://localhost:9901/browser');
  
  // Override console methods
  const originalLog = console.log;
  console.log = function(...args) {
    ws.send(JSON.stringify({
      type: 'console',
      method: 'log',
      args: args
    }));
    return originalLog.apply(console, args);
  };
  
  // Monitor network requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    const correlationId = options?.headers?.['X-Correlation-ID'];
    ws.send(JSON.stringify({
      type: 'network',
      url: url,
      method: options?.method || 'GET',
      correlationId: correlationId
    }));
    return originalFetch.apply(window, arguments);
  };
  
  // Capture errors
  window.addEventListener('error', (event) => {
    ws.send(JSON.stringify({
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno
    }));
  });
})();
```

### Sidewinder Agent (Backend)
The Sidewinder agent is injected via Node.js --require flag and monitors:
- Console output
- Process lifecycle
- Uncaught exceptions
- Server events
- HTTP server creation and requests

## Future Enhancements

### Planned Features
1. **Distributed Tracing**: OpenTelemetry integration
2. **Metrics Collection**: Performance metrics
3. **Alert System**: Real-time error notifications
4. **Dashboard UI**: Visual monitoring interface
5. **Plugin System**: Extensible monitoring hooks
6. **Cloud Storage**: Remote log storage options
7. **ML Analysis**: Anomaly detection
8. **Replay System**: Session replay capabilities
9. **Mobile Agent**: React Native / mobile web support
10. **Service Worker Agent**: PWA monitoring

### Extension Points
- Custom Sidewinder message handlers
- Additional browser event types
- Alternative storage providers
- Custom correlation strategies
- Plugin architecture for analyzers

## Configuration

### Environment Variables
```bash
SIDEWINDER_WS_PORT=9901        # Sidewinder WebSocket port
SIDEWINDER_WS_HOST=localhost   # Sidewinder WebSocket host
MONITOR_SESSION_ID=default      # Default session ID
MONITOR_LOG_LEVEL=info         # Logging verbosity
```

### Programmatic Configuration
```javascript
const monitor = await FullStackMonitor.create(resourceManager, {
  sidewinderPort: 9901,
  sidewinderPath: '/sidewinder',
  sessionName: 'my-monitoring-session',
  correlationCacheSize: 1000,
  maxClients: 100
})
```

## Troubleshooting

### Common Issues

**Agents Can't Connect**
- Check port 9901 availability
- Verify FullStackMonitor is running
- Check firewall settings
- Verify WebSocket paths:
  - Sidewinder: `/sidewinder`
  - Browser: `/browser`
- Check browser console for agent errors
- Verify agent script injection

**Logs Not Appearing**
- Verify LogManager initialization
- Check session creation
- Confirm log level settings
- Verify storage provider

**Missing Correlations**
- Check correlation ID format
- Verify extraction patterns
- Confirm both frontend and backend sending IDs
- Check correlation cache size

**High Memory Usage**
- Limit correlation cache
- Implement log rotation
- Close inactive sessions
- Clean up old correlations

## Conclusion

FullStackMonitor provides a comprehensive, unified monitoring solution by:
1. Running a WebSocket server that accepts connections from both backend (Sidewinder) and frontend (Browser) agents
2. Sidewinder agents monitor Node.js backend processes
3. Browser agents (injected by BrowserMonitor) monitor web page activity
4. Both agents communicate via WebSocket to FullStackMonitor on port 9901
5. All monitoring data stored via direct LogManager integration (no WebSocket to LogManager)
6. Events from both agents are correlated by tracking correlation IDs
7. Unified query interface for searching across all monitoring data

The architecture uses a consistent agent-based approach where both backend and frontend are monitored by agents that report to a central WebSocket server, ensuring symmetric monitoring capabilities across the full stack.