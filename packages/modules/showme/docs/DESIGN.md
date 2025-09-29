# ShowMe Module Design Document

## Overview

The ShowMe module provides a generic tool for displaying any type of resource in an appropriate floating window interface. It integrates deeply with Legion's Handle system, enabling display of Handles (strategies, files, memory, etc.) as well as traditional assets (images, JSON, tables). The tool automatically detects the resource type and displays it using the most suitable viewer component.

**Key Capabilities:**
- Display Legion Handles with introspection and interaction
- Display traditional assets (files, images, data, web content)
- Launch in chromeless browser window (app mode) for native look
- Actor-based communication for CLI → Browser control
- Real-time Handle state updates via subscriptions

## Core Principles

### 1. Handle-First Design
- **Legion URI Support**: Accept and display any Legion Handle via URI
- **Handle Introspection**: Automatically extract metadata, properties, methods from Handles
- **Type-Specific Renderers**: Specialized viewers for different Handle types (strategy, filesystem, mongodb)
- **Backward Compatibility**: Still supports traditional assets for non-Handle use cases

### 2. Fail-Fast Architecture
- **No Fallbacks**: Clear error messages, no degraded experiences
- **No Mocks in Implementation**: Only real services and resources
- **Explicit Failures**: Every error case raises an exception with clear context

### 3. Actor-Based Communication
- **CLI Control**: CLI sends Actor messages to control browser windows
- **Real-time Updates**: Handle subscriptions push live state changes to UI
- **WebSocket Protocol**: All communication via WebSocket Actor messages
- **Protocol Validation**: Schema-validated messages between server and client

### 4. Native App Experience
- **Chromeless Windows**: Launch browser in app mode (--app flag)
- **No Browser Chrome**: No tabs, URL bar, or browser UI
- **Window Control**: Full control over size, position, title from CLI

### 5. Reuse Existing Infrastructure
- **Legion Components**: Uses existing Window, CodeEditor, ImageViewer, Grid, Tree components
- **Server Framework**: Built on ConfigurableActorServer pattern
- **MVVM Architecture**: Follows proven decent-planner-ui patterns
- **ResourceManager Integration**: Uses ResourceManager for Handle resolution

## Architecture

### High-Level Components

```
Agent
  ↓
ShowMeTool (in ToolRegistry)
  ↓
ShowMe Server (ConfigurableActorServer)
  ↓
ShowMe UI (Browser)
  ↓
AssetDisplayManager
  ↓
Legion MVVM Components (Window + Viewer)
```

### Package Structure

```
packages/modules/showme/
├── src/
│   ├── index.js                    # Module entry point
│   ├── ShowMeModule.js             # Main module class
│   ├── tools/
│   │   └── ShowMeTool.js           # Tool implementation
│   ├── detection/
│   │   └── AssetTypeDetector.js    # Asset type detection
│   ├── server/
│   │   ├── ShowMeServer.js         # Server management
│   │   └── actors/
│   │       └── ShowMeServerActor.js # Server-side actor
│   └── client/
│       ├── actors/
│       │   └── ShowMeClientActor.js # Client-side actor
│       └── components/
│           └── AssetDisplayManager.js # UI management

packages/apps/showme-ui/
├── public/                         # Static assets
├── src/
│   ├── client/                     # Client application
│   └── server/                     # Server application
├── server.config.js                # Server configuration
└── package.json
```

## Asset Detection System

### AssetTypeDetector Class

The detector uses a multi-stage approach to identify asset types:

1. **Hint-based detection** (if provided)
2. **Content analysis** (MIME type, data structure)
3. **File extension analysis** (for file paths)
4. **Default fallback** (text viewer)

### Supported Resource Types

