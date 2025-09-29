# Handle URI Semantic Search Facility Design

## Overview

The Handle URI Semantic Search Facility provides **on-demand** semantic search capabilities for handle URIs in the Legion system. When explicitly commanded to "store this handle", the system analyzes what the handle actually represents (customer database, cat image, Node.js monitoring tool, etc.), generates multiple descriptive "glosses" from different perspectives using LLM analysis, and stores them as vector embeddings for semantic discovery and restoration.

**Key Principles:**
- **On-Demand Only**: Indexing happens explicitly when requested, not automatically
- **Handle-Type Specific**: Different handle types (MongoDB, file, image, etc.) have specialized analysis methods
- **What-Not-Where**: Focus on WHAT the handle represents, not its URI or location
- **Perspective-Based**: Generate 30-100 word descriptive sentences from functional, contextual, and use-case viewpoints

## Core Architecture

### System Components

```
HandleSemanticSearchManager
├── HandleGlossGenerator (LLM-based perspective generation)
├── HandleMetadataExtractor (Handle analysis and introspection)
├── HandleVectorStore (Embedding storage and retrieval)
└── Integration with existing Legion infrastructure
    ├── ResourceManager (singleton pattern)
    ├── QdrantHandle (vector database)
    ├── NomicHandle (embeddings generation)
    └── MongoDB (persistent storage)
```

### Component Responsibilities

#### HandleSemanticSearchManager
**Primary Interface**: Main orchestrator for all semantic search operations
- **URI Indexing**: `indexHandle(handleURI, options)` - Generate and store glosses
- **Semantic Search**: `searchHandles(query, options)` - Find similar handles by meaning
- **Handle Restoration**: `restoreHandle(handleURI)` - Recreate handle from stored URI
- **Gloss Management**: Update, delete, and manage handle perspectives

#### HandleGlossGenerator
**Gloss Creation**: Generates descriptive perspectives using TemplatedPrompt with handle-type-specific analysis
- **Handle-Type Registry**: Configurable analysis methods for different handle types
  - **MongoDB**: Extract schema, collections, sample data to describe "customer database with fields: name, email, purchase_history"
  - **File**: Read content preview, detect type to describe "configuration file containing API endpoints and security settings"
  - **Image**: Analyze metadata, possibly vision analysis to describe "product photo showing blue sneaker on white background"
  - **Git Repo**: Examine structure, README, package.json to describe "React component library for data visualization widgets"
  - **Generic Fallback**: Basic introspection for unknown handle types
- **Perspective Generation**: 30-100 word descriptive sentences from multiple viewpoints:
  - **Functional**: What this resource does or contains in business terms
  - **Contextual**: How this fits into larger workflows or systems
  - **Use-Case**: When and why someone would use this resource

#### HandleMetadataExtractor
**Handle-Type-Specific Analysis**: Extracts meaningful information about what the handle represents
- **Type Detection**: Identifies handle type to select appropriate analysis strategy
- **Content Analysis**: Handle-type-specific extraction:
  - **MongoDB**: Collections, schema structure, sample documents, indexes
  - **File**: Content preview, file type, dependencies, purpose indicators
  - **Image**: Dimensions, format, EXIF data, possibly visual content analysis
  - **Git Repo**: Project structure, README content, package.json, language detection
  - **Collection**: Item types, count, relationships, business purpose
  - **Generic**: Basic schema and capabilities for unknown types
- **Business Context**: Extract names, purposes, and functional descriptions rather than technical details

#### HandleVectorStore
**Storage Management**: Manages vector embeddings and handle records
- **Vector Operations**: Store, search, and manage 768-dimensional embeddings
- **Record Persistence**: Handle metadata, glosses, and indexing information
- **Dual Storage**: Qdrant for vectors, MongoDB for structured data
- **Consistency**: Maintains referential integrity between storage systems

## Handle Integration

### URI Format Compliance
The system uses standard Legion URI format:
```
legion://server/type/path
```

