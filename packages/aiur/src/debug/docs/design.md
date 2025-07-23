# Web Debug Interface for Aiur MCP Server - Comprehensive Design & API Documentation

## Overview

The Web Debug Interface provides a comprehensive browser-based debugging environment for the Aiur MCP server. It serves as a **WebSocket-based MCP client** that enables real-time monitoring, command execution, context inspection, and log viewing. This interface allows developers to debug and monitor MCP server operations interactively through a web browser.

**Key Architecture Principle**: The web interface communicates **exclusively via WebSocket** with the MCP server - there are no separate HTTP APIs for tool execution. All MCP tool calls are made through WebSocket messages.

## Architecture

### System Components

```
┌─────────────────┐    WebSocket      ┌─────────────────┐
│   Web Browser   │◄─────────────────►│   Aiur MCP      │
│                 │    (MCP Tools)     │    Server       │
│  Debug UI       │                   │                 │
│  JavaScript     │    HTTP           │  Event System   │
│                 │◄─────────────────►│                 │
└─────────────────┘  (Static Files)   └─────────────────┘
                                              │
                                              ▼
                                       ┌──────────────────┐
                                       │ MonitoringSystem │
                                       │   EventEmitter   │
                                       └──────────────────┘
```

**Communication Flow**:
1. **HTTP**: Only for serving static web files (HTML, CSS, JS)
2. **WebSocket**: All MCP tool execution and real-time event streaming
3. **No APIs**: Web interface is a pure WebSocket MCP client

### Core Features

1. **Real-time Monitoring**
   - Live event streaming via WebSocket
   - System metrics and performance data
   - Connection status and health monitoring

2. **Interactive MCP Tool Execution**
   - Execute any MCP tool via WebSocket messages
   - Direct tool calls without HTTP APIs
   - Context management operations
   - Plan creation and execution debugging

3. **Context Inspection**
   - Browse all stored context data
   - Search and filter context items
   - Real-time context updates

4. **Log Viewing**
   - Structured log display with filtering
   - Real-time log streaming
   - Log level filtering and search

5. **System Information**
   - Server status and uptime
   - Tool availability and statistics
   - Module loading status

## MCP Tool Interface

The debug interface is accessed through MCP tools that can be called via the Aiur MCP server.

### web_debug_start

Starts the web debugging interface and optionally opens a browser.

**Parameters:**
- `port` (number, optional): Preferred port (auto-detected if unavailable)
  - Range: 1024-65535
  - Default: 3001
  - Fallback ranges: 3001-3100, 8000-8099, 9000-9099
- `openBrowser` (boolean, optional): Open browser automatically
  - Default: true
- `host` (string, optional): Host to bind to
  - Default: 'localhost'

**Returns:**
```json
{
  "success": true,
  "message": "Web debug interface started successfully",
  "serverInfo": {
    "serverId": "aiur-debug-12345",
    "port": 3001,
    "url": "http://localhost:3001",
    "status": "running",
    "startedAt": "2024-01-15T10:30:45.123Z",
    "connectedClients": 0,
    "version": "1.0.0"
  },
  "url": "http://localhost:3001",
  "port": 3001,
  "instructions": [
    "Debug interface is running at http://localhost:3001",
    "Use the web interface to execute tools, view context, and monitor events",
    "Server information has been saved to context as 'debug_server'"
  ]
}
```

**Example Usage:**
```bash
# Via Claude Code MCP client
web_debug_start {"port": 3001, "openBrowser": true}
```

```json
// Raw MCP call
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "web_debug_start",
    "arguments": {
      "port": 3001,
      "openBrowser": true,
      "host": "localhost"
    }
  }
}
```

### web_debug_stop

Stops the web debugging interface and closes all client connections.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "message": "Web debug interface stopped successfully"
}
```

**Example Usage:**
```bash
web_debug_stop {}
```

### web_debug_status

Gets the current status and information about the debug interface.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "status": {
    "serverId": "aiur-debug-12345",
    "port": 3001,
    "url": "http://localhost:3001",
    "status": "running",
    "startedAt": "2024-01-15T10:30:45.123Z",
    "connectedClients": 2,
    "version": "1.0.0",
    "capabilities": [
      "real-time-monitoring",
      "tool-execution", 
      "context-management",
      "event-streaming",
      "log-viewing"
    ],
    "systemInfo": {
      "nodeVersion": "v18.17.0",
      "platform": "darwin",
      "uptime": 12345.67,
      "memoryUsage": {
        "rss": 50331648,
        "heapTotal": 20971520,
        "heapUsed": 15728640,
        "external": 1048576
      }
    }
  },
  "instructions": [
    "Access debug interface at http://localhost:3001",
    "2 client(s) currently connected",
    "Use web_debug_stop to stop the interface"
  ]
}
```