| Resource Type | Detection Method | Viewer Component |
|--------------|------------------|------------------|
| **Handle** | Legion URI pattern, Handle instance | HandleRenderer (introspection view) |
| **Strategy Handle** | Handle with resourceType='strategy' | StrategyRenderer (specialized) |
| **File Handle** | Handle with resourceType='filesystem' | FileRenderer (content + metadata) |
| **Memory Handle** | Handle with resourceType='memory' | MemoryRenderer (entity graph) |
| **Image** | MIME type, file extension, binary data | ImageRenderer |
| **Code** | File extension, syntax patterns | CodeRenderer |
| **JSON** | MIME type, object structure | JSONRenderer (tree view) |
| **Data** | Array structure, CSV format | TableRenderer (tabular view) |
| **Web** | URL, HTML content | Embedded iframe |
| **Text** | Default for non-Handle assets | CodeRenderer (plain text) |

### Detection Logic

```javascript
class AssetTypeDetector {
  detectAssetType(asset, hint) {
    // 1. Use hint if provided and valid
    if (hint && this.validateHint(hint, asset)) {
      return hint;
    }
    
    // 2. Content-based detection
    if (this.isImageData(asset)) return 'image';
    if (this.isJsonData(asset)) return 'json';
    if (this.isTabularData(asset)) return 'data';
    if (this.isWebContent(asset)) return 'web';
    if (this.isCodeFile(asset)) return 'code';
    
    // 3. Default
    return 'text';
  }
}
```

## Tool Interface

### ShowMeTool Implementation

```javascript
class ShowMeTool extends BaseTool {
  constructor() {
    super({
      name: 'show_me',
      description: 'Display any asset in appropriate floating window with automatic type detection',
      inputSchema: {
        type: 'object',
        properties: {
          asset: {
            type: 'any',
            description: 'Asset to display - file path, URL, data object, binary data, etc.'
          },
          title: {
            type: 'string',
            description: 'Window title (optional, auto-generated if not provided)'
          },
          hint: {
            type: 'string',
            enum: ['image', 'code', 'json', 'data', 'web', 'text'],
            description: 'Asset type hint for detection (optional)'
          }
        },
        required: ['asset']
      }
    });
  }

  async execute({ asset, title, hint }) {
    // 1. Detect asset type
    const assetType = this.assetDetector.detectAssetType(asset, hint);
    
    // 2. Ensure ShowMe server is running
    const serverInfo = await this.ensureServer();
    
    // 3. Send asset to server for display
    const result = await this.sendToServer({
      asset,
      assetType,
      title: title || this.generateTitle(asset, assetType),
      timestamp: Date.now()
    });
    
    return {
      success: true,
      message: `${assetType} asset displayed in floating window`,
      url: `${serverInfo.url}/showme#asset=${result.assetId}`,
      windowId: result.windowId,
      assetType
    };
  }
}
```

### Usage Examples

```javascript
// Display a file
await toolRegistry.getTool('show_me').execute({
  asset: '/tmp/data.json'
});

// Display generated data with title
await toolRegistry.getTool('show_me').execute({
  asset: { users: [...], stats: {...} },
  title: 'User Analytics'
});

// Display image with type hint
await toolRegistry.getTool('show_me').execute({
  asset: imageBuffer,
  title: 'Generated Chart',
  hint: 'image'
});

// Display web content
await toolRegistry.getTool('show_me').execute({
  asset: 'https://api.example.com/data',
  title: 'API Response'
});
```

## Server Architecture

### ConfigurableActorServer Integration

```javascript
// server.config.js
export default {
  port: 3700,
  routes: [
    {
      path: '/showme',
      serverActor: './src/server/actors/ShowMeServerActor.js',
      clientActor: './src/client/actors/ShowMeClientActor.js'
    }
  ],
  static: {
    '/legion/components': '@legion/components/src',
    '/assets': './assets'
  },
  services: {
    'assetStorage': './src/server/services/AssetStorageService.js'
  }
};
```

### ShowMeServer Class

```javascript
class ShowMeServer extends ConfigurableActorServer {
  async initialize() {
    await super.initialize();
    
    // Add API endpoints
    this.app.post('/api/display-asset', this.handleDisplayAsset.bind(this));
    this.app.get('/api/asset/:id', this.handleGetAsset.bind(this));
    
    // Asset storage
    this.assetStorage = new Map();
    this.assetCounter = 0;
  }
  
