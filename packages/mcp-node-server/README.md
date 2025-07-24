# MCP Node Server

A simple Node.js MCP (Model Context Protocol) server with SSE (Server-Sent Events) transport.

## Features

- SSE transport for real-time communication
- Two example tools:
  - `greet` - Greets a user by name
  - `calculate` - Performs basic arithmetic operations
- Express.js-based HTTP server
- Health check endpoint

## Installation

```bash
npm install
```

## Usage

### Start the server

```bash
# Start normally (stays running)
npm start

# Start in background (daemon mode)
npm run start:daemon

# Start with auto-reload for development
npm run dev

# Stop the server
npm run stop
# or press Ctrl+C if running in foreground
```

The server will start on port 8355 (or the PORT environment variable).

**Note**: When you run `npm start`, the server stays running and doesn't return to the command prompt. This is normal! The server is waiting for connections. Press Ctrl+C to stop it.

### Endpoints

- `GET /sse` - SSE connection endpoint for MCP clients
- `POST /messages` - Message handling endpoint
- `GET /health` - Health check endpoint

### Example Tools

#### Greet Tool
```json
{
  "name": "greet",
  "arguments": {
    "name": "World"
  }
}
```

#### Calculate Tool
```json
{
  "name": "calculate", 
  "arguments": {
    "operation": "add",
    "a": 5,
    "b": 3
  }
}
```

Operations supported: `add`, `subtract`, `multiply`, `divide`

## Environment Variables

- `PORT` - Server port (default: 8355)

## MCP Client Configuration

### Claude Desktop Configuration

To use this server with Claude Desktop, add the following to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "node-mcp-server": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-node-server/index.js"],
      "env": {
        "PORT": "8355"
      }
    }
  }
}
```

### Manual SSE Client Connection

To connect an MCP client to this server, use the SSE transport with:
- URL: `http://localhost:8355/sse`
- Messages endpoint: `http://localhost:8355/messages`

## Testing

Run the test client to verify the server is working:

```bash
# Start the server in one terminal
npm start

# In another terminal, run the test
npm test
```

## Implementation Notes

This server uses:
- **SSE (Server-Sent Events)** for real-time server-to-client communication
- **Express.js** for HTTP server functionality
- **Zod** for schema validation
- **@modelcontextprotocol/sdk** for MCP protocol implementation

The SSE transport is ideal for scenarios where:
- You need real-time updates from the server
- WebSocket infrastructure is not available
- You want a simpler HTTP-based transport

## Extending the Server

To add new tools, use the `server.tool()` method:

```javascript
server.tool("myTool", {
  // Zod schema for parameters
  param1: z.string(),
  param2: z.number().optional(),
}, async ({ param1, param2 }) => {
  // Tool implementation
  return {
    content: [{
      type: "text",
      text: `Result: ${param1}`
    }]
  };
});
```