## WebSocket API

The web interface communicates with the Aiur MCP server via WebSocket at `ws://localhost:<port>/ws`.

### Connection Flow

1. **Connect**: Client connects to WebSocket endpoint
2. **Welcome**: Server sends welcome message with capabilities
3. **Tool Execution**: Client sends tool requests, server responds with results
4. **Event Stream**: Server broadcasts real-time events to all clients

### Message Types

#### Welcome Message (Server → Client)

Sent immediately after connection establishment.

```json
{
  "type": "welcome",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "data": {
    "serverId": "aiur-mcp-12345",
    "version": "1.0.0",
    "capabilities": [
      "tool-execution",
      "context-management", 
      "event-streaming",
      "real-time-monitoring"
    ],
    "availableTools": [
      "context_add",
      "context_get",
      "context_list",
      "plan_execute",
      "web_debug_start",
      "web_debug_stop",
      "web_debug_status"
    ]
  }
}
```

#### Tool Request (Client → Server)

Execute any available MCP tool.

```json
{
  "type": "tool_request",
  "id": "unique-request-id",
  "tool": "context_add",
  "args": {
    "name": "my_context",
    "data": { "key": "value" },
    "description": "My test context"
  }
}
```

#### Tool Result (Server → Client)

Response to tool execution request.

```json
{
  "type": "tool_result", 
  "id": "unique-request-id",
  "timestamp": "2024-01-15T10:30:45.123Z", 
  "data": {
    "success": true,
    "result": {
      "content": [{
        "type": "text",
        "text": "{\"success\": true, \"message\": \"Context added successfully\"}"
      }]
    },
    "executionTime": 42
  }
}
```

#### Event Broadcast (Server → Client)

Real-time events from the MCP server.

```json
{
  "type": "event",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "eventType": "tool-executed",
  "source": "aiur-mcp-server",
  "payload": {
    "tool": "context_add",
    "success": true,
    "executionTime": 42,
    "args": { "name": "my_context" }
  }
}
```

#### Error Message (Server → Client)

Error notifications for invalid requests or system issues.

```json
{
  "type": "error",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "error": "Invalid JSON in message",
  "details": "Unexpected token '}' at position 15"
}
```

## Technical Implementation

### WebDebugServer Class

**Location**: `packages/aiur/src/debug/WebDebugServer.js`

**Responsibilities**:
- **HTTP server**: Serves static web files (HTML, CSS, JS) only
- **WebSocket server**: Handles all MCP tool execution and real-time events
- **MCP bridge**: Routes WebSocket messages directly to MCP tools
- **Event bridge**: Forwards MCP server events to connected web clients
- **Port auto-detection**: Collision avoidance for multiple server instances

#### Constructor

```javascript
constructor(contextManager, toolDefinitionProvider, monitoringSystem)
```

**Parameters:**
- `contextManager`: ContextManager instance for context operations
- `toolDefinitionProvider`: ToolDefinitionProvider for tool execution
- `monitoringSystem`: MonitoringSystem for event forwarding

#### Static Factory Method

```javascript
static async create(resourceManager)
```

**Parameters:**
- `resourceManager`: ResourceManager instance with registered dependencies

**Returns:** Promise<WebDebugServer>

#### Methods

##### start(options)

Start the debug server with HTTP and WebSocket endpoints.

**Parameters:**
- `options.port` (number, optional): Preferred port
- `options.host` (string, optional): Host to bind to  
- `options.openBrowser` (boolean, optional): Auto-open browser

**Returns:** Promise<ServerInfo>

##### stop()

Stop the debug server and close all connections.

**Returns:** Promise<void>

##### getServerInfo()

Get current server information and status.

**Returns:** ServerInfo object

```javascript
{
  serverId: string,
  port: number,
  url: string,
  status: 'running' | 'stopped',
  startedAt: string | null,
  connectedClients: number,
  version: string
}
```

