# Transparent Resource Handles Design

**A system for creating client-side proxy objects that look identical to server resources but route all operations through the actor protocol**

## Overview

The Transparent Resource Handle system extends Legion's Protocol-Based Actor MVVM architecture to enable seamless remote resource access. Resources (files, images, directories, database collections) on the server appear as identical objects on the client, with all method calls transparently routed through the actor communication protocol.

### Core Concept

```javascript
// Server creates and sends a file handle
const fileHandle = await server.createFileHandle('/path/to/file.txt');
client.send('resource:handle', { handle: fileHandle });

// Client receives a transparent proxy that looks exactly like a file
const content = await handle.read();        // Actually calls server
await handle.write('new content');          // Actually calls server
const stats = await handle.stat();          // Actually calls server

// Existing components work unchanged
const editor = CodeEditor.create({
  dom: window.contentElement,
  content: await handle.read(),
  onContentChange: (content) => handle.write(content)
});
```

## Architecture Components

### 1. Paired Resource Actors (CRITICAL - Missing from Initial Design!)

**ResourceClientSubActor** ↔ **ResourceServerSubActor**

Following the existing pattern of paired client/server actors, we need dedicated resource management actors:

```javascript
// CLIENT SIDE: ResourceClientSubActor  
class ResourceClientSubActor extends ProtocolActor {
  // - Receives resource handle metadata from server
  // - Creates TransparentResourceProxy objects
  // - Routes proxy method calls to server actor via protocol messages
  // - Manages client-side proxy lifecycle
}

// SERVER SIDE: ResourceServerSubActor (Plain Actor Class)
class ResourceServerSubActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.resourceManager = new ResourceHandleManager();
    this.fileSystem = services.fileSystem; // Real file system access
  }
  
  // Standard actor methods
  async setRemoteActor(remoteActor) { ... }
  receive(messageType, data) { ... }
  
  // Resource-specific methods
  // - Creates REAL FileHandle/ImageHandle objects with actual file system
  // - Executes resource method calls on real files/directories  
  // - Manages server-side handle lifecycle
  // - Sends handle metadata to client for proxy creation
}
```

**CRITICAL**: The server actor holds the REAL resources, the client actor manages proxies!

### 2. ResourceHandleManager

Central registry for creating, managing, and tracking resource handles ON THE SERVER SIDE.

```javascript
class ResourceHandleManager {
  // Create typed handles from real resources (SERVER SIDE ONLY)
  createFileHandle(filePath, fileSystem)
  createImageHandle(imagePath, fileSystem) 
  createDirectoryHandle(dirPath, fileSystem)
  
  // Register handle types and their method signatures
  registerResourceType(typeName, methodSignatures)
  
  // Handle lifecycle management (SERVER SIDE)
  trackHandle(handleId, handle)
  releaseHandle(handleId)
}
```

### 3. TransparentResourceProxy (CLIENT SIDE ONLY)

JavaScript Proxy wrapper that intercepts method calls and routes them to ResourceClientSubActor.

```javascript
class TransparentResourceProxy {
  constructor(handleId, resourceType, methodSignatures, resourceClientActor) {
    return new Proxy(this, {
      get(target, prop) {
        if (methodSignatures.includes(prop)) {
          return (...args) => {
            // Route to client actor, which sends to server actor
            return resourceClientActor.callResourceMethod(handleId, prop, args);
          };
        }
        return target[prop];
      }
    });
  }
}
```

### 3. Resource Type Registry

Maps file extensions and resource types to appropriate viewers and method signatures.

```javascript
const RESOURCE_TYPE_REGISTRY = {
  // File extensions to viewers
  extensions: {
    '.txt': 'CodeEditor',
    '.js': 'CodeEditor', 
    '.json': 'CodeEditor',
    '.png': 'ImageViewer',
    '.jpg': 'ImageViewer',
    '.gif': 'ImageViewer',
    '/': 'DirectoryBrowser'  // Special case for directories
  },
  
  // Resource types to method signatures
  signatures: {
    'FileHandle': ['read', 'write', 'stat', 'watch', 'delete'],
    'ImageHandle': ['getMetadata', 'getData', 'getUrl', 'resize'],
    'DirectoryHandle': ['list', 'createFile', 'createDir', 'delete'],
    'DatabaseCollectionHandle': ['find', 'insert', 'update', 'delete', 'count']
  }
};
```

### 4. Show Command Handler

Processes `/show` commands and opens appropriate floating windows with viewers.

