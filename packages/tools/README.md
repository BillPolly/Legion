# @legion/tools-registry - Tool Registry and Management Infrastructure

Tool registry and management infrastructure for Legion AI agents. Provides comprehensive tool discovery, execution, and management capabilities with advanced semantic search and MongoDB integration.

## Features

### 🔍 **Intelligent Tool Discovery**
- **Semantic Search**: Find tools using natural language descriptions
- **MCP Integration**: Search across thousands of MCP servers and tools
- **Auto-Suggestions**: Get installation recommendations for missing capabilities
- **Multi-Source Discovery**: NPM, GitHub, and manual server registry

### ⚡ **Automated MCP Server Management**
- **One-Click Installation**: Install servers from NPM or GitHub
- **Process Management**: Start, stop, restart, and monitor server health
- **Configuration Management**: Template-based configuration with environment variables
- **Health Monitoring**: Continuous health checks with automatic remediation

### 🛠 **Advanced Tool Registry**
- **Unified Interface**: Access Legion and MCP tools through single registry
- **Smart Recommendations**: Context-aware tool suggestions
- **Usage Analytics**: Track tool usage patterns and performance
- **Load Balancing**: Distribute tool execution across multiple servers

### 🎯 **Developer Experience**
- **CLI Management**: Comprehensive command-line interface
- **Interactive Configuration**: Guided setup for MCP servers
- **Rich Observability**: Detailed logging and tracing
- **Zero-Config Integration**: Works out of the box with Legion framework

## Quick Start

### Installation

```bash
# Install the tools package
npm install @legion/tools-registry

# Make CLI available globally
npm link @legion/tools-registry
```

### Basic Usage

```javascript
import { MCPServerManager, ToolRegistry, SemanticToolDiscovery } from '@legion/tools-registry';

// Initialize MCP integration
const serverManager = new MCPServerManager();
await serverManager.initialize();

// Enhanced tool registry with MCP support
const toolRegistry = new ToolRegistry({
  enableMCPIntegration: true,
  mcpServerRegistry: serverManager.registry
});

// Semantic tool discovery with auto-install suggestions
const toolDiscovery = new SemanticToolDiscovery({
  toolRegistry,
  mcpServerRegistry: serverManager.registry,
  mcpPackageManager: serverManager.packageManager
});

// Find tools for a task
const results = await toolDiscovery.findRelevantTools("analyze git repository");
console.log('Available tools:', results.tools);
console.log('Install suggestions:', results.suggestions);
```

### CLI Usage

```bash
# Search for available MCP servers
legion-mcp search "filesystem"

# Install a server
legion-mcp install @modelcontextprotocol/server-filesystem

# Start the server
legion-mcp start filesystem

# List available tools
legion-mcp tools

# Execute a tool
legion-mcp exec read_file '{"path": "/path/to/file.txt"}'

# Check system status
legion-mcp status
```

## CLI Commands

### Discovery Commands
- `legion-mcp search <query>` - Search for MCP servers
- `legion-mcp list` - List installed servers  
- `legion-mcp info <serverId>` - Show server details

### Management Commands
- `legion-mcp install <serverId>` - Install MCP server
- `legion-mcp uninstall <serverId>` - Uninstall server
- `legion-mcp start <serverId>` - Start server
- `legion-mcp stop <serverId>` - Stop server
- `legion-mcp restart <serverId>` - Restart server

### Monitoring Commands
- `legion-mcp status` - System status overview
- `legion-mcp health [serverId]` - Check server health
- `legion-mcp tools [serverId]` - List available tools

### Tool Execution
- `legion-mcp exec <toolName> [args]` - Execute tool
- `legion-mcp configure <serverId>` - Configure server
- `legion-mcp config [serverId]` - Show configuration

## License

MIT License - see LICENSE file for details.