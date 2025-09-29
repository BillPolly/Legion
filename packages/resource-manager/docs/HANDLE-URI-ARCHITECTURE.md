# Handle/URI Architecture

The Handle/URI architecture provides a unified interface for accessing heterogeneous resources through Legion URIs. This document provides comprehensive examples and architectural guidance for using the Handle/URI system.

## Overview

### Core Concepts

1. **Legion URIs** - Structured identifiers that locate resources: `legion://server/resourceType/path`
2. **Handles** - Resource proxies providing a uniform interface to underlying DataSources
3. **DataSources** - Backend adapters implementing resource-specific access logic
4. **ResourceManager** - Central coordinator managing Handle lifecycle and caching

### Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │────│  ResourceManager │────│     Handle      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
   Legion URIs              Handle Cache              DataSource
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ legion://local/ │    │   Promise-based  │    │  ConfigData     │
│ env/API_KEY     │    │     Caching      │    │  MongoData      │
│                 │    │   & Lifecycle    │    │  FileData       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## URI Structure

### Format
```
legion://server/resourceType/path
```

### Components

- **Protocol**: Always `legion://`
- **Server**: Deployment target (`local`, `staging`, `prod`, custom)
- **Resource Type**: Type of resource (`env`, `mongodb`, `filesystem`, `service`)
- **Path**: Resource-specific path (config key, database/collection, file path, etc.)

### Examples

```javascript
// Configuration variables
legion://local/env/ANTHROPIC_API_KEY
legion://prod/env/DATABASE_URL

// MongoDB resources  
legion://local/mongodb/projectdb/users
legion://staging/mongodb/analytics/events

// File system resources
legion://local/filesystem/workspace/config.json
legion://prod/filesystem/logs/application.log

// Service endpoints
legion://staging/service/auth/validate
legion://prod/service/payment/process
```

## Handle Types

### ConfigHandle - Environment Variables

**Purpose**: Access environment variables and configuration settings.

```javascript
import { ResourceManager } from '@legion/resource-manager';

// Create configuration handle
const resourceManager = await ResourceManager.getInstance();
const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');

// Access configuration value
const apiKey = configHandle.getValue();
console.log('API Key:', apiKey);

// Validate configuration
const isValid = configHandle.validate(apiKey);
console.log('Valid:', isValid);

// Check if key exists
const hasKey = configHandle.hasConfigKey('ANTHROPIC_API_KEY');
console.log('Key exists:', hasKey);

// Export all configuration (filtering secrets)
const publicConfig = configHandle.export({ includeSecrets: false });
const fullConfig = configHandle.export({ includeSecrets: true });

// Create child configuration handles
const dbHandle = configHandle.child('DATABASE');
const dbUrlHandle = dbHandle.child('URL'); // DATABASE.URL

// Navigate parent relationships
const parent = dbUrlHandle.parent(); // Back to DATABASE
```

### MongoHandle - MongoDB Resources

**Purpose**: Access MongoDB databases and collections.

```javascript
// Create MongoDB handle for a collection
const mongoHandle = await resourceManager.createHandleFromURI('legion://local/mongodb/projectdb/users');

// Access database metadata
const schema = mongoHandle.getSchema();
console.log('Database:', schema.database); // projectdb
console.log('Collection:', schema.collection); // users

// Handle metadata
const metadata = mongoHandle.getMetadata();
console.log('DataSource type:', metadata.dataSourceType); // MongoDataSource

// URI operations
console.log('URI:', mongoHandle.toURI()); // legion://local/mongodb/projectdb/users
console.log('String representation:', mongoHandle.toString());

// JSON serialization
const mongoJson = mongoHandle.toJSON();
console.log('Handle info:', mongoJson);
```

### FileHandle - File System Resources

**Purpose**: Access files and directories with advanced file operations.

