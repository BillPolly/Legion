# MCP FullStack Monitor

A Model Context Protocol (MCP) server that provides comprehensive monitoring for Node.js and TypeScript applications with browser automation capabilities. This server enables AI agents to start, monitor, and debug full-stack applications with automatic Sidewinder instrumentation.

## Overview

The MCP FullStack Monitor provides **9 focused tools** via the MCP protocol, allowing AI agents to:

- ✅ **Start Node.js or TypeScript servers** with automatic monitoring injection
- ✅ **Support package.json scripts** or direct script execution
- ✅ **Open and control browser sessions** for frontend monitoring
- ✅ **Execute Puppeteer commands directly** for complete browser automation
- ✅ **Query logs with correlation tracking** across backend and frontend
- ✅ **Take screenshots and record video** for debugging
- ✅ **Manage multiple monitoring sessions** simultaneously

## Key Features

### 🚀 Universal Server Support
- **Node.js servers**: Direct script execution with `--require` Sidewinder injection
- **TypeScript servers**: Automatic detection and `NODE_OPTIONS` injection for ts-node/tsx
- **Package.json scripts**: Run any npm script (start, dev, test, etc.) with monitoring
- **Flexible parameters**: Support script path OR package.json directory + script name

### 🔍 Advanced Monitoring
- **Sidewinder instrumentation**: Automatic request correlation and performance tracking
- **Real-time log capture**: All stdout/stderr with timestamps and correlation IDs
- **Browser automation**: Puppeteer-based frontend monitoring with screenshots/video
- **Multi-session support**: Run multiple applications simultaneously with isolated sessions

### 🛠️ AI-Agent Optimized
- **MCP Protocol compliance**: Full JSON-RPC 2.0 implementation
- **Rich error handling**: Descriptive error messages with troubleshooting hints
- **Flexible workflows**: Works with direct scripts, npm scripts, or complex setups
- **Resource management**: Automatic cleanup and session isolation

## Available Tools

### 1. `start_server` - Launch Application Server
Start any Node.js or TypeScript server with automatic Sidewinder monitoring injection.

**Options:**
- **Direct script**: `{ "script": "./server.js" }`
- **Package.json script**: `{ "package_path": "./", "start_script": "dev" }`
- **TypeScript support**: Automatically detects .ts files and uses appropriate loader
- **Environment variables**: `{ "env": { "NODE_ENV": "development" } }`
- **Port waiting**: `{ "wait_for_port": 3000 }` - waits for server to be ready

**Examples:**
```json
// Start Node.js server directly
{
  "script": "./src/server.js",
  "wait_for_port": 3000,
  "session_id": "backend-session",
  "log_level": "info"
}

// Start via package.json script
{
  "package_path": "./backend",
  "start_script": "dev",
  "wait_for_port": 8080,
  "session_id": "api-server"
}

// Start TypeScript server
{
  "script": "./src/app.ts",
  "wait_for_port": 4000,
  "env": { "NODE_ENV": "development" }
}
```

### 2. `open_page` - Browser Automation
Open a browser page for frontend monitoring and interaction.

```json
{
  "url": "http://localhost:3000",
  "session_id": "backend-session",
  "headless": false,
  "viewport": { "width": 1280, "height": 720 }
}
```

### 3. `browser_execute` - Direct Puppeteer Control
Execute Puppeteer page commands directly for complete browser automation control.

