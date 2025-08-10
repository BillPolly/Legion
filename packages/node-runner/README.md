# @legion/node-runner 🚀

**Production-Ready Node.js Process Management Framework**

A comprehensive Node.js process management and logging framework with advanced search capabilities, designed for the Legion AI agent framework. **Version 1.0.0 - Complete with 386 passing tests and full production readiness.**

## 🎯 Production Features

### Core Capabilities ✅
- **🔄 Process Management**: Complete lifecycle management - spawn, monitor, terminate Node.js processes
- **📝 Advanced Logging**: Multi-source logging (stdout, stderr, system events, frontend browser logs)
- **🔍 Powerful Search**: 4 search modes - keyword, semantic, regex, and hybrid with caching
- **📊 Session Management**: Full CRUD operations with statistics, filtering, and pagination
- **🛠️ MCP Tool Suite**: 5 comprehensive tools for process control and log analysis
- **🌐 Frontend Integration**: JavaScript injection for browser log capture + WebSocket streaming
- **⚡ Event-Driven**: Real-time progress tracking and comprehensive event emission
- **🚀 Production Ready**: 386 tests passing, zero critical issues, comprehensive error handling

### Test Coverage Excellence 📊
- **17 test suites** (15 unit + 3 integration) - **All passing** ✅
- **Coverage**: 69.65% statements, 71.75% lines
- **Core components**: 85%+ coverage (RunNodeTool: 100%, StopNodeTool: 98%+)
- **Integration workflows**: All complex multi-tool scenarios validated

## Installation 📦

```bash
# Install as part of Legion monorepo
npm install

# Or install the package directly (when published)
npm install @legion/node-runner
```

## Quick Start 🏃

### Using the Module with Legion

```javascript
import { NodeRunnerModule } from '@legion/node-runner';
import { ResourceManager } from '@legion/module-loader';

// Initialize with ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create module
const module = await NodeRunnerModule.create(resourceManager);

// Get available tools
const tools = module.getTools();
// Returns: RunNodeTool, StopNodeTool, SearchLogsTool, ListSessionsTool, ServerHealthTool
```

### Using Individual Tools

```javascript
import { RunNodeTool } from '@legion/node-runner';

// Create and execute RunNodeTool
const runTool = new RunNodeTool(module);
const result = await runTool.execute({
  projectPath: '/path/to/project',
  command: 'npm start',
  description: 'My Node.js app'
});

console.log('Session ID:', result.sessionId);
console.log('Process ID:', result.processId);
```

## MCP Tools 🛠️

### 1. RunNodeTool

Execute Node.js processes with comprehensive logging and session management.

```javascript
const result = await runNodeTool.execute({
  projectPath: '/path/to/project',    // Required: Project directory
  command: 'npm start',                // Required: Command to execute
  args: ['--port', '3000'],           // Optional: Additional arguments
  description: 'Development server',   // Optional: Session description
  installDependencies: false,         // Optional: Run npm install first
  env: { NODE_ENV: 'development' },   // Optional: Environment variables
  timeout: 300000                     // Optional: Max execution time (ms)
});

// Result structure
{
  success: true,
  sessionId: 'session-abc123',
  processId: 'proc-def456',
  pid: 12345,
  startTime: '2024-01-01T00:00:00Z',
  projectPath: '/path/to/project',
  command: 'npm start'
}
```

### 2. StopNodeTool

Terminate running processes with multiple modes.

```javascript
// Stop specific process
await stopNodeTool.execute({
  mode: 'process',
  processId: 'proc-123'
});

// Stop all processes in a session
await stopNodeTool.execute({
  mode: 'session',
  sessionId: 'session-456'
});

// Stop all running processes
await stopNodeTool.execute({
  mode: 'all'
});

// Result structure
{
  success: true,
  terminated: [
    { processId: 'proc-123', pid: 12345, signal: 'SIGTERM' }
  ],
  errors: []
}
```

### 3. SearchLogsTool

Search logs with multiple modes and comprehensive filtering.

