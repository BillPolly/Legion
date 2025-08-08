# MCP (Model Context Protocol) Integration for Legion

## Overview

The Legion MCP integration provides seamless discovery, installation, and management of Model Context Protocol servers, enabling Legion agents to access thousands of external tools through a standardized interface.

## Architecture

```
Legion Agent Request
        ↓
  SemanticToolDiscovery (Enhanced)
        ↓
┌─────────────────┬─────────────────┐
│   Legion Tools  │   MCP Tools     │
└─────────────────┴─────────────────┘
        ↓
  Combined Results + Installation Suggestions
```

### Core Components

1. **MCPRegistry** - Discovers available MCP servers from NPM, GitHub, and manual sources
2. **MCPPackageManager** - Handles installation/uninstallation of MCP servers
3. **MCPServerManager** - Manages server lifecycle (start/stop/restart)
4. **MCPHealthChecker** - Monitors server health and performs automatic remediation
5. **MCPServerProcess** - Individual server process management
6. **MCPToolProxy** - Legion-compatible interface for MCP tools
7. **MCPToolProvider** - Legion Module implementation for MCP servers
8. **MCPMetadataExtractor** - Extracts and converts MCP metadata to Legion format
9. **Enhanced SemanticToolDiscovery** - Integrated search across Legion and MCP tools
10. **Enhanced ToolRegistry** - MCP-aware tool discovery with auto-install suggestions

## Features

### 🔍 **Intelligent Tool Discovery**
- Semantic search across Legion and MCP tools
- Smart installation suggestions when tools are not found
- Automatic categorization and tagging of MCP tools
- Relevance scoring that considers both Legion and MCP tools

### 📦 **Automated Package Management**
- NPM and Git-based MCP server installation
- Dependency resolution and build management
- Automatic configuration generation
- Uninstall cleanup with dependency tracking

### 🚀 **Server Lifecycle Management**
- Start/stop/restart individual or all servers
- Auto-start capability on system startup
- Process monitoring with automatic restarts
- Graceful shutdown with cleanup

### 🏥 **Health Monitoring & Observability**
- Continuous health checks for all servers
- Automatic remediation (restart unhealthy servers)
- Comprehensive logging and metrics collection
- Integration with Legion's observability system

### 🔧 **Tool Integration**
- Transparent Legion Tool interface for MCP tools
- Automatic input/output format conversion
- Error handling and retry logic
- Event emission for monitoring and debugging

### ⚙️ **Configuration Management**
- JSON Schema-validated configuration
- Environment variable substitution
- Template-based server configurations
- Hot-reload configuration updates

## Quick Start

### Installation

The MCP integration is built into the `@legion/tools` package:

```bash
npm install @legion/tools
```

### Basic Usage

```javascript
import { SemanticToolDiscovery } from '@legion/semantic-search';
import { MCPServerRegistry, MCPPackageManager } from '@legion/tools';

// Initialize MCP components
const mcpRegistry = new MCPServerRegistry({ resourceManager });
const mcpPackageManager = new MCPPackageManager({ resourceManager });

// Enhanced semantic search with MCP integration
const discovery = new SemanticToolDiscovery({
  semanticSearchProvider,
  mcpServerRegistry,
  mcpPackageManager,
  enableMCPIntegration: true
});

// Find tools with installation suggestions
const results = await discovery.findRelevantTools('read a file from disk');
console.log('Available tools:', results.tools);
console.log('Install suggestions:', results.suggestions);
```

### CLI Management

Use the MCP CLI for server management:

```bash
# Discover available MCP servers
npx legion-mcp discover

# Search for specific servers
npx legion-mcp search "filesystem"

# Install a server
npx legion-mcp install @modelcontextprotocol/server-filesystem --add-config --auto-start

# List configured servers
npx legion-mcp list

# Start all servers
npx legion-mcp start

# Check server health
npx legion-mcp health

# Search available tools
npx legion-mcp search-tools "read file"
```

## Configuration

### MCP Configuration File (`mcp-config.json`)

