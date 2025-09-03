# Semantic Search RAG Module - Design Document

## Overview

The Semantic Search RAG Module provides intelligent content indexing and retrieval capabilities for the Legion framework. It enables users to index content from directories or URLs, chunk iVt intelligently, and perform semantic search queries with optional LLM-powered response generation.

## Core Responsibilities

1. **Content Indexing**: Process files and web content into searchable chunks
2. **Semantic Search**: Find relevant content using vector similarity
3. **RAG Queries**: Combine search results with LLM responses
4. **Index Management**: Maintain and update content indexes

## Architecture

### Module Structure
```
@legion/semantic-search/
├── src/
│   ├── SemanticSearchModule.js      # Main module class
│   ├── tools/
│   │   ├── IndexContentTool.js      # Index directory/URL content
│   │   ├── SearchContentTool.js     # Semantic content search
│   │   ├── QueryRAGTool.js          # RAG query with LLM
│   │   └── ManageIndexTool.js       # Index management
│   ├── processors/
│   │   ├── ContentProcessor.js      # Main content processing coordinator
│   │   ├── FileProcessor.js         # File-specific processing
│   │   ├── WebProcessor.js          # URL/web content processing
│   │   └── ChunkingStrategy.js      # Text chunking algorithms
│   ├── indexers/
│   │   ├── DocumentIndexer.js       # Document indexing pipeline
│   │   └── VectorIndexer.js         # Vector storage operations
│   ├── search/
│   │   ├── SemanticSearchEngine.js  # Core search functionality
│   │   └── RAGEngine.js             # RAG query processing
│   ├── tools-metadata.json          # Tool schemas and metadata
│   └── index.js                     # Module exports
├── __tests__/                       # Comprehensive test suite
└── docs/
    └── DESIGN.md                    # This document
```

## Integration with Existing Infrastructure

### Dependencies
- **@legion/tools-registry**: Module and Tool base classes
- **@legion/resource-manager**: Configuration and dependency injection
- **@legion/nomic**: Local Nomic embeddings (768 dimensions)
- **@legion/llm**: LLM client for RAG responses
- **Qdrant**: Vector database (localhost:6333)
- **MongoDB**: Document and metadata storage

### Leveraged Components
- **Existing Qdrant Setup**: Uses current vector database configuration
- **Nomic Embeddings**: Reuses existing local GGUF model
- **EmbeddingService**: Leverages existing batching and caching
- **File Operations**: Uses existing file reading capabilities
- **Web Fetching**: Integrates with WebFetchTool for URL content

## Database Schema

### MongoDB Collections

#### documents
```javascript
{
  _id: ObjectId,
  source: "file:///absolute/path/to/file.txt" | "https://example.com/page",
  sourceType: "file" | "url" | "directory",
  title: "Document Title or Filename",
  totalChunks: 12,
  contentHash: "sha256_of_full_content",
  fileSize: 1024000,
  contentType: "text/plain",
  indexedAt: ISODate("2024-01-01T12:00:00Z"),
  metadata: {
    fileExtension: ".md",
    lastModified: ISODate,
    encoding: "utf-8",
    language: "en"
  },
  processingOptions: {
    chunkSize: 800,
    overlap: 0.2,
    preserveStructure: true
  }
}
```

#### document_chunks
```javascript
{
  _id: ObjectId,
  documentId: ObjectId,  // Reference to documents collection
  chunkIndex: 0,         // Sequential chunk number within document
  content: "This is the actual chunk text content...",
  contentHash: "sha256_of_chunk_content",
  charStart: 0,          // Start position in original document
  charEnd: 847,          // End position in original document
  tokenCount: 156,       // Approximate token count
  embedding: [768 numbers] | null,  // Nomic embedding vector
  qdrantId: "doc_12345_chunk_0",    // Corresponding Qdrant point ID
  createdAt: ISODate,
  metadata: {
    headings: ["Chapter 1", "Introduction"],  // Document structure context
    codeBlocks: false,     // Whether chunk contains code
    listItems: true,       // Whether chunk contains lists
    hasImages: false       // Whether chunk references images
  }
}
```

