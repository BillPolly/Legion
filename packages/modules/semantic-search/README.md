# Semantic Search RAG Module

A comprehensive RAG (Retrieval-Augmented Generation) module for the Legion framework that provides intelligent content indexing and semantic search capabilities.

## 🎯 MVP Completed

This module provides a complete semantic search and RAG system with real infrastructure integration:

- ✅ **Content Indexing**: Index files, directories, and URLs
- ✅ **Semantic Search**: Vector-based similarity search  
- ✅ **RAG Queries**: LLM-powered responses with source citations
- ✅ **Index Management**: Status, listing, and clearing operations

## 🛠️ Tools Provided

### `index_content` 
Index content from various sources into searchable chunks:
```javascript
await registry.executeTool('index_content', {
  source: '/path/to/docs',
  sourceType: 'directory',
  options: {
    recursive: true,
    fileTypes: ['.md', '.txt', '.js'],
    chunkSize: 800,
    overlap: 0.2
  }
});
```

### `search_content`
Perform semantic search over indexed content:
```javascript  
await registry.executeTool('search_content', {
  query: 'database connection configuration',
  options: {
    limit: 5,
    threshold: 0.3,
    includeContext: true
  }
});
```

### `query_rag`
Get intelligent responses using RAG (search + LLM):
```javascript
await registry.executeTool('query_rag', {
  query: 'How do I set up authentication?',
  options: {
    searchLimit: 3,
    responseStyle: 'detailed',
    includeSourceCitations: true
  }
});
```

### `manage_index`
Manage and maintain content indexes:
```javascript
await registry.executeTool('manage_index', {
  action: 'status',
  options: { includeStats: true }
});
```

## 🏗️ Architecture

### Core Components
- **SemanticSearchModule**: Main module extending Legion Module base
- **ContentProcessor**: Smart text chunking with structure preservation  
- **FileProcessor**: File system operations with security validation
- **WebProcessor**: URL content extraction with HTML parsing
- **DocumentIndexer**: Complete indexing pipeline with embeddings
- **SemanticSearchEngine**: Vector similarity search with ranking
- **RAGEngine**: Context assembly and LLM response generation

### Infrastructure Integration
- **MongoDB**: Document and chunk storage with proper indexing
- **Qdrant**: Vector storage for 768-dimensional embeddings
- **Nomic**: Local GGUF embeddings for semantic understanding
- **LLM Client**: Anthropic Claude integration for RAG responses

## 📊 Test Coverage

**170+ Tests Passing** across all components:
- **Complete Integration Tests**: Using real MongoDB + Qdrant + Nomic (no mocks)
- **Comprehensive Unit Tests**: All edge cases and error scenarios covered
- **Performance Validated**: Sub-second search times, efficient batch processing
- **Error Handling**: Graceful error recovery and detailed error reporting

## 🚀 Production Ready

This module follows all Legion framework conventions:
- ✅ **ResourceManager Integration**: All configuration via environment variables  
- ✅ **Tool Registry Compliance**: Standard Module and Tool base classes
- ✅ **TDD Implementation**: Test-first development with comprehensive coverage
- ✅ **No Fallbacks**: Fail-fast error handling throughout
- ✅ **Real Infrastructure**: No mocks in production code
- ✅ **Clean Architecture**: Uncle Bob's principles applied consistently

## 📁 Module Structure

```
@legion/semantic-search/
├── src/
│   ├── SemanticSearchModule.js      # Main module class
│   ├── tools/                       # 4 Legion tools
│   │   ├── IndexContentTool.js
│   │   ├── SearchContentTool.js
│   │   ├── QueryRAGTool.js
│   │   └── ManageIndexTool.js
│   ├── processors/                  # Content processing pipeline
│   │   ├── ContentProcessor.js
│   │   ├── ChunkingStrategy.js
│   │   ├── FileProcessor.js
│   │   └── WebProcessor.js
│   ├── indexers/                    # Document indexing
│   │   └── DocumentIndexer.js
│   ├── search/                      # Search and RAG engines
│   │   ├── SemanticSearchEngine.js
│   │   └── RAGEngine.js
│   ├── database/                    # MongoDB schema
│   │   └── DatabaseSchema.js
│   ├── tools-metadata.json          # Complete tool schemas
│   └── index.js                     # Module exports
├── __tests__/                       # 170+ comprehensive tests
├── docs/
│   ├── DESIGN.md                    # Complete design document
│   └── IMPLEMENTATION-PLAN.md       # TDD implementation plan
└── package.json                     # Dependencies and scripts
```

## 🎉 Ready for Integration

The semantic search RAG module is **complete and ready** for integration with the Legion tool registry. It provides powerful content indexing and intelligent search capabilities with full infrastructure integration.

**Key Features Delivered:**
- 📁 **Universal Indexing**: Files, directories, web content
- 🔍 **Semantic Search**: Vector similarity with context
- 🤖 **RAG Responses**: LLM-powered answers with citations  
- 🛠️ **Index Management**: Complete lifecycle operations
- 🧪 **Thoroughly Tested**: 170+ tests with real infrastructure
- ⚡ **High Performance**: Optimized for production workloads