  async handleDisplayAsset(req, res) {
    const { asset, assetType, title } = req.body;
    
    // Store asset with unique ID
    const assetId = `asset_${++this.assetCounter}_${Date.now()}`;
    this.assetStorage.set(assetId, {
      asset,
      assetType,
      title,
      timestamp: Date.now()
    });
    
    // Notify client actor
    await this.actorSpace.sendMessage('showme-server', 'display-asset', {
      assetId,
      assetType,
      title
    });
    
    res.json({
      success: true,
      assetId,
      url: `http://localhost:${this.config.port}/showme#asset=${assetId}`
    });
  }
}
```

## UI Component Integration

### AssetDisplayManager

The display manager extends the proven ResourceWindowManager pattern from decent-planner-ui:

```javascript
class AssetDisplayManager extends ResourceWindowManager {
  async displayAsset(assetData) {
    const { asset, assetType, title, assetId } = assetData;
    
    // Check for existing window
    if (this.windows.has(assetId)) {
      this.focusWindow(assetId);
      return;
    }
    
    // Load UI components
    const components = await this.ensureComponentsLoaded();
    
    // Create window
    const window = this.createWindow(title, components);
    
    // Create appropriate viewer
    const viewer = await this.createViewer(assetType, asset, window.contentElement, components);
    
    // Track window
    this.windows.set(assetId, { window, viewer, assetType });
    
    // Show window
    window.show();
    
    return { window, viewer };
  }
  
  async createViewer(assetType, asset, container, components) {
    switch (assetType) {
      case 'image':
        return this.createImageViewer(asset, container, components);
      case 'code':
      case 'text':
        return this.createCodeViewer(asset, container, components);
      case 'json':
        return this.createJsonViewer(asset, container, components);
      case 'data':
        return this.createDataViewer(asset, container, components);
      case 'web':
        return this.createWebViewer(asset, container, components);
      default:
        throw new Error(`Unsupported asset type: ${assetType}`);
    }
  }
}
```

### Viewer Implementations

#### Image Viewer
```javascript
createImageViewer(asset, container, components) {
  const imageUrl = this.getImageUrl(asset);
  return components.ImageViewer.create({
    dom: container,
    imageData: imageUrl,
    showControls: true,
    showInfo: true
  });
}
```

#### Code Viewer
```javascript
createCodeViewer(asset, container, components) {
  const content = this.getTextContent(asset);
  const language = this.detectLanguage(asset);
  
  return components.CodeEditor.create({
    dom: container,
    content,
    language,
    lineNumbers: true,
    readonly: true
  });
}
```

#### JSON Viewer
```javascript
createJsonViewer(asset, container, components) {
  const jsonData = this.getJsonData(asset);
  
  return components.Tree.create({
    dom: container,
    data: this.jsonToTreeData(jsonData),
    expandedByDefault: true
  });
}
```

#### Data Viewer
```javascript
createDataViewer(asset, container, components) {
  const tableData = this.getTableData(asset);
  
  return components.Grid.create({
    dom: container,
    data: tableData.rows,
    columns: tableData.columns,
    mode: 'table'
  });
}
```

## Protocol-Based Actors

### ShowMeServerActor

```javascript
class ShowMeServerActor extends ProtocolActor {
  getProtocol() {
    return {
      name: "ShowMeServer",
      version: "1.0.0",
      state: {
        schema: { 
          connectedClients: { type: 'number', required: true },
          assetsStored: { type: 'number', required: true }
        },
        initial: { connectedClients: 0, assetsStored: 0 }
      },
      messages: {
        receives: {
          "display-asset": {
            schema: {
              assetId: { type: 'string', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true }
            }
          }
        },
        sends: {
          "asset-ready": {
            schema: {
              assetId: { type: 'string', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true }
            }
          }
        }
      }
    };
  }
  