```javascript
class ShowCommandHandler {
  async handleShowCommand(resourcePath) {
    // 1. Determine resource type from extension
    const extension = path.extname(resourcePath) || '/';
    const viewerType = RESOURCE_TYPE_REGISTRY.extensions[extension];
    
    // 2. Request resource handle from server
    const handle = await this.requestResourceHandle(resourcePath);
    
    // 3. Create floating window
    const window = Window.create({
      dom: this.containerElement,
      title: path.basename(resourcePath),
      width: 800,
      height: 600
    });
    
    // 4. Create appropriate viewer with handle
    const viewer = this.createViewer(viewerType, window.contentElement, handle);
    
    return { window, viewer, handle };
  }
}
```

## Protocol Integration

### Resource Handle Messages

Extend existing protocol actors with resource handle message types:

```javascript
// Protocol extension for resource handles
messages: {
  sends: {
    "resource:request": {
      schema: {
        path: { type: 'string', required: true },
        type: { type: 'string', required: true }
      }
    },
    "resource:call": {
      schema: {
        handleId: { type: 'string', required: true },
        method: { type: 'string', required: true },
        args: { type: 'array', required: true }
      }
    }
  },
  receives: {
    "resource:handle": {
      schema: {
        handleId: { type: 'string', required: true },
        resourceType: { type: 'string', required: true },
        metadata: { type: 'object' }
      }
    },
    "resource:result": {
      schema: {
        handleId: { type: 'string', required: true },
        method: { type: 'string', required: true },
        result: { type: 'any' },
        error: { type: 'string' }
      }
    }
  }
}
```

### Actor Serialization Extension

Extend existing `ActorSerializer` to handle resource proxy objects:

```javascript
// In ActorSerializer - detect and serialize resource handles
if (obj.__isResourceHandle) {
  return {
    __type: 'ResourceHandle',
    handleId: obj.__handleId,
    resourceType: obj.__resourceType,
    metadata: obj.__metadata
  };
}

// Deserialize back to transparent proxy
if (obj.__type === 'ResourceHandle') {
  return new TransparentResourceProxy(
    obj.handleId,
    obj.resourceType,
    RESOURCE_TYPE_REGISTRY.signatures[obj.resourceType],
    this.actorChannel
  );
}
```

## Component Integration

### Existing Components Work Unchanged

**CodeEditor Integration**:
```javascript
// FileHandle looks exactly like a file object
const fileHandle = { 
  read: async () => "content",
  write: async (content) => true,
  path: "/file.txt"
};

// CodeEditor works unchanged - doesn't know it's remote
const editor = CodeEditor.create({
  dom: window.contentElement,
  content: await fileHandle.read(),
  onContentChange: async (content) => {
    await fileHandle.write(content);  // Transparent remote call
  },
  language: this.detectLanguage(fileHandle.path)
});
```

**ImageViewer Integration**:
```javascript
// ImageHandle provides URL/data transparently  
const imageHandle = {
  getUrl: async () => "data:image/png;base64,iVBOR...",
  getMetadata: async () => ({ width: 1920, height: 1080 })
};

// ImageViewer works unchanged
const viewer = ImageViewer.create({
  dom: window.contentElement,
  imageData: await imageHandle.getUrl(),
  showControls: true,
  showInfo: true
});
```

**Window Component Perfect As-Is**:
- Already provides floating windows with drag, resize, minimize/maximize
- Content area (`window.contentElement`) hosts any component
- No changes needed - just create and populate with appropriate viewer

## Test Case: File Editor

### User Experience
```bash
# User types in chat:
/show /path/to/myfile.txt

# System automatically:
1. Creates FileHandle on server for /path/to/myfile.txt
2. Sends handle to client as transparent proxy
3. Opens floating Window with title "myfile.txt" 
4. Creates CodeEditor in window with file content
5. Editor read/write operations transparently call server
6. User edits file normally, changes saved automatically to server
```

### Implementation Flow
```javascript
// 1. Chat command processor
async handleSlashCommand(command, args) {
  if (command === 'show') {
    const resourcePath = args[0];
    await this.showResource(resourcePath);
  }
}

// 2. Resource display handler  
async showResource(resourcePath) {
  // Request handle from server
  const handle = await this.remoteActor.send('resource:request', {
    path: resourcePath,
    type: 'file'
  });
  
  // Determine viewer type
  const extension = path.extname(resourcePath);
  const viewerType = RESOURCE_TYPE_REGISTRY.extensions[extension] || 'CodeEditor';
  
  // Create floating window
  const window = Window.create({
    dom: document.body,
    title: path.basename(resourcePath),
    width: 800,
    height: 600
  });
  
  // Create appropriate viewer
  if (viewerType === 'CodeEditor') {
    const editor = CodeEditor.create({
      dom: window.contentElement,
      content: await handle.read(),
      language: this.detectLanguage(extension),
      onContentChange: (content) => handle.write(content)
    });
  } else if (viewerType === 'ImageViewer') {
    const viewer = ImageViewer.create({
      dom: window.contentElement,
      imageData: await handle.getUrl(),
      showControls: true
    });
  }
}
```

