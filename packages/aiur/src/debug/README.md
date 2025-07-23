# Aiur Web Debug Interface

A comprehensive web-based debugging interface for the Aiur MCP server, providing real-time monitoring, tool execution, and context management through an intuitive browser interface.

## 🚀 Quick Start

### 1. Start the Debug Interface

Using Claude Code CLI:
```bash
web_debug_start {"openBrowser": true}
```

Or via MCP protocol:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "web_debug_start",
    "arguments": {"port": 3001, "openBrowser": true}
  }
}
```

### 2. Access the Web Interface

Open your browser to `http://localhost:3001` to access:

- **🛠️ Command Panel**: Execute MCP tools interactively
- **📋 Context Browser**: View and manage context data
- **📡 Event Stream**: Real-time server events
- **📊 System Status**: Server health and metrics
- **📝 Log Viewer**: Debug logs and traces

### 3. Execute Your First Tool

1. In the Command Panel, enter: `context_list`
2. Click **Execute** to see all available context data
3. Watch the Event Stream for real-time execution feedback

## ✨ Features

### WebSocket-Only Architecture
- **Pure WebSocket Communication**: All tool execution via WebSocket, HTTP only serves static files
- **Real-time Updates**: Live event streaming and status updates
- **Auto-reconnection**: Robust connection handling with automatic reconnection

### Comprehensive Tool Support
- **All MCP Tools**: Execute any tool available in the Aiur server
- **Parameter Resolution**: Automatic `@contextName` reference resolution
- **Auto-save**: Save tool results to context with `saveAs` parameter
- **Tool Suggestions**: Smart autocomplete for tool names and parameters

### Advanced Context Management
- **Full CRUD Operations**: Create, read, update, delete context data
- **Search and Filter**: Quickly find context items by name or content
- **Real-time Updates**: See context changes as they happen
- **Reference System**: Use `@contextName` syntax for parameter resolution

### Real-time Monitoring
- **Event Streaming**: Live events from the MCP server
- **Performance Metrics**: Tool execution times and system health
- **Connection Monitoring**: Track connected clients and server status
- **Error Tracking**: Detailed error reporting and debugging info

### Developer Experience
- **Interactive Interface**: Point-and-click tool execution
- **JSON Formatting**: Auto-format JSON parameters and responses
- **Toast Notifications**: Non-intrusive success/error feedback
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

### Components

```
┌─────────────────┐    WebSocket     ┌──────────────────┐
│   Web Browser   │ ◄──────────────► │  WebDebugServer  │
│  (Client UI)    │                  │                  │
└─────────────────┘                  └────────┬─────────┘
                                              │
                                              │ MCP Tools
                                              ▼
                              ┌──────────────────────────┐
                              │ Aiur MCP Server          │
                              │ ┌─────────────────────┐  │
                              │ │ ToolDefinitionProvider │  │
                              │ │ ContextManager      │  │
                              │ │ ModuleLoader        │  │
                              │ │ HandleResolver      │  │
                              │ └─────────────────────┘  │
                              └──────────────────────────┘
```

### Key Classes

- **WebDebugServer**: HTTP/WebSocket server with MCP integration
- **DebugTool**: MCP tool interface (`web_debug_start`, `web_debug_stop`, `web_debug_status`)
- **DebugInterface**: Client-side JavaScript for WebSocket communication

### Integration Points

- **ToolDefinitionProvider**: Debug tools registered alongside context and module tools
- **ResourceManager**: Dependency injection following Async Resource Manager pattern
- **ContextManager**: Automatic context storage for server information
- **MonitoringSystem**: Real-time event forwarding to web clients

## 📚 Documentation

- **[API Documentation](docs/API.md)**: Complete API reference and WebSocket protocol
- **[Usage Examples](docs/examples.md)**: Detailed examples and workflows
- **[Design Document](docs/web-debug-interface.md)**: Architecture and design decisions
- **[Implementation Plan](docs/implementation-plan.md)**: Development progress and testing

## 🔧 Configuration