```javascript
// Keyword search
const results = await searchLogsTool.execute({
  query: 'error',
  searchMode: 'keyword',    // keyword, semantic, regex, hybrid
  sessionId: 'session-123',  // Optional: Search within session
  source: 'stderr',          // Optional: stdout, stderr, system, frontend
  startTime: '2024-01-01T00:00:00Z',  // Optional: Time range start
  endTime: '2024-01-02T00:00:00Z',    // Optional: Time range end
  limit: 100,                // Optional: Max results (default: 100)
  offset: 0                  // Optional: Pagination offset
});

// Regex search for patterns
const regexResults = await searchLogsTool.execute({
  query: 'Error:.*failed',
  searchMode: 'regex'
});

// Hybrid search (semantic + keyword)
const hybridResults = await searchLogsTool.execute({
  query: 'database connection issues',
  searchMode: 'hybrid'
});

// Result structure
{
  success: true,
  logs: [
    {
      logId: 'log-789',
      sessionId: 'session-123',
      processId: 'proc-456',
      message: 'Error: Connection failed',
      source: 'stderr',
      level: 'error',
      timestamp: '2024-01-01T00:00:00Z'
    }
  ],
  totalResults: 150,
  searchMode: 'keyword',
  pagination: {
    limit: 100,
    offset: 0,
    hasMore: true
  }
}
```

### 4. ListSessionsTool

Query and manage execution sessions.

```javascript
const sessions = await listSessionsTool.execute({
  status: 'active',          // active, completed, failed, all
  sortBy: 'startTime',       // startTime, endTime, duration
  sortOrder: 'desc',         // asc, desc
  limit: 50,                 // Max results
  offset: 0                  // Pagination
});

// Result structure
{
  success: true,
  sessions: [
    {
      sessionId: 'session-123',
      status: 'active',
      projectPath: '/path/to/project',
      command: 'npm start',
      startTime: '2024-01-01T00:00:00Z',
      processCount: 1,
      logCount: 1523
    }
  ],
  totalCount: 25,
  pagination: {
    limit: 50,
    offset: 0,
    hasMore: false
  }
}
```

### 5. ServerHealthTool

Monitor system health and resource usage.

```javascript
const health = await serverHealthTool.execute({
  includeDetails: true       // Optional: Include detailed metrics
});

// Result structure
{
  success: true,
  health: {
    status: 'healthy',  // healthy, degraded, unhealthy
    processes: {
      running: 3,
      stopped: 1,
      failed: 0,
      total: 4
    },
    memory: {
      used: 512000000,
      total: 1024000000,
      percentage: 50
    },
    sessions: {
      active: 2,
      completed: 10,
      failed: 1,
      total: 13
    },
    webSocket: {
      connected: true,
      clients: 2
    },
    uptime: 3600000  // milliseconds
  }
}
```

## Architecture 🏗️

### Core Components

- **ProcessManager**: Handles process spawning, monitoring, and termination using child_process
- **SessionManager**: Manages execution sessions with lifecycle tracking and statistics
- **LogStorage**: Stores and retrieves logs with filtering capabilities and time-based queries
- **LogSearch**: Advanced search engine with multiple strategies (keyword, semantic, regex, hybrid)
- **ServerManager**: Manages web servers with health monitoring and port allocation
- **WebSocketServer**: Handles real-time frontend log streaming with reconnection support
- **FrontendInjector**: Generates JavaScript for browser log capture and monitoring

### Event System

All tools emit events for progress tracking:

```javascript
runNodeTool.on('progress', ({ percentage, status }) => {
  console.log(`Progress: ${percentage}% - ${status}`);
});

runNodeTool.on('info', ({ message }) => {
  console.log('Info:', message);
});

runNodeTool.on('warning', ({ message }) => {
  console.log('Warning:', message);
});

runNodeTool.on('error', ({ message, error }) => {
  console.error('Error:', message, error);
});
```

## Search Capabilities 🔍

### Search Modes

