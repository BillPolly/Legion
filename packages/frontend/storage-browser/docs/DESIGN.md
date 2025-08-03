# StorageBrowser Component Design Document

## 1. Overview

### 1.1 Purpose
The StorageBrowser is an Umbilical MVVM component that provides a powerful, elegant interface for browsing and manipulating data in Legion's storage system. It connects to the backend StorageProvider through the Actor communication protocol, enabling real-time, bidirectional communication between the frontend and any storage provider (MongoDB, SQLite, Memory).

### 1.2 Goals
- **Unified Interface**: Single component for all storage providers
- **Real-time Updates**: Live data synchronization through Actor protocol
- **Rich Interactions**: Full CRUD operations with visual feedback
- **Query Capabilities**: MongoDB-style queries across all providers
- **Umbilical Compliance**: Follows Legion's component protocol
- **MVVM Architecture**: Clean separation of concerns internally

### 1.3 Integration Points
- **Frontend**: Umbilical Component Protocol for seamless integration
- **Backend**: Actor-based communication with StorageProvider
- **Storage**: Works with all Legion storage providers
- **Transport**: WebSocket for real-time bidirectional messaging

## 2. Architecture

### 2.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    StorageBrowser Component                 │
├─────────────────────────────────────────────────────────────┤
│  Umbilical Interface (create, introspect, validate)         │
├─────────────────────────────────────────────────────────────┤
│                      MVVM Architecture                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    ViewModel                          │  │
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
│                    Actor Client Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              StorageActorClient                       │  │
│  │  - Message Protocol                                  │  │
│  │  - Request/Response Handling                         │  │
│  │  - Error Recovery                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebSocketChannel                        │  │
│  │  - Connection Management                             │  │
│  │  - Auto-reconnection                                 │  │
│  │  - Message Serialization                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↕
                      WebSocket Protocol
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                  Backend Actor Server                        │
├─────────────────────────────────────────────────────────────┤
│  StorageActorHost → CollectionActor → StorageProvider       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Layers

#### Model Layer (`model/`)
- **StorageBrowserModel.js**: Core state management
  - Current provider and connection status
  - Selected collection and documents
  - Query history and saved queries
  - Pagination state
  - Cache management

- **QueryBuilder.js**: MongoDB-style query construction
  - Visual query builder state
  - Query validation
  - Query optimization hints

- **DataCache.js**: Client-side caching
  - Document cache with TTL
  - Query result caching
  - Invalidation on updates

#### View Layer (`view/`)
- **StorageBrowserView.js**: Main container and layout
  - Split-pane layout (collections | documents)
  - Toolbar and status bar
  - Theme management

- **CollectionTree.js**: Collection navigation
  - Hierarchical collection display
  - Collection statistics
  - Context menu actions

- **DocumentGrid.js**: Document display
  - Table view with columns
  - Card view for nested data
  - Pagination controls
  - Selection management

- **QueryEditor.js**: Query input interface
  - Syntax-highlighted input
  - Autocomplete suggestions
  - Query history dropdown

- **DocumentEditor.js**: CRUD operations UI
  - JSON editor with validation
  - Field-level editing
  - Bulk operations interface

#### ViewModel Layer (`viewmodel/`)
- **StorageBrowserViewModel.js**: Orchestration layer
  - Binds Model to View
  - Handles user commands
  - Manages Actor communication
  - Coordinates state updates
  - Implements business logic

#### Actor Client Layer (`actors/`)
- **StorageActorClient.js**: Backend communication
  - Implements Actor protocol
  - Request/response correlation
  - Subscription management
  - Error handling

- **WebSocketChannel.js**: Transport layer
  - WebSocket connection management
  - Auto-reconnection with exponential backoff
  - Message queuing during disconnection
  - Binary/JSON serialization

### 2.3 Data Flow

#### Query Execution Flow
```
User Input → QueryEditor → ViewModel → Model → ActorClient → WebSocket
                                                     ↓
                                              Backend Actor
                                                     ↓
                                             StorageProvider
                                                     ↓
WebSocket ← ActorClient ← Model ← ViewModel ← DocumentGrid ← Results
```

#### Real-time Update Flow
```
Backend Change → Actor Notification → WebSocket → ActorClient
                                            ↓
                                    Model (cache invalidation)
                                            ↓
                                    ViewModel (state update)
                                            ↓
                                    View (re-render)
```

## 3. Component Interface

### 3.1 Umbilical Contract
```javascript
StorageBrowser.create(umbilical)
```