### Qdrant Collection

#### semantic_content
- **Collection Name**: `semantic_content`
- **Vector Dimensions**: 768 (Nomic compatibility)
- **Distance Metric**: Cosine similarity
- **Payload Structure**:
```javascript
{
  documentId: "60f7b1c1e4b0a1b2c3d4e5f6",  // MongoDB document ID
  chunkIndex: 0,
  source: "file:///path/to/doc.md",
  title: "Document Title",
  contentType: "text/markdown",
  charStart: 0,
  charEnd: 847,
  headings: ["Chapter 1"],
  indexedAt: "2024-01-01T12:00:00Z"
}
```

## Core Components

### SemanticSearchModule
**Extends**: `Module` from `@legion/tools-registry`

**Responsibilities**:
- Initialize Qdrant and MongoDB connections
- Register and manage all semantic search tools
- Coordinate between content processing and search operations
- Handle cleanup and resource management

**Configuration**:
```javascript
{
  mongodb: {
    database: "semantic_search",  // Default database name
    collections: {
      documents: "documents",
      chunks: "document_chunks"
    }
  },
  qdrant: {
    collection: "semantic_content",
    dimensions: 768,
    distance: "cosine"
  },
  processing: {
    defaultChunkSize: 800,
    defaultOverlap: 0.2,
    maxFileSize: 50 * 1024 * 1024,  // 50MB limit
    supportedFileTypes: [".txt", ".md", ".json", ".yaml", ".js", ".py", ".java", ".go", ".html"]
  }
}
```

### ContentProcessor
**Responsibilities**:
- Detect file types and select appropriate processing strategy
- Coordinate chunking across different content types
- Handle content cleaning and normalization
- Extract metadata from processed content

**Methods**:
- `processFile(filePath, options)`: Process single file
- `processDirectory(dirPath, options)`: Process directory recursively  
- `processURL(url, options)`: Process web content
- `chunkContent(content, options)`: Apply chunking strategy

### ChunkingStrategy
**Responsibilities**:
- Implement intelligent text segmentation
- Preserve semantic boundaries (sentences, paragraphs)
- Handle overlap between chunks for context preservation
- Optimize chunk sizes for embedding generation

**Algorithm**:
1. **Sentence Boundary Detection**: Split on sentence boundaries first
2. **Size Optimization**: Target 500-1000 characters per chunk
3. **Overlap Strategy**: 20% overlap between adjacent chunks
4. **Structure Preservation**: Keep code blocks, lists, and headings intact
5. **Context Markers**: Add heading context to chunks

### DocumentIndexer
**Responsibilities**:
- Batch process content into document chunks
- Generate embeddings using Nomic service
- Store documents and chunks in MongoDB
- Index vectors in Qdrant with proper metadata

**Workflow**:
1. Process content into chunks using ContentProcessor
2. Generate batch embeddings via existing EmbeddingService
3. Store document metadata in MongoDB documents collection
4. Store chunks with embeddings in MongoDB document_chunks collection
5. Index vectors in Qdrant semantic_content collection
6. Handle deduplication based on content hashes

### SemanticSearchEngine
**Responsibilities**:
- Execute semantic queries against indexed content
- Rank and filter results by relevance
- Provide rich result metadata for context

**Search Process**:
1. Generate query embedding using Nomic
2. Search Qdrant for similar vectors
3. Retrieve corresponding document chunks from MongoDB
4. Rank results by similarity and relevance
5. Return formatted results with source context

### RAGEngine
**Responsibilities**:
- Combine semantic search with LLM response generation
- Assemble retrieved context for LLM prompts
- Generate coherent responses using search results

**RAG Workflow**:
1. Execute semantic search for user query
2. Retrieve top N relevant chunks
3. Assemble context from search results
4. Generate LLM prompt with query + context
5. Return LLM response with source citations

## Tool API Design

### IndexContentTool
**Purpose**: Index content from directories or URLs

