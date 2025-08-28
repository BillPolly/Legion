# Legion Tools Registry - User Acceptance Testing Guide

## Overview
This UAT guide validates all critical functionality of the Legion Tools Registry system following Uncle Bob's Clean Architecture principles. It tests module loading, tool metadata, tool execution, semantic search, and infrastructure integration.

## Prerequisites

### Environment Setup
1. **MongoDB**: Running on localhost:27017
2. **Qdrant**: Running on localhost:6333  
3. **OpenAI API Key**: Set in `.env` file
4. **All dependencies installed**: `npm install` in monorepo root

### Environment Variables Required
```bash
# In monorepo root .env file
OPENAI_API_KEY=your_openai_api_key_here
MONGO_URI=mongodb://localhost:27017
QDRANT_URL=http://localhost:6333
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

## UAT Test Phases

### Phase 1: System Architecture Validation

#### Test 1.1: Clean Architecture Interface Segregation
```bash
cd /Users/williampearson/Documents/p/agents/Legion/packages/tools-registry
npm test __tests__/integration/CompleteLiveSystemTest.test.js
```

**Expected Results:**
- ✅ 30/30 modules loaded (100%)
- ✅ ~100 tools available
- ✅ Interface Segregation working (ToolConsumer vs ToolManager)
- ✅ Shared system state (both interfaces see same tools)

#### Test 1.2: Module Loading Debug
```bash
npm test __tests__/debug/ModuleLoadingDebug.test.js
```

**Expected Results:**
- ✅ All modules load without syntax errors
- ✅ JSGeneratorModule loads successfully with 8 tools
- ✅ FileModule loads successfully with 6 tools
- ✅ No "Unexpected token" errors

### Phase 2: Tool Metadata Validation

#### Test 2.1: Tool Metadata Retrieval
Create and run this test script:
```bash
node -e "
import { getToolConsumer } from './src/index.js';

console.log('🔍 Testing Tool Metadata Retrieval...');

const consumer = await getToolConsumer();

// Load all modules first
const toolManager = await import('./src/management/ToolManager.js').then(m => m.ToolManager.getInstance());
await toolManager.clearAllData();
await toolManager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await toolManager.loadAllModules();

