# StorageBrowser - Umbilical MVVM Component

A powerful, elegant storage browser component with Actor-based backend communication for the Legion framework.

## 🎯 Features

- **Umbilical Component Protocol** - Seamless integration with Legion ecosystem
- **Actor-Based Communication** - Real-time bidirectional messaging via WebSocket
- **MVVM Architecture** - Clean separation of concerns with Model-View-ViewModel pattern
- **Multi-Provider Support** - Works with MongoDB, SQLite, and Memory storage providers
- **Rich UI** - Collection browser, document grid, query editor with syntax highlighting
- **Real-time Updates** - Live synchronization of data changes
- **MongoDB Query Syntax** - Universal query language across all providers

## 🚀 Quick Start

```javascript
import { StorageBrowser } from '@legion/storage-browser';

const browser = StorageBrowser.create({
  dom: document.getElementById('container'),
  serverUrl: 'ws://localhost:3700/storage',
  provider: 'mongodb',
  
  onConnect: (info) => console.log('Connected to', info.provider),
  onError: (error) => console.error('Error:', error)
});
```

## 📋 Requirements

- Node.js 18+
- WebSocket server (Storage Actor Server)
- Modern browser with ES6 module support

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                StorageBrowser Component                     │
├─────────────────────────────────────────────────────────────┤
│  Umbilical Interface (create, introspect, validate)         │
├─────────────────────────────────────────────────────────────┤
│                    MVVM Architecture                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  ViewModel                            │  │
│  │  - Event Coordination                                │  │
│  │  - Command Processing                                │  │
│  │  - State Synchronization                             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─────────────────────┐  ┌────────────────────────────┐  │
│  │        Model         │  │          View              │  │
│  │  - State Management  │  │  - DOM Rendering          │  │
│  │  - Data Caching     │  │  - User Interaction       │  │
│  │  - Query Building   │  │  - Visual Feedback        │  │
│  └─────────────────────┘  └────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Actor Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            StorageActorClient                         │  │
│  │  - Message Protocol                                  │  │
│  │  - Request/Response Handling                         │  │
│  │  - Error Recovery                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            WebSocketChannel                          │  │
│  │  - Connection Management                             │  │
│  │  - Auto-reconnection                                 │  │
│  │  - Message Serialization                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
                    WebSocket Protocol
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                Backend Actor Server                          │
├─────────────────────────────────────────────────────────────┤
│  StorageActorHost → CollectionActor → StorageProvider       │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Configuration

### Full Configuration Example

```javascript
StorageBrowser.create({
  // Required
  dom: HTMLElement,           // Container element
  serverUrl: string,          // WebSocket server URL
  
  // Provider Selection
  provider: 'mongodb',        // 'mongodb' | 'sqlite' | 'memory'
  database: 'myapp',          // Database name
  
  // Display Options
  mode: 'split',              // 'split' | 'collections' | 'documents'
  theme: 'light',             // 'light' | 'dark' | 'auto'
  layout: {
    splitRatio: 30,           // Percentage for collection pane
    collapsible: true         // Allow pane collapse
  },
  
  // Features
  features: {
    query: true,              // Enable query editor
    create: true,             // Enable document creation
    update: true,             // Enable document editing
    delete: true,             // Enable document deletion
    export: true,             // Enable export functionality
    import: true              // Enable import functionality
  },
  
  // Display Preferences
  display: {
    documentsView: 'table',   // 'table' | 'cards' | 'json'
    pageSize: 25,             // Documents per page
    maxNesting: 5,            // Max depth for nested display
    dateFormat: 'iso'         // Date display format
  },
  
  // Event Callbacks
  onConnect: (info) => {},    // Connection established
  onDisconnect: (reason) => {},// Connection lost
  onProviderChange: (provider) => {}, // Provider switched
  onCollectionSelect: (collection) => {}, // Collection selected
  onDocumentSelect: (document) => {}, // Document selected
  onDocumentChange: (change) => {}, // Document CRUD event
  onQueryExecute: (query, results) => {}, // Query executed
  onError: (error) => {},     // Error occurred
  
  // Lifecycle
  onMount: (instance) => {},  // Component mounted
  onDestroy: (instance) => {} // Component destroyed
})
```

