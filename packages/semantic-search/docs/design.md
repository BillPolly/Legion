# Semantic Search Package Design Document

## Overview

The `@legion/semantic-search` package provides intelligent, AI-powered semantic search capabilities as a generic storage provider for the Legion framework. It enables natural language search across any type of document or data, using vector embeddings to understand meaning and context rather than just keyword matching.

## Problem Statement

Traditional keyword-based search becomes insufficient when dealing with:

1. **Natural language queries** - "Find documents about user authentication" should match content about OAuth, JWT, login systems, etc.
2. **Semantic understanding** - "customer feedback" should find documents containing "user reviews", "client testimonials", or "satisfaction surveys"
3. **Large-scale datasets** - Efficiently search through millions of documents, code files, logs, or any text data
4. **Context-aware retrieval** - Return most relevant results based on meaning, not just exact word matches
5. **Multi-domain search** - Search across heterogeneous data types (tools, documents, code, configurations, etc.)

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                SemanticSearchProvider                   │
├─────────────────────────────────────────────────────────┤
│ • Extends Legion Provider base class                    │
│ • Implements semantic, hybrid, and similarity search    │
│ • Manages configuration and initialization              │
└─────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ OpenAI Embedding│  │ Qdrant Vector   │  │ Document        │
│ Service         │  │ Store           │  │ Processor       │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • Text→Vector   │  │ • Vector Storage│  │ • Text Extract  │
│ • Batch Process │  │ • Similarity    │  │ • Optimization  │
│ • Cost Track    │  │ • Collections   │  │ • Metadata Gen  │
│ • Retry Logic   │  │ • Filtering     │  │ • Validation    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────┐
│              Supporting Infrastructure                   │
├─────────────────────────────────────────────────────────┤
│ • EmbeddingCache - Cost optimization & performance      │
│ • SearchTypes - Type definitions & validation          │
│ • Test Infrastructure - Mocks, fixtures, utilities     │
└─────────────────────────────────────────────────────────┘
```

### Integration with Legion Framework

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Any Data      │───▶│ Semantic Search │───▶│  Applications   │
│   Source        │    │    Provider     │    │                 │
│ • Documents     │    │ • Query Parse   │    │ • AI Agents     │
│ • Code Files    │    │ • Vector Search │    │ • Search UIs    │
│ • Logs/Events   │    │ • Result Rank   │    │ • Analytics     │
│ • Tools/Config  │    │ • Hybrid Match  │    │ • Discovery     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ResourceManager & Storage Layer                │
├─────────────────────────────────────────────────────────────┤
│ • API Key Management (OpenAI, Qdrant)                      │
│ • Configuration & Environment Variables                     │
│ • Storage Provider Interface                               │
│ • Dependency Injection                                     │
└─────────────────────────────────────────────────────────────┘
```

## API Specification

### Primary Search Methods

#### Semantic Search
```javascript
// Search any collection with natural language
const results = await provider.semanticSearch(
  'documents',  // any collection name
  'machine learning model deployment strategies',  // natural language query
  {
    limit: 10,
    threshold: 0.75,
    includeMetadata: true,
    filter: { category: 'technical' }  // optional filtering
  }
);
// Returns: Array<SemanticSearchResult>

// Search code repositories
const codeResults = await provider.semanticSearch(
  'codebase',
  'functions that handle user authentication',
  { limit: 20, includeVectors: false }
);

// Search logs and events
const logResults = await provider.semanticSearch(
  'logs',
  'database connection errors in production',
  { filter: { severity: 'error', env: 'prod' } }
);
```

#### Hybrid Search (Semantic + Keyword)
```javascript
// Combine semantic understanding with keyword matching
const results = await provider.hybridSearch(
  'knowledge_base',
  'API rate limiting throttling 429',  // Mix natural language and keywords
  {
    semanticWeight: 0.7,  // Emphasize meaning
    keywordWeight: 0.3,   // But ensure specific terms match
    limit: 15
  }
);
// Returns: Array<HybridSearchResult>
```

#### Similarity Search
```javascript
// Find similar documents to a reference document
const similarDocs = await provider.findSimilar(
  'articles',
  { 
    title: 'Introduction to Microservices',
    content: 'Microservices are a software architecture pattern...',
    tags: ['architecture', 'distributed-systems']
  },
  { limit: 5, threshold: 0.8 }
);
// Returns: Array<SemanticSearchResult>

// Find similar code patterns
const similarCode = await provider.findSimilar(
  'code_snippets',
  { code: 'async function fetchUserData(userId) { ... }' },
  { limit: 10 }
);
```

### Configuration API