```json
{
  "mcpServers": {
    "filesystem": {
      "name": "Filesystem Operations",
      "description": "File and directory operations",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/allowed/path"],
      "category": "filesystem",
      "tags": ["file", "directory", "read", "write"],
      "enabled": true,
      "autoStart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 60000,
        "timeout": 5000,
        "maxFailures": 3
      }
    }
  },
  "discovery": {
    "sources": [
      {
        "type": "npm",
        "searchTerms": ["mcp-server", "@modelcontextprotocol"],
        "enabled": true
      },
      {
        "type": "github",
        "searchTerms": ["mcp-server", "model-context-protocol"],
        "enabled": true
      }
    ],
    "updateInterval": 86400000,
    "cacheTimeout": 3600000
  },
  "integration": {
    "enabled": true,
    "toolPrefix": "mcp",
    "semanticSearch": {
      "enabled": true,
      "searchWeight": 0.8,
      "autoSuggest": true
    },
    "observability": {
      "enabled": true,
      "logLevel": "info",
      "traceExecution": true
    }
  }
}
```

### Legion Integration

```javascript
import { ResourceManager } from '@legion/module-loader';
import { MCPServerRegistry } from '@legion/tools';
import { ToolRegistry } from '@legion/tools';

// Initialize resource manager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create MCP registry
const mcpServerRegistry = new MCPServerRegistry({ resourceManager });
await mcpServerRegistry.initialize();

// Enhanced tool registry with MCP support
const toolRegistry = new ToolRegistry({
  mcpServerRegistry,
  enableMCPIntegration: true
});

// Search tools (includes MCP tools)
const tools = await toolRegistry.searchToolsWithMCP('file operations');

// Get smart recommendations with installation suggestions  
const recommendations = await toolRegistry.getSmartToolRecommendations('parse JSON data');
```

## API Reference

### SemanticToolDiscovery (Enhanced)

```javascript
const discovery = new SemanticToolDiscovery({
  // Legion components
  semanticSearchProvider,
  toolIndexer,
  toolRegistry,
  
  // MCP components
  mcpServerRegistry,
  mcpPackageManager,
  enableMCPIntegration: true,
  
  // Configuration
  config: {
    includeMCPTools: true,
    mcpSearchWeight: 0.8,
    mcpAutoSuggest: true,
    maxMCPSuggestions: 3
  }
});

// Enhanced findRelevantTools returns installation suggestions
const results = await discovery.findRelevantTools('task description');
// Returns: { tools, suggestions, metadata }
```

### MCPPackageManager

```javascript
const packageManager = new MCPPackageManager({ resourceManager });

// Install server
const result = await packageManager.installServer('server-id', {
  method: 'npm', // or 'git'
  force: false,
  skipDeps: false
});

// Get recommendations
const suggestions = await packageManager.getRecommendations('task description', {
  maxRecommendations: 5,
  includeInstalled: false
});
```

### MCPServerManager  

```javascript
const serverManager = new MCPServerManager({ resourceManager, config });

// Start server
const result = await serverManager.startServer('server-id', {
  timeout: 30000,
  env: { API_KEY: 'value' }
});

// Get all tools
const tools = await serverManager.getAllAvailableTools();
```

### MCPHealthChecker

```javascript
const healthChecker = new MCPHealthChecker({ serverManager });

// Check all servers
const results = await healthChecker.performHealthChecks();

// Enable automatic remediation
healthChecker.startPeriodicChecks({
  interval: 60000,
  autoRemediate: true
});
```

## CLI Commands

### Discovery
```bash
mcp discover [--limit N] [--no-installed]
mcp search <query> [--limit N] [--categories cat1,cat2]
```

### Installation
```bash
mcp install <server-id> [--force] [--method npm|git] [--add-config] [--auto-start]
mcp uninstall <server-id> [--remove-config]
```

### Management
```bash
mcp list                                    # List configured servers
mcp start [server-id] [--timeout N]        # Start server(s)
mcp stop [server-id] [--force]            # Stop server(s)
mcp restart [server-id] [--force]         # Restart server(s)
```

### Monitoring
```bash
mcp health [server-id]                     # Check health
mcp logs <server-id> [--lines N] [--follow] # View logs
```