## 🔌 Backend Setup

### 1. Start Storage Actor Server

```javascript
import { StorageActorServer } from '@legion/storage/server/storage-actor-server.js';
import { ResourceManager } from '@legion/module-loader';

const resourceManager = new ResourceManager();
await resourceManager.initialize();

const server = new StorageActorServer({ resourceManager });
await server.start();
console.log('Storage Actor Server running on ws://localhost:3700/storage');
```

### 2. Environment Variables

```bash
# .env
MONGODB_URL=mongodb://localhost:27017/myapp
SQLITE_FILE=./data/storage.db
STORAGE_ACTOR_PORT=3700
```

## 🎮 API Reference

### Instance Methods

```javascript
const browser = StorageBrowser.create(config);

// Connection Management
await browser.connect();
browser.disconnect();
browser.isConnected();

// Provider Operations
await browser.setProvider('mongodb');
const providers = browser.getProviders();
const info = browser.getProviderInfo();

// Collection Operations
const collections = await browser.getCollections();
await browser.selectCollection('users');
await browser.createCollection('newCollection');
await browser.dropCollection('oldCollection');

// Document Operations
const docs = await browser.getDocuments({ status: 'active' });
const doc = await browser.getDocument('doc-id');
const result = await browser.createDocument({ name: 'New Doc' });
await browser.updateDocument('doc-id', { $set: { status: 'updated' } });
await browser.deleteDocument('doc-id');

// Query Operations
const results = await browser.executeQuery({ 
  age: { $gte: 18 },
  status: 'active'
});
const count = await browser.count({ verified: true });

// UI Control
browser.setView('documents');
browser.setTheme('dark');
browser.refresh();

// Utility
const data = await browser.export('json');
await browser.import(jsonData);

// Cleanup
browser.destroy();
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run specific test
npm test basic.test.js

# Run with coverage
npm run test:coverage
```

## 🚀 Development

### Start Demo Server

```bash
npm run dev
# Visit http://localhost:3600
```

### Project Structure

```
src/
├── index.js                 # Main Umbilical component
├── model/
│   ├── StorageBrowserModel.js    # State management
│   ├── QueryBuilder.js           # MongoDB query builder
│   └── DataCache.js              # Client-side caching
├── view/
│   ├── StorageBrowserView.js     # DOM rendering
│   └── ...                       # UI components
├── viewmodel/
│   └── StorageBrowserViewModel.js # Coordination layer
├── actors/
│   ├── StorageActorClient.js     # Actor client
│   └── WebSocketChannel.js       # WebSocket transport
└── styles/
    └── storage-browser.css       # Component styles
```

## 📚 Examples

### Basic Usage

```javascript
import { StorageBrowser } from '@legion/storage-browser';

const browser = StorageBrowser.create({
  dom: document.getElementById('browser'),
  serverUrl: 'ws://localhost:3700/storage',
  provider: 'mongodb'
});
```

### With Event Handlers

```javascript
const browser = StorageBrowser.create({
  dom: container,
  serverUrl: 'ws://localhost:3700/storage',
  
  onConnect: () => console.log('Connected!'),
  onDocumentSelect: (doc) => console.log('Selected:', doc),
  onError: (error) => alert(`Error: ${error.message}`)
});
```

### Query Examples

```javascript
// Simple queries
await browser.executeQuery({ status: 'active' });
await browser.executeQuery({ age: { $gte: 18 } });

// Complex queries
await browser.executeQuery({
  $and: [
    { status: 'active' },
    { age: { $gte: 18, $lt: 65 } },
    { role: { $in: ['user', 'admin'] } }
  ]
});
```

## 🤝 Contributing

1. Follow TDD approach
2. Update implementation plan
3. Add comprehensive tests
4. Maintain Umbilical protocol compliance

## 📄 License

MIT - See LICENSE file for details

---

**StorageBrowser** - Part of the Legion Framework  
*Elegant storage browsing with real-time Actor communication*