# Aiur Debug UI - Design Document

## Overview

The Aiur Debug UI is a standalone web-based debugging interface for MCP (Model Context Protocol) servers. It provides real-time interaction capabilities, tool execution, context management, and comprehensive monitoring for AI agent development and debugging.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐    WebSocket     ┌─────────────────┐
│   Browser       │◄────────────────►│   Debug UI      │◄────────────────►│   MCP Server    │
│   Client        │                  │   Proxy Server  │                  │   (Aiur/Other)  │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

The Debug UI acts as a WebSocket proxy between browser clients and MCP servers, enabling web-based interaction with AI agents while maintaining the MCP protocol.

### Component Architecture

```
Aiur Debug UI Package
├── Client-Side Components
│   ├── Connection Manager
│   ├── Tool Interface
│   ├── Context Browser
│   ├── Event Stream
│   └── Session Manager
├── Server Components
│   ├── Express Server
│   ├── WebSocket Proxy
│   ├── Configuration Manager
│   └── Logger
└── Supporting Infrastructure
    ├── Test Suite
    ├── Documentation
    └── Build/Deploy Scripts
```

## Core Components

### 1. WebSocket Proxy Server (`src/server/websocket.js`)

**Purpose**: Bridges browser clients with MCP servers via WebSocket connections.

**Key Features**:
- **Connection Management**: Tracks client connections with unique IDs
- **Auto-Reconnection**: Exponential backoff retry logic for MCP connections
- **Message Queuing**: Buffers messages during reconnection attempts
- **Session Isolation**: Each client maintains independent MCP connection state
- **Error Handling**: Comprehensive error recovery and reporting

**Message Flow**:
```
Browser Client → Debug UI Proxy → MCP Server
             ←                 ←
```

**Connection Lifecycle**:
1. Browser connects to Debug UI proxy
2. Proxy sends welcome message with configuration
3. Client requests connection to specific MCP server
4. Proxy establishes WebSocket to MCP server
5. Messages are bidirectionally forwarded
6. Auto-reconnection on disconnection

### 2. Express Server (`src/server/index.js`)

**Purpose**: Serves static files and provides REST API endpoints.

**Key Features**:
- **Static File Serving**: HTML, CSS, JS assets with appropriate caching
- **Security Headers**: CSP, XSS protection, frame options
- **CORS Support**: Configurable cross-origin resource sharing
- **API Endpoints**: Configuration and health check endpoints
- **Request Logging**: Comprehensive request/response logging

**Endpoints**:
- `GET /` - Main debug interface
- `GET /api/config` - Client configuration
- `GET /health` - Health check
- `WS /ws` - WebSocket proxy endpoint

### 3. Configuration Manager (`src/utils/config.js`)

**Purpose**: Centralized configuration management with environment override support.

**Configuration Structure**:
```javascript
{
  server: {
    port: 3000,
    host: 'localhost'
  },
  mcp: {
    defaultUrl: 'ws://localhost:3001/ws',
    reconnectInterval: 1000,
    maxReconnectAttempts: 5
  },
  ui: {
    theme: 'dark',
    autoConnect: true
  },
  logging: {
    level: 'info',
    enableFile: false
  },
  cors: {
    enabled: false,
    origin: '*'
  }
}
```

### 4. Logger (`src/utils/logger.js`)

**Purpose**: Winston-based logging with configurable transports.

**Features**:
- **Console Transport**: Colorized output with timestamps
- **File Transport**: Optional JSON file logging  
- **Child Loggers**: Context-aware logging with metadata
- **Log Levels**: Error, warn, info, debug levels

### 5. Client Application (`src/client/app.js`)

**Purpose**: Browser-based interface for MCP server interaction.

**Key Features**:
- **Connection Management**: Connect/disconnect from MCP servers
- **Tool Execution**: Interactive tool calling with argument validation
- **Context Browser**: View and manage context data
- **Event Streaming**: Real-time event monitoring
- **Session Management**: Handle multiple concurrent sessions
- **Toast Notifications**: User feedback and error reporting

**UI Components**:
- **Connection Panel**: Server URL input and connection controls
- **Tool Panel**: Available tools list and execution interface
- **Context Panel**: Context data browser and management
- **Events Panel**: Real-time event stream with filtering
- **Status Bar**: Connection status and session information

## Data Flow

### Tool Execution Flow

```
1. User selects tool in browser
2. Client validates arguments
3. WebSocket message sent to proxy
4. Proxy forwards to MCP server
5. MCP server executes tool
6. Response forwarded back through proxy
7. Client displays results
8. Context automatically updated
```

### Connection Management Flow

```
1. Browser loads debug interface
2. WebSocket connects to proxy
3. Proxy sends welcome message
4. Client initiates MCP connection
5. Proxy establishes MCP WebSocket
6. Connection confirmed to client
7. Bidirectional message flow begins
```

## Security Considerations

### 1. Input Validation
- **Message Validation**: All WebSocket messages validated
- **Parameter Sanitization**: Tool arguments sanitized
- **URL Validation**: MCP server URLs validated

### 2. Security Headers
- **CSP**: Content Security Policy prevents XSS
- **Frame Options**: Prevents clickjacking
- **MIME Sniffing**: Disabled to prevent content-type confusion

### 3. Connection Security
- **Origin Validation**: Optional CORS validation
- **Rate Limiting**: Prevents connection abuse
- **Error Sanitization**: Prevents information leakage

## Testing Strategy

