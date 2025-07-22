# @jsenvoy/aiur

MCP (Model Context Protocol) server for AI agent coordination.

## Features

- MCP server implementation with stdio transport
- WebSocket server for direct testing
- Simple tools: `about` and `hello`

## Usage

### Start the MCP server
```bash
npm start
# or from root
npm run aiur
```

### Run tests
```bash
npm test
# or from root
npm run test:aiur
```

## WebSocket Testing

The server starts a WebSocket server on port 8080 for direct testing. You can connect and send messages like:

```json
{
  "type": "list_tools",
  "id": "123"
}

{
  "type": "call_tool",
  "id": "456",
  "name": "hello",
  "args": {"name": "World"}
}
```

## MCP Integration

This server can be integrated with Claude Code by configuring it as an MCP server in your Claude Code settings.