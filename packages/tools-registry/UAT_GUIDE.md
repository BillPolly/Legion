# ToolRegistry User Acceptance Testing (UAT) Guide

## Overview

This UAT guide validates the complete ToolRegistry system functionality from module discovery through semantic search capabilities. The system is designed around a primary ToolRegistry singleton interface that handles all tool operations without artificial limits.

## Architecture Overview

- **ToolRegistry**: The PRIMARY singleton interface - provides complete functionality for all users
- **Module Loading**: Background infrastructure for loading tools from filesystem modules  
- **Database Persistence**: Tools are stored in MongoDB for efficient retrieval
- **Semantic Search**: 3-phase pipeline: Perspectives → Embeddings → Vector Indexing
- **No Artificial Limits**: System returns all available tools/results unless specifically limited

## Phase 1: Basic System Initialization

**Purpose**: Verify core ToolRegistry singleton functionality and module loading.

### Step 1.1: Initialize ToolRegistry
```javascript
import { getToolRegistry } from '@legion/tools-registry';

// Get the primary singleton interface
const toolRegistry = await getToolRegistry();
console.log('✅ ToolRegistry initialized');
```

**Expected**: ToolRegistry instance created successfully.

### Step 1.2: Verify Module Discovery
```javascript
const discovery = await toolRegistry.discoverModules();
console.log(`✅ Discovered ${discovery.discovered} modules`);
```

**Expected**: Multiple modules discovered from the monorepo.

### Step 1.3: Load All Modules
```javascript
const loading = await toolRegistry.loadModules();
console.log(`✅ Loaded ${loading.successful} modules with ${loading.tools} tools`);
```

**Expected**: All discovered modules load successfully with their tools.

## Phase 2: Tool Visibility and Access

**Purpose**: Verify all tools are visible through the ToolRegistry interface without artificial limits.

### Step 2.1: Count All Available Tools
```javascript
const allTools = await toolRegistry.listTools();
console.log(`✅ Total tools available: ${allTools.length}`);
```

**Expected**: All loaded tools are visible (no 50-tool limit or other artificial restrictions).

### Step 2.2: Verify Tool Retrieval by Name
```javascript
const testTools = ['calculator', 'file_write', 'json_parse'];
for (const toolName of testTools) {
    const tool = await toolRegistry.getTool(toolName);
    console.log(`✅ ${toolName}: ${tool ? 'Found' : 'Not Found'}`);
}
```

**Expected**: All common tools can be retrieved by name.

### Step 2.3: Verify No Limits Applied
```javascript
// Test that search doesn't artificially limit results
const searchResults = await toolRegistry.searchTools('file');
console.log(`✅ Search results: ${searchResults.length} (no artificial limits)`);
```

**Expected**: Search returns all matching tools without artificial limits.

## Phase 3: Tool Execution Testing

**Purpose**: Verify tools can be executed and return expected results.

### Step 3.1: Execute Calculator Tool
```javascript
const calc = await toolRegistry.getTool('calculator');
const result = await calc.execute({ expression: '15 * 8' });
console.log(`✅ Calculator: 15 * 8 = ${result.result}`);
```

**Expected**: Result should be 120.

### Step 3.2: Execute File Operations
```javascript
const fileWrite = await toolRegistry.getTool('file_write');
const testFile = '/tmp/uat-test-' + Date.now() + '.txt';
const writeResult = await fileWrite.execute({
    filepath: testFile,
    content: 'UAT Test Content'
});
console.log('✅ File write:', writeResult.success ? 'SUCCESS' : 'FAILED');

const fileRead = await toolRegistry.getTool('file_read');
const readResult = await fileRead.execute({ filepath: testFile });
console.log('✅ File read content:', readResult.content.trim());
```

**Expected**: File operations succeed, content matches what was written.

### Step 3.3: Execute JSON Operations
```javascript
const jsonParse = await toolRegistry.getTool('json_parse');
const parseResult = await jsonParse.execute({
    jsonString: '{"name": "UAT Test", "version": 1, "active": true}'
});
console.log('✅ JSON parsed:', parseResult.result);
```

**Expected**: JSON parsing succeeds and returns the correct object.

## Phase 4: Semantic Search Infrastructure Building

**Purpose**: Build the infrastructure needed for semantic search (perspectives, embeddings, vectors).

This phase builds the 3-phase pipeline that enables semantic search:
1. **Perspectives**: Generate different viewpoints/descriptions for each tool
2. **Embeddings**: Convert perspectives to vector representations using Nomic (768 dims)
3. **Vector Indexing**: Store vectors in Qdrant for fast similarity search