Examples:
- `legion://local/mongodb/users/collection/active_users`
- `legion://remote/file/project/src/components/UserList.tsx`
- `legion://local/qdrant/collections/vector_store/embeddings`
- `legion://local/git/repository/main/branches`

### ResourceManager Integration
Extends the existing ResourceManager singleton pattern:

```javascript
// Get semantic search manager
const resourceManager = await ResourceManager.getInstance();
const semanticSearch = resourceManager.createHandleSemanticSearch();

// Index a handle
await semanticSearch.indexHandle('legion://local/mongodb/users');

// Search for similar handles
const results = await semanticSearch.searchHandles('user management database');

// Restore handle from URI
const userHandle = await semanticSearch.restoreHandle('legion://local/mongodb/users');
```

### Handle Lifecycle Integration
- **On-Demand Indexing**: Index handles only when explicitly requested via `storeHandle(handle)` command
- **Manual Updates**: Re-generate glosses only when explicitly requested (no automatic monitoring)
- **Explicit Deletion**: Remove from index only when explicitly requested via `removeHandle(handleURI)`
- **URI-Based Restoration**: Restore handles from stored URIs for discovery

## Gloss Generation System

### Handle-Type-Specific Analysis and Perspective Generation

The system uses handle-type-specific analyzers to extract meaningful information about what the handle represents, then generates descriptive glosses using TemplatedPrompt:

```javascript
const glossTemplate = new TemplatedPrompt({
  prompt: `You are analyzing a {{handleType}} resource. Based on the extracted information, generate {{glossCount}} distinct descriptive perspectives (30-100 words each):

WHAT THIS RESOURCE IS:
{{resourceDescription}}

EXTRACTED DETAILS:
{{extractedDetails}}

BUSINESS CONTEXT:
{{businessContext}}

Generate {{glossCount}} different perspectives that describe what this resource represents and how it might be used. Focus on practical, business-oriented descriptions rather than technical implementation details.`,

  responseSchema: {
    type: "object",
    properties: {
      glosses: {
        type: "array",
        items: {
          type: "object",
          properties: {
            perspective: { type: "string", enum: ["functional", "contextual", "use-case"] },
            description: { type: "string", minLength: 30, maxLength: 100 },
            keywords: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  }
});
```

### Handle-Type-Specific Analysis Examples

#### MongoDB Database Handle
```javascript
// Analyzer extracts meaningful business information
const mongoAnalyzer = {
  async analyze(handle) {
    const collections = await handle.listCollections();
    const sampleData = await handle.collection('users').findOne();
    const schema = await handle.getSchema();
    
    return {
      resourceDescription: `MongoDB database containing ${collections.length} collections for user management system`,
      extractedDetails: `Collections: ${collections.join(', ')}. User fields: ${Object.keys(sampleData).join(', ')}`,
      businessContext: `Customer database storing user profiles, authentication data, and account preferences for web application`
    };
  }
};

// LLM generates perspective glosses like:
// "User management database storing customer profiles, authentication credentials, and account preferences with support for user registration, login, and profile updates across web and mobile applications"
```

#### Image File Handle
```javascript
const imageAnalyzer = {
  async analyze(handle) {
    const metadata = await handle.getMetadata();
    const exif = await handle.getExifData();
    
    return {
      resourceDescription: `${metadata.format} image file, ${metadata.width}x${metadata.height} pixels`,
      extractedDetails: `Camera: ${exif.camera}, Date: ${exif.date}, Size: ${metadata.fileSize}KB`,
      businessContext: `Product photography for e-commerce catalog showing ${extractAltText(handle)} for online retail display`
    };
  }
};

// LLM generates perspective glosses like:
// "Product photograph of blue running sneaker on white background, professionally shot for e-commerce website catalog display, suitable for online retail listings and promotional materials"
```

