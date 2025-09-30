# RemoteHandle - Transparent Remote Handle Access

Enables seamless Handle resource sharing across Actor channels.

## Quick Overview

When you send a Handle through an Actor channel, the receiver gets a RemoteHandle that looks and behaves identically to the original Handle, but all operations transparently proxy to the server.

```javascript
// Server
const imageHandle = new ImageHandle(imageDataSource);
serverActor.send(imageHandle);

// Client automatically receives RemoteHandle
const remoteImage = clientReceives;

// Works identically to local Handle
const title = remoteImage.title;           // Property access
remoteImage.title = "New Title";          // Property update
const thumbnail = remoteImage.thumbnail(); // Projection
```

## Key Features

- **Self-referential**: RemoteHandle IS its own DataSource
- **Zero overhead**: PrototypeFactory provides native property access (no Proxy)
- **Fully typed**: Schema-based property manufacturing
- **Projectable**: Full support for Handle query combinators
- **Subscribable**: Real-time updates through Actor channels
- **Universal**: Works with any Handle type

## Architecture

```
RemoteHandle (extends Handle)
  ├── super(this)  // Self as DataSource
  ├── query() → Actor channel → Server Handle
  ├── subscribe() → Actor channel → Server Handle
  ├── getSchema() → Cached from serialization
  └── queryBuilder() → Standard query builder
```

## Documentation

See [DESIGN.md](./docs/DESIGN.md) for complete architecture and implementation details.

## Files

- `RemoteHandle.js` - Main RemoteHandle class
- `RemoteCallManager.js` - Manages remote method calls and responses
- `RemoteSubscriptionManager.js` - Manages subscriptions and push updates
- `docs/DESIGN.md` - Complete design document