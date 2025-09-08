# ShowMe Module Design Document

## Overview

The ShowMe module provides a generic tool for displaying any type of asset in an appropriate floating window interface. When an agent creates or finds an asset (file, image, data, web content, etc.), the ShowMe tool automatically detects the asset type and displays it using the most suitable viewer component.

## Core Principles

### 1. Generic Asset Handling
- **Universal Interface**: Single tool that handles any asset type
- **Automatic Detection**: Intelligent asset type detection without manual specification
- **Extensible**: Easy to add new asset types and viewers

### 2. Reuse Existing Infrastructure
- **Legion Components**: Uses existing Window, CodeEditor, ImageViewer, Grid, Tree components
- **Server Framework**: Built on ConfigurableActorServer pattern
- **MVVM Architecture**: Follows proven decent-planner-ui patterns
- **Protocol Actors**: Point-to-point client-server communication

### 3. Agent-Friendly Design
- **Simple Interface**: `show_me(asset, title?, hint?)` - one function for everything
- **Fail-Fast**: Clear error messages for unsupported assets
- **No Fallbacks**: Clean failures instead of degraded experience

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

### Supported Asset Types

| Asset Type | Detection Method | Viewer Component |
|------------|------------------|------------------|
| **Image** | MIME type, file extension, binary data | ImageViewer |
| **Code** | File extension, syntax patterns | CodeEditor |
| **JSON** | MIME type, object structure | Tree (JSON tree view) |
| **Data** | Array structure, CSV format | Grid (tabular view) |
| **Web** | URL, HTML content | Embedded iframe |
| **Text** | Default fallback | CodeEditor (plain text) |

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

## MVP Scope

### Included in MVP
- ✅ Core ShowMeTool with basic asset detection
- ✅ Image, code, JSON, and data display
- ✅ ConfigurableActorServer integration
- ✅ Protocol-based client-server actors
- ✅ Window management with existing Legion components
- ✅ Basic error handling and validation

### Not Included in MVP
- 🚫 Advanced asset formats (video, audio, 3D models)
- 🚫 Real-time collaborative viewing
- 🚫 Asset persistence beyond session
- 🚫 Advanced window management (workspaces, layouts)
- 🚫 Asset editing capabilities
- 🚫 Integration with external viewers

The MVP focuses on providing a solid, working foundation that demonstrates the core value proposition while leveraging all existing Legion infrastructure.