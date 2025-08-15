# Aiur MCP Server Design Document

## Overview

Aiur is an MCP (Model Context Protocol) server that serves as an intelligent gateway between AI agents and the Legion tool ecosystem. It transforms the traditional stateless tool-calling paradigm into a stateful, context-aware orchestration platform.

### Vision

Rather than treating each tool call as an isolated operation, Aiur maintains a living workspace where:
- Objects persist between calls (handles)
- Tools are dynamically loaded based on context
- Complex tasks are planned and executed with checkpoints
- The AI agent works with a coherent mental model of the system

## Architecture

### Client-Server Architecture

Aiur uses a clean client-server architecture that separates concerns:

```
MCP Client ↔ [MCP Format] ↔ Stdio Server ↔ [WebSocket] ↔ Backend Server
                              (index.js)                    (server/index.js)
```

#### Components

1. **MCP Stdio Server** (`src/index.js`)
   - Thin client that implements MCP stdio protocol
   - Auto-detects and launches backend server if needed
   - Converts between MCP format and Legion format
   - Maintains WebSocket connection to backend
   - Auto-reconnection with exponential backoff

2. **Backend Server** (`src/server/index.js`)
   - Runs as independent process
   - Handles all business logic and tool execution
   - Manages sessions, handles, and tool registry
   - Communicates in native Legion format
   - HTTP endpoints for health monitoring

3. **Auto-Launch System**
   - `ServerDetector` - Checks if backend is running via health endpoint
   - `ServerLauncher` - Spawns backend process if needed
   - `ServerManager` - Orchestrates detection and launching
   - `WebSocketClient` - Manages persistent connection with auto-reconnect

#### Running Modes

1. **Auto-Launch Mode** (default)
   ```bash
   npm start  # Detects and launches backend automatically
   ```

2. **Standalone Backend**
   ```bash
   npm run start:server  # Start backend separately
   npm start            # Connect stdio client
   ```

3. **Quiet Mode**
   ```bash
   npm run start:quiet  # Less verbose output
   ```

#### Benefits

- **Clean Separation**: MCP protocol handling separate from business logic
- **Scalability**: Backend can serve multiple MCP clients
- **Reliability**: Backend persists independently of client connections
- **Flexibility**: Backend can be deployed separately or embedded
- **Session Isolation**: Each client gets isolated session state

## Core Features

### 1. Context Management System

Context provides persistent memory across tool calls within a session:

#### Context Tools

**`context_add`** - Store data for later reference
```json
{
  "name": "api_config",
  "data": {"url": "https://api.example.com", "timeout": 5000},
  "description": "API configuration settings"
}
```

**`context_get`** - Retrieve stored data
```json
{
  "name": "api_config"
}
```

**`context_list`** - List all stored context
```json
{
  "filter": "api*"  // Optional pattern matching
}
```

#### Parameter Resolution (@contextName)

Use `@contextName` to reference saved context in any tool parameter:

```json
// First save data
{"tool": "context_add", "args": {"name": "server", "data": {"host": "prod.example.com"}}}

// Then reference it
{"tool": "deploy", "args": {"target": "@server"}}  // Automatically resolved
```

Resolution features:
- Works in nested objects and arrays
- Automatic resolution before tool execution
- Clear error messages for missing references
- No limit on nesting depth

### 2. Planning System

Built on `@legion/llm-planner` with extensions for Aiur:

#### Planning Tools

**`plan_create`** - Generate structured execution plan
```json
{
  "title": "Deploy Application",
  "description": "Complete deployment workflow",
  "allowableActions": [
    {"type": "build", "inputs": ["source"], "outputs": ["artifact"]},
    {"type": "test", "inputs": ["artifact"], "outputs": ["test_results"]},
    {"type": "deploy", "inputs": ["artifact", "test_results"], "outputs": ["deployment"]}
  ],
  "inputs": ["source_code"],
  "requiredOutputs": ["deployment"],
  "saveAs": "deployment_plan"  // Auto-save to context
}
```

**`plan_execute`** - Execute plan with monitoring
```json
{
  "plan": "@deployment_plan",  // Reference saved plan
  "options": {
    "stopOnError": true,
    "timeout": 300000,
    "retries": 3
  }
}
```

**`plan_status`** - Monitor execution progress
```json
{
  "sessionId": "current",
  "includeResults": true,
  "includeContext": true
}
```

