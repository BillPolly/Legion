# Aiur Debug UI

A standalone web-based debugging interface for MCP (Model Context Protocol) servers.

## Overview

Aiur Debug UI is a web application that provides real-time debugging and monitoring capabilities for any MCP-compliant server. It connects via WebSocket and offers:

- 🔧 Tool discovery and execution
- 📊 Real-time event monitoring
- 🗂️ Context management
- 📝 Session tracking
- 🚨 Error tracking and logging
- 📈 Performance metrics

## Quick Start

```bash
# Install dependencies
npm install

# Start the debug UI server
npm start

# Or run in development mode
npm run dev
```

The debug UI will be available at http://localhost:3001

## Configuration

Configure via environment variables or `config.json`:

```bash
# Server Configuration
DEBUG_UI_PORT=3001              # Port for debug UI server
DEBUG_UI_HOST=localhost         # Host to bind to

# MCP Server Connection
MCP_SERVER_URL=ws://localhost:8080/ws  # Default MCP server URL
MCP_SERVER_TIMEOUT=30000               # Connection timeout

# UI Configuration
UI_THEME=dark                   # UI theme (dark/light)
UI_AUTO_CONNECT=true            # Auto-connect on load
```

## Architecture

The debug UI consists of three main components:

1. **Express Server** - Serves static files and provides configuration API
2. **WebSocket Proxy** - Connects to MCP servers and forwards messages
3. **Web UI** - Interactive debugging interface

```
Browser <-> Debug UI Server <-> MCP Server
         (WebSocket Proxy)
```

## Features

### Tool Execution
- Browse available tools with descriptions
- View input schemas
- Execute tools with JSON arguments
- See real-time results

### Session Management
- List active sessions
- Switch between sessions
- View session-specific context
- Track session metrics

### Event Monitoring
- Real-time event stream
- Filter by event type
- Export event history
- Pause/resume streaming

### Context Browser
- View all context items
- Search and filter
- Inspect context data
- Track context changes

## Development

```bash
# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

## Docker Support

```bash
# Build image
docker build -t aiur-debug-ui .

# Run container
docker run -p 3001:3001 -e MCP_SERVER_URL=ws://host.docker.internal:8080/ws aiur-debug-ui
```

## License

MIT