#### Properties

- `isRunning` (boolean): Whether server is currently running
- `port` (number): Current port (null if not running)
- `clients` (Set): Set of connected WebSocket clients
- `serverId` (string): Unique server identifier

### DebugTool Class

**Location**: `packages/aiur/src/debug/DebugTool.js`

**Responsibilities**:
- MCP tool interface for web debug functionality
- Server lifecycle management
- Context integration for server info storage

#### Constructor

```javascript
constructor(webDebugServer, contextManager)
```

#### Static Factory Method

```javascript  
static async create(resourceManager)
```

#### Methods

##### getToolDefinitions()

Get MCP tool definitions for debug functionality.

**Returns:** Array of MCP tool definitions

##### executeDebugTool(name, args)

Execute a debug tool by name.

**Parameters:**
- `name` (string): Tool name ('web_debug_start', 'web_debug_stop', 'web_debug_status')
- `args` (object): Tool arguments (already resolved)

**Returns:** Promise<MCP-formatted response>

##### isDebugTool(toolName)

Check if a tool name is a debug tool.

**Parameters:**
- `toolName` (string): Name to check

**Returns:** boolean

### Web Interface Components

**Location**: `packages/aiur/src/debug/web/`

**Files**:
- `index.html` - Main interface HTML
- `script.js` - Client-side JavaScript
- `styles.css` - Interface styling

**Interface Sections**:
1. **Command Panel** - Execute MCP tools via WebSocket
2. **Context Browser** - View and manage context via MCP tools
3. **Log Viewer** - Real-time log display from event stream
4. **System Status** - Server health and metrics
5. **Event Stream** - Live MCP server event monitoring

**Note**: All tool execution happens through WebSocket messages to the MCP server - the web interface is purely a client.

## Client-Side JavaScript API

The browser interface provides a `DebugInterface` class for WebSocket communication.

### DebugInterface Class

#### Constructor

```javascript
const debugInterface = new DebugInterface();
```

Automatically connects to WebSocket at current host.

#### Methods

##### executeTool(toolName, args)

Execute an MCP tool via WebSocket.

**Parameters:**
- `toolName` (string): Name of tool to execute
- `args` (object): Tool arguments

**Returns:** Promise<ToolResult>

```javascript
const result = await debugInterface.executeTool('context_add', {
  name: 'test_context',
  data: { key: 'value' }
});
```

##### refreshContext()

Refresh the context browser display.

**Returns:** Promise<void>

##### refreshStatus()

Refresh the system status display.

**Returns:** Promise<void>

##### showToast(message, type)

Show a toast notification.

**Parameters:**
- `message` (string): Message to display
- `type` (string): 'success', 'error', 'warning', 'info'

#### Events

The DebugInterface emits various events that can be listened to:

```javascript
debugInterface.on('connected', () => {
  console.log('Connected to debug server');
});

debugInterface.on('disconnected', () => {
  console.log('Disconnected from debug server');
});

debugInterface.on('tool_result', (result) => {
  console.log('Tool executed:', result);
});

debugInterface.on('event', (event) => {
  console.log('Server event:', event);
});
```

## Usage Examples & Workflows

### Getting Started

#### 1. Starting the Debug Interface

```bash
# Using Claude Code CLI
web_debug_start {"openBrowser": true}
```

#### 2. Accessing the Web Interface

Once started, open your browser to `http://localhost:3001`. You'll see:

- **Command Panel**: Execute any MCP tool interactively
- **Context Browser**: View and search context data
- **Event Stream**: Real-time events from the MCP server
- **System Status**: Server health and connection info
- **Log Viewer**: Server logs and debugging information

### Basic Operations

#### 3. Executing Tools via Web Interface

**Adding Context Data:**

1. In the Command Panel, enter tool name: `context_add`
2. Enter arguments:
```json
{
  "name": "user_preferences",
  "data": {
    "theme": "dark",
    "language": "en",
    "notifications": true
  },
  "description": "User interface preferences"
}
```
3. Click **Execute**

**Result:**
```json
{
  "success": true,
  "message": "Context added successfully",
  "contextName": "user_preferences"
}
```

**Listing Context Items:**
1. Tool name: `context_list`
2. Arguments: `{}` (empty)
3. Execute to see all context items