### 3.2 Configuration Options
```javascript
{
  // Required
  dom: HTMLElement,           // Container element
  serverUrl: string,          // WebSocket server URL (e.g., 'ws://localhost:3700')
  
  // Provider Selection
  provider: string,           // 'mongodb' | 'sqlite' | 'memory'
  database: string,           // Database name (optional)
  
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
}
```

### 3.3 Public API Methods
```javascript
const browser = StorageBrowser.create(umbilical);

// Connection Management
browser.connect();                    // Establish connection
browser.disconnect();                 // Close connection
browser.reconnect();                  // Force reconnection
browser.isConnected();                // Check connection status

// Provider Operations
browser.setProvider(name);            // Switch storage provider
browser.getProviders();               // List available providers
browser.getProviderInfo();            // Current provider details

// Collection Operations
browser.getCollections();             // List all collections
browser.selectCollection(name);       // Select a collection
browser.createCollection(name);       // Create new collection
browser.dropCollection(name);         // Delete collection

// Document Operations
browser.getDocuments(query, options); // Query documents
browser.getDocument(id);              // Get single document
browser.createDocument(data);         // Insert document
browser.updateDocument(id, update);   // Update document
browser.deleteDocument(id);           // Delete document
browser.deleteDocuments(query);       // Bulk delete

// Query Operations
browser.executeQuery(query);          // Execute MongoDB-style query
browser.count(query);                 // Count matching documents
browser.aggregate(pipeline);          // Run aggregation pipeline

// UI Control
browser.setView(mode);                // Change view mode
browser.setTheme(theme);              // Change theme
browser.refresh();                    // Refresh current view
browser.clearCache();                 // Clear client cache

// Utility
browser.export(format);               // Export data (json/csv)
browser.import(file);                 // Import data
browser.destroy();                    // Cleanup component
```

## 4. Core Features (MVP)

### 4.1 Collection Management
- **Browse Collections**: Tree view of all collections
- **Collection Info**: Document count, size, indexes
- **Create/Drop**: Add or remove collections
- **Search**: Filter collections by name

### 4.2 Document Operations
- **List Documents**: Paginated document display
- **View Document**: Detailed document viewer
- **Create Document**: JSON editor with validation
- **Update Document**: In-place or modal editing
- **Delete Document**: With confirmation
- **Bulk Operations**: Select multiple for bulk actions

### 4.3 Query Execution
- **Query Editor**: MongoDB syntax with highlighting
- **Visual Builder**: Point-and-click query construction
- **Query History**: Recent queries with re-run
- **Save Queries**: Named query library
- **Export Results**: Download query results

### 4.4 Real-time Updates
- **Live Refresh**: Auto-update on backend changes
- **Change Notifications**: Visual indicators for changes
- **Optimistic Updates**: Immediate UI feedback
- **Conflict Resolution**: Handle concurrent edits

### 4.5 Provider Support
- **Provider Switching**: Change provider on-the-fly
- **Provider Capabilities**: Adjust UI for provider features
- **Universal Queries**: MongoDB syntax for all providers

## 5. Technical Design

### 5.1 State Management
```javascript
// Model State Structure
{
  connection: {
    status: 'connected' | 'connecting' | 'disconnected',
    serverUrl: string,
    provider: string,
    error: Error | null
  },
  
  collections: {
    list: Array<CollectionInfo>,
    selected: string | null,
    loading: boolean
  },
  
  documents: {
    items: Array<Document>,
    total: number,
    page: number,
    pageSize: number,
    loading: boolean,
    selected: Set<string>
  },
  
  query: {
    current: object,
    history: Array<QueryRecord>,
    saved: Array<SavedQuery>
  },
  
  ui: {
    mode: string,
    theme: string,
    documentView: string,
    splitRatio: number
  }
}
```

### 5.2 Actor Message Protocol

#### Request Message Format
```javascript
{
  type: 'request',
  id: string,              // Unique request ID
  actor: string,           // Target actor (e.g., 'CollectionActor')
  method: string,          // Method to call
  params: object,          // Method parameters
  timestamp: number
}
```

#### Response Message Format
```javascript
{
  type: 'response',
  id: string,              // Matching request ID
  success: boolean,
  data: any,               // Response data
  error: object | null,    // Error details if failed
  timestamp: number
}
```

#### Notification Message Format
```javascript
{
  type: 'notification',
  event: string,           // Event type
  data: object,            // Event data
  timestamp: number
}
```

