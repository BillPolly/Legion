# New Tool Registry Design Document

## Executive Summary

This document specifies the design for a clean, test-driven implementation of the Legion Tool Registry system. The new implementation will replace the existing complex and unreliable tools-registry package with a modular, well-tested system that provides both core tool management and optional semantic search capabilities.

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Registry System                         │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Core Module Loader                                   │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   ModuleLoader  │────│ Legion Module   │                    │
│  │                 │    │ (JavaScript)    │                    │
│  └─────────────────┘    └─────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 2: Discovery & Database                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ ModuleDiscovery │────│ DatabaseService │                    │
│  │                 │    │   (MongoDB)     │                    │
│  └─────────────────┘    └─────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 3: Tool Registry                                        │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  ToolRegistry   │────│   TextSearch    │                    │
│  │   (with cache)  │    │                 │                    │
│  └─────────────────┘    └─────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│  Phase 4-5: Semantic Search (Optional)                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │PerspectiveGen   │────│ SemanticSearch  │────│   Qdrant    │ │
│  │    (LLM)        │    │  (Embeddings)   │    │  (Vectors)  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Test-Driven Development**: Every component has comprehensive unit and integration tests
2. **Clean Architecture**: Simple, focused classes with clear responsibilities
3. **Graceful Degradation**: Core functionality works without optional features
4. **Resource Management**: Proper lifecycle management with clean shutdown
5. **Fail-Fast**: Clear error handling and validation

## Database Schema Design

### Collections Overview

```javascript
// 1. module_registry - Discovery phase output
{
  _id: ObjectId,
  name: "CalculatorModule",
  path: "/path/to/calculator/index.js",
  type: "class", // or "json"
  discoveredAt: ISODate,
  lastModified: ISODate
}

// 2. modules - Runtime module instances  
{
  _id: ObjectId,
  name: "CalculatorModule", 
  description: "Mathematical calculation tools",
  version: "1.0.0",
  path: "/path/to/calculator/index.js",
  className: "CalculatorModule",
  toolCount: 5,
  loadedAt: ISODate,
  metadata: { /* module-specific data */ }
}

// 3. tools - Tool definitions and metadata
{
  _id: ObjectId,
  name: "add",
  moduleName: "CalculatorModule",
  moduleId: ObjectId("..."),
  description: "Add two numbers together",
  inputSchema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" }
    },
    required: ["a", "b"]
  },
  outputSchema: {
    type: "object", 
    properties: {
      result: { type: "number" }
    }
  },
  examples: [
    { input: { a: 5, b: 3 }, output: { result: 8 } }
  ],
  createdAt: ISODate
}

// 4. tool_perspectives - LLM-generated perspectives with embeddings
{
  _id: ObjectId,
  toolId: ObjectId("..."),
  toolName: "add",
  perspective: "calculation",
  title: "Mathematical Addition",
  description: "Performs basic arithmetic addition of two numeric values",
  useCase: "Use when you need to calculate the sum of two numbers",
  keywords: ["math", "arithmetic", "addition", "sum", "calculate"],
  embedding: [0.1, -0.2, 0.15, ...], // 384-dimensional vector
  generatedAt: ISODate,
  llmModel: "claude-3-haiku"
}
```

### Database Indexes

```javascript
// Performance and uniqueness indexes
db.modules.createIndex({ name: 1 }, { unique: true });
db.tools.createIndex({ name: 1, moduleName: 1 }, { unique: true });
db.tools.createIndex({ moduleName: 1 });
db.tool_perspectives.createIndex({ toolId: 1 });
db.tool_perspectives.createIndex({ toolName: 1 });

// Text search indexes
db.tools.createIndex({ 
  name: "text", 
  description: "text",
  "metadata.keywords": "text"
});
```

## Component Specifications

### Phase 1: Core Module Loader

#### ModuleLoader Class

**Purpose**: Load and interact with Legion module JavaScript files