  async handleDisplayAsset({ assetId, assetType, title }) {
    // Send to all connected clients
    await this.send('asset-ready', { assetId, assetType, title });
    
    this.state.assetsStored++;
    this.emitStateChange();
  }
}
```

### ShowMeClientActor

```javascript
class ShowMeClientActor extends ProtocolActor {
  constructor(displayManager) {
    super();
    this.displayManager = displayManager;
  }
  
  getProtocol() {
    return {
      name: "ShowMeClient",
      version: "1.0.0",
      state: {
        schema: {
          connected: { type: 'boolean', required: true },
          windowsOpen: { type: 'number', required: true }
        },
        initial: { connected: false, windowsOpen: 0 }
      },
      messages: {
        receives: {
          "asset-ready": {
            schema: {
              assetId: { type: 'string', required: true },
              assetType: { type: 'string', required: true },
              title: { type: 'string', required: true }
            }
          }
        }
      }
    };
  }
  
  async handleAssetReady({ assetId, assetType, title }) {
    // Fetch asset data from server
    const assetData = await this.fetchAssetData(assetId);
    
    // Display in appropriate window
    await this.displayManager.displayAsset({
      assetId,
      assetType,
      title,
      asset: assetData
    });
    
    this.state.windowsOpen++;
    this.emitStateChange();
  }
}
```

## Integration Points

### Tool Registry Integration

```javascript
// Module registration
export class ShowMeModule {
  getName() {
    return 'ShowMe';
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getTools() {
    return [
      new ShowMeTool()
    ];
  }
  
  async initialize(resourceManager) {
    this.resourceManager = resourceManager;
    this.server = new ShowMeServer();
    
    // Start server on module load
    await this.server.initialize();
    
    return true;
  }
}
```

### ResourceManager Integration

The module uses ResourceManager for:
- **Server port configuration**: `resourceManager.get('env.SHOWME_PORT') || 3700`
- **Asset storage path**: `resourceManager.get('env.SHOWME_ASSETS_PATH')`
- **Component serving**: Integration with Legion components

## Error Handling

### Tool-Level Errors
- **Asset not found**: Clear error message with asset path/reference
- **Unsupported format**: List of supported formats
- **Server unavailable**: Automatic server startup attempt
- **Display failure**: Component-specific error messages

### Server-Level Errors  
- **Port conflicts**: Try alternative ports with clear messaging
- **Asset corruption**: Validation and clear failure reporting
- **Component loading**: Fallback to text display with warning

### UI-Level Errors
- **Window creation**: Clean failure with retry option
- **Component rendering**: Error boundary with diagnostic info
- **Asset loading**: Loading states and timeout handling

## Testing Strategy

### Tool Testing
- **Asset detection**: Test all supported asset types and edge cases
- **Server integration**: Mock server for tool testing
- **Error scenarios**: Network failures, invalid assets, etc.

### UI Testing
- **Component integration**: Test each viewer type with real assets
- **Window management**: Multiple windows, close/focus behavior
- **Protocol actors**: Real actor communication testing

### Integration Testing
- **End-to-end**: Agent → Tool → Server → UI → Display
- **Multiple assets**: Concurrent display scenarios
- **Error recovery**: Graceful degradation testing

## Handle Integration

### Handle Detection and Resolution

```javascript
class AssetTypeDetector {
  detectResourceType(resource, hint) {
    // 1. Check if it's a Legion URI string
    if (typeof resource === 'string' && resource.startsWith('legion://')) {
      return 'handle-uri';
    }

    // 2. Check if it's a Handle instance
    if (resource && typeof resource.toURI === 'function' && resource.resourceType) {
      return `handle-${resource.resourceType}`;
    }

    // 3. Fall back to traditional asset detection
    return this.detectAssetType(resource, hint);
  }
}
```

### Handle Renderer Architecture

```javascript
class HandleRenderer {
  async render(handle, container) {
    // Extract Handle metadata
    const metadata = handle.getMetadata ? handle.getMetadata() : {};
    const schema = handle.getSchema ? handle.getSchema() : {};

    // Build introspection view
    const view = {
      header: this.renderHeader(handle),
      properties: this.renderProperties(handle, schema),
      methods: this.renderMethods(handle),
      capabilities: this.renderCapabilities(metadata),
      actions: this.renderActions(handle)
    };

    // Render to container
    this.displayInWindow(view, container);

    // Setup live updates if Handle supports subscriptions
    if (typeof handle.subscribe === 'function') {
      handle.subscribe((changes) => {
        this.updateView(changes);
      });
    }
  }

