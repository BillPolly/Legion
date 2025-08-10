# MCP FullStack Monitor

A Model Context Protocol (MCP) server that provides comprehensive full-stack monitoring capabilities for AI agents. This server enables AI agents to monitor, debug, and analyze both backend processes and frontend browser applications in real-time.

## Overview

The MCP FullStack Monitor server exposes 12 tools via the MCP protocol, allowing AI agents to:

- Start and stop full-stack monitoring sessions
- Execute automated debugging scenarios
- Search and analyze logs from both backend and frontend
- Track request correlations across the entire system
- Perform error analysis with intelligent recommendations
- Take screenshots and debug browser interactions

## Architecture

```
AI Agent (Claude, etc.)
    ↓ MCP Protocol (JSON-RPC over stdio)
MCP Server
    ├── SessionManager (manages monitoring instances)
    ├── ToolHandler (routes and formats tool calls)
    └── Tool Modules
        ├── MonitoringTools (start/stop monitoring)
        ├── DebugTools (scenarios, screenshots)
        └── AnalysisTools (log search, error analysis)
```

## Available Tools

### Monitoring Tools (4)
- **`start_fullstack_monitoring`** - Start monitoring backend + frontend
- **`stop_monitoring`** - Clean up monitoring session
- **`get_monitoring_stats`** - Get session statistics
- **`list_sessions`** - List all active sessions

### Debug Tools (3)
- **`execute_debug_scenario`** - Run multi-step debugging scenarios
- **`debug_user_flow`** - Debug from natural language description
- **`take_screenshot`** - Capture page screenshots

### Analysis Tools (5)
- **`search_logs`** - Search backend and frontend logs
- **`get_correlations`** - Get logs by correlation ID
- **`analyze_error`** - Deep analysis of specific errors
- **`get_recent_errors`** - Get recent errors with grouping
- **`trace_request`** - Trace requests through the system

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd packages/mcps/fullstack-monitor

# Install dependencies (none required - standalone)
npm install

# Make executable
chmod +x mcp-server.js
```

## Usage

### Starting the MCP Server

```bash
# Direct execution
node mcp-server.js

# Or via npm
npm start
```

The server communicates over stdio using JSON-RPC 2.0 protocol.

### Example Tool Usage

#### Start Monitoring
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "start_fullstack_monitoring",
    "arguments": {
      "backend_script": "./server.js",
      "backend_name": "my-api",
      "backend_port": 3001,
      "frontend_url": "http://localhost:3000",
      "headless": true,
      "session_id": "debug-session-1"
    }
  }
}
```

#### Execute Debug Scenario
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "execute_debug_scenario",
    "arguments": {
      "steps": [
        { "action": "screenshot" },
        { "action": "click", "selector": "#login-btn" },
        { "action": "type", "selector": "#username", "text": "test@example.com" },
        { "action": "click", "selector": "#submit" }
      ],
      "session_id": "debug-session-1"
    }
  }
}
```

#### Search Logs
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_logs",
    "arguments": {
      "query": "error",
      "mode": "keyword",
      "source": "all",
      "limit": 50,
      "session_id": "debug-session-1"
    }
  }
}
```

## Testing

The MCP server includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Test server startup
npm run test:server
```

**Test Coverage:**
- **36 total tests** across 4 test suites
- **Unit Tests**: StandaloneSessionManager (13 tests), ToolHandler (14 tests)
- **Integration Tests**: Full workflow (7 tests), End-to-end MCP protocol (2 tests)

## Key Features

### 1. Session Management
- Supports multiple concurrent monitoring sessions
- Automatic session limits and cleanup
- Session timeout handling
- Resource leak prevention

### 2. Real-time Monitoring
- Backend process monitoring with stdout/stderr capture
- Frontend browser automation and event capture
- Cross-system correlation ID tracking
- Real-time log streaming and analysis

### 3. Intelligent Analysis
- Error pattern recognition and grouping
- Performance bottleneck identification
- Request flow tracing across frontend and backend
- Automated recommendations for issue resolution

### 4. Rich Response Formatting
- Markdown-formatted responses with emojis and structure
- Context-aware error messages and suggestions
- Detailed debug scenario results with step-by-step analysis
- Comprehensive statistics and monitoring insights

## Error Handling

The server includes robust error handling:

- **Tool Validation**: Schema validation for all tool parameters
- **Session Recovery**: Graceful handling of failed monitoring sessions
- **Resource Cleanup**: Automatic cleanup on errors and timeouts
- **Protocol Compliance**: Full JSON-RPC 2.0 error response formatting

## Development

### Project Structure
```
mcp-server.js                 # Main MCP server implementation
handlers/
  ├── StandaloneSessionManager.js  # Session and monitor management
  └── ToolHandler.js               # Tool routing and formatting
tools/
  ├── MonitoringTools.js           # Core monitoring operations
  ├── DebugTools.js                # Debug scenarios and screenshots
  └── AnalysisTools.js             # Log analysis and correlation
__tests__/
  ├── unit/                        # Unit tests for components
  └── integration/                 # End-to-end workflow tests
```

### Dependencies
- **Zero Dependencies**: Fully standalone implementation
- **Node.js**: Requires Node.js 18+ for ES modules
- **Mock Implementation**: Uses mock monitors for testing without Legion dependencies

### Contributing

1. All changes must include tests
2. Maintain 100% test pass rate
3. Follow existing code patterns and naming conventions
4. Update documentation for API changes

## Protocol Compliance

This server implements MCP Protocol version 2024-11-05:

- **Transport**: JSON-RPC 2.0 over stdio
- **Methods**: `initialize`, `tools/list`, `tools/call`, `notifications/initialized`
- **Capabilities**: Tools execution with schema validation
- **Error Codes**: Standard JSON-RPC error codes (-32600 to -32603)

## Integration with AI Agents

This MCP server is designed to work seamlessly with AI agents like Claude:

1. **Agent starts MCP server** as a subprocess
2. **Handshake** via initialize/tools-list protocol
3. **Tool execution** for monitoring and debugging tasks
4. **Rich responses** provide actionable insights to the agent
5. **Session cleanup** when agent completes tasks

The server provides everything needed for an AI agent to become a full-stack debugging expert, with the ability to monitor applications, identify issues, and provide detailed analysis and recommendations.

## License

Part of the Legion AI Agent Framework - see main repository for license information.