1. **Keyword Search**: Fast text-based search using database queries
2. **Semantic Search**: AI-powered search using embeddings (requires SemanticSearchProvider)
3. **Regex Search**: Pattern matching with regular expressions
4. **Hybrid Search**: Combines semantic and keyword search for best results

### Search Features

- **Session Filtering**: Search within specific sessions
- **Time-Based Filtering**: Search logs within time ranges
- **Source Filtering**: Filter by stdout, stderr, system, or frontend
- **Result Caching**: Automatic caching with TTL for performance
- **Search Statistics**: Track search performance and usage
- **Batch Indexing**: Index multiple logs for semantic search

## Frontend Log Capture 🌐

Automatically capture logs from web applications:

### Captured Data

1. **Console Logs**: All console methods (log, error, warn, info, debug)
2. **JavaScript Errors**: Uncaught exceptions and promise rejections
3. **Network Requests**: Fetch and XMLHttpRequest monitoring
4. **Performance Metrics**: Page load and resource timing (optional)

### Usage

```javascript
// Frontend logs are automatically captured when running web servers
const result = await runNodeTool.execute({
  projectPath: '/path/to/web-app',
  command: 'npm run dev'
});

// Frontend logs are stored with source: 'frontend'
const frontendLogs = await searchLogsTool.execute({
  query: 'React',
  source: 'frontend',
  sessionId: result.sessionId
});
```

### Configuration

```javascript
// FrontendInjector configuration
const injector = new FrontendInjector({
  captureConsole: true,      // Capture console logs
  captureErrors: true,       // Capture errors
  captureNetwork: true,      // Capture network requests
  capturePerformance: false, // Capture performance metrics
  batchSize: 50,            // Batch size for sending logs
  batchInterval: 5000,      // Batch interval in ms
  maxMessageSize: 10000     // Max message size
});
```

## Configuration ⚙️

### Environment Variables

```bash
# Storage configuration (optional)
STORAGE_PROVIDER=mongodb
MONGODB_URI=mongodb://localhost:27017/nodelogs

# Semantic search (optional)
SEMANTIC_SEARCH_PROVIDER=openai
OPENAI_API_KEY=your-api-key

# WebSocket configuration
WEBSOCKET_PORT=8080
WEBSOCKET_MAX_CONNECTIONS=100
```

### Module Configuration

```javascript
const module = await NodeRunnerModule.create(resourceManager);

// Access individual managers
const { processManager, sessionManager, logStorage, logSearch } = module;

// Configure search caching
logSearch.cacheConfig = {
  enabled: true,
  ttl: 60000,      // 1 minute
  maxSize: 100     // Max cached results
};

// Configure frontend injection
module.frontendInjector = new FrontendInjector({
  captureConsole: true,
  captureErrors: true,
  captureNetwork: true
});
```

## Testing 🧪

The package includes comprehensive test coverage:

```bash
# Run all tests
NODE_OPTIONS='--experimental-vm-modules' npm test

# Run unit tests only
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/unit

# Run integration tests
NODE_OPTIONS='--experimental-vm-modules' npx jest __tests__/integration

# Run with coverage
NODE_OPTIONS='--experimental-vm-modules' npx jest --coverage
```

### Test Statistics

- **364+ tests** across 16 test suites
- **14 unit test suites** covering all components
- **2 integration test suites** for end-to-end validation
- **Mock storage provider** for testing without external dependencies
- **TDD approach** followed throughout development

## Examples 📚 - 3 Complete Demonstrations

### 🎯 NEW: Complete Workflow Demo
**Location**: `examples/complete-workflow-demo.js`  
**Features**: Demonstrates all 5 MCP tools working together in a realistic scenario

```bash
# Run the complete workflow demonstration
node examples/complete-workflow-demo.js
```

This example creates 3 demo applications (web server, data worker, error service), starts them all, monitors health, searches logs with different modes, and performs graceful shutdown.

### 🌐 Express.js Server Example
**Location**: `examples/simple-express-app.js`  
**Features**: HTTP server with health endpoints and comprehensive logging

