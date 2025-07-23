# Web Debug Interface for Aiur MCP Server

## Overview

The Web Debug Interface provides a browser-based debugging environment for the Aiur MCP server. It enables real-time monitoring, command execution, context inspection, and log viewing through a WebSocket connection. This interface allows developers to debug and monitor MCP server operations without needing a direct MCP client connection.

## Architecture

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │    │  WebDebugServer  │    │   Aiur MCP      │
│                 │◄──►│                  │◄──►│    Server       │
│  Debug UI       │    │  WebSocket +     │    │                 │
│  JavaScript     │    │  HTTP Server     │    │  Event System   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ MonitoringSystem │
                       │   EventEmitter   │
                       └──────────────────┘
```

### Core Features

1. **Real-time Monitoring**
   - Live event streaming via WebSocket
   - System metrics and performance data
   - Connection status and health monitoring

2. **Interactive Command Execution**
   - Execute any MCP tool through the web interface
   - Context management operations
   - Plan creation and execution

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

## Technical Implementation

### WebDebugServer Class

**Location**: `packages/aiur/src/debug/WebDebugServer.js`

**Responsibilities**:
- HTTP server for serving the web interface
- WebSocket server for real-time communication
- Event bridge between MCP server and web client
- Port auto-detection and collision avoidance

**Key Methods**:
```javascript
class WebDebugServer {
  static async create(resourceManager)
  async start(options = {})
  async stop()
  async getServerInfo()
  _setupEventBridge()
  _handleWebSocketMessage(ws, message)
  _broadcastEvent(eventType, data)
}
```

### DebugTool Class

**Location**: `packages/aiur/src/debug/DebugTool.js`

**Responsibilities**:
- MCP tool interface for web debug functionality
- Server lifecycle management
- Context integration for server info storage

**Tool Functions**:
```javascript
{
  name: "web_debug_start",
  description: "Start web debugging interface",
  inputSchema: {
    type: "object",
    properties: {
      port: { type: "number", description: "Preferred port (auto-detected if unavailable)" },
      openBrowser: { type: "boolean", default: true, description: "Open browser automatically" }
    }
  }
}
```

### Web Interface Components

**Location**: `packages/aiur/src/debug/web/`

**Files**:
- `index.html` - Main interface HTML
- `script.js` - Client-side JavaScript
- `styles.css` - Interface styling

**Interface Sections**:
1. **Command Panel** - Execute MCP tools
2. **Context Browser** - View and manage context
3. **Log Viewer** - Real-time log display
4. **System Status** - Server health and metrics
5. **Event Stream** - Live event monitoring

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

## WebSocket Protocol

### Connection Handshake

```javascript
// Client connects to ws://localhost:{port}/ws
// Server responds with welcome message
{
  type: 'welcome',
  data: {
    serverId: 'aiur-mcp-12345',
    version: '1.0.0',
    capabilities: ['tool-execution', 'context-management', 'event-streaming']
  }
}
```

### Message Types

#### Client → Server

**Execute Tool**:
```javascript
{
  type: 'execute-tool',
  id: 'unique-request-id',
  data: {
    name: 'context_list',
    arguments: { filter: 'deploy*' }
  }
}
```

**Subscribe to Events**:
```javascript
{
  type: 'subscribe',
  data: {
    events: ['metric-recorded', 'tool-executed'],
    filters: { severity: 'warning' }
  }
}
```

#### Server → Client

**Tool Result**:
```javascript
{
  type: 'tool-result',
  id: 'unique-request-id',
  data: {
    success: true,
    result: { /* tool output */ },
    executionTime: 150
  }
}
```

**Event Stream**:
```javascript
{
  type: 'event',
  data: {
    eventType: 'metric-recorded',
    timestamp: '2024-01-15T10:30:00.000Z',
    payload: { /* event data */ }
  }
}
```

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

## Usage Workflows

### Starting Debug Session

1. Execute `web_debug_start` tool through MCP client
2. Server auto-detects available port
3. Web interface opens in default browser
4. WebSocket connection establishes
5. Real-time monitoring begins

### Debugging Context Issues

1. Open **Context Browser** panel
2. Search for relevant context items
3. Inspect context data structure
4. Execute context operations (`context_add`, `context_get`)
5. Monitor real-time context changes

### Monitoring Plan Execution

1. Start plan execution via **Command Panel**
2. Monitor progress in **Event Stream**
3. View execution metrics in **System Status**
4. Inspect intermediate results in **Context Browser**
5. Debug failures using **Log Viewer**

### System Health Monitoring

1. **System Status** panel shows health score
2. **Event Stream** displays anomalies and alerts
3. **Log Viewer** shows detailed diagnostic information
4. **Context Browser** reveals system state

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

## Error Handling

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

## Performance Considerations

### Event Processing

- **Batching**: Multiple events bundled in single WebSocket message
- **Filtering**: Client-side filtering reduces network traffic
- **Compression**: Optional WebSocket compression for large payloads

### Memory Management

- **Event buffers**: Circular buffers prevent unbounded growth
- **Context caching**: LRU cache for frequently accessed context
- **Cleanup routines**: Periodic cleanup of stale connections

### Scalability

- **Single server instance**: One debug server per MCP server instance
- **Connection limits**: Maximum concurrent WebSocket connections
- **Resource monitoring**: Automatic degradation under resource pressure

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

## Future Enhancements

### Planned Features

1. **Multi-server support**: Connect to multiple MCP server instances
2. **Persistent sessions**: Save debug sessions across restarts  
3. **Export functionality**: Export logs and context data
4. **Remote access**: Secure remote debugging capabilities
5. **Plugin system**: Extensible debug tool plugins

### Integration Opportunities

1. **IDE integration**: VSCode extension for embedded debugging
2. **CI/CD integration**: Automated debug report generation
3. **Monitoring dashboards**: Integration with external monitoring
4. **Alerting systems**: Integration with notification services

## Conclusion

The Web Debug Interface provides a comprehensive debugging environment for Aiur MCP servers, enabling efficient development and troubleshooting of AI agent systems. The design prioritizes real-time visibility, ease of use, and integration with existing MCP infrastructure while maintaining security and performance considerations for development environments.