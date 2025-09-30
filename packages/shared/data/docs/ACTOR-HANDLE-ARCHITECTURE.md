# Actor and Handle Architecture

## Overview

This document describes the complete architecture of the Actor and Handle systems in Legion, including how they work together to enable transparent remote method calls, automatic serialization, and seamless client-server communication.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Actor System](#actor-system)
3. [Handle System](#handle-system)
4. [Serialization and Remote Communication](#serialization-and-remote-communication)
5. [Server Framework Integration](#server-framework-integration)
6. [Complete Flow Examples](#complete-flow-examples)

---

## Core Concepts

### The Problem

In distributed systems, we need to:
1. Send objects between client and server
2. Call methods on remote objects as if they were local
3. Handle serialization/deserialization automatically
4. Manage object lifecycles and references
5. Provide a uniform interface for different resource types

### The Solution

Legion uses two complementary patterns:

- **Actors**: Message-passing objects that can exist on either client or server
- **Handles**: Proxy objects that provide a consistent interface to any resource type

Both systems share the same serialization infrastructure and can seamlessly work together.

---

## Actor System

### What is an Actor?

An Actor is any object that implements the Actor protocol. The minimal requirement is:

```javascript
class MyActor extends Actor {
  receive(message) {
    // Handle incoming messages
  }
}
```

Actors have one key property: `isActor = true`

### ActorSpace

An **ActorSpace** is a container that manages actors in a particular execution context (server or client).

```javascript
const actorSpace = new ActorSpace('my-space-id');
```

**Key responsibilities:**
1. **GUID Generation**: Each actor gets a unique identifier
2. **Actor Registration**: Maps actors to GUIDs and vice versa
3. **Serialization**: Converts actors to wire format
4. **Deserialization**: Reconstructs actors or creates proxies
5. **Channel Management**: Handles WebSocket connections

**Internal State:**
```javascript
{
  spaceId: 'unique-space-id',
  objectToGuid: Map<Actor, string>,  // Actor -> GUID
  guidToObject: Map<string, Actor>,  // GUID -> Actor
  channels: Map<string, Channel>,    // Channels for communication
  serializer: ActorSerializer        // Handles serialization
}
```

### Channel

A **Channel** wraps a WebSocket connection and handles message routing.

```javascript
const channel = actorSpace.addChannel(websocket);
```

**Key methods:**
- `send(targetGuid, messageType, data)` - Send message to remote actor
- `makeRemote(guid)` - Create a RemoteActor proxy for a remote GUID

**How it works:**
1. Serializes outgoing messages using ActorSerializer
2. Deserializes incoming messages
3. Routes messages to the correct actor via ActorSpace
4. Handles remote method call protocol

### RemoteActor

A **RemoteActor** is a proxy that represents an actor living in another ActorSpace.

```javascript
const remoteActor = channel.makeRemote('remote-guid');
remoteActor.receive('my-message', { data: 'hello' });
```

**Properties:**
- `isActor = true`
- `isRemote = true`
- `guid` - The GUID of the remote actor
- `_channel` - Reference to the channel for communication

**How receive() works:**
When you call `remoteActor.receive(messageType, data)`:
1. RemoteActor wraps the call in a message
2. Sends it through the channel
3. Channel serializes the message (including any Actors/Handles in data)
4. Sends over WebSocket
5. Remote side deserializes and routes to the real actor

### ActorSerializer

The **ActorSerializer** handles automatic serialization/deserialization of actors and handles.

**During Serialization (JSON.stringify with custom replacer):**

```javascript
serialize(object) {
  return JSON.stringify(object, (key, value) => {
    // Check if value is an Actor
    if (value?.isActor === true) {
      let guid = this.actorSpace.objectToGuid.get(value);

      if (!guid) {
        // Auto-register local actors
        guid = this.actorSpace._generateGuid();
        this.actorSpace.objectToGuid.set(value, guid);
        this.actorSpace.guidToObject.set(guid, value);
      }

      // Check if Actor has custom serialization (like Handle.serialize())
      if (typeof value.serialize === 'function') {
        const customData = value.serialize();
        return {
          $actor: guid,
          ...customData
        };
      }

      // Standard actor serialization
      return { $actor: guid };
    }

    return value;
  });
}
```

**Key points:**
- Automatically detects actors via `isActor` property
- Auto-generates GUIDs and registers actors on first serialization
- Calls custom `serialize()` method if available (used by Handles)
- Complete isolation - actor classes know nothing about serialization

**During Deserialization (JSON.parse with custom reviver):**

```javascript
deserialize(json, channel) {
  return JSON.parse(json, (key, value) => {
    // Check for actor reference
    if (value?.$actor) {
      const guid = value.$actor;

      // Check if we already have this actor locally
      let actor = this.actorSpace.guidToObject.get(guid);

      if (!actor) {
        // Check if this is a Handle (has __type: 'RemoteHandle')
        if (value.__type === 'RemoteHandle') {
          // Create RemoteHandle proxy
          actor = new RemoteHandle(
            value.handleType,
            value.schema,
            value.capabilities,
            guid,
            channel
          );

          // Register in ActorSpace
          const localGuid = this.actorSpace._generateGuid();
          this.actorSpace.objectToGuid.set(actor, localGuid);
          this.actorSpace.guidToObject.set(localGuid, actor);
        } else {
          // Create RemoteActor proxy
          actor = channel.makeRemote(guid);
        }
      }

      return actor;
    }

    return value;
  });
}
```

**Key points:**
- Detects actor references via `$actor` property
- Creates RemoteHandle or RemoteActor proxies for unknown actors
- Reuses existing local actors if already known
- Completely automatic - no manual proxy creation needed

---

## Handle System

### What is a Handle?

A **Handle** is a specialized Actor that provides a consistent interface to any resource type.

```javascript
class ImageHandle extends Handle {
  async getData() {
    return this.imageData.data;
  }

  async getMetadata() {
    return { id: this.imageData.id, title: this.imageData.title };
  }
}
```

**Key properties:**
- `isActor = true` (inherits from Actor)
- Has a `DataSource` that provides the actual data
- Implements custom methods like `getData()`, `getMetadata()`
- Provides `serialize()` method for custom serialization

### DataSource

Every Handle wraps a **DataSource** - an object that provides data access:

```javascript
const dataSource = {
  query: (querySpec) => Promise<results>,
  subscribe: (querySpec, callback) => Subscription,
  getSchema: () => Schema,
  queryBuilder: () => QueryBuilder
};
```

The Handle delegates data operations to the DataSource while providing a richer API.

### Handle.serialize()

Handles implement custom serialization that tells the remote side what capabilities they have:

```javascript
serialize() {
  return {
    __type: 'RemoteHandle',
    handleType: 'ImageHandle',
    schema: this.dataSource.getSchema(),
    capabilities: ['query', 'subscribe', 'getData', 'getMetadata', 'getType', 'getTitle']
  };
}
```

**Key points:**
- `__type: 'RemoteHandle'` signals ActorSerializer to create RemoteHandle
- `handleType` identifies the type of Handle
- `schema` describes the data structure
- `capabilities` lists all available methods

### RemoteHandle

A **RemoteHandle** is created on the client side when a Handle is deserialized. It's a proxy that forwards method calls to the real Handle on the server.

```javascript
class RemoteHandle {
  constructor(handleType, schema, capabilities, guid, channel) {
    this.isActor = true;
    this.isRemote = true;
    this.guid = guid;
    this._channel = channel;
    this.capabilities = capabilities;

    // Automatically create methods for each capability
    for (const capability of capabilities) {
      if (!this[capability]) {
        this[capability] = (...args) => this._callRemote(capability, ...args);
      }
    }
  }

  async _callRemote(method, ...args) {
    const callId = `call-${Date.now()}-${Math.random()}`;

    // Send remote-call message
    const promise = new Promise((resolve, reject) => {
      this._pendingCalls.set(callId, { resolve, reject });
    });

    this.receive({
      type: 'remote-call',
      callId,
      method,
      args
    });

    return promise;
  }
}
```

**Key points:**
- Dynamically creates methods based on capabilities list
- Each method call sends a `remote-call` message
- Returns a Promise that resolves when response arrives
- Complete transparency - looks like a local object

### Handle.receive() - Server Side

When a RemoteHandle calls a method, the real Handle on the server receives a message:

```javascript
async receive(message) {
  if (message.type === 'remote-call') {
    return await this._handleRemoteCall(message);
  }
  return super.receive(message);
}

async _handleRemoteCall(message) {
  const { callId, method, args = [] } = message;

  try {
    let result;

    // Check if method exists on Handle itself (custom methods like getData)
    if (typeof this[method] === 'function') {
      result = await this[method](...args);
    } else if (typeof this.dataSource[method] === 'function') {
      // Fall back to DataSource methods
      result = await this.dataSource[method](...args);
    } else {
      throw new Error(`Method '${method}' not found`);
    }

    // Send response back
    return {
      type: 'remote-response',
      callId,
      result
    };
  } catch (error) {
    return {
      type: 'remote-response',
      callId,
      error: error.message
    };
  }
}
```

**Key points:**
- Checks Handle methods first (getData, getMetadata, etc.)
- Falls back to DataSource methods (query, subscribe, etc.)
- Sends response with callId so RemoteHandle can resolve the Promise
- Error handling built-in

### RemoteCallManager

The **RemoteCallManager** tracks pending remote method calls:

```javascript
class RemoteCallManager {
  constructor() {
    this._pendingCalls = new Map(); // callId -> {resolve, reject}
  }

  createCall(callId) {
    return new Promise((resolve, reject) => {
      this._pendingCalls.set(callId, { resolve, reject });
    });
  }

  resolveCall(callId, result) {
    const pending = this._pendingCalls.get(callId);
    if (pending) {
      pending.resolve(result);
      this._pendingCalls.delete(callId);
    }
  }

  rejectCall(callId, error) {
    const pending = this._pendingCalls.get(callId);
    if (pending) {
      pending.reject(error);
      this._pendingCalls.delete(callId);
    }
  }
}
```

Used by RemoteHandle to manage async method calls.

---

## Serialization and Remote Communication

### Complete Serialization Flow

**Step 1: Actor creates object with Handle**

```javascript
const imageHandle = new ImageHandle({
  id: 'img-123',
  data: 'data:image/png;base64,iVBORw0...'
});

serverActor.remoteActor.receive('display-asset', {
  asset: imageHandle,
  title: 'Test Image'
});
```

**Step 2: RemoteActor wraps in message**

```javascript
{
  type: 'receive',
  targetGuid: 'client-root',
  messageType: 'display-asset',
  data: {
    asset: imageHandle,  // Still the actual Handle object
    title: 'Test Image'
  }
}
```

**Step 3: Channel.send() serializes**

```javascript
channel.send(targetGuid, messageType, data) {
  const message = { type: 'receive', targetGuid, messageType, data };
  const json = this.actorSpace.serializer.serialize(message);
  this.endpoint.send(json);
}
```

**Step 4: ActorSerializer processes**

During `JSON.stringify`, when it encounters `imageHandle`:
- Detects `isActor === true`
- Checks if GUID exists, generates if not
- Calls `imageHandle.serialize()`
- Gets back: `{ __type: 'RemoteHandle', handleType: 'ImageHandle', capabilities: [...] }`
- Merges with GUID: `{ $actor: 'server-123-0', __type: 'RemoteHandle', ... }`

**Step 5: WebSocket transmission**

```json
{
  "type": "receive",
  "targetGuid": "client-root",
  "messageType": "display-asset",
  "data": {
    "asset": {
      "$actor": "server-123-0",
      "__type": "RemoteHandle",
      "handleType": "ImageHandle",
      "schema": {...},
      "capabilities": ["getData", "getMetadata", "getType", "getTitle"]
    },
    "title": "Test Image"
  }
}
```

**Step 6: Client Channel receives**

```javascript
channel._handleEndpointMessage(event) {
  const message = this.actorSpace.serializer.deserialize(event.data, this);
  this.actorSpace.handleIncomingMessage(message);
}
```

**Step 7: ActorSerializer deserializes**

During `JSON.parse`, when it encounters the asset object:
- Sees `$actor` property
- Sees `__type: 'RemoteHandle'`
- Creates new RemoteHandle:
  ```javascript
  const remoteHandle = new RemoteHandle(
    'ImageHandle',
    schema,
    ['getData', 'getMetadata', 'getType', 'getTitle'],
    'server-123-0',
    channel
  );
  ```
- Auto-generates local GUID and registers in client ActorSpace

**Step 8: RemoteHandle constructor creates methods**

```javascript
for (const capability of capabilities) {
  this[capability] = (...args) => this._callRemote(capability, ...args);
}
```

Now the client has a proxy with `getData()`, `getMetadata()`, etc.

**Step 9: Client actor receives**

```javascript
clientActor.receive('display-asset', {
  asset: remoteHandle,  // Looks like a local Handle!
  title: 'Test Image'
});
```

**Step 10: Client calls method**

```javascript
const imageData = await asset.getData();
```

This triggers:
1. `remoteHandle._callRemote('getData', [])`
2. Sends `remote-call` message through channel
3. Server receives, calls `imageHandle.getData()`
4. Server sends `remote-response` with result
5. RemoteHandle resolves Promise with result

---

## Server Framework Integration

### ConfigurableActorServer

The **ConfigurableActorServer** provides declarative server setup:

```javascript
class ShowMeServer extends ConfigurableActorServer {
  constructor(config) {
    super({
      port: 3700,
      routes: [
        {
          path: '/showme',
          serverActor: './actors/ShowMeServerActor.js',
          clientActor: '../client/actors/ShowMeClientActor.js'
        }
      ],
      services: {
        'assetStorage': './services/AssetStorageService.js'
      }
    });
  }
}
```

**Key features:**
- Automatic actor loading from file paths
- Service injection
- WebSocket setup
- Static file serving
- Legion package routes

### ActorSpaceManager

The **ActorSpaceManager** manages ActorSpace lifecycles and connections:

```javascript
class ActorSpaceManager {
  handleConnection(ws, route) {
    // 1. Create new ActorSpace for this connection
    const actorSpace = new ActorSpace(`server-${Date.now()}`);

    // 2. Load server actor class
    const ServerActor = await import(routeConfig.serverActor);

    // 3. Create server actor with services
    const serverActor = new ServerActor.default(services);

    // 4. Register in ActorSpace
    const guid = `server-root-${Date.now()}`;
    actorSpace.register(serverActor, guid);

    // 5. Create channel
    const channel = actorSpace.addChannel(ws);

    // 6. Create remote reference to client
    const remoteClient = channel.makeRemote(clientGuid);

    // 7. Give remote reference to server actor
    await serverActor.setRemoteActor(remoteClient);
  }
}
```

**Key points:**
- One ActorSpace per WebSocket connection
- Automatic actor instantiation
- Service injection via constructor
- No manual ActorSpace management in actor code

### Server Actor Structure

A proper server actor knows nothing about ActorSpace:

```javascript
export class ShowMeServerActor extends Actor {
  constructor(services = {}) {
    super();
    this.server = services.server;
    this.remoteActor = null;  // Set by framework
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    // Now can send messages to client
  }

  async handleDisplayAsset({ assetId, assetType, title, asset }) {
    // Create Handle
    const imageHandle = new ImageHandle({
      id: assetId,
      title: title,
      data: asset.data
    });

    // Send to client - serialization is automatic!
    this.remoteActor.receive('display-asset', {
      asset: imageHandle,
      title
    });
  }
}
```

**Key points:**
- No ActorSpace references
- No manual registration
- No serialization code
- Just create objects and send them
- Framework handles everything

### Client Actor Structure

Client actors are equally simple:

```javascript
export class ShowMeClientActor extends Actor {
  constructor() {
    super();
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(messageType, data) {
    if (messageType === 'display-asset') {
      await this.handleDisplayAsset(data);
    }
  }

  async handleDisplayAsset({ asset, title }) {
    // asset is a RemoteHandle - use it like a local object!
    const imageData = await asset.getData();
    const metadata = await asset.getMetadata();

    // Display the image
    const img = document.createElement('img');
    img.src = imageData;
    img.alt = metadata.title;
    document.body.appendChild(img);
  }
}
```

**Key points:**
- RemoteHandle looks exactly like a local Handle
- Async method calls work transparently
- No awareness of network communication
- Clean, simple code

---

## Complete Flow Examples

### Example 1: Sending an ImageHandle

**Server Side:**
```javascript
// 1. Create ImageHandle
const imageHandle = new ImageHandle({
  id: 'img-123',
  title: 'Cat Picture',
  type: 'image/png',
  data: 'data:image/png;base64,iVBORw0KGg...',
  width: 800,
  height: 600
});

// 2. Send to client
serverActor.remoteActor.receive('display-asset', {
  asset: imageHandle
});
```

**What happens:**
1. RemoteActor wraps in message
2. Channel serializes via ActorSerializer
3. ActorSerializer sees `isActor`, auto-registers, calls `serialize()`
4. Gets: `{ $actor: 'guid', __type: 'RemoteHandle', capabilities: [...] }`
5. Sends JSON over WebSocket

**Client Side:**
```javascript
// 1. Client actor receives message
async handleDisplayAsset({ asset }) {
  // asset is RemoteHandle - looks like ImageHandle!

  // 2. Call methods
  const imageData = await asset.getData();     // Remote call
  const metadata = await asset.getMetadata(); // Remote call

  // 3. Use the data
  displayImage(imageData, metadata);
}
```

**What happens:**
1. Channel deserializes via ActorSerializer
2. ActorSerializer sees `__type: 'RemoteHandle'`, creates RemoteHandle
3. RemoteHandle auto-creates methods from capabilities
4. Method calls send `remote-call` messages
5. Server Handle receives, executes, sends response
6. RemoteHandle resolves Promise with result

### Example 2: FileHandle with ResourceManager

**Server Side:**
```javascript
// 1. Create FileHandle via ResourceManager
const resourceManager = await ResourceManager.getInstance();
const fileHandle = await resourceManager.createHandleFromURI(
  'legion://local/filesystem/path/to/image.jpg'
);

// 2. Send to client
serverActor.remoteActor.receive('display-asset', {
  asset: fileHandle
});
```

**What happens:**
1. FileHandle extends Handle, has `isActor = true`
2. Implements `getData()` which reads file asynchronously
3. Serialization is automatic
4. Client receives RemoteHandle
5. Calling `getData()` triggers file read on server
6. Image data streams back to client

**Client Side:**
```javascript
async handleDisplayAsset({ asset }) {
  // Same code works for ImageHandle or FileHandle!
  const imageData = await asset.getData();
  displayImage(imageData);
}
```

**Key point:** Client code is identical regardless of Handle type.

### Example 3: Custom Handle Type

**Define Handle:**
```javascript
class VideoHandle extends Handle {
  constructor(videoData) {
    super(createVideoDataSource(videoData));
    this.videoData = videoData;
  }

  async getVideoUrl() {
    return this.videoData.url;
  }

  async getThumbnail() {
    return this.videoData.thumbnail;
  }

  async getDuration() {
    return this.videoData.duration;
  }

  serialize() {
    return {
      __type: 'RemoteHandle',
      handleType: 'VideoHandle',
      schema: this.dataSource.getSchema(),
      capabilities: [
        'query', 'subscribe', 'getSchema',
        'getVideoUrl', 'getThumbnail', 'getDuration'
      ]
    };
  }
}
```

**Use it:**
```javascript
// Server
const videoHandle = new VideoHandle({ url: '...', duration: 120 });
serverActor.remoteActor.receive('play-video', { video: videoHandle });

// Client
async receive(messageType, data) {
  if (messageType === 'play-video') {
    const url = await data.video.getVideoUrl();
    const thumbnail = await data.video.getThumbnail();
    const duration = await data.video.getDuration();
    playVideo(url, thumbnail, duration);
  }
}
```

**Everything just works:**
- Automatic serialization
- Automatic method proxy creation
- Transparent remote calls
- Type-safe interface

---

## Key Principles

### 1. Complete Isolation

- **Actor classes** know nothing about serialization
- **Handle classes** know nothing about ActorSpace
- **Server actors** don't manage connections
- **Serialization** happens at the Channel level

### 2. Automatic Everything

- GUID generation is automatic
- Actor registration is automatic
- Proxy creation is automatic
- Method proxying is automatic
- Error handling is automatic

### 3. Transparent Remoting

- RemoteHandle looks identical to Handle
- Method calls look synchronous (with await)
- No network code in business logic
- Type-safe interfaces

### 4. Extensible

- Add new Handle types easily
- Add new capabilities without changing infrastructure
- Custom DataSources for different backends
- Protocol remains the same

### 5. Testable

- Mock WebSockets for integration tests
- Test Actor communication without network
- Test Handle logic independently
- No framework dependencies in tests

---

## Common Patterns

### Pattern 1: Sending Multiple Handles

```javascript
serverActor.remoteActor.receive('display-gallery', {
  images: [
    new ImageHandle({...}),
    new ImageHandle({...}),
    new ImageHandle({...})
  ]
});

// Client receives array of RemoteHandles
async handleDisplayGallery({ images }) {
  for (const imageHandle of images) {
    const data = await imageHandle.getData();
    displayImage(data);
  }
}
```

### Pattern 2: Nested Handles

```javascript
const folderHandle = new FolderHandle({...});
const files = await folderHandle.getFiles(); // Returns array of FileHandles

for (const fileHandle of files) {
  const content = await fileHandle.getData();
  processFile(content);
}
```

### Pattern 3: Bidirectional Communication

```javascript
// Server to client
serverActor.remoteActor.receive('update', { handle: someHandle });

// Client to server
clientActor.remoteActor.receive('request', { query: {...} });
```

Both directions work identically!

### Pattern 4: Handle Composition

```javascript
class DocumentHandle extends Handle {
  constructor(doc) {
    super(createDocDataSource(doc));
    this.imageHandles = doc.images.map(img => new ImageHandle(img));
  }

  async getImages() {
    return this.imageHandles; // Returns array of ImageHandles
  }

  serialize() {
    return {
      __type: 'RemoteHandle',
      handleType: 'DocumentHandle',
      capabilities: ['getImages', 'getText', 'getTitle']
    };
  }
}
```

Client receives DocumentHandle, calls `getImages()`, gets RemoteHandles!

---

## Debugging Tips

### Enable Debug Logging

```javascript
// In ActorSerializer
console.log('Serializing:', value.constructor.name);
console.log('GUID:', guid);
console.log('Capabilities:', value.serialize?.());

// In RemoteHandle
console.log('Remote call:', method, args);
console.log('Got response:', result);

// In Channel
console.log('CHANNEL SEND:', targetGuid, messageType, data);
console.log('CHANNEL RECEIVE:', message);
```

### Check Actor Registration

```javascript
console.log('ActorSpace GUIDs:', Array.from(actorSpace.guidToObject.keys()));
console.log('ActorSpace actors:', Array.from(actorSpace.objectToGuid.keys()).map(a => a.constructor.name));
```

### Verify Handle Capabilities

```javascript
console.log('RemoteHandle capabilities:', remoteHandle.capabilities);
console.log('RemoteHandle methods:', Object.keys(remoteHandle).filter(k => typeof remoteHandle[k] === 'function'));
```

### Trace Message Flow

```javascript
// Override receive in both client and server actors
receive(messageType, data) {
  console.log(`[${this.constructor.name}] Received:`, messageType);
  return super.receive(messageType, data);
}
```

---

## Performance Considerations

### 1. Lazy Serialization

Actors are only serialized when sent over the wire, not when created.

### 2. GUID Caching

Once an actor has a GUID, it's reused for all subsequent sends.

### 3. RemoteHandle Reuse

If the same Handle is sent multiple times, the client reuses the same RemoteHandle.

### 4. Batching

Multiple messages can be batched in a single WebSocket frame (implemented at Channel level).

### 5. Streaming

Large data can be streamed by implementing chunked `getData()` methods.

---

## Security Considerations

### 1. Capability-Based Security

Handles explicitly list their capabilities. Client can only call listed methods.

### 2. GUID Privacy

GUIDs are scoped to ActorSpace. Different connections get different GUIDs.

### 3. Method Validation

Server validates all remote method calls before execution.

### 4. Error Isolation

Errors in remote calls don't crash the server, only reject the client Promise.

### 5. Resource Cleanup

When connections close, ActorSpaces and all Handles are garbage collected.

---

## Conclusion

The Actor-Handle architecture provides:

- **Transparency**: Remote objects look like local objects
- **Simplicity**: No boilerplate, no manual proxies
- **Type Safety**: Consistent interfaces across network
- **Extensibility**: Easy to add new types
- **Testability**: Mock everything easily
- **Performance**: Efficient serialization and caching
- **Robustness**: Automatic error handling

All while keeping business logic completely isolated from infrastructure concerns.