  renderHeader(handle) {
    return {
      uri: handle.toURI(),
      type: handle.resourceType,
      server: handle.server || 'local'
    };
  }

  renderProperties(handle, schema) {
    const props = [];
    const schemaProps = schema.properties || {};

    for (const [key, value] of Object.entries(schemaProps)) {
      props.push({
        name: key,
        value: handle[key],
        type: value.type,
        description: value.description
      });
    }

    return props;
  }

  renderMethods(handle) {
    const methods = [];

    // Extract methods from handle
    for (const key of Object.keys(handle)) {
      if (typeof handle[key] === 'function' && !key.startsWith('_')) {
        methods.push({
          name: key,
          callable: true
        });
      }
    }

    return methods;
  }

  renderActions(handle) {
    const actions = [];

    // Common Handle actions
    actions.push({
      label: 'Copy URI',
      action: () => navigator.clipboard.writeText(handle.toURI())
    });

    actions.push({
      label: 'View JSON',
      action: () => this.showJSON(handle.toJSON())
    });

    // Handle-type specific actions
    if (handle.resourceType === 'strategy') {
      actions.push({
        label: 'Instantiate',
        action: () => this.instantiateStrategy(handle)
      });
    }

    return actions;
  }
}
```

### Strategy Renderer (Specialized)

```javascript
class StrategyRenderer extends HandleRenderer {
  async render(strategyHandle, container) {
    // Get strategy metadata
    const metadata = await strategyHandle.getMetadata();

    // Build strategy-specific view
    const view = {
      header: {
        name: metadata.strategyName,
        type: metadata.strategyType,
        uri: strategyHandle.toURI()
      },
      requirements: {
        tools: metadata.requiredTools || [],
        prompts: metadata.promptSchemas || []
      },
      capabilities: metadata.capabilities || [],
      file: {
        path: metadata.filePath,
        size: metadata.fileSize,
        modified: metadata.lastModified
      },
      actions: [
        {
          label: 'Instantiate Strategy',
          action: async () => {
            const rm = await ResourceManager.getInstance();
            const context = {
              resourceManager: rm,
              toolRegistry: rm.get('toolRegistry'),
              llmClient: await rm.get('llmClient')
            };
            const strategy = await strategyHandle.instantiate(context);
            this.showSuccess(`Strategy instantiated: ${strategy.strategyType}`);
          }
        },
        {
          label: 'View Source',
          action: async () => {
            const source = await this.loadSource(metadata.filePath);
            this.showInCodeViewer(source, 'javascript');
          }
        },
        {
          label: 'Search Similar',
          action: async () => {
            const semanticSearch = rm.get('handleSemanticSearch');
            const similar = await semanticSearch.searchHandles(
              metadata.strategyName,
              { handleTypes: ['strategy'], limit: 10 }
            );
            this.showSearchResults(similar);
          }
        }
      ]
    };

    this.displayStrategyView(view, container);
  }
}
```

### Browser Launch in App Mode

```javascript
class ShowMeServer {
  async launchBrowser(url, options = {}) {
    const { default: open } = await import('open');

    // Launch Chrome in app mode (chromeless)
    await open(url, {
      app: {
        name: open.apps.chrome,
        arguments: [
          `--app=${url}`,                    // App mode (no browser chrome)
          `--window-size=${options.width || 1200},${options.height || 800}`,
          `--window-position=${options.x || 100},${options.y || 100}`,
          '--disable-features=TranslateUI',  // Disable translate bar
          '--hide-scrollbars',               // Clean look
          '--no-default-browser-check',      // Skip default browser prompt
          '--disable-popup-blocking'         // Allow window.open
        ]
      }
    });

    console.log(`Launched browser in app mode: ${url}`);
  }
}
```

### CLI Display Engine Integration

```javascript
class CLIDisplayEngine {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.showMeActor = null;
  }