**Interface**:
```javascript
class ModuleLoader {
  constructor(options = {})
  
  // Core capabilities
  async loadModule(modulePath) // Load JS file, return module instance
  async getModuleMetadata(moduleInstance) // Extract name, description, version
  async getTools(moduleInstance) // Get array of tool definitions
  async invokeTool(toolInstance, parameters) // Execute tool with params
  
  // Validation
  validateModuleStructure(moduleInstance) // Check required methods/properties
  validateToolSchema(tool) // Validate tool input/output schemas
}
```

**Key Features**:
- Dynamic import of ES modules
- Comprehensive error handling for malformed modules
- Schema validation using JSON Schema or Zod
- Sandbox execution for tool invocation
- Support for both class-based and object-based modules

**Error Handling**:
```javascript
class ModuleLoadError extends Error {
  constructor(modulePath, cause) {
    super(`Failed to load module at ${modulePath}: ${cause.message}`);
    this.modulePath = modulePath;
    this.cause = cause;
  }
}

class ToolExecutionError extends Error {
  constructor(toolName, parameters, cause) {
    super(`Tool '${toolName}' execution failed: ${cause.message}`);
    this.toolName = toolName;
    this.parameters = parameters;
    this.cause = cause;
  }
}
```

### Phase 2: Module Discovery & Database Storage

#### ModuleDiscovery Class

**Purpose**: Find all Legion module files in the monorepo

**Interface**:
```javascript
class ModuleDiscovery {
  constructor(options = {})
  
  async discoverModules(searchPaths = []) // Find module files
  async saveToRegistry(modules) // Write to module_registry collection
  async getRegisteredModules(filter = {}) // Read from registry
  
  // Discovery strategies
  findClassModules(basePath) // Find index.js with class exports
  findJsonModules(basePath) // Find module.json definitions
  validateModuleFiles(modules) // Check files exist and are readable
}
```

**Discovery Logic**:
```javascript
// Search patterns for module discovery
const discoveryPatterns = [
  'packages/*/index.js',           // Direct package modules
  'packages/*/src/index.js',       // Source-based modules  
  'packages/*/module.json',        // JSON module definitions
  'tools/*/index.js'               // Tool collection modules
];

// Validation criteria
const moduleValidation = {
  classModule: {
    hasDefaultExport: true,
    hasGetToolsMethod: true,
    hasModuleMetadata: true
  },
  jsonModule: {
    hasValidSchema: true,
    hasToolDefinitions: true,
    hasExecutableCode: true
  }
};
```

#### DatabaseService Class

**Purpose**: MongoDB operations with proper schema management

**Interface**:
```javascript
class DatabaseService {
  constructor(resourceManager)
  
  // Connection management
  async connect()
  async disconnect() 
  async isConnected()
  
  // Module operations
  async saveModule(moduleData)
  async getModule(moduleName)
  async listModules(filter = {})
  async deleteModule(moduleName)
  
  // Tool operations  
  async saveTools(tools, moduleName)
  async getTool(toolName)
  async listTools(filter = {})
  async searchTools(query) // Text search
  async deleteToolsByModule(moduleName)
  
  // Database management
  async clearModule(moduleName) // Remove module + its tools
  async clearAll() // Remove all data (test mode only)
  async ensureIndexes() // Create required indexes
}
```

**Transaction Support**:
```javascript
// Atomic module loading with rollback capability
async saveModuleWithTools(moduleData, tools) {
  const session = await this.client.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Save module
      const moduleResult = await this.modules.insertOne(moduleData, { session });
      const moduleId = moduleResult.insertedId;
      
      // Save tools with module reference
      const toolsWithModule = tools.map(tool => ({
        ...tool,
        moduleId,
        moduleName: moduleData.name
      }));
      
      await this.tools.insertMany(toolsWithModule, { session });
    });
  } finally {
    await session.endSession();
  }
}
```