### 5.3 Actor Communication Examples

#### List Collections
```javascript
// Request
{
  type: 'request',
  id: 'req-001',
  actor: 'StorageActor',
  method: 'listCollections',
  params: { provider: 'mongodb' }
}

// Response
{
  type: 'response',
  id: 'req-001',
  success: true,
  data: ['users', 'products', 'orders']
}
```

#### Query Documents
```javascript
// Request
{
  type: 'request',
  id: 'req-002',
  actor: 'CollectionActor',
  method: 'find',
  params: {
    collection: 'users',
    query: { status: 'active' },
    options: { limit: 25, skip: 0, sort: { name: 1 } }
  }
}

// Response
{
  type: 'response',
  id: 'req-002',
  success: true,
  data: {
    documents: [...],
    total: 150,
    page: 1,
    pageSize: 25
  }
}
```

#### Real-time Update Notification
```javascript
// Notification
{
  type: 'notification',
  event: 'document.updated',
  data: {
    collection: 'users',
    documentId: 'user-123',
    changes: { status: 'inactive' }
  }
}
```

## 6. UI/UX Design

### 6.1 Layout Structure
```
┌────────────────────────────────────────────────────────────┐
│                         Toolbar                            │
│ [Provider ▼] [Database ▼] [↻ Refresh] [+ New] [Import/Export] │
├────────────────┬───────────────────────────────────────────┤
│                │                                           │
│  Collections   │              Documents                    │
│                │                                           │
│  ▼ mydb        │  ┌──────────────────────────────────┐    │
│    ▷ users     │  │       Query Editor                │    │
│    ▶ products  │  │  db.products.find({ price: {     │    │
│      - items   │  │    $gte: 100                     │    │
│      - reviews │  │  }})                             │    │
│    ▷ orders    │  │  [Run Query] [Save] [History ▼]  │    │
│                │  └──────────────────────────────────┘    │
│                │                                           │
│  [+ Collection]│  ┌──────────────────────────────────┐    │
│                │  │     Document Grid/Table           │    │
│                │  │  ┌────┬──────┬────────┬──────┐  │    │
│                │  │  │ ID │ Name │ Price  │ Stock│  │    │
│                │  │  ├────┼──────┼────────┼──────┤  │    │
│                │  │  │ 1  │ Laptop│ $1200  │ 5    │  │    │
│                │  │  │ 2  │ Mouse │ $25    │ 50   │  │    │
│                │  │  └────┴──────┴────────┴──────┘  │    │
│                │  │  [◀ Prev] Page 1 of 6 [Next ▶]  │    │
│                │  └──────────────────────────────────┘    │
│                │                                           │
├────────────────┴───────────────────────────────────────────┤
│ Status: Connected to MongoDB | 3 collections | 150 documents│
└────────────────────────────────────────────────────────────┘
```

### 6.2 Interactive Elements

#### Collection Tree
- Click to select and load documents
- Right-click for context menu (Create Index, Drop, Export)
- Expand/collapse for nested views
- Drag to reorder (if supported)

#### Document Grid
- Click row to select
- Double-click to edit
- Right-click for context menu (Edit, Delete, Duplicate)
- Column resize and reorder
- Sort by clicking headers

#### Query Editor
- Syntax highlighting for MongoDB queries
- Auto-completion for field names
- Error highlighting for invalid syntax
- Keyboard shortcuts (Ctrl+Enter to run)

### 6.3 Visual Feedback

#### Loading States
- Spinner overlays during operations
- Skeleton screens for initial loads
- Progress bars for bulk operations

#### Success/Error Feedback
- Toast notifications for operations
- Inline error messages for validation
- Success animations for CRUD operations

#### Real-time Updates
- Highlight flash for updated documents
- Badge notifications for new documents
- Strikethrough for deleted documents

## 7. Implementation Plan

### Phase 1: Foundation (Backend Actor Server)
1. Create storage-actor-server.js
2. Implement WebSocket server
3. Create StorageActorHost
4. Implement CollectionActor with basic CRUD
5. Test actor communication protocol

### Phase 2: Frontend Infrastructure
1. Set up package structure
2. Create WebSocketChannel
3. Implement StorageActorClient
4. Test connection and messaging
5. Handle reconnection logic

### Phase 3: Core MVVM Implementation
1. Implement StorageBrowserModel
2. Create basic StorageBrowserView
3. Implement StorageBrowserViewModel
4. Wire up Umbilical interface
5. Test three-mode pattern