**Input Schema**:
```javascript
{
  "source": "file:///path/to/docs" | "https://example.com",
  "sourceType": "file" | "url" | "directory",
  "options": {
    "recursive": true,           // For directories
    "fileTypes": [".md", ".txt"], // File extension filter
    "chunkSize": 800,           // Target chunk size
    "overlap": 0.2,             // Overlap ratio
    "crawlDepth": 2,            // For URLs
    "updateExisting": false     // Whether to reindex existing content
  }
}
```

**Output Schema**:
```javascript
{
  "documentsIndexed": 15,
  "chunksCreated": 247,
  "vectorsIndexed": 247,
  "processingTime": 45000,
  "errors": [],
  "summary": {
    "totalFiles": 15,
    "totalSize": 1024000,
    "avgChunksPerDoc": 16.5
  }
}
```

### SearchContentTool
**Purpose**: Perform semantic search over indexed content

**Input Schema**:
```javascript
{
  "query": "How to configure database connections",
  "options": {
    "limit": 10,
    "threshold": 0.3,
    "sourceFilter": "file:///specific/directory",  // Optional source filtering
    "contentTypeFilter": ["text/markdown"],       // Optional content type filter
    "includeContext": true                        // Include surrounding chunks
  }
}
```

**Output Schema**:
```javascript
{
  "query": "How to configure database connections",
  "results": [
    {
      "content": "Database connections can be configured...",
      "similarity": 0.847,
      "source": "file:///docs/database.md",
      "title": "Database Configuration Guide",
      "chunkIndex": 3,
      "context": {
        "previousChunk": "...",
        "nextChunk": "...",
        "headings": ["Configuration", "Database Setup"]
      },
      "metadata": {
        "fileType": "text/markdown",
        "lastModified": "2024-01-01T12:00:00Z"
      }
    }
  ],
  "totalResults": 12,
  "searchTime": 234
}
```

### QueryRAGTool
**Purpose**: Execute RAG queries combining search + LLM response

**Input Schema**:
```javascript
{
  "query": "How do I set up authentication in the system?",
  "options": {
    "searchLimit": 5,
    "searchThreshold": 0.3,
    "llmModel": "claude-3-5-sonnet",
    "includeSourceCitations": true,
    "responseStyle": "detailed" | "concise"
  }
}
```

**Output Schema**:
```javascript
{
  "query": "How do I set up authentication in the system?",
  "response": "Based on the documentation, authentication can be set up by...",
  "sources": [
    {
      "content": "Authentication setup requires...",
      "source": "file:///docs/auth.md",
      "similarity": 0.892,
      "usedInResponse": true
    }
  ],
  "llmMetadata": {
    "model": "claude-3-5-sonnet",
    "tokensUsed": 450,
    "responseTime": 1200
  },
  "searchResults": 5
}
```

### ManageIndexTool
**Purpose**: Manage document indexes (list, clear, update)

**Input Schema**:
```javascript
{
  "action": "list" | "clear" | "update" | "status",
  "options": {
    "sourceFilter": "file:///specific/path",  // Optional filter
    "contentTypeFilter": ["text/markdown"],  // Optional filter
    "includeStats": true                     // Include detailed statistics
  }
}
```

## Content Processing Pipeline

### File Processing Strategy

#### Supported File Types
- **Text Files**: `.txt`, `.md`, `.json`, `.yaml`, `.csv`
- **Code Files**: `.js`, `.py`, `.java`, `.go`, `.cpp`, `.rs`, `.php`
- **Web Content**: HTML pages via URL fetching
- **Configuration**: `.conf`, `.ini`, `.toml`, `.env`

#### Processing Rules
1. **Text Files**: Direct content extraction with encoding detection
2. **Code Files**: Preserve syntax structure, include comment extraction
3. **Markdown**: Maintain heading hierarchy for context
4. **Web Content**: HTML→text conversion via cheerio
5. **Large Files**: Stream processing for memory efficiency

### Chunking Algorithm