### Step 4.1: Generate Tool Perspectives
```javascript
// Generate perspectives for a subset of tools to test the pipeline
const perspectiveResults = await toolRegistry.generatePerspectives({
    limit: 5,  // Test with limited set
    forceRegenerate: true
});
console.log(`✅ Generated perspectives: ${perspectiveResults.generated} tools processed`);
console.log(`   Processed: ${perspectiveResults.processed}`);
console.log(`   Skipped: ${perspectiveResults.skipped}`);
console.log(`   Errors: ${perspectiveResults.errors.length}`);
```

**Expected**: Perspectives are generated and stored in database for the specified tools. Each tool should have multiple perspective types (functional, technical, use-case).

### Step 4.2: Generate Embeddings for Perspectives  
```javascript
// Generate embeddings for the perspectives created in Step 4.1
const embeddingResults = await toolRegistry.generateEmbeddings();
console.log(`✅ Generated embeddings: ${embeddingResults.embedded} perspectives processed`);
console.log(`   Processed: ${embeddingResults.processed}`);
console.log(`   Errors: ${embeddingResults.errors.length}`);
```

**Expected**: Embeddings are created using Nomic local embeddings (768 dimensions) and stored in the database. Each perspective should now have a corresponding embedding vector.

### Step 4.3: Index Vectors in Vector Store
```javascript  
// Index the embeddings into Qdrant vector store for search
const indexResults = await toolRegistry.indexVectors();
console.log(`✅ Indexed vectors: ${indexResults.indexed} vectors processed`);
console.log(`   Errors: ${indexResults.errors.length}`);
```

**Expected**: Vectors are successfully indexed in Qdrant vector database. The system should now be ready for semantic search queries.

### Step 4.4: Verify Infrastructure Components
```javascript
// Verify the complete infrastructure is working
const stats = await toolRegistry.getStatistics();
console.log('✅ Infrastructure Status:');
console.log(`   Perspectives: ${stats.search?.perspectivesGenerated || 0}`);
console.log(`   Embeddings: ${stats.search?.perspectivesWithEmbeddings || 0}`);  
console.log(`   Vectors: ${stats.search?.vectorsIndexed || 0}`);
```

**Expected**: All infrastructure components show positive counts indicating successful setup of the semantic search pipeline.

## Phase 5: Semantic Search Testing

**Purpose**: Test the semantic search functionality using the infrastructure built in Phase 4.

### Step 5.1: Basic Semantic Search Test
```javascript
const searchResults = await toolRegistry.testSemanticSearch([
    'file operations',
    'mathematical calculations', 
    'data processing'
]);
console.log('✅ Semantic search test results:');
console.log(`   Total queries: ${searchResults.totalQueries}`);
console.log(`   Successful queries: ${searchResults.successfulQueries}`);
console.log(`   Errors: ${searchResults.errors.length}`);
```

**Expected**: Semantic search returns relevant results for test queries with good success rate.

### Step 5.2: Direct Semantic Query
```javascript
const fileResults = await toolRegistry.searchTools('file operations', { 
    useSemanticSearch: true,
    limit: 5
});
console.log(`✅ Semantic search for 'file operations': ${fileResults.length} results`);
fileResults.slice(0, 3).forEach(result => {
    console.log(`   - ${result.name}: similarity ${result.similarity?.toFixed(3) || result.score?.toFixed(3)}`);
});
```

**Expected**: Returns tools related to file operations with similarity scores, ranked by relevance.

### Step 5.3: Verify Search Quality
```javascript
const calcResults = await toolRegistry.searchTools('mathematical calculations', {
    useSemanticSearch: true,
    limit: 5
});
const hasCalculator = calcResults.some(r => r.name.toLowerCase().includes('calculator') || r.name.toLowerCase().includes('calc'));
console.log(`✅ Math search finds calculator: ${hasCalculator}`);
calcResults.forEach(result => {
    console.log(`   - ${result.name}: ${result.description}`);
});
```

**Expected**: Semantic search for mathematical terms finds calculator-related tools with high relevance.

## Phase 6: Complete End-to-End Integration Testing

**Purpose**: Verify the entire system works together seamlessly.

### Step 6.1: Full System Pipeline
```javascript
// Test complete workflow: discovery → loading → perspectives → embeddings → vectors → search → execution
console.log('🚀 Starting complete system pipeline test...');

// 1. Fresh system start
const toolRegistry = await getToolRegistry();

// 2. Load all modules
const moduleStats = await toolRegistry.loadModules();
console.log(`✅ Loaded ${moduleStats.successful} modules with ${moduleStats.tools} tools`);

// 3. Build search infrastructure
console.log('Building semantic search infrastructure...');
const perspectiveResults = await toolRegistry.generatePerspectives({ limit: 10 });
console.log(`✅ Generated ${perspectiveResults.generated} perspectives`);

const embeddingResults = await toolRegistry.generateEmbeddings();
console.log(`✅ Generated ${embeddingResults.embedded} embeddings`);

const indexResults = await toolRegistry.indexVectors();
console.log(`✅ Indexed ${indexResults.indexed} vectors`);

// 4. Test hybrid search (both text and semantic)
const hybridResults = await toolRegistry.searchTools('file processing');
console.log(`✅ Hybrid search: ${hybridResults.length} results`);

// 5. Execute found tools
if (hybridResults.length > 0) {
    const topResult = hybridResults[0];
    const tool = await toolRegistry.getTool(topResult.name);
    console.log(`✅ Can execute found tool: ${tool ? 'YES' : 'NO'}`);
}
```

