# @legion/aiur-mcp-bridge

stdio MCP (Model Context Protocol) bridge for connecting to Aiur WebSocket server.

## Overview

This package provides a bridge between MCP clients (like Claude) and the Aiur WebSocket server. It translates between the MCP protocol over stdio and Aiur's WebSocket protocol, allowing AI agents to access Aiur's module discovery and tool loading capabilities through the standard MCP interface.

## Installation

```bash
npm install @legion/aiur-mcp-bridge
```

## Usage

### As a Command-Line Tool

```bash
# Start the MCP bridge (will auto-launch Aiur server if not running)
aiur-mcp

# Connect to existing Aiur server
AIUR_AUTO_LAUNCH_SERVER=false aiur-mcp

# Use custom server host/port
AIUR_SERVER_HOST=192.168.1.100 AIUR_SERVER_PORT=9090 aiur-mcp
```

### Programmatic Usage

```javascript
import { spawn } from 'child_process';

// Spawn the MCP bridge
const mcpBridge = spawn('aiur-mcp', [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    AIUR_SERVER_HOST: 'localhost',
    AIUR_SERVER_PORT: '8080'
  }
});

// Send MCP requests via stdio
mcpBridge.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  method: 'tools/list',
  id: 1
}) + '\n');

// Read MCP responses
mcpBridge.stdout.on('data', (data) => {
  const response = JSON.parse(data.toString());
  console.log('MCP Response:', response);
});
```

## Environment Variables

- `AIUR_SERVER_HOST` - Aiur server host (default: localhost)
- `AIUR_SERVER_PORT` - Aiur server port (default: 8080)
- `AIUR_AUTO_LAUNCH_SERVER` - Auto-launch server if not running (default: true)
- `AIUR_SERVER_INDEPENDENT` - Keep server running after bridge exits (default: true)
- `AIUR_STOP_SERVER_ON_EXIT` - Stop server when bridge exits (default: false)
- `AIUR_ENABLE_FILE_LOGGING` - Enable file logging (default: true)
- `AIUR_LOG_DIRECTORY` - Log file directory (default: ./logs)

## Architecture

```
┌─────────────────┐     stdio      ┌──────────────────┐     WebSocket    ┌─────────────────┐
│   MCP Client    │ ◄────────────► │  MCP Bridge      │ ◄──────────────► │  Aiur Server    │
│   (Claude)      │     JSON-RPC   │  (this package)  │    Custom Proto  │  (port 8080)    │
└─────────────────┘                └──────────────────┘                   └─────────────────┘
```

## Features

- **Auto-launch**: Automatically detects and launches Aiur server if not running
- **Protocol Translation**: Seamless conversion between MCP and Aiur protocols
- **Session Management**: Maintains persistent sessions with the Aiur server
- **Reconnection**: Automatic reconnection with exponential backoff
- **Logging**: File-based logging for debugging (stdio is reserved for MCP)

## License

MIT