#### Strategy: Semantic Boundary Preservation
1. **Primary Split**: Sentence boundaries using regex patterns
2. **Size Targeting**: 500-1000 characters per chunk (configurable)
3. **Overlap**: 20% content overlap between adjacent chunks
4. **Structure Awareness**: 
   - Preserve code blocks intact
   - Keep list items together
   - Maintain heading context
   - Respect paragraph boundaries

#### Implementation Details
```javascript
// Example chunking process
class ChunkingStrategy {
  chunk(content, options = {}) {
    const { chunkSize = 800, overlap = 0.2 } = options;
    
    // 1. Detect structure (headings, code blocks, lists)
    const structure = this.analyzeStructure(content);
    
    // 2. Split into semantic units (sentences, paragraphs)
    const units = this.splitIntoUnits(content, structure);
    
    // 3. Group units into optimally-sized chunks
    const chunks = this.groupUnits(units, chunkSize, overlap);
    
    // 4. Add context metadata (headings, structure)
    return this.enrichChunks(chunks, structure);
  }
}
```

### Vector Indexing Workflow

1. **Content Processing**: Extract and chunk content
2. **Batch Embedding**: Generate embeddings using Nomic (batch size: 20)
3. **MongoDB Storage**: Store documents and chunks with embeddings
4. **Qdrant Indexing**: Index vectors with searchable metadata
5. **Deduplication**: Check content hashes to avoid duplicate indexing

## Search Architecture

### Semantic Search Process

1. **Query Embedding**: Generate query vector using Nomic
2. **Vector Search**: Query Qdrant for similar chunks (cosine similarity)
3. **Result Enrichment**: Fetch full chunk data from MongoDB
4. **Context Assembly**: Add surrounding chunks if requested
5. **Ranking**: Apply additional relevance scoring
6. **Formatting**: Return structured results with metadata

### RAG Query Process

1. **Semantic Search**: Execute content search for query
2. **Context Selection**: Choose top N most relevant chunks
3. **Context Assembly**: Format search results for LLM consumption
4. **LLM Prompting**: Generate response using assembled context
5. **Source Attribution**: Link response sections to original sources
6. **Response Formatting**: Return answer with citations

## Configuration

### Module Configuration (via ResourceManager)
```javascript
// Environment variables
SEMANTIC_SEARCH_DB_NAME=semantic_search
SEMANTIC_SEARCH_CHUNK_SIZE=800
SEMANTIC_SEARCH_OVERLAP=0.2
SEMANTIC_SEARCH_MAX_FILE_SIZE=52428800  // 50MB
QDRANT_URL=http://localhost:6333
ANTHROPIC_API_KEY=sk-...  // For RAG responses
```

### Runtime Options
```javascript
{
  chunking: {
    defaultSize: 800,
    defaultOverlap: 0.2,
    maxSize: 2000,
    minSize: 200
  },
  indexing: {
    batchSize: 20,        // Embedding batch size
    maxConcurrent: 5,     // Concurrent file processing
    skipDuplicates: true
  },
  search: {
    defaultLimit: 10,
    defaultThreshold: 0.3,
    maxResults: 100,
    includeContext: true
  },
  rag: {
    maxContextTokens: 4000,
    defaultModel: "claude-3-5-sonnet",
    includeCitations: true,
    responseMaxLength: 2000
  }
}
```

## Error Handling Strategy

### Error Types
1. **ProcessingError**: File reading, content extraction failures
2. **ChunkingError**: Text segmentation issues
3. **EmbeddingError**: Vector generation failures  
4. **IndexingError**: Database or vector store failures
5. **SearchError**: Query processing or result retrieval failures
6. **RAGError**: LLM integration failures

### Error Recovery
- **Partial Failures**: Continue processing other files/chunks
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Return partial results when possible
- **Detailed Logging**: Comprehensive error context for debugging

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: Process multiple files/chunks simultaneously
2. **Embedding Caching**: Reuse embeddings for identical content
3. **Incremental Updates**: Only reprocess changed content
4. **Memory Management**: Stream large files, cleanup resources
5. **Vector Search Optimization**: Use appropriate similarity thresholds

