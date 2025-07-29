# CLAUDE.md - Aiur Architecture Guide

## CRITICAL: Module Loading and API Key Rules

**NEVER MANUALLY HANDLE API KEYS OR CREATE MULTIPLE MODULE MANAGERS!**

### Module Loading Flow (Sacred Rules)

1. **Environment Variables**
   - `.env` file in Legion root contains: `SERPER_API_KEY=abc123`
   - ResourceManager automatically loads `.env` and stores as: `SERPER_API_KEY` (raw key name)
   - **NEVER manually register API keys with `resourceManager.register()`**

2. **Module Definition (module.json)**
   ```json
   {
     "dependencies": {
       "SERPER_API_KEY": { "type": "string", "description": "..." }
     },
     "initialization": {
       "config": { "apiKey": "${SERPER_API_KEY}" }
     }
   }
   ```

3. **Automatic Flow (DO NOT INTERFERE)**
   - Single ModuleManager created ONCE in Aiur server startup
   - ModuleFactory reads module.json dependencies
   - For `SERPER_API_KEY`, calls `resourceManager.get('SERPER_API_KEY')`
   - Config resolution: `${SERPER_API_KEY}` → actual API key value
   - Module constructor receives `config.apiKey` with the key
   - Tool instance can make authenticated API calls

4. **Forbidden Actions**
   - ❌ NEVER manually register API keys anywhere
   - ❌ NEVER create multiple ModuleManager instances
   - ❌ NEVER bypass ModuleFactory dependency resolution
   - ❌ NEVER touch or handle API keys in code

5. **Required Error Handling**
   - ResourceManager MUST throw if .env not found
   - ModuleFactory MUST throw if required dependency not found
   - Module MUST throw if required config missing
   - All failures must be explicit errors, NOT silent failures

## CRITICAL: Understanding Aiur's Architecture

**AIUR IS NOT AN MCP SERVER!** This is a crucial distinction that must be understood:

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude/AI     │     │   MCP Server    │     │   Aiur Server   │
│     Agent       │◄───►│   (Separate)    │◄───►│  (WebSocket)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              JSON-RPC              Custom Protocol
```

### What Aiur IS:
- **A WebSocket server** with its own custom protocol
- **A Legion module host** that loads and executes Legion tools directly
- **A context and planning system** with persistent memory
- **An AI coordination server** with session management

### What Aiur IS NOT:
- ❌ NOT an MCP server
- ❌ NOT using JSON-RPC protocol
- ❌ NOT implementing Model Context Protocol directly

## How It Actually Works

### 1. **Aiur Server** (`/packages/aiur/`)
- Runs on WebSocket (default port 8080)
- Uses custom message protocol:
  ```javascript
  // Session creation
  { type: 'session_create', requestId: 'req_123' }
  
  // Tool execution
  { 
    type: 'mcp_request',  // Legacy naming, but NOT actual MCP!
    method: 'tools/call',
    params: { name: 'file_read', arguments: {...} }
  }
  ```

### 2. **MCP Server Bridge** (`/packages/aiur/src/mcp/`)
- A SEPARATE process that can connect to Aiur
- Translates between MCP protocol and Aiur's protocol
- Allows Claude to use Aiur tools via MCP
- This is an ADAPTER, not part of core Aiur

### 3. **Legion Module System**
- Aiur directly loads Legion modules using `ModuleLoader`
- Tools are executed directly by Aiur, not through MCP
- When you run `module_load file`:
  - Aiur's ModuleLoader loads the FileModule
  - The module's tools become available in Aiur
  - These tools can be called via Aiur's WebSocket protocol

### 4. **Debug UI** (`/packages/apps/aiur-debug-ui/`)
- Connects DIRECTLY to Aiur WebSocket server
- Does NOT use MCP protocol
- Sends Aiur protocol messages for tool execution

## Common Misconceptions to Avoid

### ❌ WRONG: "MCP tools need to be registered"
✅ **RIGHT**: Legion tools are registered with Aiur's ToolRegistry when modules load

### ❌ WRONG: "The tool isn't exposed at the MCP level"
✅ **RIGHT**: Tools are exposed at the Aiur level. MCP is a separate adapter layer.

### ❌ WRONG: "MCP server needs to refresh tool list"
✅ **RIGHT**: Aiur needs to update its tool registry when modules are loaded

## Tool Execution Flow

1. **Module Loading**:
   ```
   Client → Aiur: module_load file
   Aiur: ModuleLoader.loadModule('file')
   Aiur: Registers FileOperationsTool with ToolRegistry
   Aiur: Tool functions (file_read, directory_list) available
   ```

2. **Tool Execution**:
   ```
   Client → Aiur: directory_list
   Aiur: ToolRegistry.getTool('directory_list')
   Aiur: Execute FileOperationsTool.invoke({function: {name: 'directory_list'}})
   Aiur → Client: Result
   ```

## Key Components

### Aiur Core:
- `SessionManager` - Manages WebSocket sessions
- `ToolRegistry` - Stores all available tools
- `ModuleLoader` - Loads Legion modules
- `LegionModuleAdapter` - Converts Legion tools for Aiur use
- `RequestHandler` - Handles incoming WebSocket messages

### NOT Part of Aiur Core:
- MCP protocol handling
- JSON-RPC processing
- Model Context Protocol implementation

## Debugging Tool Issues

If a tool like `directory_list` isn't working after `module_load file`:

1. **Check if module loaded**:
   - The ModuleLoader should have loaded FileModule
   - Check logs for "Loaded module: file"

2. **Check tool registration**:
   - LegionModuleAdapter should convert multi-function tools
   - Each function (file_read, directory_list) should be registered separately

3. **Check ToolRegistry**:
   - Tools should be indexed by name
   - `directory_list` should be findable in the registry

4. **Common Issues**:
   - Module loaded but tools not extracted from multi-function tools
   - Tool names not matching (might need refresh of tool list)
   - Session-specific tool registry not updated

## Important Notes

- **Aiur uses session-based tool management** - each session has its own tool context
- **Multi-function tools** (like FileOperationsTool) are expanded into individual tool entries
- **The debug UI** must refresh its tool list after modules are loaded
- **Tool execution** happens entirely within Aiur, not through any MCP layer

Remember: Aiur is a standalone AI coordination server with its own protocol. MCP is just one of many possible ways to connect to it!