**Supported Commands:**
- **Navigation**: `goto`, `reload`, `goBack`, `goForward`
- **Interaction**: `click`, `type`, `select`, `focus`, `hover`
- **Evaluation**: `evaluate`, `evaluateHandle`, `title`, `url`, `content`
- **Waiting**: `waitForSelector`, `waitForNavigation`, `waitForTimeout`
- **Screenshots**: `screenshot`, `pdf`
- **And many more**: See [Puppeteer Page API](https://pptr.dev/api/puppeteer.page)

**Examples:**
```json
// Click a button
{
  "command": "click",
  "args": ["#submit-button"],
  "session_id": "backend-session"
}

// Type into an input field
{
  "command": "type",
  "args": ["#email-input", "user@example.com"],
  "session_id": "backend-session"
}

// Navigate to a URL
{
  "command": "goto",
  "args": ["https://example.com", {"waitUntil": "networkidle2"}],
  "session_id": "backend-session"
}

// Evaluate JavaScript on the page
{
  "command": "evaluate",
  "args": ["() => document.title"],
  "session_id": "backend-session"
}

// Wait for an element
{
  "command": "waitForSelector",
  "args": [".loading-complete", {"timeout": 10000}],
  "session_id": "backend-session"
}

// Take a screenshot
{
  "command": "screenshot",
  "args": [{"path": "page.png", "fullPage": true}],
  "session_id": "backend-session"
}
```

### 4. `query_logs` - Search Application Logs
Query logs with filtering and correlation tracking.

```json
{
  "query": "error",
  "limit": 50,
  "last": "5m",
  "level": "error",
  "session_id": "backend-session",
  "include_system": true
}
```

### 5. `take_screenshot` - Capture Page Screenshots
Take screenshots for debugging or documentation.

```json
{
  "path": "./debug-screenshot.png",
  "fullPage": true,
  "session_id": "backend-session"
}
```

### 6. `record_video` - Record Browser Interactions
Record video of browser interactions for debugging.

```json
{
  "action": "start",
  "path": "./debug-recording.mp4",
  "duration": 60,
  "session_id": "backend-session"
}
```

### 7. `set_log_level` - Adjust Logging Verbosity
```json
{
  "level": "debug",
  "session_id": "backend-session"
}
```

### 8. `list_sessions` - Show Active Sessions
```json
{}
```

### 9. `stop_app` - Clean Shutdown
```json
{
  "session_id": "backend-session"
}
```

## Installation

```bash
# Clone and navigate to the package
cd packages/mcps/mcp-monitor

# Install dependencies
npm install

# Make executable (optional)
chmod +x mcp-server.js
```

## Usage

### As MCP Server (Recommended)
```bash
# Start MCP server (communicates over stdio)
node mcp-server.js

# The server will wait for MCP initialization handshake
# and respond to tool calls via JSON-RPC 2.0
```

### For Testing/Development
```bash
# Run comprehensive tests
npm test

# Test individual components
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests

# Demo MCP client
npm run demo
```

## Common Workflows

### 1. Monitor Node.js Application
```json
// 1. Start server with monitoring
{
  "name": "start_server",
  "arguments": {
    "script": "./app.js",
    "wait_for_port": 3000,
    "session_id": "my-app",
    "log_level": "info"
  }
}

// 2. Open browser to test
{
  "name": "open_page",
  "arguments": {
    "url": "http://localhost:3000",
    "session_id": "my-app",
    "headless": false
  }
}

// 3. Monitor logs in real-time
{
  "name": "query_logs",
  "arguments": {
    "session_id": "my-app",
    "last": "1m",
    "include_system": true
  }
}
```

### 2. Monitor TypeScript Application
```json
// Automatically detects TypeScript and uses ts-node
{
  "name": "start_server",
  "arguments": {
    "script": "./src/server.ts",
    "wait_for_port": 8080,
    "session_id": "ts-app"
  }
}
```

### 3. Monitor via Package.json Scripts
```json
// Uses existing npm scripts with monitoring injection
{
  "name": "start_server",
  "arguments": {
    "package_path": "./backend",
    "start_script": "dev",
    "wait_for_port": 4000,
    "session_id": "dev-server"
  }
}
```

### 4. Debug Frontend Issues
```json
// 1. Start backend
{ "name": "start_server", "arguments": { "script": "./api.js", "wait_for_port": 3001 } }

// 2. Open frontend
{ "name": "open_page", "arguments": { "url": "http://localhost:3000" } }

// 3. Take screenshot of issue
{ "name": "take_screenshot", "arguments": { "path": "./issue.png", "fullPage": true } }

// 4. Check for errors
{ "name": "query_logs", "arguments": { "level": "error", "last": "5m" } }
```

## Architecture

```
AI Agent (Claude Code, etc.)
    ↓ MCP Protocol (JSON-RPC over stdio)
MCP Server
    ├── EnhancedServerStarter (Node.js/TypeScript process management)
    ├── SessionManager (resource lifecycle)  
    ├── PortManager (port allocation)
    └── SimplifiedTools (9 focused tools)
        ├── start_server (universal app launching)
        ├── open_page (browser automation)
        ├── browser_execute (direct Puppeteer control)
        ├── query_logs (log analysis)
        ├── take_screenshot (debugging)
        ├── record_video (interaction recording)
        ├── set_log_level (runtime configuration)
        ├── list_sessions (session management)  
        └── stop_app (cleanup)
```

## What Makes This Special

### 🎯 **Universal Compatibility**
- Works with **any Node.js or TypeScript** application
- Supports **direct scripts, npm scripts, ts-node, tsx, nodemon**
- **Automatic detection** of project type and tooling
- **No configuration required** - just point and monitor

### ⚡ **Automatic Instrumentation** 
- **Sidewinder injection** happens automatically during startup
- **Zero code changes** required in your application
- **Request correlation tracking** across your entire stack
- **Performance monitoring** with detailed metrics

### 🔧 **AI Agent Optimized**
- **Rich error messages** with actionable suggestions
- **Flexible parameter handling** (script OR package.json)
- **Session isolation** for multiple concurrent projects
- **Clean resource management** with automatic cleanup

### 🚀 **Production Ready**
- **Comprehensive test coverage** (8 test scenarios)
- **Process lifecycle management** with graceful shutdown
- **Port conflict resolution** with automatic allocation
- **Memory leak prevention** with proper resource cleanup

## Testing

The server includes extensive test coverage:

```bash
# Run all tests (recommended)
npm test

# Specific test suites
npm run test:unit                                    # Component tests
npm run test:integration                             # End-to-end workflows

# Individual test files
npx jest __tests__/integration/EnhancedStarterComprehensive.test.js --verbose
```

**Test Coverage:**
- ✅ **8 comprehensive scenarios**: Node.js direct, TypeScript direct, package.json scripts, error handling, multi-server
- ✅ **Sidewinder verification**: Every test confirms monitoring injection works
- ✅ **Correlation tracking**: Request correlation IDs verified in all scenarios  
- ✅ **Resource cleanup**: All sessions properly cleaned up
- ✅ **Error handling**: Missing files, invalid configs, duplicate sessions

## Known Issues

### Browser Launch on macOS

On macOS, Puppeteer's bundled "Chrome for Testing" may fail to launch with a "socket hang up" error. This is due to macOS Gatekeeper blocking the unsigned binary. The tool automatically falls back to using your system's Chrome installation at `/Applications/Google Chrome.app`.

**Why this happens:**
- Puppeteer downloads an unsigned "Chrome for Testing" binary
- macOS Gatekeeper blocks unsigned applications from running programmatically
- The WebSocket connection fails, causing the "socket hang up" error

**Solution (already implemented):**
The tool automatically detects and uses your system's Chrome, Chromium, or Brave browser if available. This provides better compatibility and performance on macOS.

## Error Handling

The server provides helpful error messages with troubleshooting guidance:

```bash
❌ Failed to start server: Script file not found at /path/to/server.js

💡 Troubleshooting:
- Check that the script path is correct
- Ensure the file exists and is readable
- Try using package.json approach instead: {"package_path": "./", "start_script": "start"}
```

## Requirements

- **Node.js 18+** (for ES modules and advanced features)
- **npm or yarn** (if using package.json scripts)
- **TypeScript tooling** (ts-node, tsx) if monitoring TypeScript apps

## Integration with AI Agents

This MCP server is designed for seamless integration with AI coding assistants:

1. **Agent starts** the MCP server process
2. **Handshake** via MCP protocol initialization  
3. **Tool calls** for application monitoring and debugging
4. **Rich responses** provide actionable insights
5. **Session cleanup** when debugging is complete

The server handles all the complexity of process management, monitoring injection, and resource cleanup, allowing AI agents to focus on high-level debugging and analysis tasks.

## License

Part of the Legion AI Agent Framework - MIT License