### Expected Performance
- **Indexing**: ~100 documents/minute (varies by size)
- **Search**: <500ms for typical queries
- **RAG Queries**: 1-3 seconds (including LLM response)
- **Memory Usage**: <500MB for typical workloads

## Security Considerations

### Input Validation
- **Path Traversal Protection**: Validate file paths, prevent directory escapes
- **File Size Limits**: Enforce maximum file size limits
- **Content Sanitization**: Clean extracted content before processing
- **URL Validation**: Validate URLs, prevent SSRF attacks

### Access Control
- **Sandboxed Processing**: Restrict file system access to specified directories
- **Content Filtering**: Skip sensitive files (.env, .key, etc.)
- **Safe Defaults**: Conservative default settings for security

## Integration Examples

### Basic Directory Indexing
```javascript
const registry = await getToolRegistry();

// Index documentation directory
const result = await registry.executeTool('index_content', {
  source: 'file:///project/docs',
  sourceType: 'directory',
  options: {
    recursive: true,
    fileTypes: ['.md', '.txt'],
    chunkSize: 800,
    overlap: 0.2
  }
});

console.log(`Indexed ${result.data.documentsIndexed} documents`);
```

### Semantic Search
```javascript
// Search for configuration information
const searchResult = await registry.executeTool('search_content', {
  query: 'database connection configuration',
  options: {
    limit: 5,
    threshold: 0.4,
    includeContext: true
  }
});

searchResult.data.results.forEach(result => {
  console.log(`${result.source}: ${result.similarity}`);
  console.log(result.content);
});
```

### RAG Query
```javascript
// Get intelligent response with sources
const ragResult = await registry.executeTool('query_rag', {
  query: 'How do I configure the database connection?',
  options: {
    searchLimit: 3,
    llmModel: 'claude-3-5-sonnet',
    includeSourceCitations: true
  }
});

console.log('Answer:', ragResult.data.response);
console.log('Sources:', ragResult.data.sources.map(s => s.source));
```

### Index Management
```javascript
// Check index status
const status = await registry.executeTool('manage_index', {
  action: 'status',
  options: { includeStats: true }
});

console.log(`Total documents: ${status.data.totalDocuments}`);
console.log(`Total chunks: ${status.data.totalChunks}`);
console.log(`Vector count: ${status.data.vectorCount}`);
```

## MVP Scope

### Core Features Included
- ✅ **Directory Indexing**: Recursive file processing with type filtering
- ✅ **URL Indexing**: Web content extraction and processing
- ✅ **Smart Chunking**: Sentence-boundary aware chunking with overlap
- ✅ **Semantic Search**: Vector-based content search with ranking
- ✅ **RAG Queries**: LLM-powered responses using search context
- ✅ **Index Management**: Basic index operations (list, clear, status)
- ✅ **Deduplication**: Content hash-based duplicate detection
- ✅ **Error Handling**: Comprehensive error recovery and logging

### File Type Support
- ✅ **Text Files**: Plain text, markdown, JSON, YAML
- ✅ **Code Files**: JavaScript, Python, Java, Go (syntax-aware chunking)
- ✅ **Web Content**: HTML pages with text extraction
- ✅ **Configuration Files**: Various config formats

### Technical Features
- ✅ **Nomic Integration**: Local GGUF model embeddings
- ✅ **Qdrant Integration**: Vector storage and similarity search  
- ✅ **MongoDB Integration**: Document and metadata persistence
- ✅ **Batch Processing**: Efficient bulk operations
- ✅ **ResourceManager Integration**: Configuration and dependencies
- ✅ **Legion Tool Registry**: Standard module/tool architecture

### Limitations & Simplifications
- **Single Index**: One global semantic index (no multiple collections)
- **Basic Chunking**: Simple size-based chunking (no advanced NLP)
- **Limited File Types**: Core text-based formats only
- **Simple RAG**: Basic context assembly (no advanced retrieval strategies)
- **No Auth**: Direct file system and web access (no authentication)

This MVP provides a solid foundation for semantic content indexing and retrieval while leveraging all existing Legion infrastructure components.