### Test Structure
```
__tests__/
├── unit/
│   ├── utils/
│   │   ├── config.test.js
│   │   └── logger.test.js
│   └── server/
│       ├── index.test.js
│       └── websocket.test.js
├── integration/
│   └── server.integration.test.js
├── fixtures/
│   └── mockMcpServer.js
└── utils/
    └── setup.js
```

### Testing Approach

**Unit Tests**:
- Test individual components in isolation
- Mock external dependencies
- Focus on logic and error handling

**Integration Tests**:
- Test complete request/response flows
- Real WebSocket connections
- End-to-end message routing

**Mock Infrastructure**:
- Mock MCP server for testing
- Configurable response delays and failures
- Test fixtures for various scenarios

### Test Coverage Goals
- **Minimum**: 80% line coverage
- **Functions**: 90% coverage
- **Branches**: 75% coverage
- **Critical Paths**: 100% coverage

## Error Handling

### Client-Side Error Handling
- **Connection Errors**: Auto-retry with user notification
- **Validation Errors**: Immediate user feedback
- **Server Errors**: Toast notifications with details
- **Network Errors**: Graceful degradation

### Server-Side Error Handling
- **WebSocket Errors**: Logging and client notification
- **MCP Connection Errors**: Auto-reconnection
- **Validation Errors**: Structured error responses
- **System Errors**: Comprehensive logging

## Performance Considerations

### 1. Connection Optimization
- **Keep-Alive**: WebSocket connections maintained
- **Message Batching**: Reduce connection overhead
- **Compression**: Optional WebSocket compression

### 2. Memory Management
- **Connection Cleanup**: Automatic cleanup on disconnect
- **Message Queue Limits**: Prevent memory leaks
- **Context Caching**: Efficient context data storage

### 3. Scalability
- **Concurrent Connections**: Support multiple clients
- **Resource Limits**: Configurable connection limits
- **Graceful Degradation**: Handle resource exhaustion

## Configuration Management

### Environment Variables
```bash
# Server Configuration
DEBUG_UI_PORT=3000
DEBUG_UI_HOST=localhost

# MCP Configuration  
MCP_DEFAULT_URL=ws://localhost:3001/ws
MCP_RECONNECT_INTERVAL=1000
MCP_MAX_RECONNECT_ATTEMPTS=5

# UI Configuration
UI_THEME=dark
UI_AUTO_CONNECT=true

# Logging Configuration
LOG_LEVEL=info
LOG_ENABLE_FILE=false

# CORS Configuration
CORS_ENABLED=false
CORS_ORIGIN=*
```

### Configuration Files
- **Default**: Built-in default configuration
- **JSON Override**: Optional `config.json` file
- **Environment Override**: Environment variables take precedence

## Deployment

### Development Deployment
```bash
npm start              # Start development server
npm run dev           # Start with file watching
npm test              # Run test suite
npm run test:watch    # Run tests in watch mode
```

### Production Deployment
- **Process Management**: PM2 or similar process manager
- **Reverse Proxy**: Nginx for static file serving
- **HTTPS**: TLS termination at proxy level
- **Monitoring**: Health check endpoints for monitoring

## Extensibility

### Plugin Architecture
The design supports future plugin extensions:
- **Custom Tools**: Additional tool implementations
- **UI Themes**: Customizable interface themes
- **Protocol Extensions**: Support for protocol variations
- **Monitoring Plugins**: Custom monitoring capabilities

### Integration Points
- **MCP Server Discovery**: Automatic server detection
- **Authentication**: Pluggable auth mechanisms
- **Storage Backends**: Alternative context storage
- **Event Handlers**: Custom event processing

## Monitoring and Observability

### Logging
- **Structured Logging**: JSON format for parsing
- **Log Levels**: Configurable verbosity
- **Context Enrichment**: Request tracing
- **Error Aggregation**: Centralized error tracking

### Metrics
- **Connection Metrics**: Active connections, reconnections
- **Performance Metrics**: Response times, throughput
- **Error Metrics**: Error rates, failure patterns
- **Usage Metrics**: Tool usage, session duration

### Health Checks
- **Liveness**: Server responsiveness
- **Readiness**: MCP connectivity
- **Dependencies**: External service health

## Future Enhancements

### Planned Features
1. **Multi-Server Support**: Connect to multiple MCP servers
2. **Session Persistence**: Save and restore debug sessions
3. **Tool History**: Command history and replay
4. **Visual Workflow**: Graphical tool execution flows
5. **Real-time Collaboration**: Multi-user debugging sessions

### Technical Improvements
1. **Performance Optimization**: Message compression, caching
2. **Enhanced Security**: Authentication, authorization
3. **Monitoring Dashboard**: Built-in analytics
4. **Plugin System**: Extensible architecture
5. **Mobile Support**: Responsive mobile interface

## Dependencies

### Runtime Dependencies
- **express**: Web server framework
- **ws**: WebSocket implementation
- **winston**: Logging framework
- **dotenv**: Environment variable loading
- **cors**: Cross-origin resource sharing

### Development Dependencies
- **jest**: Testing framework
- **eslint**: Code linting
- **prettier**: Code formatting
- **supertest**: HTTP testing
- **@jest/globals**: Jest ES modules support

## Conclusion

The Aiur Debug UI provides a comprehensive, standalone debugging interface for MCP servers with a focus on real-time interaction, robust error handling, and developer productivity. The architecture supports current debugging needs while providing extensibility for future enhancements.

The separation into its own package enables independent development, deployment, and scaling while maintaining clean integration with the broader Legion ecosystem.