**`plan_debug`** - Interactive debugging with breakpoints
```json
{
  "plan": "@deployment_plan",
  "breakpoints": ["step_3", "step_5"],
  "action": "continue",
  "inspectVariables": true
}
```

### 3. Module Integration

Aiur dynamically loads Legion modules to provide tools:

#### Built-in Modules
- **Context Module** - Context management tools
- **Planning Module** - Plan creation and execution
- **File Module** - File system operations
- **Debug Module** - Web debugging interface

#### Module Loading
```javascript
// Modules specified in environment
AIUR_MODULES=@legion/tools-registry/file,@legion/tools-registry/github

// Or dynamically loaded based on context
```

### 4. Handle System (Legacy)

Handles provide an alternative to context for backward compatibility:

```javascript
// Tools can return handles
{
  "result": data,
  "saveAs": "myHandle"  // Creates handle reference
}

// Reference handles with @ prefix
{
  "repo": "@myHandle"
}
```

Note: Context system is preferred for new implementations.

### 5. Debug Interface

Web-based debugging interface for development:

#### Debug Tools

**`web_debug_start`** - Launch debug interface
```json
{
  "port": 3000,
  "openBrowser": true
}
```

**`web_debug_status`** - Check debug server status

**`read_logs`** - Read system logs with filtering
```json
{
  "level": "error",
  "limit": 100,
  "search": "WebSocket"
}
```

## Session Management

Each MCP client connection gets an isolated session:

### Session Features
- **Isolated State**: Each session has its own context and handles
- **Automatic Cleanup**: Sessions expire after timeout
- **Persistent Backend**: Sessions survive client reconnections
- **WebSocket Communication**: Real-time bidirectional updates

### Session Lifecycle
1. Client connects → New session created
2. Session ID assigned and tracked
3. All tool calls execute in session context
4. Session expires after inactivity timeout
5. Resources automatically cleaned up

## Error Handling

Comprehensive error handling throughout the system:

### Error Broadcasting
- **ErrorBroadcastService** captures all errors
- Errors logged to file system
- Critical errors broadcast via WebSocket
- Graceful degradation on component failures

### Error Recovery
- Auto-reconnection for WebSocket disconnects
- Backend process restart detection
- Transaction rollback on failures
- Clear error messages in MCP format

## Logging System

Multi-level logging with automatic rotation:

### Log Features
- **File Logging**: Persistent logs in `./logs` directory
- **Log Rotation**: Automatic archival of old logs
- **Structured Logging**: JSON format with metadata
- **Log Filtering**: Search and filter capabilities
- **Performance**: Minimal impact on operations

### Log Configuration
```bash
AIUR_ENABLE_FILE_LOGGING=true
AIUR_LOG_DIRECTORY=./logs
AIUR_LOG_RETENTION_DAYS=7
AIUR_MAX_LOG_FILE_SIZE=10485760  # 10MB
```

## Format Conversion

Clean separation between MCP and Legion formats:

### MCP Format
```json
{
  "content": [{
    "type": "text",
    "text": "JSON string of result"
  }],
  "isError": false
}
```

### Legion Format
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed",
  "error": null,
  "code": "SUCCESS"
}
```

Conversion happens automatically in the stdio server layer.

## Implementation Status

### ✅ Completed
- Client-server architecture
- Auto-launch system
- Session management
- Context system with @ resolution
- Planning integration
- Module loading
- Error handling
- Debug interface
- Format conversion
- Comprehensive logging

### 🚧 In Progress
- Performance optimization
- Additional Legion module adapters
- Extended planning features

### 📋 Planned
- Distributed session storage
- Multi-agent coordination
- Visual planning interface
- Context versioning
- Advanced caching strategies

## Configuration

### Environment Variables

```bash
# Server Configuration
AIUR_SERVER_HOST=localhost
AIUR_SERVER_PORT=8080
AIUR_SESSION_TIMEOUT=3600000  # 1 hour

# Auto-Launch Configuration  
AIUR_AUTO_LAUNCH_SERVER=true
AIUR_SERVER_INDEPENDENT=true
AIUR_STOP_SERVER_ON_EXIT=false
AIUR_SERVER_LAUNCH_TIMEOUT=30000

# Logging Configuration
AIUR_ENABLE_FILE_LOGGING=true
AIUR_LOG_DIRECTORY=./logs
AIUR_LOG_RETENTION_DAYS=7

# Module Configuration
AIUR_MODULES=@legion/tools-registry/file,@legion/tools-registry/github