#### Git Repository Handle
```javascript
const gitAnalyzer = {
  async analyze(handle) {
    const packageJson = await handle.file('package.json').read();
    const readme = await handle.file('README.md').read();
    const structure = await handle.getProjectStructure();
    
    return {
      resourceDescription: `${packageJson.name} - ${packageJson.description}`,
      extractedDetails: `Language: ${structure.primaryLanguage}, Dependencies: ${Object.keys(packageJson.dependencies).slice(0,5).join(', ')}`,
      businessContext: `Software library providing ${extractPurposeFromReadme(readme)} for developers building ${structure.projectType} applications`
    };
  }
};

// LLM generates perspective glosses like:
// "React component library providing reusable UI widgets for data visualization including charts, graphs, and interactive dashboards used by development teams building analytics applications"
```

## Storage Architecture

### Dual Storage Strategy

#### MongoDB Collections
**Collection**: `handle_records`
```javascript
{
  _id: ObjectId,
  handleURI: "legion://server/type/path",
  handleType: "mongodb|file|collection|git|...",
  metadata: {
    server: "local|remote",
    resourceType: "type",
    path: "path/components",
    capabilities: ["query", "update", "subscribe"],
    schema: { /* handle schema */ }
  },
  glosses: [
    {
      type: "functional",
      content: "User authentication and profile management database",
      keywords: ["authentication", "users", "profiles", "security"],
      confidence: 0.95,
      embedding_id: "gloss_001"
    }
  ],
  indexed_at: ISODate,
  updated_at: ISODate,
  vector_collection: "handle_vectors",
  status: "active|updating|error"
}
```

#### Qdrant Vector Collection
**Collection**: `handle_vectors`
```javascript
{
  id: "handle_001_gloss_functional",
  vector: [0.1234, -0.5678, ...], // 768 dimensions from Nomic
  payload: {
    handle_uri: "legion://local/mongodb/users",
    gloss_type: "functional",
    handle_type: "mongodb",
    server: "local",
    indexed_at: "2024-01-15T10:30:00Z"
  }
}
```

### Vector Embedding Process
1. **Gloss Generation**: HandleGlossGenerator creates semantic perspectives
2. **Embedding Creation**: NomicHandle generates 768-dimensional vectors
3. **Vector Storage**: QdrantHandle stores vectors with metadata
4. **Record Persistence**: MongoDB stores complete handle records
5. **Index Synchronization**: Maintain consistency between storage systems

## API Specification

### HandleSemanticSearchManager Interface

#### Core Operations
```javascript
class HandleSemanticSearchManager {
  /**
   * Store/index a handle with generated glosses (ON-DEMAND ONLY)
   * @param {Handle|string} handle - Handle instance or URI
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} Indexing result
   */
  async storeHandle(handle, options = {}) {
    // handleType?: string - Override automatic type detection
    // forceReindex?: boolean - Reindex existing handle
    // analysisDepth?: 'shallow'|'deep' - How much content to analyze
  }

  /**
   * Search for handles using semantic similarity
   * @param {string} query - Natural language search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Ranked search results
   */
  async searchHandles(query, options = {}) {
    // limit?: number - Maximum results (default: 10)
    // threshold?: number - Similarity threshold (default: 0.7)
    // handleTypes?: string[] - Filter by handle types
    // server?: string - Filter by server
  }

  /**
   * Restore handle from URI
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Handle>} Restored handle instance
   */
  async restoreHandle(handleURI) {
    // Uses ResourceManager.createHandleFromURI()
  }

  /**
   * Update glosses for existing handle
   * @param {string} handleURI - Legion URI
   * @param {Array} newGlosses - Updated gloss definitions
   * @returns {Promise<Object>} Update result
   */
  async updateGlosses(handleURI, newGlosses) {
    // Regenerates embeddings and updates storage
  }

  /**
   * Get detailed information about indexed handle
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Object>} Handle information and glosses
   */
  async getHandleInfo(handleURI) {
    // Returns complete record from MongoDB
  }

  /**
   * Remove handle from semantic search index
   * @param {string} handleURI - Legion URI
   * @returns {Promise<Object>} Removal result
   */
  async removeHandle(handleURI) {
    // Cleans up both MongoDB and Qdrant
  }
}
```