### Phase 3: Tool Registry with Caching

#### ToolRegistry Class

**Purpose**: Main public API for tool management with intelligent caching

**Interface**:
```javascript
class ToolRegistry {
  constructor(options = {})
  
  // Public API - Core functionality
  async getTool(toolName) // Get executable tool instance
  async listTools(options = {}) // List available tools
  async searchTools(query) // Text-based search
  async getModule(moduleName) // Get module information
  
  // Module management
  async loadModule(moduleName, options = {}) // Load single module
  async loadAllModules(options = {}) // Load all discovered modules
  async clearModule(moduleName) // Remove module and tools
  async clearAll() // Clear all data
  
  // System operations
  async initialize() // Setup connections and cache
  async cleanup() // Clean shutdown with resource cleanup
  async getStats() // System statistics and health
  
  // Optional: Semantic search (if available)
  async semanticSearch(query, options = {}) // Vector-based search
  async generatePerspectives(moduleFilter = null) // Create perspectives
}
```

**Caching Strategy**:
```javascript
class ToolRegistryCache {
  constructor(options = {}) {
    this.toolCache = new LRUCache({ max: options.maxTools || 1000 });
    this.moduleCache = new LRUCache({ max: options.maxModules || 100 });
    this.ttl = options.ttl || 30 * 60 * 1000; // 30 minutes
  }
  
  // Cache operations with TTL
  async getCachedTool(toolName) {
    const cached = this.toolCache.get(toolName);
    if (cached && !this.isExpired(cached)) {
      return cached.tool;
    }
    return null;
  }
  
  cacheTool(toolName, tool) {
    this.toolCache.set(toolName, {
      tool,
      cachedAt: Date.now()
    });
  }
  
  invalidateModule(moduleName) {
    // Remove all tools from this module
    for (const [key, value] of this.toolCache.entries()) {
      if (value.tool.moduleName === moduleName) {
        this.toolCache.delete(key);
      }
    }
    this.moduleCache.delete(moduleName);
  }
}
```

**Resource Management**:
```javascript
class ToolRegistry {
  constructor(options = {}) {
    this.connections = new Set();
    this.timers = new Set();
    this.cleanup = this.cleanup.bind(this);
    
    // Register cleanup on process termination
    process.on('SIGTERM', this.cleanup);
    process.on('SIGINT', this.cleanup);
    process.on('beforeExit', this.cleanup);
  }
  
  async cleanup() {
    console.log('Cleaning up ToolRegistry resources...');
    
    // Clear timers
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
    
    // Close connections
    for (const connection of this.connections) {
      try {
        if (connection.close) {
          await connection.close();
        }
      } catch (error) {
        console.warn('Connection cleanup failed:', error.message);
      }
    }
    this.connections.clear();
    
    // Clear caches
    if (this.cache) {
      this.cache.clear();
    }
    
    console.log('ToolRegistry cleanup complete');
  }
}
```

### Phase 4-5: Semantic Search System

#### PerspectiveGenerator Class

**Purpose**: Generate multiple perspectives for tools using LLM

**Interface**:
```javascript
class PerspectiveGenerator {
  constructor(llmClient)
  
  async generatePerspectives(tool) // Generate multiple perspectives for one tool
  async generateForModule(moduleName) // Generate for all tools in module
  async savePerspectives(perspectives) // Store in database
  
  // Perspective types
  async generateFunctionalPerspective(tool) // What the tool does
  async generateUseCasePerspective(tool) // When to use it
  async generateDomainPerspective(tool) // Domain/category context
  async generateTechnicalPerspective(tool) // Implementation details
}
```