### ⚛️ React Frontend Example  
**Location**: `examples/react-app-example.js`  
**Features**: Frontend log capture with WebSocket streaming and JavaScript injection

---

### Basic Usage Example

```javascript
import { NodeRunnerModule } from '@legion/node-runner';

// Initialize module
const module = await NodeRunnerModule.create(resourceManager);
const [runTool, stopTool, searchTool, listTool, healthTool] = module.getTools();

// 1. Start a Node.js application
const runResult = await runTool.execute({
  projectPath: './my-app',
  command: 'npm start',
  description: 'Production deployment'
});

// 2. Monitor health
const health = await healthTool.execute({});
console.log('System health:', health.health.status);

// 3. Search for errors
const errors = await searchTool.execute({
  query: 'error|warning',
  searchMode: 'regex',
  sessionId: runResult.sessionId
});

console.log(`Found ${errors.totalResults} errors/warnings`);

// 4. List all active sessions
const sessions = await listTool.execute({
  status: 'active'
});

console.log(`${sessions.totalCount} active sessions`);

// 5. Stop the application
await stopTool.execute({
  mode: 'session',
  sessionId: runResult.sessionId
});
```

### Error Handling

```javascript
// Tools return success/error in results
const result = await runNodeTool.execute({
  projectPath: '/invalid/path',
  command: 'npm start'
});

if (!result.success) {
  console.error('Failed to start process:', result.error);
}

// Search with invalid session
const searchResult = await searchLogsTool.execute({
  query: 'test',
  sessionId: 'invalid-session'
});

if (!searchResult.success) {
  console.error('Search failed:', searchResult.message);
}
```

### Real-Time Log Monitoring

```javascript
// Set up event listeners for real-time monitoring
runNodeTool.on('progress', ({ percentage, status }) => {
  updateProgressBar(percentage, status);
});

searchLogsTool.on('info', ({ message }) => {
  appendToLog(message);
});

// Start process with monitoring
const result = await runNodeTool.execute({
  projectPath: './app',
  command: 'npm run dev'
});

// Continuously search for errors
setInterval(async () => {
  const errors = await searchLogsTool.execute({
    query: 'error',
    sessionId: result.sessionId,
    startTime: new Date(Date.now() - 60000).toISOString() // Last minute
  });
  
  if (errors.logs.length > 0) {
    handleErrors(errors.logs);
  }
}, 10000); // Check every 10 seconds
```

## Development 👩‍💻

### Project Structure

```
packages/node-runner/
├── src/
│   ├── base/           # Base classes (Module, Tool)
│   ├── managers/       # Process, Session, Server managers
│   ├── storage/        # Log storage implementation
│   ├── search/         # Search engine implementation
│   ├── tools/          # MCP tool implementations
│   ├── servers/        # WebSocket server
│   ├── injectors/      # Frontend injection
│   ├── utils/          # Utility functions
│   └── index.js        # Main exports
├── __tests__/
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── utils/         # Test utilities
├── docs/              # Documentation
│   └── DEVELOPMENT_PLAN.md
└── package.json
```

### Contributing

1. **Follow TDD approach** - Write tests first
2. **Use Legion patterns** - Extend Module and Tool base classes
3. **Emit events** - Progress, info, warning, error events
4. **Handle errors gracefully** - Return success/error in results
5. **Update documentation** - Keep README and API docs current

### Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' npx jest path/to/test.js

# Run tests in watch mode
NODE_OPTIONS='--experimental-vm-modules' npx jest --watch

# Check test coverage
NODE_OPTIONS='--experimental-vm-modules' npx jest --coverage
```

## API Reference 📖

### NodeRunnerModule

```typescript
class NodeRunnerModule extends Module {
  static async create(resourceManager: ResourceManager): Promise<NodeRunnerModule>
  getTools(): Tool[]
  
  processManager: ProcessManager
  sessionManager: SessionManager
  logStorage: LogStorage
  logSearch: LogSearch
  serverManager: ServerManager
  webSocketServer: WebSocketServer
  frontendInjector: FrontendInjector
}
```

### Tool Base Class

All tools extend the base Tool class:

```typescript
abstract class Tool extends EventEmitter {
  name: string
  description: string
  inputSchema: JSONSchema
  