  async initialize() {
    // Get ShowMe service from ResourceManager
    this.showMeService = this.resourceManager.get('showme');

    // Get ShowMe server actor for direct messaging
    this.showMeActor = await this.showMeService.getServerActor();
  }

  async displayHandle(handle, options = {}) {
    // Send Handle URI to ShowMe
    await this.showMeActor.send({
      type: 'display-resource',
      resource: handle.toURI(),
      window: {
        title: options.title || `${handle.resourceType}: ${handle.toURI()}`,
        width: options.width || 1000,
        height: options.height || 700,
        position: options.position || 'center'
      }
    });

    console.log(chalk.green('✓ Displaying in ShowMe window'));
  }

  async exploreInteractive(handle) {
    await this.displayHandle(handle, {
      title: `Explore: ${handle.resourceType}`,
      width: 1200,
      height: 800
    });
  }
}
```

## MVP Scope

### Included in MVP
- ✅ **Handle Integration**: Accept and display Legion URI Handles
- ✅ **Handle Renderer**: Generic introspection view for any Handle type
- ✅ **Strategy Renderer**: Specialized viewer for strategy handles
- ✅ **Resource Detection**: Detect Handles vs traditional assets
- ✅ **App Mode Launch**: Chromeless browser window with --app flag
- ✅ **Actor Communication**: CLI → Server → Browser messaging
- ✅ **Existing Renderers**: Image, code, JSON, table display (already working)
- ✅ **ConfigurableActorServer**: Built on existing server framework
- ✅ **Protocol Validation**: Schema-validated actor messages
- ✅ **Fail-Fast**: No fallbacks, explicit error handling

### Not Included in MVP
- 🚫 **Handle Editing**: Read-only Handle viewing (no modification)
- 🚫 **Advanced Handle Types**: Focus on strategy, file, memory handles only
- 🚫 **Real-time Collaboration**: Single-user viewing only
- 🚫 **Persistence**: No saving of Handle states or sessions
- 🚫 **Advanced Window Management**: No workspaces or custom layouts
- 🚫 **Video/Audio Assets**: Images and static content only
- 🚫 **Security/Authentication**: Local-only, trusted environment
- 🚫 **Performance Optimization**: Focus on correctness, not speed
- 🚫 **Migration/Upgrade**: New implementation, no backward compatibility
- 🚫 **Documentation**: Design doc only, no user docs

### Implementation Approach
- **TDD Without Refactor**: Get it right first time, comprehensive testing
- **No Mocks in Integration Tests**: Use real ResourceManager, real Handles
- **No Mocks in Implementation**: Only real services and resources
- **Fail-Fast**: Every error raises an exception, no silent failures
- **Phase-Based Development**: Each phase delivers working, testable functionality
- **Local Development**: No deployment concerns, local UAT only

The MVP focuses on providing Handle integration that works correctly with comprehensive testing, leveraging existing ShowMe infrastructure while adding Handle-specific capabilities.