#### Batch Operations
```javascript
/**
 * Batch index multiple handles
 * @param {Array<string>} handleURIs - Array of Legion URIs
 * @param {Object} options - Batch options
 * @returns {Promise<Object>} Batch processing results
 */
async indexHandleBatch(handleURIs, options = {}) {
  // concurrency?: number - Parallel processing limit
  // onProgress?: function - Progress callback
}

/**
 * Batch search with multiple queries
 * @param {Array<string>} queries - Array of search queries
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Results for each query
 */
async searchHandleBatch(queries, options = {}) {}
```

### Search Result Format
```javascript
{
  query: "user authentication database",
  results: [
    {
      handleURI: "legion://local/mongodb/users",
      handleType: "mongodb",
      similarity: 0.92,
      matchedGloss: {
        type: "functional",
        content: "User authentication and profile management database",
        keywords: ["authentication", "users", "profiles"]
      },
      metadata: {
        server: "local",
        capabilities: ["query", "update", "subscribe"],
        indexed_at: "2024-01-15T10:30:00Z"
      }
    }
  ],
  executionTime: 45,
  totalResults: 1
}
```

## Configuration

### System Configuration
```javascript
{
  // Gloss generation settings
  glossGeneration: {
    defaultGlossCount: {
      simple: 3,    // Files, basic objects
      complex: 5    // Databases, collections
    },
    glossTypes: ["functional", "contextual", "technical", "use-case", "operational", "relationship"],
    maxRetries: 3,
    timeoutMs: 30000
  },

  // Vector storage settings
  vectorStorage: {
    dimensions: 768,        // Nomic embedding dimensions
    collection: "handle_vectors",
    similarity: "cosine",   // Qdrant similarity metric
    indexing: {
      batchSize: 100,
      maxConcurrency: 5
    }
  },

  // Search settings
  search: {
    defaultLimit: 10,
    defaultThreshold: 0.7,
    maxResults: 100,
    cacheResults: true,
    cacheTTL: 300000  // 5 minutes
  },

  // Storage settings
  storage: {
    mongodb: {
      collection: "handle_records",
      database: "legion_semantic_search"
    },
    qdrant: {
      collection: "handle_vectors"
    }
  }
}
```

### Handle Type Registry Configuration
```javascript
{
  handleTypeRegistry: {
    "mongodb": {
      analyzer: "MongoDBAnalyzer",
      glossCount: 3,
      perspectives: ["functional", "contextual", "use-case"],
      extractMethods: ["collections", "sampleDocuments", "schema", "businessPurpose"]
    },
    "file": {
      analyzer: "FileAnalyzer", 
      glossCount: 3,
      perspectives: ["functional", "contextual", "use-case"],
      extractMethods: ["contentPreview", "fileType", "dependencies", "purpose"]
    },
    "image": {
      analyzer: "ImageAnalyzer",
      glossCount: 2,
      perspectives: ["functional", "use-case"],
      extractMethods: ["metadata", "exifData", "visualContent", "businessContext"]
    },
    "git": {
      analyzer: "GitAnalyzer",
      glossCount: 3,
      perspectives: ["functional", "contextual", "use-case"],
      extractMethods: ["projectStructure", "readme", "packageJson", "codeAnalysis"]
    },
    "collection": {
      analyzer: "CollectionAnalyzer",
      glossCount: 3,
      perspectives: ["functional", "contextual", "use-case"],
      extractMethods: ["itemTypes", "relationships", "businessPurpose", "usage"]
    },
    "generic": {
      analyzer: "GenericAnalyzer",
      glossCount: 2,
      perspectives: ["functional", "use-case"],
      extractMethods: ["schema", "capabilities", "introspection"]
    }
  }
}
```

## Technical Decisions

### Why TemplatedPrompt Over Direct LLMClient
- **Schema Validation**: Automatic response validation and retry logic
- **Consistency**: Standardized output format across all handle types
- **Error Handling**: Built-in retry mechanisms for validation failures
- **Integration**: Natural fit with Legion's prompt management system

