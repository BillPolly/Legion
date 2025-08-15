# Aiur MCP Server

Aiur is an advanced MCP (Model Context Protocol) server that provides AI agents with persistent memory, context management, and intelligent tool orchestration capabilities.

## Quick Start

```bash
# Install dependencies
npm install

# Start the MCP server (auto-launches backend)
npm start

# Or start in quiet mode
npm run start:quiet
```

## Architecture

Aiur uses a client-server architecture with automatic backend management:

```
AI Agent ↔ MCP Protocol ↔ Aiur Client ↔ WebSocket ↔ Aiur Backend
              (stdio)      (index.js)               (server/index.js)
```

- **Automatic Launch**: Backend server starts automatically when needed
- **Session Isolation**: Each client gets an isolated session
- **Persistent State**: Context and handles persist across tool calls
- **Format Conversion**: Clean separation between MCP and Legion formats

## Core Features

### 🧠 Context Management
Store and retrieve data across tool calls using the `@contextName` syntax:

```json
// Save data
{"tool": "context_add", "args": {"name": "config", "data": {"api": "https://example.com"}}}

// Reference it later
{"tool": "api_call", "args": {"config": "@config"}}
```

### 📋 Planning System
Create and execute multi-step plans with automatic dependency resolution:

```json
{"tool": "plan_create", "args": {
  "description": "Deploy application",
  "allowableActions": [...],
  "saveAs": "deploy_plan"
}}

{"tool": "plan_execute", "args": {"plan": "@deploy_plan"}}
```

### 🔧 Dynamic Tool Loading
Load Legion modules dynamically to extend capabilities:
- File operations
- GitHub integration
- Custom modules via `AIUR_MODULES` environment variable

### 🐛 Debug Interface
Web-based debugging and monitoring:

```json
{"tool": "web_debug_start", "args": {"port": 3000, "openBrowser": true}}
```

## Running Modes

### Default: Auto-Launch Mode
```bash
npm start  # Detects and launches backend automatically
```

### Standalone Backend
```bash
# Terminal 1: Start backend
npm run start:server

# Terminal 2: Connect MCP client
npm start
```

### Development Mode
```bash
# With verbose logging
AIUR_VERBOSE=true npm start

# Stop server on exit
AIUR_STOP_SERVER_ON_EXIT=true npm start
```

## Configuration

Environment variables for customization:

```bash
# Server settings
AIUR_SERVER_HOST=localhost
AIUR_SERVER_PORT=8080
AIUR_SESSION_TIMEOUT=3600000

# Auto-launch behavior
AIUR_AUTO_LAUNCH_SERVER=true
AIUR_SERVER_INDEPENDENT=true

# Logging
AIUR_ENABLE_FILE_LOGGING=true
AIUR_LOG_DIRECTORY=./logs

# Modules to load
AIUR_MODULES=@legion/tools-registry/file,@legion/tools-registry/github
```

## Available Tools

### Context Management
- `context_add` - Store data for later reference
- `context_get` - Retrieve stored data
- `context_list` - List all stored context

### Planning
- `plan_create` - Create execution plans
- `plan_execute` - Execute plans with monitoring
- `plan_status` - Check execution status
- `plan_debug` - Interactive debugging

### Debug & Monitoring
- `web_debug_start` - Launch web interface
- `web_debug_status` - Check debug server
- `read_logs` - Read system logs

### File Operations
- `file_read` - Read file contents
- `file_write` - Write to files
- `directory_list` - List directory contents
- `directory_create` - Create directories

## Testing

```bash
# Run all tests
npm test

# Specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
npm run test:auto-server # Auto-launch tests
```

## Documentation

- [Design Document](docs/DESIGN.md) - Complete architecture and feature details
- [Client-Server Architecture](docs/CLIENT_SERVER_ARCHITECTURE.md) - Technical implementation
- [MCP Protocol](docs/MCP_STDIO_PROTOCOL.md) - Protocol compliance details
- [Error Handling](docs/ERROR_HANDLING.md) - Error management system
- [Testing Guide](TESTING_GUIDE.md) - Comprehensive testing documentation

## Development

### Project Structure
```
aiur/
├── src/
│   ├── index.js           # MCP stdio server (client)
│   ├── server/           # Backend server
│   │   ├── index.js      # Server entry point
│   │   ├── AiurServer.js # Main server class
│   │   └── ...
│   ├── client/           # Client components
│   │   ├── ServerManager.js
│   │   ├── WebSocketClient.js
│   │   └── ...
│   └── core/             # Core functionality
│       ├── ContextManager.js
│       ├── ToolDefinitionProvider.js
│       └── ...
├── docs/                 # Documentation
└── __tests__/           # Test suites
```

### Adding New Tools

1. Create a Legion module with your tools
2. Add to `AIUR_MODULES` environment variable
3. Tools automatically available in Aiur

## License

Part of the Legion framework.