```javascript
// Create file handle
const fileHandle = await resourceManager.createHandleFromURI('legion://local/filesystem/workspace/config.json');

// File information
console.log('File name:', fileHandle.getName()); // config.json
console.log('Extension:', fileHandle.getExtension()); // .json
console.log('File path:', fileHandle.filePath);

// File operations (async)
const exists = await fileHandle.exists();
if (exists) {
    // Read file content
    const content = await fileHandle.getContentAsync();
    console.log('Content:', content);
    
    // Get file statistics
    const stats = await fileHandle.getStatsAsync();
    console.log('Size:', stats.size);
    console.log('Modified:', stats.modified);
    
    // Write new content
    await fileHandle.write('{"updated": true}');
    
    // Append to file
    await fileHandle.append('\n// Added comment');
}

// Directory operations
const dirHandle = await resourceManager.createHandleFromURI('legion://local/filesystem/workspace');
if (dirHandle.handleType === 'directory') {
    // List directory contents
    const files = await dirHandle.list();
    console.log('Files:', files.map(f => f.name));
    
    // Find files by pattern
    const jsFiles = await dirHandle.find('*.js');
    console.log('JS files:', jsFiles.length);
}

// File hierarchy navigation
const configFile = dirHandle.child('config.json');
const parent = configFile.parent(); // Back to workspace directory

// File operations
await fileHandle.copy('/backup/config.json');
await fileHandle.move('/new/location/config.json');
// await fileHandle.delete({ force: true });
```

## ResourceManager Usage

### Singleton Pattern

```javascript
// Always use singleton instance
const resourceManager = await ResourceManager.getInstance();

// Static factory method for convenience  
const handle = await ResourceManager.fromURI('legion://local/env/API_KEY');
```

### URI Creation

```javascript
// Create URIs from components
const configUri = resourceManager.toURI('env', 'API_KEY', 'local');
// Returns: legion://local/env/API_KEY

const mongoUri = resourceManager.toURI('mongodb', 'mydb/users');  
// Returns: legion://local/mongodb/mydb/users (default server: local)

const fileUri = resourceManager.toURI('filesystem', 'data/file.txt', 'prod');
// Returns: legion://prod/filesystem/data/file.txt
```

### Handle Creation and Caching

```javascript
// Create handles (automatically cached)
const handle1 = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
const handle2 = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');

// Same cached instance
console.log(handle1 === handle2); // true

// Cache statistics
const stats = resourceManager.getHandleCacheStats();
console.log('Cached handles:', stats.handles.currentSize);
console.log('Cache hits:', stats.handles.hits);
console.log('Cache misses:', stats.handles.misses);
```

### Cache Management

```javascript
// Invalidate specific handles by pattern
resourceManager.invalidateHandleCache('.*mongodb.*');

// Clear all caches
resourceManager.clearHandleCaches();

// Check cache status
const isInCache = resourceManager._handleCache.has('legion://local/env/API_KEY');
```

## Advanced Usage Patterns

### Multi-Resource Application Setup

```javascript
class Application {
    constructor() {
        this.config = null;
        this.database = null;
        this.logFile = null;
    }
    
    async initialize() {
        // Initialize all application resources
        const [configHandle, dbHandle, logHandle] = await Promise.all([
            ResourceManager.fromURI('legion://local/env/ANTHROPIC_API_KEY'),
            resourceManager.createHandleFromURI('legion://local/mongodb/appdb/sessions'),
            resourceManager.createHandleFromURI('legion://local/filesystem/logs/app.log')
        ]);
        
        this.config = configHandle;
        this.database = dbHandle;
        this.logFile = logHandle;
        
        // Verify all resources are accessible
        const apiKey = this.config.getValue();
        const dbSchema = this.database.getSchema();
        const logExists = await this.logFile.exists();
        
        console.log('Application initialized with:');
        console.log('- API Key:', !!apiKey);
        console.log('- Database:', dbSchema.database);
        console.log('- Log file exists:', logExists);
    }
    
    async shutdown() {
        // Clean up resources
        if (this.config) this.config.destroy();
        if (this.database) this.database.destroy();
        if (this.logFile) this.logFile.destroy();
    }
}
```

### Subscription and Real-time Updates

```javascript
// Subscribe to configuration changes
const configHandle = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');

const subscription = configHandle.subscribe((changes) => {
    console.log('Configuration changed:', changes);
    // Reload application configuration
    reloadConfig();
});

// Subscribe to file system changes
const fileHandle = await resourceManager.createHandleFromURI('legion://local/filesystem/config.json');

const fileSubscription = fileHandle.subscribe((changes) => {
    console.log('Config file changed:', changes);
    // Reload configuration from file
    reloadConfigFile();
}, { 
    watchAll: true // Watch entire directory tree
});

// Clean up subscriptions
subscription.unsubscribe();
fileSubscription.unsubscribe();
```

### Error Handling and Recovery