```javascript
// Factory creation with ResourceManager
const provider = await SemanticSearchProvider.create(resourceManager);

// Configuration via environment variables
process.env.OPENAI_API_KEY = 'your-key';
process.env.QDRANT_URL = 'http://localhost:6333';
process.env.SEMANTIC_SEARCH_MODEL = 'text-embedding-3-large';
```

### Data Indexing API

```javascript
// Index any type of document
await provider.insert('documents', [
  {
    id: 'doc_1',
    title: 'System Architecture Guide',
    content: 'This guide covers the microservices architecture...',
    author: 'John Doe',
    category: 'technical',
    tags: ['architecture', 'guide', 'microservices']
  },
  // ... more documents
]);

// Index code files
await provider.insert('codebase', [
  {
    filepath: '/src/auth/jwt.js',
    content: fileContent,
    language: 'javascript',
    module: 'authentication',
    lastModified: new Date()
  }
]);

// Index structured data
await provider.insert('products', [
  {
    sku: 'PROD-123',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling over-ear headphones...',
    specifications: { battery: '30 hours', bluetooth: '5.0' },
    reviews: ['Great sound quality...', 'Comfortable for long use...']
  }
]);

// Standard CRUD operations still available
const docs = await provider.find('documents', { category: 'technical' });
await provider.update('documents', { id: 'doc_1' }, { status: 'reviewed' });
await provider.delete('documents', { status: 'deprecated' });
```

## Technical Implementation

### Embedding Generation Strategy

**Model Selection:**
- **Default**: `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens)
- **High-Accuracy**: `text-embedding-3-large` (3072 dimensions, $0.13/1M tokens)
- **Configurable** via `SEMANTIC_SEARCH_MODEL` environment variable

**Text Processing Pipeline:**
1. **Document Processing** - Extract relevant text from tool definitions
2. **Query Enhancement** - Expand abbreviations and add context
3. **Batch Processing** - Group requests to minimize API calls
4. **Caching** - Store embeddings to avoid regeneration

### Vector Storage Architecture

**Qdrant Integration:**
- **Collections** - Separate collections for different document types (tools, modules, capabilities)
- **Vectors** - Store embeddings with metadata for filtering
- **Indexes** - Payload indexes for efficient filtering by module, tags, etc.

**Collection Schema:**
```javascript
{
  vectors: {
    size: 1536,  // or 3072 for large model
    distance: "Cosine"
  },
  payload_schema: {
    name: { type: "keyword" },
    module: { type: "keyword" },
    tags: { type: "keyword", is_array: true },
    category: { type: "keyword" },
    searchText: { type: "text" }
  }
}
```

### Hybrid Search Algorithm

**Score Combination:**
```javascript
hybridScore = (semanticScore × semanticWeight) + (keywordScore × keywordWeight)
```

**Default Weights:**
- **Semantic Weight**: 0.7 (emphasizes meaning and context)
- **Keyword Weight**: 0.3 (ensures exact matches aren't missed)

**Ranking Strategy:**
1. Perform semantic search via vector similarity
2. Perform keyword search on indexed text fields
3. Normalize scores to 0-1 range
4. Combine using weighted formula
5. Sort by hybrid score descending

### Performance Optimizations

#### Embedding Cache
- **In-Memory Cache** - LRU eviction, configurable TTL
- **Persistent Cache** - Optional disk storage via Legion storage providers
- **Cost Reduction** - Avoid regenerating embeddings for repeated queries

#### Batch Processing
- **Embedding Generation** - Batch up to 100 texts per API call
- **Vector Operations** - Bulk insert/update operations
- **Connection Pooling** - Reuse Qdrant connections

#### Query Optimization
- **Text Preprocessing** - Remove stop words, normalize formatting
- **Smart Truncation** - Intelligent text length management
- **Field Weighting** - Prioritize name/description over metadata

## Document Processing Features

### Generic Document Processing

The `DocumentProcessor` handles any document type intelligently:

```javascript
// Process any document for optimal search
const processedDoc = processor.processDocument({
  title: 'Database Migration Best Practices',
  content: 'When migrating databases, consider...',
  author: 'Jane Smith',
  tags: ['database', 'migration', 'devops'],
  metadata: { version: '2.0', lastUpdated: '2024-01-15' }
});
// Automatically extracts and weights text from all relevant fields

// Process code for semantic search
const processedCode = processor.processDocument({
  filepath: '/src/utils/validation.js',
  content: codeContent,
  imports: ['zod', 'joi'],
  exports: ['validateEmail', 'validatePhone'],
  complexity: 15
});