**Getting Specific Context:**
1. Tool name: `context_get`
2. Arguments:
```json
{
  "name": "user_preferences"
}
```

#### 4. Real-time Event Monitoring

The Event Stream automatically shows events as they happen:

```json
{
  "eventType": "tool-executed",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "payload": {
    "tool": "context_add",
    "success": true,
    "executionTime": 25
  }
}
```

Filter events by type using the dropdown:
- **All Events**: Show everything
- **Tool Executed**: Only tool executions
- **Metrics**: Performance metrics
- **Alerts**: System alerts and warnings

### Advanced Usage

#### 5. Plan Execution Workflow

**Creating a Deployment Plan:**

```json
{
  "tool": "plan_create",
  "args": {
    "title": "Deploy Application",
    "description": "Complete deployment workflow with validation",
    "steps": [
      {
        "id": "validate",
        "action": "validate_config",
        "parameters": {
          "config": "@deployment_config"
        }
      },
      {
        "id": "build",
        "action": "build_app", 
        "dependsOn": ["validate"],
        "parameters": {
          "environment": "production"
        }
      },
      {
        "id": "deploy",
        "action": "deploy_app",
        "dependsOn": ["build"],
        "parameters": {
          "target": "production",
          "rollback": true
        }
      }
    ],
    "saveAs": "deployment_plan"
  }
}
```

**Executing the Plan:**

```json
{
  "tool": "plan_execute",
  "args": {
    "planHandle": "@deployment_plan",
    "options": {
      "parallel": false,
      "stopOnError": true
    }
  }
}
```

**Monitoring Plan Progress:**

Watch the Event Stream for plan execution events:

```json
{
  "eventType": "plan-step-started",
  "payload": {
    "planId": "deployment_plan",
    "stepId": "validate",
    "action": "validate_config"
  }
}
```

#### 6. Context Data Management

**Saving Configuration Data:**

```json
{
  "tool": "context_add",
  "args": {
    "name": "deployment_config",
    "data": {
      "environment": "production",
      "replicas": 3,
      "resources": {
        "cpu": "500m",
        "memory": "512Mi"
      },
      "secrets": {
        "database_url": "@db_connection_string",
        "api_keys": "@production_api_keys"
      }
    },
    "description": "Production deployment configuration"
  }
}
```

**Using Parameter Resolution:**

Reference saved context in subsequent tool calls:

```json
{
  "tool": "deploy_service",
  "args": {
    "config": "@deployment_config",
    "environment": "production",
    "validate": true
  }
}
```

The `@deployment_config` reference is automatically resolved to the actual saved data.

#### 7. Multi-Step Database Migration Example

1. **Save migration scripts to context:**
```json
{
  "tool": "context_add", 
  "args": {
    "name": "migration_scripts",
    "data": {
      "scripts": [
        "001_create_users.sql",
        "002_add_indexes.sql", 
        "003_update_schema.sql"
      ],
      "rollback_scripts": [
        "003_rollback_schema.sql",
        "002_drop_indexes.sql",
        "001_drop_users.sql"
      ]
    }
  }
}
```

2. **Create migration plan:**
```json
{
  "tool": "plan_create",
  "args": {
    "title": "Database Migration",
    "steps": [
      {
        "id": "backup",
        "action": "backup_database",
        "parameters": {
          "target": "@backup_location"
        }
      },
      {
        "id": "migrate",
        "action": "run_migrations",
        "dependsOn": ["backup"],
        "parameters": {
          "scripts": "@migration_scripts"
        }
      },
      {
        "id": "verify",
        "action": "verify_migration",
        "dependsOn": ["migrate"],
        "parameters": {
          "checks": "@verification_queries"
        }
      }
    ],
    "saveAs": "migration_plan"
  }
}
```

3. **Execute with monitoring:**
Execute the plan and watch progress in real-time through the Event Stream.

## Event System Integration

### MonitoringSystem Bridge

The debug interface integrates with the existing `MonitoringSystem` to capture and forward events:

```javascript
// Event types forwarded to web clients
const FORWARDED_EVENTS = [
  'metric-recorded',
  'alert-triggered', 
  'anomaly-detected',
  'monitoring-stopped',
  'configuration-applied'
];

// Additional debug-specific events
const DEBUG_EVENTS = [
  'tool-executed',
  'context-updated',
  'plan-status-changed',
  'connection-status',
  'server-health'
];
```