```javascript
async function robustHandleAccess() {
    try {
        // Create handle with error handling
        const handle = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
        
        // Verify handle is not destroyed
        if (handle.isDestroyed()) {
            throw new Error('Handle was destroyed');
        }
        
        // Access resource safely
        const value = handle.getValue();
        if (!value) {
            console.warn('Configuration value is empty');
        }
        
        return handle;
        
    } catch (error) {
        console.error('Handle access failed:', error.message);
        
        // Implement fallback strategy
        if (error.message.includes('not found')) {
            console.log('Using default configuration');
            return createDefaultHandle();
        }
        
        throw error; // Re-throw if not recoverable
    }
}

// Handle lifecycle management
function handleLifecycle() {
    let handle = null;
    
    try {
        handle = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
        
        // Use handle
        const value = handle.getValue();
        
    } finally {
        // Always clean up
        if (handle && !handle.isDestroyed()) {
            handle.destroy();
        }
    }
}
```

### Query Builders and Advanced Operations

```javascript
// Configuration query builder
const configHandle = await resourceManager.createHandleFromURI('legion://local/env/DATABASE');
const queryBuilder = configHandle.query();

const dbConfigs = await queryBuilder
    .whereKey('DATABASE.*')
    .whereValue(/.+/)  // Non-empty values
    .toArray();

console.log('Database configurations:', dbConfigs);

// File system query builder
const dirHandle = await resourceManager.createHandleFromURI('legion://local/filesystem/src');
const fileQueryBuilder = dirHandle.queryBuilder();

const jsFiles = await fileQueryBuilder
    .pattern('**/*.js')
    .type('file')
    .ignore(['node_modules/**', 'dist/**'])
    .toArray();

console.log('JavaScript files:', jsFiles.length);

// Get first matching file
const mainFile = await fileQueryBuilder
    .name('main.js')
    .first();

if (mainFile) {
    console.log('Found main.js:', mainFile.uri);
}
```

## Performance Considerations

### Handle Caching

The ResourceManager implements efficient Handle caching:

- **Promise-based caching**: Prevents race conditions during concurrent access
- **Automatic cleanup**: Handles are removed from cache when destroyed
- **Memory efficient**: ~43KB per cached Handle
- **High performance**: 160,000+ operations per second throughput
- **Cache invalidation**: Pattern-based invalidation for bulk cleanup

### Best Practices

1. **Reuse Handles**: Always use the same URI to benefit from caching
2. **Proper cleanup**: Always call `handle.destroy()` when done
3. **Batch operations**: Create multiple Handles concurrently when possible
4. **Monitor cache**: Use `getHandleCacheStats()` to monitor cache efficiency

### Performance Metrics

From performance tests:

```
Cache Performance:
- Cache hit speedup: 41.7x faster than creation
- Cache overhead: 184x vs direct object access (still efficient)
- Memory per handle: 42.96KB
- Cache capacity: 200 handles maximum

Scaling Performance:
- Linear scaling with 0.76x scaling factor
- Concurrent access: 163,694 ops/sec
- Race condition prevention: 100% reliable
- Cache invalidation: <1ms for 200 handles
```

## Testing

### Unit Tests

```javascript
import { ResourceManager } from '@legion/resource-manager';

describe('Handle/URI Integration', () => {
    let resourceManager;
    
    beforeEach(async () => {
        resourceManager = await ResourceManager.getInstance();
    });
    
    afterEach(() => {
        // Clean up handles
        resourceManager.clearHandleCaches();
    });
    
    it('should create and use configuration handle', async () => {
        const handle = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
        
        expect(handle.constructor.name).toBe('ConfigHandle');
        expect(handle.getValue()).toBeDefined();
        expect(handle.toURI()).toBe('legion://local/env/API_KEY');
        
        handle.destroy();
    });
});
```

### End-to-End Tests

```javascript
it('should demonstrate complete application workflow', async () => {
    // Application setup
    const config = await ResourceManager.fromURI('legion://local/env/API_KEY');
    const db = await resourceManager.createHandleFromURI('legion://local/mongodb/app/users');
    const log = await resourceManager.createHandleFromURI('legion://local/filesystem/app.log');
    
    // Verify application resources
    expect(config.getValue()).toBeDefined();
    expect(db.getSchema().database).toBe('app');
    
    // Test Handle caching
    const cachedConfig = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
    expect(cachedConfig).toBe(config); // Same cached instance
    
    // Application shutdown
    config.destroy();
    db.destroy();
    log.destroy();
});
```