### Type-Aware Gloss Strategy
- **Scalability**: Prevents over-generation for simple handles
- **Quality**: Ensures comprehensive coverage for complex handles
- **Relevance**: Type-specific perspectives improve search accuracy
- **Performance**: Optimizes embedding generation and storage

### Dual Storage Architecture
- **MongoDB Strengths**: Complex queries, transactions, structured data
- **Qdrant Strengths**: High-performance vector similarity search
- **Separation of Concerns**: Metadata vs. vector operations
- **Consistency**: Referential integrity through coordinated updates

### URI-First Design
- **Portability**: Handles can be referenced without original context
- **Persistence**: URIs provide stable, long-term references
- **Distribution**: Supports remote and distributed handle operations
- **Restoration**: Complete handle recreation from URI alone

### Embedding Dimension Choice
- **Nomic Standard**: 768 dimensions from nomic-embed-text-v1.5
- **Quality**: High-quality semantic representations
- **Performance**: Balanced between accuracy and speed
- **Compatibility**: Works with existing Qdrant infrastructure

## Error Handling

### Indexing Errors
```javascript
{
  error: "INDEXING_FAILED",
  handleURI: "legion://local/mongodb/users",
  stage: "gloss_generation|embedding_creation|storage",
  message: "Detailed error description",
  retryable: true|false,
  suggestion: "Recommended action"
}
```

### Search Errors
```javascript
{
  error: "SEARCH_FAILED",
  query: "user database",
  stage: "embedding|vector_search|result_formatting",
  message: "Detailed error description",
  partialResults: [] // If some results were retrieved
}
```

### Handle Restoration Errors
```javascript
{
  error: "RESTORATION_FAILED",
  handleURI: "legion://local/mongodb/users",
  reason: "handle_not_found|invalid_uri|connection_failed",
  message: "Detailed error description",
  availableAlternatives: [] // Similar URIs if applicable
}
```

## Usage Examples

### On-Demand Handle Storage and Search
```javascript
const resourceManager = await ResourceManager.getInstance();
const semanticSearch = resourceManager.createHandleSemanticSearch();

// Store a handle for semantic search (explicit command)
const userDBHandle = resourceManager.createHandle('legion://local/mongodb/users');
await semanticSearch.storeHandle(userDBHandle);

// Search for similar handles using natural language
const results = await semanticSearch.searchHandles('customer database for web application');

// Restore and use the found handle
const foundDB = await semanticSearch.restoreHandle(results[0].handleURI);
const activeUsers = foundDB.collection('users').find({ active: true });
```

### Advanced Search with Filters
```javascript
// Search with type filtering
const dbResults = await semanticSearch.searchHandles('analytics data', {
  handleTypes: ['mongodb', 'collection'],
  server: 'local',
  limit: 5,
  threshold: 0.8
});

// Batch search for multiple concepts
const batchResults = await semanticSearch.searchHandleBatch([
  'user authentication',
  'product catalog',
  'order processing'
]);
```

### Handle Storage Lifecycle Management
```javascript
// Explicitly store different types of handles
const imageHandle = resourceManager.createHandle('legion://local/file/products/shoe-image.jpg');
const repoHandle = resourceManager.createHandle('legion://local/git/ui-components');
const configHandle = resourceManager.createHandle('legion://local/file/config/api-settings.json');

// Store each handle for semantic search (on-demand only)
await semanticSearch.storeHandle(imageHandle);
await semanticSearch.storeHandle(repoHandle);
await semanticSearch.storeHandle(configHandle);

// Update stored glosses when business context changes
await semanticSearch.updateGlosses(imageHandle.toURI(), [
  {
    perspective: "functional",
    description: "Updated product photography showing new colorway for seasonal catalog refresh",
    keywords: ["product", "photo", "seasonal", "catalog"]
  }
]);

// Remove from search when no longer relevant
await semanticSearch.removeHandle(configHandle.toURI());
```

---

**This design provides a comprehensive, MVP-focused semantic search facility that integrates seamlessly with Legion's existing handle architecture while providing powerful LLM-driven discovery capabilities.**