**Perspective Generation Logic**:
```javascript
const perspectivePrompts = {
  functional: `
    Analyze this tool and describe what it does in simple terms:
    Tool: {toolName}
    Description: {description}
    Input: {inputSchema}
    Output: {outputSchema}
    
    Provide a clear, concise explanation of the tool's primary function.
  `,
  
  useCase: `
    When would someone use this tool? Provide practical scenarios:
    Tool: {toolName}
    Description: {description}
    
    List 3-5 specific use cases with brief explanations.
  `,
  
  domain: `
    What domain or category does this tool belong to?
    Tool: {toolName}
    Description: {description}
    
    Identify the primary domain and related categories.
  `
};
```

#### SemanticSearch Class

**Purpose**: Embedding generation and vector search integration

**Interface**:
```javascript
class SemanticSearch {
  constructor(embeddingService, vectorStore)
  
  // Embedding operations
  async generateEmbeddings(perspectives) // Create embeddings for perspectives
  async updateEmbeddings(toolName) // Refresh embeddings for tool
  
  // Vector search
  async search(query, options = {}) // Semantic search with query
  async findSimilar(toolName, limit = 10) // Find similar tools
  
  // Index management
  async indexTool(toolName) // Add tool to vector index
  async removeFromIndex(toolName) // Remove tool from index
  async rebuildIndex(moduleFilter = null) // Rebuild vector index
}
```

**Qdrant Integration**:
```javascript
class QdrantVectorStore {
  constructor(resourceManager) {
    this.client = null;
    this.collectionName = 'tool_perspectives';
  }
  
  async initialize() {
    const qdrantUrl = this.resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333';
    this.client = new QdrantClient({ url: qdrantUrl });
    
    // Ensure collection exists
    await this.ensureCollection();
  }
  
  async ensureCollection() {
    try {
      await this.client.getCollection(this.collectionName);
    } catch (error) {
      if (error.status === 404) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 384, // Nomic embedding dimension
            distance: 'Cosine'
          }
        });
      } else {
        throw error;
      }
    }
  }
  
  async upsertVectors(vectors) {
    const points = vectors.map((vector, index) => ({
      id: vector.id,
      vector: vector.embedding,
      payload: {
        toolName: vector.toolName,
        perspective: vector.perspective,
        description: vector.description
      }
    }));
    
    await this.client.upsert(this.collectionName, {
      wait: true,
      points
    });
  }
  
  async search(queryVector, limit = 10) {
    const results = await this.client.search(this.collectionName, {
      vector: queryVector,
      limit,
      with_payload: true
    });
    
    return results.map(result => ({
      toolName: result.payload.toolName,
      perspective: result.payload.perspective,
      score: result.score,
      description: result.payload.description
    }));
  }
}
```

## Testing Strategy

### Test Structure

```
__tests__/
├── unit/                          # Unit tests with mocks
│   ├── ModuleLoader.test.js       # Test module loading logic
│   ├── DatabaseService.test.js    # Test database operations
│   ├── ToolRegistry.test.js       # Test registry functionality
│   └── PerspectiveGenerator.test.js # Test LLM integration
├── integration/                   # Integration tests with real services
│   ├── ModuleLoading.test.js      # End-to-end module loading
│   ├── DatabaseIntegration.test.js # Real MongoDB operations
│   └── SemanticSearch.test.js     # Full semantic search workflow
└── fixtures/                     # Test data and mock modules
    ├── MockCalculatorModule.js    # Sample module for testing
    ├── MockToolData.js           # Tool test data
    └── test-schemas.js           # JSON schemas for validation
```

### Unit Testing Approach

```javascript
// Example: ModuleLoader unit test
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModuleLoader } from '../src/core/ModuleLoader.js';

describe('ModuleLoader', () => {
  let moduleLoader;
  
  beforeEach(() => {
    moduleLoader = new ModuleLoader();
  });
  
  describe('loadModule', () => {
    it('should load a valid module class', async () => {
      const mockModule = {
        default: class {
          getTools() { return []; }
          getName() { return 'TestModule'; }
        }
      };
      
      // Mock dynamic import
      jest.doMock('/test/module.js', () => mockModule, { virtual: true });
      
      const result = await moduleLoader.loadModule('/test/module.js');
      
      expect(result).toBeInstanceOf(mockModule.default);
      expect(result.getName()).toBe('TestModule');
    });
    
    it('should handle module loading errors', async () => {
      await expect(moduleLoader.loadModule('/nonexistent/module.js'))
        .rejects
        .toThrow('Failed to load module');
    });
  });
});
```