### Phase 4: UI Components
1. Implement CollectionTree
2. Create DocumentGrid with table view
3. Add QueryEditor with basic functionality
4. Implement DocumentEditor
5. Add pagination and sorting

### Phase 5: Features and Polish
1. Add query history and saved queries
2. Implement real-time updates
3. Add export/import functionality
4. Implement themes
5. Add keyboard shortcuts

### Phase 6: Testing
1. Unit tests for each MVVM layer
2. Integration tests for actor communication
3. Functional tests for user workflows
4. Mock actor tests for frontend isolation

## 8. API Reference

### 8.1 StorageBrowser.create(umbilical)
Main factory function following Umbilical protocol.

**Parameters:**
- `umbilical` (Object): Configuration object with all options

**Returns:**
- Instance object with public methods

**Modes:**
- Introspection: When `umbilical.describe` is provided
- Validation: When `umbilical.validate` is provided
- Instance: Normal operation mode

### 8.2 Event Specifications

#### onConnect(info)
Fired when connection is established.
```javascript
info = {
  provider: string,
  serverUrl: string,
  collections: number,
  timestamp: Date
}
```

#### onDocumentChange(change)
Fired on any document modification.
```javascript
change = {
  type: 'create' | 'update' | 'delete',
  collection: string,
  document: object | null,
  documentId: string,
  timestamp: Date
}
```

#### onError(error)
Fired on any error condition.
```javascript
error = {
  type: 'connection' | 'query' | 'operation',
  message: string,
  details: object,
  recoverable: boolean
}
```

## 9. Example Usage

### Basic Setup
```javascript
import { StorageBrowser } from '@legion/storage-browser';

const browser = StorageBrowser.create({
  dom: document.getElementById('storage-browser'),
  serverUrl: 'ws://localhost:3700',
  provider: 'mongodb',
  
  features: {
    query: true,
    create: true,
    update: true,
    delete: true
  },
  
  onConnect: (info) => {
    console.log(`Connected to ${info.provider}`);
  },
  
  onDocumentSelect: (doc) => {
    console.log('Selected:', doc);
  },
  
  onError: (error) => {
    console.error('Storage error:', error);
  }
});
```

### Query Execution
```javascript
// Execute a query programmatically
const results = await browser.executeQuery({
  status: 'active',
  createdAt: { $gte: new Date('2024-01-01') }
});

// Subscribe to query results
browser.onQueryExecute = (query, results) => {
  console.log(`Query returned ${results.length} documents`);
};
```

### Document Operations
```javascript
// Create a new document
const newDoc = await browser.createDocument({
  name: 'New Product',
  price: 99.99,
  inStock: true
});

// Update existing document
await browser.updateDocument(docId, {
  $set: { price: 89.99 },
  $inc: { views: 1 }
});

// Bulk delete
const deleted = await browser.deleteDocuments({
  status: 'archived'
});
```

## 10. Testing Strategy

### Unit Tests
- Test each MVVM layer in isolation
- Mock dependencies appropriately
- Focus on business logic and state management

### Integration Tests
- Test actor communication flow
- Verify WebSocket reconnection
- Test error recovery scenarios

### Functional Tests
- Complete user workflows
- UI interaction testing with jsdom
- Verify visual feedback and updates

### Performance Tests (Post-MVP)
- Large dataset handling
- Query performance
- Memory usage monitoring

## 11. Future Enhancements (Post-MVP)

### Advanced Features
- Schema validation and enforcement
- Data visualization (charts, graphs)
- Advanced aggregation pipeline builder
- Backup and restore functionality
- Multi-database support
- Collaborative editing with conflict resolution

### UI Enhancements
- Customizable layouts
- Advanced filtering and search
- Keyboard-only navigation
- Touch gesture support
- Accessibility improvements

### Developer Features
- Plugin system for custom views
- Custom query templates
- Webhook integration
- API for external tools

## 12. Conclusion

The StorageBrowser component provides a comprehensive solution for database interaction within the Legion framework. By combining the Umbilical Component Protocol with MVVM architecture and Actor-based communication, it delivers a powerful, maintainable, and extensible storage browsing experience.

The design prioritizes:
- **User Experience**: Intuitive interface with rich interactions
- **Developer Experience**: Clean API following Legion patterns
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Support for new providers and features
- **Real-time Capability**: Live updates through Actor protocol

This MVP implementation focuses on core functionality while laying the groundwork for future enhancements.