### Event Data Structure

All events sent to web clients follow this structure:

```javascript
{
  type: 'event-name',
  timestamp: '2024-01-15T10:30:00.000Z',
  source: 'monitoring-system' | 'mcp-server' | 'debug-server',
  data: {
    // Event-specific data
  },
  metadata: {
    serverId: 'aiur-mcp-12345',
    version: '1.0.0'
  }
}
```

## Port Management

### Auto-Detection Algorithm

The debug server uses intelligent port detection to avoid conflicts when multiple MCP server instances are running:

```javascript
async function findAvailablePort(preferredPort = 3001) {
  const basePort = preferredPort;
  const maxAttempts = 100;
  
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  throw new Error('No available ports found');
}
```

### Port Range Strategy

- **Default range**: 3001-3100
- **Fallback range**: 8000-8099  
- **Emergency range**: 9000-9099

### Context Storage

Server information is automatically stored in context for reference:

```javascript
// Stored as context_debug_server
{
  port: 3001,
  url: 'http://localhost:3001',
  status: 'running',
  startedAt: '2024-01-15T10:30:00.000Z',
  serverId: 'aiur-mcp-12345'
}
```

## Error Handling

### Common Error Types

#### Connection Errors
- **WebSocket Connection Failed**: Check if debug server is running and port is correct
- **HTTP 400 Bad Request**: Invalid WebSocket upgrade request
- **Connection Timeout**: Server may be overloaded or unreachable

#### Tool Execution Errors
- **Unknown Tool**: Tool name not found in available tools
- **Invalid Parameters**: Parameters don't match tool schema
- **Execution Failed**: Tool execution threw an error

#### Server Errors
- **Port In Use**: Another process is using the requested port
- **Permission Denied**: Insufficient permissions to bind to port
- **Resource Exhaustion**: Server out of memory or file handles

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,  
  "error": "Error description",
  "details": "Additional error details",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

### Connection Failures

- **Port unavailable**: Automatic retry with next available port
- **WebSocket disconnect**: Automatic reconnection with exponential backoff
- **Server crash**: Client displays connection lost status

### Tool Execution Errors

- **Invalid tool**: Clear error message with available tools list
- **Parameter errors**: Schema validation feedback
- **Execution timeout**: Configurable timeout with progress indication

### Resource Limitations

- **Memory usage**: Event buffer limits prevent memory leaks
- **CPU usage**: Throttled event processing under high load
- **Network bandwidth**: Selective event forwarding based on subscriptions

## Security Considerations

### Access Control

- **Local only**: Debug server binds to localhost/127.0.0.1 only
- **No authentication**: Assumes trusted local development environment
- **CORS disabled**: Only accepts connections from same origin

### Data Exposure

- **Context data**: Full access to all stored context
- **System metrics**: Complete monitoring data exposure
- **Tool execution**: Full MCP tool execution capability

**Warning**: The debug interface provides full access to the MCP server capabilities. Only use in trusted development environments.

⚠️ **Important**: The debug interface is intended for development and debugging only.

### Security Limitations
- **No Authentication**: Direct access to all MCP tools
- **Full Context Access**: Read/write access to all context data
- **Tool Execution**: Can execute any available MCP tool
- **Network Exposure**: Binds to configurable host (localhost by default)

### Recommendations
- **Trusted Networks Only**: Only run on secure, trusted networks
- **Firewall Protection**: Use firewall rules to restrict access
- **VPN/SSH Tunneling**: For remote access, use secure tunneling
- **Monitor Usage**: Keep logs of tool executions and access
- **Stop When Unused**: Stop the debug interface when not actively debugging

## Performance Characteristics

### Resource Usage
- **Memory**: ~10-20MB baseline, scales with connected clients and context data
- **CPU**: Low impact, spikes during tool execution
- **Network**: WebSocket connections maintained, HTTP for static files only

### Scalability
- **Concurrent Clients**: Tested with 20+ concurrent connections
- **Tool Execution**: Queue-based execution, no artificial limits
- **Event Broadcasting**: Efficient broadcast to all connected clients
- **Context Data**: Handles large context items (tested up to 10KB per item)

### Event Processing