### Server Options

```javascript
await debugServer.start({
  port: 3001,           // Preferred port (auto-fallback)
  host: 'localhost',    // Bind address
  openBrowser: true     // Auto-open browser
});
```

### Port Ranges

The server automatically tries these port ranges:
1. **Primary**: `port` to `port + 99` (e.g., 3001-3100)
2. **Fallback 1**: 8000-8099
3. **Fallback 2**: 9000-9099

### Environment Variables

- `NODE_ENV=test`: Reduces console logging in test environments
- `DEBUG=aiur:*`: Enable debug logging (if using debug module)

## 🧪 Testing

The debug interface has comprehensive test coverage:

### Test Suites

- **Unit Tests**: Individual component testing
- **Integration Tests**: Aiur MCP server integration (17/19 passing)
- **Browser Tests**: End-to-end UI testing with Puppeteer
- **System Tests**: Complete workflow and edge case testing

### Running Tests

```bash
# All debug interface tests
npm test -- src/debug

# Specific test suites
npm test -- src/debug/__tests__/unit
npm test -- src/debug/__tests__/integration
npm test -- src/debug/__tests__/system

# Integration tests only
npm test -- src/debug/__tests__/integration/AiurServerIntegration.test.js
```

### Test Coverage

- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: 89% success rate (17/19 tests passing)
- **Browser Tests**: Complete UI workflow coverage
- **Edge Cases**: Malformed messages, network failures, resource exhaustion

## 🔒 Security Considerations

⚠️ **Development Use Only**: The debug interface is intended for development and debugging.

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

## 📈 Performance

### Resource Usage

- **Memory**: ~10-20MB baseline, scales with clients and context
- **CPU**: Low impact, spikes during tool execution
- **Network**: Persistent WebSocket connections, minimal HTTP traffic

### Scalability

- **Concurrent Clients**: Tested with 20+ simultaneous connections
- **Tool Execution**: No artificial limits, queue-based processing
- **Event Broadcasting**: Efficient real-time distribution to all clients
- **Context Data**: Handles large context items (10KB+ per item tested)

### Monitoring

Built-in performance monitoring includes:
- Client connection/disconnection tracking
- Tool execution timing and success rates
- Memory usage and system health metrics
- Event broadcasting performance

## 🐛 Troubleshooting

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

## 🛠️ Development

### Project Structure

```
src/debug/
├── README.md                 # This file
├── WebDebugServer.js         # Main server implementation
├── DebugTool.js             # MCP tool interface
├── web/                     # Client-side files
│   ├── index.html           # Web interface
│   ├── script.js            # Client JavaScript
│   └── style.css            # Interface styling
├── docs/                    # Documentation
│   ├── API.md               # API reference
│   ├── examples.md          # Usage examples
│   ├── web-debug-interface.md  # Design document
│   └── implementation-plan.md  # Development plan
└── __tests__/               # Test suites
    ├── unit/                # Unit tests
    ├── integration/         # Integration tests
    ├── browser/             # Browser tests
    ├── system/              # System tests
    └── fixtures/            # Test utilities
```

### Adding New Features

1. **Update Design**: Modify `docs/web-debug-interface.md`
2. **Write Tests**: Create tests in appropriate `__tests__/` directory
3. **Implement**: Add functionality following existing patterns
4. **Update Docs**: Update API documentation and examples
5. **Test Integration**: Verify Aiur MCP server integration

### Contributing

- Follow existing code patterns and style
- Maintain test coverage above 90%
- Update documentation for any API changes
- Test with multiple browser types
- Verify integration with Aiur MCP server

## 📄 License

This project is part of the Legion framework and follows the same licensing terms.

## 🙏 Acknowledgments

Built as part of the Legion AI agent framework, integrating with:
- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol/specification)
- [Legion Framework](../../../README.md)
- WebSocket and HTTP standards

---

**Ready to debug?** Start with `web_debug_start {"openBrowser": true}` and explore the powerful debugging capabilities! 🚀