**Expected**: Complete pipeline executes successfully with all components working together.

### Step 6.2: System Health and Statistics
```javascript
const healthCheck = await toolRegistry.healthCheck();
const systemStats = await toolRegistry.getStatistics();

console.log('✅ System Health Check:');
console.log(`   Overall Health: ${healthCheck.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
console.log(`   Modules: ${systemStats.modules?.loaded || 0} loaded`);
console.log(`   Tools: ${systemStats.tools?.total || 0} total`);
console.log(`   Database: ${healthCheck.database ? 'CONNECTED' : 'DISCONNECTED'}`);
console.log(`   Vector Search: ${healthCheck.vectorSearch ? 'ENABLED' : 'DISABLED'}`);
```

**Expected**: System reports healthy status with all components functioning.

### Step 6.3: Performance and Scalability
```javascript
// Test system performance with realistic usage
console.time('bulk-tool-retrieval');
const bulkTools = await Promise.all([
    toolRegistry.getTool('calculator'),
    toolRegistry.getTool('file_write'),
    toolRegistry.getTool('json_parse'),
    toolRegistry.getTool('file_read'),
    toolRegistry.getTool('json_stringify')
]);
console.timeEnd('bulk-tool-retrieval');

const allRetrieved = bulkTools.every(tool => tool !== null);
console.log(`✅ Bulk tool retrieval: ${allRetrieved ? 'SUCCESS' : 'FAILED'}`);

// Test search performance
console.time('semantic-search');
const searchResults = await toolRegistry.searchTools('data processing', { 
    useSemanticSearch: true, 
    limit: 10 
});
console.timeEnd('semantic-search');
console.log(`✅ Semantic search returned ${searchResults.length} results`);
```

**Expected**: System handles concurrent operations efficiently with acceptable performance.

## Success Criteria

For UAT to pass, all phases must complete successfully:

1. **Phase 1**: ToolRegistry initializes and loads all discovered modules
2. **Phase 2**: All tools are visible without artificial limits  
3. **Phase 3**: Core tools execute correctly and return expected results
4. **Phase 4**: Semantic search infrastructure builds successfully (perspectives → embeddings → vectors)
5. **Phase 5**: Semantic search returns relevant results for test queries
6. **Phase 6**: Complete system integration works with healthy status

## Environment Requirements

### Required Services
- **MongoDB**: Running on localhost:27017 (or configured MONGODB_URL)
- **Qdrant**: Running on localhost:6333 (or configured QDRANT_URL)

### Environment Variables
```bash
# In monorepo root .env file
MONGODB_URL=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333
USE_LOCAL_EMBEDDINGS=true  # Uses Nomic 768-dim embeddings (recommended)
# OPENAI_API_KEY=your_key   # Only if USE_LOCAL_EMBEDDINGS=false
```

## Failure Handling

If any phase fails:
1. Document the specific failure point and error message
2. Check system logs for detailed error information
3. Verify all dependencies are properly installed and configured
4. Ensure database connections are active (MongoDB and Qdrant)
5. Confirm vector database collection dimensions match embedding dimensions (768 for Nomic)

## Key Differences from Previous Version

1. **Phase 4 Correctly Described**: Now properly describes infrastructure building (perspectives → embeddings → vectors) rather than search testing
2. **No Artificial Limits**: Emphasis on system returning all results without arbitrary limits
3. **ToolRegistry Primary**: Focus on single ToolRegistry interface rather than multiple interfaces
4. **Nomic Embeddings**: Default to local Nomic embeddings (768 dimensions) rather than OpenAI
5. **Proper Pipeline**: Clear separation between infrastructure building (Phase 4) and search testing (Phase 5)
6. **Real Implementation**: All components use real implementations, no mocks or fallbacks

## Notes

- The system uses **no artificial limits** - tools and search results are only limited by explicit parameters
- **ToolRegistry** is the single point of access for all users
- **Nomic embeddings** use 768 dimensions - this is automatically handled by the system
- **MongoDB** is used for tool persistence, **Qdrant** for vector search
- All components are designed to **fail fast** rather than fallback to mock implementations
- **Phase 4** builds infrastructure, **Phase 5** tests search functionality - these are distinct phases