### Integration Testing Approach

```javascript
// Example: Database integration test
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseService } from '../src/database/DatabaseService.js';
import { ResourceManager } from '@legion/resource-manager';

describe('DatabaseService Integration', () => {
  let dbService;
  let testDbName;
  
  beforeEach(async () => {
    // Use test-specific database
    testDbName = `test_tool_registry_${Date.now()}`;
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Override database name for testing
    resourceManager.set('test.database.name', testDbName);
    
    dbService = new DatabaseService(resourceManager);
    await dbService.connect();
  });
  
  afterEach(async () => {
    // Clean up test database
    if (dbService.isConnected()) {
      await dbService.client.db(testDbName).dropDatabase();
      await dbService.disconnect();
    }
  });
  
  it('should save and retrieve modules', async () => {
    const moduleData = {
      name: 'TestModule',
      description: 'Test module for integration testing',
      version: '1.0.0',
      path: '/test/module.js'
    };
    
    await dbService.saveModule(moduleData);
    const retrieved = await dbService.getModule('TestModule');
    
    expect(retrieved.name).toBe('TestModule');
    expect(retrieved.description).toBe(moduleData.description);
  });
});
```

### Test Cleanup and Resource Management

```javascript
// __tests__/setup.js - Global test setup
import { ResourceManager } from '@legion/resource-manager';

// Global cleanup tracking
global.testCleanupTasks = [];
global.testConnections = new Set();

global.registerCleanupTask = (task) => {
  global.testCleanupTasks.push(task);
};

global.registerTestConnection = (connection) => {
  global.testConnections.add(connection);
};

// Cleanup after all tests
afterAll(async () => {
  console.log('Running global test cleanup...');
  
  // Run cleanup tasks
  for (const task of global.testCleanupTasks) {
    try {
      await task();
    } catch (error) {
      console.warn('Cleanup task failed:', error.message);
    }
  }
  
  // Close connections
  for (const connection of global.testConnections) {
    try {
      if (connection.close) {
        await connection.close();
      }
    } catch (error) {
      console.warn('Connection cleanup failed:', error.message);
    }
  }
  
  console.log('Global test cleanup complete');
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in tests, just log
});
```

## Performance Requirements

### Response Time Targets

- **Tool Retrieval**: < 50ms (cached), < 200ms (database)
- **Module Loading**: < 2 seconds per module
- **Text Search**: < 100ms for up to 10,000 tools  
- **Semantic Search**: < 500ms for vector lookup
- **Bulk Operations**: < 30 seconds for 100 modules

### Scalability Targets

- **Database Size**: Support up to 10,000 tools across 1,000 modules
- **Cache Size**: 1,000 most-used tools in memory
- **Concurrent Users**: 50 simultaneous tool requests
- **Vector Index**: 50,000 perspective embeddings

### Memory Usage

- **Base Memory**: < 100MB without cache
- **Full Cache**: < 500MB with full tool cache
- **Peak Usage**: < 1GB during bulk loading operations

## Error Handling Strategy

### Error Classifications

```javascript
// Base error class
class ToolRegistryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Specific error types
class ModuleNotFoundError extends ToolRegistryError {
  constructor(moduleName) {
    super(`Module '${moduleName}' not found`, 'MODULE_NOT_FOUND', { moduleName });
  }
}

class ToolExecutionError extends ToolRegistryError {
  constructor(toolName, parameters, cause) {
    super(`Tool '${toolName}' execution failed: ${cause.message}`, 'TOOL_EXECUTION_FAILED', {
      toolName,
      parameters,
      cause: cause.message
    });
  }
}

class DatabaseConnectionError extends ToolRegistryError {
  constructor(cause) {
    super(`Database connection failed: ${cause.message}`, 'DATABASE_CONNECTION_FAILED', {
      cause: cause.message
    });
  }
}
```