# Verbosity
AIUR_VERBOSE=true
```

## Testing

Comprehensive test suite covering all components:

### Test Categories
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full MCP protocol testing
- **Auto-Server Tests**: Server launch and detection
- **Session Tests**: Isolation and cleanup

### Running Tests
```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:e2e      # End-to-end tests
npm run test:auto-server  # Auto-launch tests
```

## MCP Protocol Compliance

### Stdio Communication Rules

Aiur strictly follows MCP stdio protocol requirements:

1. **Only JSON-RPC on stdout**: No console.log or debug output
2. **Use stderr for logs**: All debugging goes to stderr or files
3. **JSON-RPC 2.0 format**: Strict compliance with protocol spec
4. **Response ID matching**: Responses use same ID as requests

### Implementation Details

- **LogManager interception**: Redirects all console output to files
- **Official MCP SDK**: Uses `@modelcontextprotocol/sdk` for protocol handling
- **StdioServerTransport**: Manages stdin/stdout communication
- **Validation layer**: Ensures all responses meet MCP format requirements

## Web Debug Interface

### Overview

Browser-based debugging environment accessible via:

```bash
# Start debug interface
{"tool": "web_debug_start", "args": {"port": 3001, "openBrowser": true}}
```

### Features

1. **Real-time Monitoring**
   - Live event streaming via WebSocket
   - System metrics and performance data
   - Connection status tracking

2. **Interactive Command Execution**
   - Execute any tool through web UI
   - View results and timing
   - Inspect request/response data

3. **Context Browser**
   - View all stored context
   - Search and filter capabilities
   - Real-time updates

4. **Log Viewer**
   - Structured log display
   - Level filtering (error, warning, info)
   - Search functionality
   - Real-time streaming

5. **Error Dashboard**
   - All errors displayed with red highlighting
   - Expandable stack traces
   - Error statistics and patterns
   - Historical error buffer (last 100)

### Architecture

```
Web Browser ←→ WebDebugServer ←→ Aiur Server
     ↓              ↓                ↓
  Debug UI    WebSocket +      Event System
              HTTP Server
```

### Error Broadcasting

The ErrorBroadcastService captures and broadcasts all errors:

- **Global handlers**: Uncaught exceptions and rejections
- **Tool errors**: Execution failures with context
- **Module errors**: Loading failures (non-fatal)
- **Rich metadata**: Component, operation, severity, stack trace

Error format:
```json
{
  "type": "error",
  "data": {
    "id": "err_[timestamp]_[random]",
    "errorType": "tool-execution",
    "severity": "error",
    "source": "component-name",
    "error": {
      "message": "Error description",
      "stack": "Stack trace...",
      "code": "ERROR_CODE"
    },
    "context": {
      "tool": "tool-name",
      "operation": "operation-name"
    }
  }
}
```

## File Structure

### Core Components

```
src/
├── index.js                    # MCP stdio server (client)
├── server/
│   ├── index.js               # Backend server entry
│   ├── AiurServer.js          # Main server class
│   ├── SessionManager.js      # Session isolation
│   ├── RequestHandler.js      # Request processing
│   └── WebSocketHandler.js    # WebSocket management
├── client/
│   ├── ServerManager.js       # Auto-launch orchestration
│   ├── ServerDetector.js      # Health checking
│   ├── ServerLauncher.js      # Process spawning
│   └── WebSocketClient.js     # Connection management
├── core/
│   ├── ContextManager.js      # Context storage
│   ├── ToolDefinitionProvider.js # Tool management
│   ├── ModuleLoader.js        # Dynamic loading
│   ├── LogManager.js          # File-based logging
│   └── ErrorBroadcastService.js # Error handling
├── debug/
│   ├── WebDebugServer.js      # Debug interface
│   ├── DebugTool.js          # Debug tools
│   └── web/                  # Web UI assets
└── handles/
    ├── HandleRegistry.js      # Handle storage
    └── HandleResolver.js      # @ resolution
```

## Future Enhancements

1. **Distributed Architecture**: Redis-backed session storage
2. **Multi-Agent Support**: Shared context spaces
3. **Visual Tools**: Web UI for plan creation
4. **Performance**: Caching and optimization
5. **Security**: Authentication and authorization
6. **Monitoring**: Prometheus metrics export
7. **Error Persistence**: Save errors to disk for analysis
8. **Advanced Recovery**: Automatic error recovery strategies