// Process logs with metadata
const processedLog = processor.processDocument({
  timestamp: '2024-01-20T10:30:00Z',
  level: 'ERROR',
  message: 'Failed to connect to database',
  stackTrace: '...',
  service: 'api-gateway',
  environment: 'production'
});
```

### Query Enhancement

```javascript
// Query expansion for better semantic matching
const query = processor.processCapabilityQuery("auth issues");
// Expands to: "authentication authorize login security issues"

// Domain-specific abbreviation expansion:
"ML model" → "machine learning model algorithm"
"k8s pods" → "kubernetes pods containers orchestration"
"CI/CD pipeline" → "continuous integration deployment pipeline automation"
```

### Use Case Patterns

**Documentation Search:**
```javascript
// Find relevant documentation
await provider.semanticSearch('docs', 'how to configure load balancer');
// Finds: nginx configs, HAProxy guides, AWS ELB docs, etc.
```

**Code Search:**
```javascript
// Find code implementing specific patterns
await provider.semanticSearch('codebase', 'singleton pattern implementation');
// Finds: various singleton implementations across languages
```

**Log Analysis:**
```javascript
// Find related error patterns
await provider.hybridSearch('logs', 'timeout connection database', {
  filter: { timeRange: 'last_24h', severity: 'error' }
});
```

**Knowledge Base:**
```javascript
// Find similar issues and solutions
const issue = { description: 'Application crashes on startup with OOM error' };
await provider.findSimilar('issues', issue, { limit: 10 });
```

## Integration Patterns

### Application Integration Examples

#### Knowledge Management System
```javascript
class KnowledgeBase {
  constructor(semanticProvider) {
    this.semanticProvider = semanticProvider;
  }
  
  async findRelatedArticles(query) {
    return await this.semanticProvider.semanticSearch('articles', query);
  }
  
  async suggestSimilarContent(article) {
    return await this.semanticProvider.findSimilar('articles', article);
  }
  
  async findExpertise(topic) {
    // Find documents and authors with expertise in topic
    return await this.semanticProvider.hybridSearch('knowledge', topic, {
      includeMetadata: true,
      filter: { type: ['article', 'tutorial', 'guide'] }
    });
  }
}
```

#### Code Intelligence System
```javascript
class CodeIntelligence {
  async findSimilarImplementations(codeSnippet) {
    // Find similar code patterns across the codebase
    const similar = await this.semanticProvider.findSimilar(
      'codebase',
      { content: codeSnippet },
      { limit: 10, threshold: 0.7 }
    );
    return similar;
  }
  
  async searchByFunctionality(description) {
    // Find code that implements described functionality
    return await this.semanticProvider.semanticSearch(
      'codebase',
      description,
      { includeMetadata: true }
    );
  }
}
```

#### Log Analytics Platform
```javascript
class LogAnalytics {
  async findRelatedErrors(errorMessage) {
    // Find similar error patterns
    return await this.semanticProvider.semanticSearch(
      'logs',
      errorMessage,
      { 
        filter: { level: 'error' },
        limit: 50,
        threshold: 0.6
      }
    );
  }
  
  async detectAnomalies(normalPattern) {
    // Find logs that deviate from normal patterns
    const results = await this.semanticProvider.findSimilar(
      'logs',
      normalPattern,
      { limit: 100 }
    );
    // Return logs with low similarity scores as potential anomalies
    return results.filter(r => r._similarity < 0.3);
  }
}
```

#### E-commerce Search
```javascript
class ProductSearch {
  async searchProducts(query) {
    // Natural language product search
    return await this.semanticProvider.hybridSearch(
      'products',
      query,
      {
        semanticWeight: 0.6,  // Balance semantic and keyword
        keywordWeight: 0.4,   // Important for product names/SKUs
        includeMetadata: true
      }
    );
  }
  
  async findSimilarProducts(product) {
    return await this.semanticProvider.findSimilar(
      'products',
      product,
      { limit: 20 }
    );
  }
}
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *required* | OpenAI API key for embeddings |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_API_KEY` | *optional* | Qdrant API key if required |
| `SEMANTIC_SEARCH_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `SEMANTIC_SEARCH_BATCH_SIZE` | `100` | Batch size for processing |
| `SEMANTIC_SEARCH_CACHE_TTL` | `3600` | Cache TTL in seconds |
| `SEMANTIC_SEARCH_ENABLE_CACHE` | `true` | Enable embedding cache |

### Configuration Object