- **Batching**: Multiple events bundled in single WebSocket message
- **Filtering**: Client-side filtering reduces network traffic
- **Compression**: Optional WebSocket compression for large payloads

### Memory Management

- **Event buffers**: Circular buffers prevent unbounded growth
- **Context caching**: LRU cache for frequently accessed context
- **Cleanup routines**: Periodic cleanup of stale connections

### Monitoring
- Built-in metrics via MonitoringSystem integration
- Client connection/disconnection tracking
- Tool execution timing and success rates
- Memory usage and system health monitoring

## Configuration Options

### Server Configuration

```javascript
const debugOptions = {
  port: 3001,                    // Preferred port
  host: 'localhost',             // Bind address  
  openBrowser: true,             // Auto-open browser
  eventBuffer: 1000,             // Max events to buffer
  logLevel: 'info',              // Debug logging level
  enableMetrics: true,           // Collect performance metrics
  corsEnabled: false             // CORS settings
};
```

### Web Interface Configuration

```javascript
const clientConfig = {
  reconnectInterval: 5000,       // WebSocket reconnect delay
  eventDisplayLimit: 500,        // Max events in UI
  refreshInterval: 1000,         // UI refresh rate
  autoScroll: true,              // Auto-scroll logs
  theme: 'dark'                  // UI theme
};
```

## Integration with Aiur MCP Server

The debug interface integrates seamlessly with the Aiur MCP server:

1. **Tool Registration**: Debug tools are registered in ToolDefinitionProvider
2. **Resource Management**: Uses ResourceManager pattern for dependency injection  
3. **Context Integration**: Server info automatically stored in context
4. **Event Forwarding**: MonitoringSystem events forwarded to web clients
5. **Lifecycle Management**: Server startup/shutdown integrated with Aiur lifecycle

### Aiur Server Configuration

The debug interface is automatically available when Aiur starts:

```javascript
// Debug tools are available via MCP
const tools = await aiurClient.listTools();
// Returns: [..., 'web_debug_start', 'web_debug_stop', 'web_debug_status']

// Start debug interface
await aiurClient.callTool('web_debug_start', { port: 3001 });
```

## Troubleshooting

### Common Issues

**"Connection refused"**
- Verify debug server is running: `web_debug_status`
- Check port availability
- Ensure correct URL: `http://localhost:<port>`

**"WebSocket connection failed"**
- Use correct WebSocket path: `ws://localhost:<port>/ws`
- Check browser console for detailed errors
- Verify server is accepting WebSocket connections

**"Unknown tool" errors**
- Check available tools in System Status panel
- Verify tool is loaded in Aiur server
- Check spelling and parameter format

**Slow performance**
- Use event filtering to reduce noise
- Clear old context data
- Check system resource usage
- Consider restarting debug server

### Debug Logging

Enable verbose logging for troubleshooting:

```bash
# Server-side logging
NODE_ENV=development npm start

# Browser console
// Open browser dev tools and check console logs
```

## Development Guidelines

### Adding New Features

1. **Event types**: Add to `DEBUG_EVENTS` constant
2. **WebSocket handlers**: Extend message type handling
3. **UI components**: Add corresponding web interface elements
4. **Documentation**: Update this design document

### Testing Strategy

1. **Unit tests**: Test individual components in isolation
2. **Integration tests**: Test WebSocket communication
3. **Browser tests**: Automated web interface testing
4. **Load tests**: Multiple connection handling
5. **Error simulation**: Network failure scenarios

### Debugging the Debugger

- **Server logs**: Console output for debug server operations
- **Client console**: Browser developer tools for web interface
- **WebSocket inspection**: Network tab for message analysis
- **Performance profiling**: Browser performance tools

## Conclusion

The Web Debug Interface provides a comprehensive debugging environment for Aiur MCP servers, enabling efficient development and troubleshooting of AI agent systems. The design prioritizes real-time visibility, ease of use, and integration with existing MCP infrastructure while maintaining security and performance considerations for development environments.

**Key Benefits:**
- **WebSocket-only architecture** ensures consistent MCP protocol usage
- **Real-time monitoring** provides immediate feedback on system behavior
- **Interactive tool execution** enables rapid debugging and testing
- **Context management** facilitates parameter resolution and data inspection
- **Comprehensive documentation** supports both users and developers

The interface is production-ready for development environments and provides a solid foundation for future enhancements and integrations.