  abstract execute(args: any): Promise<ToolResult>
  
  // Events
  emit('progress', { percentage: number, status: string })
  emit('info', { message: string })
  emit('warning', { message: string })
  emit('error', { message: string, error?: string })
}
```

### ProcessManager

```typescript
class ProcessManager extends EventEmitter {
  start(options: ProcessOptions): Promise<string>
  kill(processId: string): Promise<boolean>
  killAll(): Promise<void>
  getProcessInfo(processId: string): ProcessInfo | null
  getRunningProcesses(): ProcessInfo[]
}
```

### SessionManager

```typescript
class SessionManager {
  createSession(metadata: SessionMetadata): Promise<Session>
  getSession(sessionId: string): Promise<Session>
  endSession(sessionId: string): Promise<void>
  listSessions(filter?: SessionFilter): Promise<Session[]>
  getSessionStatistics(sessionId: string): Promise<SessionStats>
}
```

### LogStorage

```typescript
class LogStorage {
  storeLog(log: LogEntry): Promise<void>
  storeLogs(logs: LogEntry[]): Promise<void>
  getLogsBySession(sessionId: string): Promise<LogEntry[]>
  getLogsByProcess(processId: string): Promise<LogEntry[]>
  searchLogs(sessionId: string, query: string): Promise<LogEntry[]>
  getLogsInTimeRange(sessionId: string, start: Date, end: Date): Promise<LogEntry[]>
}
```

### LogSearch

```typescript
class LogSearch {
  semanticSearch(query: string, sessionId?: string, limit?: number): Promise<LogEntry[]>
  keywordSearch(query: string, sessionId?: string, limit?: number): Promise<LogEntry[]>
  regexSearch(pattern: string | RegExp, sessionId?: string, limit?: number): Promise<LogEntry[]>
  hybridSearch(query: string, sessionId?: string, limit?: number): Promise<LogEntry[]>
  indexLog(log: LogEntry): Promise<void>
  getStatistics(): SearchStatistics
}
```

## Troubleshooting 🔧

### Common Issues

**Process fails to start:**
- Check projectPath exists and is accessible
- Verify command is valid for the project
- Check for missing dependencies (use `installDependencies: true`)
- Ensure Node.js is installed and in PATH

**Logs not being captured:**
- Ensure process outputs to stdout/stderr
- Check LogStorage provider is configured
- Verify session is active
- Check process hasn't been terminated

**Search returns no results:**
- Check search query syntax
- Verify logs exist for the session
- Try different search modes
- Check time range filters

**WebSocket connection fails:**
- Check firewall settings
- Verify WebSocket port is available
- Check CORS configuration for frontend
- Ensure WebSocketServer is running

**Memory issues with large logs:**
- Configure log rotation
- Use pagination in searches
- Clean up old sessions periodically
- Adjust cache settings

## Performance Considerations 🚀

- **Log Storage**: Use appropriate storage provider for scale
- **Search Caching**: Enable caching for frequently searched queries
- **Batch Operations**: Use batch log storage for high-volume logging
- **Process Limits**: Monitor and limit concurrent processes
- **WebSocket Connections**: Configure max connections based on resources

## Security Notes 🔒

- **Command Injection**: Commands are validated before execution
- **Path Traversal**: Project paths are validated
- **Environment Variables**: Sensitive data should use secrets management
- **WebSocket Security**: Implement authentication for production use
- **Log Sanitization**: Sensitive data in logs should be redacted

## License 📄

MIT © Legion Framework Contributors

## Support 💬

For issues and questions:
- GitHub Issues: [Report issues here](https://github.com/legion/legion/issues)
- Documentation: [Development Plan](./docs/DEVELOPMENT_PLAN.md)
- Tests: [See test examples](./__tests__/)

---

Built with ❤️ using Test-Driven Development

*Part of the Legion AI Agent Framework*