## Migration Guide

### From Direct Resource Access

**Before:**
```javascript
// Direct environment variable access
const apiKey = process.env.ANTHROPIC_API_KEY;

// Direct file access
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json'));

// Direct MongoDB access
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI);
```

**After:**
```javascript
// Handle-based access
const resourceManager = await ResourceManager.getInstance();

const configHandle = await resourceManager.createHandleFromURI('legion://local/env/ANTHROPIC_API_KEY');
const apiKey = configHandle.getValue();

const fileHandle = await resourceManager.createHandleFromURI('legion://local/filesystem/config.json');
const config = JSON.parse(await fileHandle.getContentAsync());

const mongoHandle = await resourceManager.createHandleFromURI('legion://local/mongodb/app/users');
const schema = mongoHandle.getSchema();
```

### Benefits of Migration

1. **Unified Interface**: Same API for all resource types
2. **Automatic Caching**: Performance optimization without code changes
3. **Real-time Updates**: Subscribe to resource changes
4. **Error Handling**: Consistent error patterns across resources
5. **Testability**: Easy mocking and testing with Handle patterns
6. **Scalability**: Built-in performance optimizations and monitoring

## API Reference

### ResourceManager

```javascript
class ResourceManager {
    // Singleton access
    static async getInstance(): Promise<ResourceManager>
    static async fromURI(uri: string): Promise<Handle>
    
    // Handle creation
    async createHandleFromURI(uri: string): Promise<Handle>
    
    // URI utilities
    toURI(resourceType: string, path: string, server?: string): string
    _parseURI(uri: string): ParsedURI
    
    // Cache management
    getHandleCacheStats(): CacheStats
    clearHandleCaches(): void
    invalidateHandleCache(pattern: string): void
}
```

### Handle Base Interface

```javascript
class Handle {
    // Lifecycle
    destroy(): void
    isDestroyed(): boolean
    clone(): Handle
    
    // Metadata
    getMetadata(): Object
    getSchema(): Object
    toURI(): string
    toString(): string
    toJSON(): Object
    
    // Subscriptions
    subscribe(callback: Function, options?: Object): Subscription
    
    // Hierarchy
    parent(): Handle | null
    child(path: string): Handle
}
```

### ConfigHandle

```javascript
class ConfigHandle extends Handle {
    getValue(): any
    hasConfigKey(key: string): boolean
    validate(value?: any): boolean
    export(options: { includeSecrets: boolean }): Object
    query(): ConfigQueryBuilder
}
```

### FileHandle

```javascript
class FileHandle extends Handle {
    // Content access
    getContent(options?: Object): string
    async getContentAsync(options?: Object): Promise<string>
    async write(content: string, options?: Object): Promise<Object>
    async append(content: string, options?: Object): Promise<Object>
    
    // File operations
    async exists(): Promise<boolean>
    async copy(destination: string, options?: Object): Promise<FileHandle>
    async move(destination: string): Promise<FileHandle>
    async delete(options?: Object): Promise<Object>
    
    // Directory operations
    async list(options?: Object): Promise<Array<FileHandle>>
    async find(pattern: string, options?: Object): Promise<Array<FileHandle>>
    async mkdir(options?: Object): Promise<Object>
    
    // File metadata
    getStats(): Object
    async getStatsAsync(): Promise<Object>
    getName(): string
    getExtension(): string
    
    // Query builder
    queryBuilder(): FileQueryBuilder
}
```

## Troubleshooting

### Common Issues

1. **Handle destroyed errors**: Always check `handle.isDestroyed()` before use
2. **Cache misses**: Ensure exact URI matching for cache hits
3. **Memory leaks**: Always call `handle.destroy()` in finally blocks
4. **Async operations**: Use `*Async()` methods for file system operations

### Debug Information

```javascript
// Get cache statistics
const stats = resourceManager.getHandleCacheStats();
console.log('Cache stats:', stats);

// Monitor handle lifecycle
const handle = await resourceManager.createHandleFromURI('legion://local/env/API_KEY');
console.log('Handle created:', handle.toString());
console.log('Handle metadata:', handle.getMetadata());
```

This architecture provides a robust, performant, and scalable foundation for resource access across the Legion framework.