### Tools
```bash
mcp tools [server-id]                      # List tools
mcp search-tools <query> [--limit N]      # Search tools
```

### Configuration
```bash
mcp config [section]                       # Show config
mcp set <key> <value>                     # Set config value
```

## Integration Examples

### Agent with MCP Tools

```javascript
class EnhancedAgent {
  constructor() {
    this.discovery = new SemanticToolDiscovery({
      enableMCPIntegration: true,
      // ... other config
    });
  }
  
  async executeTask(description) {
    // Find tools with installation suggestions
    const results = await this.discovery.findRelevantTools(description);
    
    // Use available tools
    for (const tool of results.tools) {
      if (tool.available) {
        const result = await tool.execute(params);
        return result;
      }
    }
    
    // Suggest installation if no tools available
    if (results.suggestions.length > 0) {
      console.log('Consider installing:', results.suggestions);
      // Auto-install if configured
      // await this.installSuggestedTools(results.suggestions);
    }
  }
}
```

### Automatic Tool Installation

```javascript
class AutoInstallAgent {
  async findOrInstallTool(taskDescription) {
    const results = await this.discovery.findRelevantTools(taskDescription);
    
    // Return tool if available
    if (results.tools.length > 0) {
      return results.tools[0];
    }
    
    // Auto-install if suggestions available
    if (results.suggestions.length > 0) {
      const suggestion = results.suggestions[0];
      
      console.log(`Installing ${suggestion.serverName}...`);
      const installResult = await this.packageManager.installServer(
        suggestion.serverId,
        { addToConfig: true }
      );
      
      if (installResult.success) {
        // Restart discovery after installation
        const newResults = await this.discovery.findRelevantTools(taskDescription);
        return newResults.tools[0];
      }
    }
    
    throw new Error(`No tools available for: ${taskDescription}`);
  }
}
```

## Popular MCP Servers

### Official Servers
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-git` - Git operations  
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-sqlite` - SQLite database
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-puppeteer` - Browser automation

### Community Servers
- Search NPM for packages with "mcp-server" tag
- Browse GitHub repositories with "model-context-protocol" topic

## Best Practices

### 1. **Resource Management**
- Always use ResourceManager for environment variables and dependencies
- Implement proper cleanup in server lifecycle management
- Monitor memory usage with many servers

### 2. **Error Handling**
- Implement retry logic for transient failures
- Use health checks to detect and remediate issues
- Log errors with sufficient context for debugging

### 3. **Security**
- Validate MCP server sources before installation
- Use environment variables for sensitive configuration
- Regularly update servers to get security patches

### 4. **Performance**
- Cache search results and metadata appropriately
- Use semantic search to reduce tool discovery latency
- Monitor server startup times and resource usage

### 5. **Configuration**
- Use configuration templates for common server types
- Document custom server configurations
- Version control your MCP configuration files

## Troubleshooting

### Common Issues

1. **Server won't start**
   ```bash
   mcp health server-id  # Check health status
   mcp logs server-id    # View error logs
   ```

2. **Tools not found**
   ```bash
   mcp tools server-id   # List server tools
   mcp restart server-id # Restart server
   ```

3. **Installation fails**
   ```bash
   mcp install server-id --force  # Force reinstall
   ```

4. **Performance issues**
   - Check server resource usage
   - Reduce health check frequency
   - Limit concurrent servers

### Debug Mode

Enable debug logging:
```bash
DEBUG=legion:mcp* mcp start server-id
```

Or in configuration:
```json
{
  "integration": {
    "observability": {
      "logLevel": "debug"
    }
  }
}
```

## Contributing

The MCP integration is part of the Legion framework. Contributions are welcome:

1. **New MCP Servers** - Create and publish MCP servers following the official specification
2. **Integration Improvements** - Enhance discovery, installation, or management features
3. **Documentation** - Improve guides and examples
4. **Bug Reports** - Report issues with specific MCP servers or integration features

## License

Part of the Legion project. See main project license for details.

---

*The MCP integration makes Legion agents incredibly powerful by providing access to thousands of external tools with automatic discovery and installation. Start with the CLI to explore available servers, then integrate semantic search for intelligent tool selection.*