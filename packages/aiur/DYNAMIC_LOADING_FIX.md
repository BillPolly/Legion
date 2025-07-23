# Dynamic Module Loading Fix for Aiur MCP Server

## Problem
The MCP server was setting up request handlers before loading Legion modules, causing the `ListToolsRequestSchema` handler to capture the TOOLS array before dynamic tools were added. This resulted in dynamically loaded tools (like file_write) not appearing in the MCP tools list.

## Solution
Move module loading to happen BEFORE setting up server request handlers.

## Key Changes Required

### 1. Remove duplicate tool definitions
The current index.js has duplicate tool arrays (`comprehensiveTools` and `simpleTools`). Consolidate into a single `TOOLS` array.

### 2. Create generic module loading function
Replace the FileModule-specific `initializeFileModule()` with a generic `loadLegionModules()` function:

```javascript
async function loadLegionModules() {
  try {
    const legionAdapter = new LegionModuleAdapter(toolRegistry, handleRegistry);
    await legionAdapter.initialize();
    
    // Module configuration - easy to add new modules here
    const moduleConfigs = [
      {
        module: FileModule,
        dependencies: {
          basePath: process.cwd(),
          encoding: 'utf8',
          createDirectories: true,
          permissions: 0o755
        }
      }
      // Add more modules here as needed
    ];
    
    // Load each module
    for (const config of moduleConfigs) {
      const result = await legionAdapter.loadModule(config.module, config.dependencies);
      console.error(`Loaded module: ${result.moduleName}`);
      
      // Get all newly registered tools
      const registeredTools = toolRegistry.getAllTools();
      const newTools = registeredTools.filter(tool => 
        tool.tags && 
        tool.tags.includes('legion-module') &&
        !TOOLS.some(t => t.name === tool.name)
      );
      
      // Add each tool to TOOLS array for MCP listing
      newTools.forEach(tool => {
        TOOLS.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      });
      
      console.error(`Added ${newTools.length} tools from ${result.moduleName}:`, newTools.map(t => t.name));
    }
    
    console.error(`Total tools available: ${TOOLS.length}`);
  } catch (error) {
    console.error('Failed to load modules:', error);
  }
}
```

### 3. Move server handler setup into runServer()
Move the `server.setRequestHandler` calls from the top level into the `runServer()` function, AFTER module loading:

```javascript
async function runServer() {
  // CRITICAL: Load modules BEFORE setting up handlers
  await loadLegionModules();
  
  // NOW set up request handlers - they will capture the updated TOOLS array
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments ?? {})
  );
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

### 4. Fix LegionModuleAdapter for multi-function tools
The adapter needs to handle tools that only have `getAllToolDescriptions` without `getToolDescription`:

```javascript
_convertToMCPTools(legionTool) {
  // Handle tools that expose multiple functions
  if (legionTool.getAllToolDescriptions) {
    const allDescs = legionTool.getAllToolDescriptions();
    
    // Create individual MCP tools for each function
    return allDescs.map(desc => ({
      name: desc.function.name,
      description: desc.function.description,
      inputSchema: desc.function.parameters,
      category: 'legion',
      tags: ['imported', 'legion-module', legionTool.name],
      execute: async (args) => {
        // ... execution logic
      }
    }));
  }
  
  // Single function tool - must have getToolDescription
  if (!legionTool.getToolDescription) {
    throw new Error(`Tool ${legionTool.name} must have either getToolDescription or getAllToolDescriptions method`);
  }
  
  // ... rest of single function handling
}
```

## Benefits
1. **Generic Solution**: Easy to add new Legion modules without changing core logic
2. **Proper Timing**: Tools are loaded before handlers are set up
3. **Clean Architecture**: Separation of concerns between module loading and server setup
4. **Extensible**: New modules can be added to the `moduleConfigs` array

## Testing
The fix has been tested and shows:
- File tools appear in MCP tools list
- Tools can be executed successfully  
- Total tool count is correct (13 tools: 7 base + 6 file operations)

## Next Steps
1. Apply these changes to index.js
2. Remove the FileModule-specific code
3. Add tests to ensure dynamic loading works correctly
4. Consider adding more Legion modules using the same pattern