### Error Recovery Strategies

```javascript
class ToolRegistry {
  async getTool(toolName) {
    try {
      // Try cache first
      const cached = await this.cache.getCachedTool(toolName);
      if (cached) return cached;
      
      // Try database
      const tool = await this.database.getTool(toolName);
      if (!tool) {
        throw new ToolNotFoundError(toolName);
      }
      
      // Load module if needed
      const moduleInstance = await this.loadModuleInstance(tool.moduleName);
      const executableTool = await this.createExecutableTool(tool, moduleInstance);
      
      // Cache for future use
      this.cache.cacheTool(toolName, executableTool);
      
      return executableTool;
      
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        // No recovery possible
        throw error;
      } else if (error instanceof DatabaseConnectionError) {
        // Try cache-only mode
        const cached = await this.cache.getCachedTool(toolName);
        if (cached) {
          console.warn(`Using cached tool '${toolName}' due to database error`);
          return cached;
        }
        throw error;
      } else {
        // Wrap unexpected errors
        throw new ToolRegistryError(`Unexpected error getting tool '${toolName}': ${error.message}`, 'UNEXPECTED_ERROR', {
          toolName,
          originalError: error.message
        });
      }
    }
  }
}
```

## Implementation Timeline

### Phase 1: Core Module Loader (Week 1)
**Days 1-2**: Project setup, ModuleLoader class
**Days 3-4**: Tool execution and validation  
**Days 5-7**: Comprehensive unit tests and error handling

### Phase 2: Discovery & Database (Week 2)
**Days 1-2**: ModuleDiscovery implementation
**Days 3-4**: DatabaseService with MongoDB integration
**Days 5-7**: Integration tests and transaction support

### Phase 3: Tool Registry (Week 3)
**Days 1-2**: ToolRegistry class with caching
**Days 3-4**: Public API and text search
**Days 5-7**: Performance optimization and resource management

### Phase 4: Semantic Foundation (Week 4)
**Days 1-2**: PerspectiveGenerator with LLM integration
**Days 3-4**: Database schema for perspectives
**Days 5-7**: Embedding generation and storage

### Phase 5: Vector Search (Week 5)
**Days 1-2**: Qdrant integration and vector operations
**Days 3-4**: Semantic search API and query processing
**Days 5-7**: End-to-end testing and performance tuning

## Success Criteria

### Functional Requirements
- [ ] Load any valid Legion module from JavaScript file
- [ ] Extract and store module/tool metadata in MongoDB
- [ ] Provide fast tool retrieval with caching
- [ ] Support text-based tool search
- [ ] Generate and search tool perspectives semantically
- [ ] Handle 1000+ tools across 100+ modules

### Quality Requirements  
- [ ] 100% test coverage on core functionality
- [ ] All tests pass consistently without flakiness
- [ ] No resource leaks or hanging connections
- [ ] Graceful degradation when optional services unavailable
- [ ] Clear error messages and proper error handling

### Performance Requirements
- [ ] Tool retrieval under 200ms
- [ ] Module loading under 2 seconds
- [ ] Text search under 100ms
- [ ] Semantic search under 500ms
- [ ] Memory usage under 500MB normal operation

### Operational Requirements
- [ ] Can be imported and used without complex setup
- [ ] Works with or without Qdrant/semantic search
- [ ] Proper connection lifecycle management
- [ ] Comprehensive logging and debugging support
- [ ] Clear documentation and examples

This design provides a solid foundation for implementing a reliable, test-driven tool registry system that addresses all the issues identified in the existing implementation while maintaining the valuable semantic search capabilities.