```javascript
const config = {
  // Core settings
  openaiApiKey: 'sk-...',
  qdrantUrl: 'http://localhost:6333',
  embeddingModel: 'text-embedding-3-small',
  
  // Performance tuning
  batchSize: 100,
  cacheTtl: 3600,
  enableCache: true,
  
  // Text processing
  maxTextLength: 8000,
  truncateStrategy: 'smart',
  
  // Field weights for document processing
  weightedFields: {
    title: 3.0,
    name: 3.0,
    description: 2.0,
    content: 1.0,
    tags: 1.5,
    keywords: 1.5
  }
};
```

## Testing Strategy

### Unit Tests
- **Provider Creation** - Factory pattern with ResourceManager
- **Search Operations** - Semantic, hybrid, and similarity search
- **Configuration** - Environment variable handling
- **Error Handling** - API failures, network issues

### Integration Tests
- **OpenAI Integration** - Real embedding generation
- **Qdrant Integration** - Vector storage and retrieval
- **End-to-End Workflows** - Document indexing to search results

### Test Infrastructure
- **Mock Services** - OpenAI and Qdrant mocks for unit tests
- **Test Utilities** - Helper functions for creating test data
- **Fixtures** - Sample documents, code snippets, and expected results

## Performance Characteristics

### Latency Expectations
- **Cache Hit**: < 10ms
- **Cache Miss + Embedding**: 100-500ms (depends on text length)
- **Vector Search**: 10-100ms (depends on collection size)
- **Hybrid Search**: 50-200ms (combines semantic + keyword)

### Throughput
- **Embedding Generation**: 100 texts/second (batched)
- **Vector Search**: 1000+ queries/second
- **Cache Performance**: 10,000+ queries/second

### Scalability
- **Collection Size**: Millions of documents per collection
- **Concurrent Users**: Thousands of simultaneous searches
- **Data Types**: Any text-based data (documents, code, logs, JSON, etc.)

### Cost Optimization
- **Embedding Cache**: 80%+ cost reduction for repeated queries
- **Batch Processing**: 90%+ reduction in API calls
- **Smart Truncation**: Minimize token usage while preserving meaning

## Security Considerations

### API Key Management
- **ResourceManager Integration** - Secure key storage and access
- **Environment Variables** - Keys never hardcoded in source
- **Error Handling** - No API keys in error messages or logs

### Data Privacy
- **Local Processing** - Text processing happens locally when possible
- **OpenAI Data Use** - Embeddings are not used for training
- **Vector Storage** - Qdrant can run locally for sensitive data

### Access Control
- **Collection Isolation** - Different collections for different access levels
- **Filtering** - User-based filtering for multi-tenant scenarios

## Monitoring and Observability

### Metrics
- **Search Performance** - Query latency, cache hit ratio
- **Cost Tracking** - API usage, token consumption
- **Error Rates** - Failed embeddings, connection issues

### Logging
- **Query Logs** - Search queries and results (configurable)
- **Performance Logs** - Response times, cache statistics
- **Error Logs** - Detailed error information for debugging

## Future Enhancements

### Planned Features
1. **Fine-tuned Models** - Domain-specific embeddings for specialized content
2. **Multi-modal Search** - Images, audio, video content search
3. **Federated Search** - Search across distributed data sources
4. **Auto-categorization** - Automatic content classification using ML
5. **Usage Analytics** - Search patterns to improve relevance
6. **Real-time Indexing** - Stream processing for live data
7. **Cross-lingual Search** - Query in one language, find results in any language

### Extensibility Points
- **Custom Processors** - Domain-specific text processing
- **Alternative Backends** - Support for other vector databases
- **Plugin Architecture** - Custom search algorithms and rankers

## Migration and Deployment

### Initial Setup
1. Install and configure Qdrant server
2. Set OpenAI API key in environment
3. Create SemanticSearchProvider via ResourceManager
4. Index existing data using batch insert

### Data Migration
```javascript
// Migrate any existing data to semantic search
const documents = await existingDb.getAllDocuments();
await semanticProvider.insert('documents', documents);

// Batch process large datasets
const batchSize = 1000;
for (let i = 0; i < totalRecords; i += batchSize) {
  const batch = await source.getBatch(i, batchSize);
  await semanticProvider.insert('collection', batch);
}
```

### Production Deployment
- **Qdrant Clustering** - High availability setup
- **Resource Monitoring** - Memory and CPU usage tracking  
- **Backup Strategy** - Vector data backup and recovery
- **Updates** - Zero-downtime re-indexing procedures

---

This design provides a comprehensive foundation for intelligent semantic search across any data type in the Legion framework, enabling applications and agents to discover relevant information through natural language queries and semantic understanding, regardless of whether they're searching for tools, documents, code, logs, or any other text-based content.