// Test 1: Get available tools
console.log('\\n📋 Available Tools:');
const tools = await consumer.listTools();
console.log(\`Found \${tools.length} tools\`);

// Test 2: Get specific tool details
console.log('\\n🔧 Testing Calculator Tool Metadata:');
const calcTools = tools.filter(t => t.name.includes('calculate') || t.name.includes('math'));
if (calcTools.length > 0) {
  const calcTool = calcTools[0];
  console.log(\`Tool Name: \${calcTool.name}\`);
  console.log(\`Description: \${calcTool.description}\`);
  console.log(\`Input Schema: \${JSON.stringify(calcTool.inputSchema, null, 2)}\`);
  console.log(\`Output Schema: \${JSON.stringify(calcTool.outputSchema, null, 2)}\`);
} else {
  console.log('❌ No calculator tools found');
}

// Test 3: Get file operation tool details  
console.log('\\n📁 Testing File Tool Metadata:');
const fileTools = tools.filter(t => t.name.includes('file') || t.name.includes('read') || t.name.includes('write'));
if (fileTools.length > 0) {
  const fileTool = fileTools[0];
  console.log(\`Tool Name: \${fileTool.name}\`);
  console.log(\`Description: \${fileTool.description}\`);
  console.log(\`Module: \${fileTool.moduleName}\`);
  console.log(\`Has Input Schema: \${!!fileTool.inputSchema}\`);
  console.log(\`Has Output Schema: \${!!fileTool.outputSchema}\`);
} else {
  console.log('❌ No file tools found');
}

await consumer.cleanup();
"
```

**Expected Results:**
- ✅ Tools list contains ~100 tools
- ✅ Calculator tools have proper input/output schemas
- ✅ File tools have proper metadata and schemas
- ✅ No undefined or null metadata fields

#### Test 2.2: Dual Validation Architecture
```bash
node -e "
import { getToolConsumer } from './src/index.js';

console.log('🔍 Testing Dual Validation Architecture...');

const consumer = await getToolConsumer();
const toolManager = await import('./src/management/ToolManager.js').then(m => m.ToolManager.getInstance());

// Load system
await toolManager.clearAllData();
await toolManager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await toolManager.loadAllModules();

console.log('\\n1️⃣ Schema Validation (happens at tool construction):');
console.log('   - Tool schemas validated as proper JSON Schema objects');
console.log('   - Invalid schemas cause module loading to fail');
console.log('   - This happens ONCE when tools are created');

console.log('\\n2️⃣ Input Validation (happens at runtime):');
const tools = await consumer.listTools();
const testTool = tools[0]; // Get any tool

if (testTool) {
  console.log(\`   Testing with: \${testTool.name}\`);
  console.log('   Schema:', JSON.stringify(testTool.inputSchema, null, 2));
  
  // This will trigger input validation in base Tool class
  try {
    await consumer.executeTool(testTool.name, {}); // Empty params should fail validation
  } catch (error) {
    console.log('   ✅ Input validation working:', error.message);
  }
}

await consumer.cleanup();
"
```

**Expected Results:**
- ✅ Schema validation happens once during tool construction
- ✅ Input validation happens on every tool execution
- ✅ Both validations use @legion/schema centrally
- ✅ Tools no longer have custom validation methods

### Phase 3: Tool Execution Testing

#### Test 3.1: Calculator Tool Execution
```bash
node -e "
import { getToolConsumer } from './src/index.js';

console.log('🧮 Testing Calculator Tool Execution...');

const consumer = await getToolConsumer();

// Load system
const toolManager = await import('./src/management/ToolManager.js').then(m => m.ToolManager.getInstance());
await toolManager.clearAllData();
await toolManager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await toolManager.loadAllModules();

// Find calculator tool
const tools = await consumer.listTools();
const calcTool = tools.find(t => t.name.includes('calculate') || t.name.includes('math') || t.name.includes('calculator'));

if (!calcTool) {
  console.log('❌ No calculator tool found');
  process.exit(1);
}

console.log(\`Found calculator tool: \${calcTool.name}\`);

// Test basic calculation
try {
  const result = await consumer.executeTool(calcTool.name, {
    expression: '2 + 2 * 3'
  });
  
  console.log('Calculation result:', JSON.stringify(result, null, 2));
  
  if (result.success && result.result !== undefined) {
    console.log('✅ Calculator tool execution successful');
  } else {
    console.log('❌ Calculator tool execution failed');
  }
} catch (error) {
  console.log('❌ Calculator tool execution error:', error.message);
}

await consumer.cleanup();
"
```

**Expected Results:**
- ✅ Calculator tool found and identified
- ✅ Mathematical expression evaluated correctly
- ✅ Result returned in expected format
- ✅ No execution errors

#### Test 3.2: File Operation Tool Execution  
```bash
node -e "
import { getToolConsumer } from './src/index.js';
import fs from 'fs/promises';
import path from 'path';

console.log('📁 Testing File Operation Tool Execution...');

const consumer = await getToolConsumer();

// Load system
const toolManager = await import('./src/management/ToolManager.js').then(m => m.ToolManager.getInstance());
await toolManager.clearAllData();
await toolManager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await toolManager.loadAllModules();

const tools = await consumer.listTools();

// Test file write
const writeTool = tools.find(t => t.name.includes('write') || t.name === 'file_write');
if (writeTool) {
  console.log(\`Found write tool: \${writeTool.name}\`);
  
  try {
    const testFile = '/tmp/uat-test.txt';
    const testContent = 'UAT Test Content - ' + new Date().toISOString();
    
    const writeResult = await consumer.executeTool(writeTool.name, {
      filePath: testFile,
      content: testContent
    });
    
    console.log('Write result:', JSON.stringify(writeResult, null, 2));
    
    // Verify file was created
    const fileExists = await fs.access(testFile).then(() => true).catch(() => false);
    console.log(\`File created: \${fileExists}\`);
    
    if (writeResult.success && fileExists) {
      console.log('✅ File write tool execution successful');
      
      // Test file read
      const readTool = tools.find(t => t.name.includes('read') || t.name === 'file_read');
      if (readTool) {
        console.log(\`Found read tool: \${readTool.name}\`);
        
        const readResult = await consumer.executeTool(readTool.name, {
          filePath: testFile
        });
        
        console.log('Read result:', JSON.stringify(readResult, null, 2));
        
        if (readResult.success && readResult.content === testContent) {
          console.log('✅ File read tool execution successful');
        } else {
          console.log('❌ File read tool execution failed');
        }
      }
    } else {
      console.log('❌ File write tool execution failed');
    }
    
    // Cleanup
    await fs.unlink(testFile).catch(() => {});
    
  } catch (error) {
    console.log('❌ File tool execution error:', error.message);
  }
} else {
  console.log('❌ No file write tool found');
}

await consumer.cleanup();
"
```

**Expected Results:**
- ✅ File write tool found and executes successfully
- ✅ File read tool found and executes successfully  
- ✅ Content written and read back correctly
- ✅ No file operation errors

### Phase 4: Semantic Search Infrastructure Testing

#### Test 4.1: Database and Vector Store Connections
```bash
node -e "
import { getToolManager } from './src/index.js';

console.log('🔌 Testing Infrastructure Connections...');

const manager = await getToolManager();

// Test system health
console.log('\\n🏥 System Health Check:');
const health = await manager.healthCheck();
console.log('Health Status:', JSON.stringify(health, null, 2));

// Check database connection
if (health.database?.connected) {
  console.log('✅ Database connection successful');
} else {
  console.log('❌ Database connection failed:', health.database?.error);
}

// Check vector store connection  
if (health.vectorStore?.connected) {
  console.log('✅ Vector store connection successful');
} else {
  console.log('❌ Vector store connection failed:', health.vectorStore?.error);
}

await manager.cleanup();
"
```

**Expected Results:**
- ✅ Database connection successful
- ✅ Vector store (Qdrant) connection successful
- ✅ Overall system health is good

#### Test 4.2: Perspectives Generation
```bash
node -e "
import { getToolManager } from './src/index.js';

console.log('🔍 Testing Perspectives Generation...');

const manager = await getToolManager();

// Clear and load system
await manager.clearAllData();
await manager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await manager.loadAllModules();

// Generate perspectives
console.log('\\n📝 Generating Perspectives...');
const perspectiveResult = await manager.generatePerspectives();
console.log('Perspective Generation:', JSON.stringify(perspectiveResult, null, 2));

if (perspectiveResult.success && perspectiveResult.generated > 0) {
  console.log(\`✅ Generated \${perspectiveResult.generated} perspectives\`);
} else {
  console.log('❌ Perspective generation failed');
}

await manager.cleanup();
"
```

**Expected Results:**
- ✅ Perspectives generated for all tools
- ✅ Multiple perspective types per tool (functional, technical, use-case)
- ✅ No generation errors

#### Test 4.3: Embeddings Generation
```bash
node -e "
import { getToolManager } from './src/index.js';

console.log('🧠 Testing Embeddings Generation...');

const manager = await getToolManager();

// Load system with perspectives
await manager.clearAllData();
await manager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await manager.loadAllModules();
await manager.generatePerspectives();

// Generate embeddings
console.log('\\n🔢 Generating Embeddings...');
const embeddingResult = await manager.generateEmbeddings();
console.log('Embedding Generation:', JSON.stringify(embeddingResult, null, 2));

if (embeddingResult.success && embeddingResult.generated > 0) {
  console.log(\`✅ Generated \${embeddingResult.generated} embeddings\`);
} else {
  console.log('❌ Embedding generation failed:', embeddingResult.error);
}

await manager.cleanup();
"
```

**Expected Results:**
- ✅ Embeddings generated using OpenAI API
- ✅ Vector embeddings for all perspectives
- ✅ No API errors or rate limiting issues

#### Test 4.4: Vector Indexing
```bash
node -e "
import { getToolManager } from './src/index.js';

console.log('📊 Testing Vector Indexing...');

const manager = await getToolManager();

// Full pipeline
await manager.clearAllData();
await manager.discoverModules(['/Users/williampearson/Documents/p/agents/Legion/packages/modules']);
await manager.loadAllModules();
await manager.generatePerspectives();
await manager.generateEmbeddings();

// Index vectors
console.log('\\n🗂️ Indexing Vectors...');
const indexResult = await manager.indexVectors();
console.log('Vector Indexing:', JSON.stringify(indexResult, null, 2));

if (indexResult.success && indexResult.indexed > 0) {
  console.log(\`✅ Indexed \${indexResult.indexed} vectors\`);
} else {
  console.log('❌ Vector indexing failed:', indexResult.error);
}

await manager.cleanup();
"
```

**Expected Results:**
- ✅ Vectors indexed in Qdrant
- ✅ Search index created successfully
- ✅ No indexing errors

### Phase 5: Semantic Search Testing

#### Test 5.1: Complete Pipeline Setup
```bash
node -e "
import { getToolManager } from './src/index.js';

console.log('🚀 Running Complete Semantic Search Pipeline...');

const manager = await getToolManager();

// Run complete pipeline
console.log('\\n⚡ Running Complete Pipeline...');
const pipelineResult = await manager.runCompletePipeline({
  searchPaths: ['/Users/williampearson/Documents/p/agents/Legion/packages/modules'],
  generatePerspectives: true,
  generateEmbeddings: true,
  indexVectors: true
});

console.log('Pipeline Result:', JSON.stringify(pipelineResult, null, 2));

if (pipelineResult.success) {
  console.log('✅ Complete semantic search pipeline successful');
  
  // Show pipeline steps
  console.log('\\n📋 Pipeline Steps:');
  pipelineResult.steps?.forEach((step, i) => {
    console.log(\`  \${i + 1}. \${step.name}: \${step.success ? '✅' : '❌'}\`);
  });
} else {
  console.log('❌ Pipeline failed:', pipelineResult.error);
}

await manager.cleanup();
"
```

**Expected Results:**
- ✅ All pipeline steps complete successfully
- ✅ Modules loaded, perspectives generated, embeddings created, vectors indexed
- ✅ System ready for semantic search

#### Test 5.2: Semantic Search Queries
```bash
node -e "
import { getToolConsumer } from './src/index.js';
import { getToolManager } from './src/index.js';

console.log('🔍 Testing Semantic Search Queries...');

// Setup complete system
const manager = await getToolManager();
await manager.runCompletePipeline({
  searchPaths: ['/Users/williampearson/Documents/p/agents/Legion/packages/modules'],
  generatePerspectives: true,
  generateEmbeddings: true,
  indexVectors: true
});

const consumer = await getToolConsumer();

// Test semantic search queries
const testQueries = [
  'calculate mathematical expressions',
  'read and write files',
  'generate JavaScript code',
  'send emails',
  'deploy applications',
  'analyze images',
  'work with JSON data'
];

console.log('\\n🎯 Testing Search Queries:');

for (const query of testQueries) {
  try {
    console.log(\`\\n Query: \"\${query}\"\`);
    
    const results = await consumer.searchTools(query, {
      useSemanticSearch: true,
      limit: 3,
      minScore: 0.3
    });
    
    console.log(\`  Found \${results.length} results\`);
    results.forEach((result, i) => {
      console.log(\`    \${i + 1}. \${result.name} (score: \${result.score?.toFixed(3) || 'N/A'})\`);
    });
    
    if (results.length > 0) {
      console.log('  ✅ Search successful');
    } else {
      console.log('  ❌ No results found');
    }
    
  } catch (error) {
    console.log(\`  ❌ Search failed: \${error.message}\`);
  }
}

await consumer.cleanup();
await manager.cleanup();
"
```

**Expected Results:**
- ✅ All search queries return relevant results
- ✅ Semantic similarity scores are reasonable (>0.3)
- ✅ Results are ranked by relevance
- ✅ No search errors

#### Test 5.3: Search vs Direct Tool Access Performance
```bash
node -e "
import { getToolConsumer } from './src/index.js';
import { getToolManager } from './src/index.js';

console.log('⚡ Testing Search Performance...');

// Setup system
const manager = await getToolManager();
await manager.runCompletePipeline({
  searchPaths: ['/Users/williampearson/Documents/p/agents/Legion/packages/modules']
});

const consumer = await getToolConsumer();

// Performance test
const startTime = Date.now();

for (let i = 0; i < 10; i++) {
  await consumer.searchTools('mathematical operations', { limit: 5 });
}

const searchTime = Date.now() - startTime;
console.log(\`Search Performance: \${searchTime}ms for 10 queries (\${(searchTime/10).toFixed(1)}ms avg)\`);

// Test direct tool access
const directStart = Date.now();
const allTools = await consumer.listTools();
const directTime = Date.now() - directStart;

console.log(\`Direct Access: \${directTime}ms to list \${allTools.length} tools\`);

if (searchTime < 5000) {  // Should be under 5 seconds for 10 queries
  console.log('✅ Search performance acceptable');
} else {
  console.log('❌ Search performance too slow');
}

await consumer.cleanup();
await manager.cleanup();
"
```

**Expected Results:**
- ✅ Search performance under 500ms per query
- ✅ Direct tool access faster than search
- ✅ System handles multiple concurrent searches

### Phase 6: Integration Testing

#### Test 6.1: Full Workflow Test
```bash
node -e "
import { getToolConsumer, getToolManager } from './src/index.js';

console.log('🔄 Testing Complete Workflow...');

// 1. Setup system
console.log('\\n1️⃣ Setting up system...');
const manager = await getToolManager();
const consumer = await getToolConsumer();

await manager.runCompletePipeline({
  searchPaths: ['/Users/williampearson/Documents/p/agents/Legion/packages/modules']
});

// 2. Search for tool
console.log('\\n2️⃣ Searching for calculator tool...');
const calcResults = await consumer.searchTools('mathematical calculations', { limit: 1 });

if (calcResults.length === 0) {
  console.log('❌ No calculator tool found via search');
  process.exit(1);
}

const calcTool = calcResults[0];
console.log(\`Found: \${calcTool.name}\`);

// 3. Execute tool  
console.log('\\n3️⃣ Executing calculator tool...');
const execResult = await consumer.executeTool(calcTool.name, {
  expression: '(10 + 5) * 2'
});

console.log('Execution result:', execResult);

// 4. Verify result
if (execResult.success && execResult.result === 30) {
  console.log('✅ Complete workflow successful: Search → Execute → Verify');
} else {
  console.log('❌ Workflow failed at execution step');
}

await consumer.cleanup();
await manager.cleanup();
"
```

**Expected Results:**
- ✅ System setup completes successfully
- ✅ Semantic search finds appropriate tool
- ✅ Tool execution produces correct result
- ✅ End-to-end workflow works seamlessly

## UAT Acceptance Criteria

### ✅ Must Pass (Critical)
1. **Module Loading**: 30/30 modules load successfully (100%)
2. **Tool Availability**: ~100 tools available across all categories
3. **Clean Architecture**: Interface segregation working properly
4. **Tool Execution**: Calculator and file tools execute correctly
5. **Infrastructure**: Database and vector store connections working

### ⚠️ Should Pass (Important)  
1. **Semantic Search**: Search queries return relevant results
2. **Perspectives**: Generated for all tools with multiple viewpoints
3. **Embeddings**: Generated using OpenAI API without errors
4. **Performance**: Search queries complete under 500ms
5. **Error Handling**: Graceful error handling for invalid inputs

### 🔍 Nice to Have (Enhancement)
1. **Search Accuracy**: Semantic search scores >0.5 for relevant queries
2. **Performance**: Sub-100ms search response times
3. **Coverage**: All tool categories represented in search results
4. **Robustness**: System handles concurrent operations

## Running the Complete UAT

Execute all tests in sequence:

```bash
# Navigate to tools-registry
cd /Users/williampearson/Documents/p/agents/Legion/packages/tools-registry

# Run all UAT phases
echo "=== PHASE 1: ARCHITECTURE ==="
npm test __tests__/integration/CompleteLiveSystemTest.test.js

echo "=== PHASE 2-6: FUNCTIONALITY ==="
# Copy each test script above and run individually

echo "=== UAT COMPLETE ==="
```

## Expected Final State

After successful UAT completion:

- 🏗️ **Clean Architecture**: Uncle Bob's principles implemented
- 📦 **30/30 Modules**: All modules loaded and functional  
- 🔧 **100+ Tools**: All tools have proper metadata and execute correctly
- 🔍 **Semantic Search**: Full-text and vector search working
- 💾 **Infrastructure**: MongoDB + Qdrant + OpenAI integration complete
- 🚀 **Production Ready**: Error handling, logging, performance tested

---

**Please review this UAT guide and let me know if you'd like me to proceed with running these tests, or if you need any modifications to the testing approach.**