## Server-Side Handle Creation

### File Handle Implementation
```javascript
class FileHandle {
  constructor(filePath, fileSystem) {
    this.path = filePath;
    this.fs = fileSystem;
    this.handleId = generateUniqueId();
  }
  
  async read() {
    return await this.fs.readFile(this.path, 'utf8');
  }
  
  async write(content) {
    await this.fs.writeFile(this.path, content, 'utf8');
    return true;
  }
  
  async stat() {
    return await this.fs.stat(this.path);
  }
  
  // Serialization metadata for client
  getSerializationData() {
    return {
      handleId: this.handleId,
      resourceType: 'FileHandle',
      metadata: { 
        path: this.path,
        extension: path.extname(this.path)
      }
    };
  }
}
```

### Complete Actor Communication Flow

```javascript
// 1. USER TYPES: /show myfile.txt

// 2. CLIENT CHAT ACTOR -> RESOURCE CLIENT ACTOR
chatActor.send('resource:request', { path: '/myfile.txt', type: 'file' });

// 3. RESOURCE CLIENT ACTOR -> RESOURCE SERVER ACTOR (via protocol)
resourceClientActor.send('resource:request', { path: '/myfile.txt', type: 'file' });

// 4. RESOURCE SERVER ACTOR creates REAL FileHandle
class ResourceServerSubActor {
  async receive(messageType, data) {
    switch (messageType) {
      case 'resource:request':
        // Create REAL FileHandle with actual file system
        const realHandle = this.resourceManager.createFileHandle(data.path, this.fileSystem);
        this.resourceManager.trackHandle(realHandle.handleId, realHandle);
        
        // Send handle metadata to client (NOT the real handle)
        this.remoteActor.receive('resource:handle', realHandle.getSerializationData());
        break;
        
      case 'resource:call':
        // Execute method on REAL handle
        const handle = this.resourceManager.getHandle(data.handleId);
        const result = await handle[data.method](...data.args);
        this.remoteActor.receive('resource:result', { handleId, method, result });
        break;
    }
  }
}

// 5. CLIENT ACTOR receives handle metadata, creates TransparentResourceProxy
class ResourceClientSubActor {
  handleMessage(messageType, data) {
    switch (messageType) {
      case 'resource:handle':
        // Create proxy that routes calls back to server
        const proxy = new TransparentResourceProxy(
          data.handleId, data.resourceType, data.methodSignatures, this
        );
        // Send to chat/show command handler
        this.parentActor.receive('resource:ready', { path: data.metadata.path, handle: proxy });
        break;
    }
  }
}

// 6. PROXY METHOD CALLS route back to server:
// proxy.read() -> ResourceClientActor.send('resource:call', {...}) 
//              -> ResourceServerActor executes on REAL file
//              -> Returns result to client
```

### Enhanced ActorSerializer Support

**CRITICAL: ENHANCE EXISTING ActorSerializer - DO NOT CREATE NEW SERIALIZER!**
**CRITICAL: CHECK IF JSON5 SHOULD BE USED INSTEAD OF JSON!**

Extend the existing `/packages/shared/actors/src/ActorSerializer.js` to handle resource handle metadata:

```javascript
// In EXISTING ActorSerializer.serialize() replacer function - ADD THIS CHECK:
if (value.__isResourceHandle === true) {
  return {
    __type: 'ResourceHandle',
    handleId: value.__handleId,
    resourceType: value.__resourceType,
    methodSignatures: value.__methodSignatures,
    metadata: value.__metadata
  };
}

// In EXISTING ActorSerializer.deserialize() reviver function - ADD THIS CHECK:  
if (value.__type === 'ResourceHandle') {
  // Reconstruct proxy using ResourceClientSubActor
  const resourceClient = this.actorSpace.guidToObject.get('resource-client-sub');
  if (!resourceClient) {
    throw new Error('ResourceClientSubActor not found for handle reconstruction');
  }
  return resourceClient.createProxyFromData(value);
}
```

**NOTE: Only modify the existing ActorSerializer, never create duplicate serialization logic!**

## Key Benefits

1. **Zero Learning Curve** - Existing components work unchanged
2. **Transparent Operations** - Client code doesn't know resources are remote
3. **Type Safety** - Handles maintain original resource interfaces
4. **Agent Integration** - Simple `/show filename` opens appropriate viewer
5. **Extensible** - Easy to add new resource types without changing existing code
6. **Clean Architecture** - Builds on existing Protocol Actor MVVM foundation

## MVP Scope

This design focuses exclusively on core functionality:
- Basic file editing through `/show filename.txt`  
- Image viewing through `/show image.png`
- Transparent handle proxy system
- Integration with existing Window/CodeEditor/ImageViewer components
- No advanced features, optimizations, or future enhancements