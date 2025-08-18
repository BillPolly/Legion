# @legion/semantic-search

Intelligent semantic search system designed for AI agent debugging, with local Nomic embeddings and unified event capture. Enables natural language search across documents, logs, tests, and runtime events.

## Features

### Core Search Capabilities
- 🔍 **Natural Language Search** - Search using everyday language, not just keywords
- 🎯 **Semantic Understanding** - Finds conceptually similar content, not just exact matches
- ⚡ **Hybrid Search** - Combines semantic and keyword search for best results
- 📊 **Similarity Matching** - Find documents similar to a reference document
- 🚀 **High Performance** - Embedding caching, batch processing, and optimized vector search

### Unified Event System
- 🧪 **Jest Integration** - Capture test events, console logs, and assertions with proper timing
- 📊 **Production Logs** - Structured log capture with correlation tracking
- 🔄 **Runtime Events** - API calls, performance metrics, errors, and system events
- 🔗 **Correlation Tracking** - Trace requests across distributed systems
- 🤖 **AI Agent Interface** - Natural language queries for intelligent debugging

### Local Embeddings
- 💻 **Nomic Embeddings** - Local embeddings with high-quality semantic understanding (2-5ms per embedding)
- 💰 **Cost Effective** - No API costs, runs entirely offline
- 🎯 **Event Optimized** - Specialized for log and event text processing
- 📈 **High Throughput** - 200-500 embeddings/second on Apple Silicon

## Architecture

```
Jest Tests → UniversalEventCollector ← Production Logs
     ↓              ↓                        ↑
Console Logs   Correlation ID          LogManager
     ↓         Tracking                      ↑
     ↓              ↓                   API/Runtime
     └──────→ Local Nomic Embeddings ←──────┘
                    ↓
            Vector Store (Qdrant)
                    ↓
        AgentEventAnalyzer (Natural Language Queries)
```

## Installation

```bash
npm install @legion/semantic-search
```

## Quick Start

### 1. Basic Document Search

```javascript
import { ResourceManager } from '@legion/tools-registry';
import { SemanticSearchProvider } from '@legion/semantic-search';

// Initialize (loads .env automatically)
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Create provider
const searchProvider = await SemanticSearchProvider.create(resourceManager);
await searchProvider.connect();

// Index documents
await searchProvider.insert('docs', [
  { id: '1', title: 'React Guide', content: 'Learn React hooks and components...' },
  { id: '2', title: 'Node.js Tutorial', content: 'Build APIs with Express...' }
]);

// Search with natural language
const results = await searchProvider.semanticSearch('docs', 
  'how to build frontend applications',
  { limit: 5 }
);

// Results include similarity scores
results.forEach(r => {
  console.log(`${r.document.title} - Similarity: ${r._similarity}`);
});
```

### 2. Unified Event System for AI Debugging

```javascript
import { UniversalEventCollector } from '@legion/jester/core/UniversalEventCollector.js';
import { EventAwareLogManager } from '@legion/log-manager/EventAwareLogManager.js';
import { EventSemanticSearchProvider } from '@legion/semantic-search/providers/EventSemanticSearchProvider.js';
import { AgentEventAnalyzer } from '@legion/semantic-search/agents/AgentEventAnalyzer.js';

// Initialize event capture system
const eventCollector = new UniversalEventCollector();
const logManager = new EventAwareLogManager();
logManager.setEventCollector(eventCollector);

// Create event-aware search with local embeddings
const searchProvider = await EventSemanticSearchProvider.create(resourceManager, {
  useLocalEmbeddings: true,
  localModelPath: './models/nomic-embed-text-v1' # Bundled with @legion/nomic
});

// Create AI agent interface
const agentAnalyzer = new AgentEventAnalyzer(searchProvider);

// Events are automatically captured from:
// - Jest tests (test events, console logs, assertions)
// - Production logs (structured logs with correlation IDs)  
// - API calls (HTTP requests with status/duration)
// - Runtime events (errors, performance metrics)

// AI agents can investigate using natural language:
const result = await agentAnalyzer.investigate(
  'what database errors happened in the last hour?'
);

console.log(result.summary);
// {
//   totalErrors: 15,
//   services: ['user-service', 'payment-service'],
//   commonPatterns: ['Connection timeout', 'Query timeout']
// }

// Analyze test failures with production correlation
const analysis = await agentAnalyzer.investigate(
  'analyze failing database tests and find related production issues'
);

// Trace requests across all systems
const trace = await agentAnalyzer.investigate(
  'trace all events for correlation ID corr-abc-123'
);
```

### 3. Jest Integration

```javascript
// jest.config.js
export default {
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.js']
};

// src/test-setup.js
import { setupEventCapture } from '@legion/semantic-search/testing';
setupEventCapture();

// Tests automatically generate events with proper timing
describe('User Authentication', () => {
  test('should authenticate valid user', async () => {
    console.log('Starting authentication test'); // Captured with test context
    const result = await authenticateUser('valid@user.com', 'password123');
    expect(result.success).toBe(true);
  });
});
```

## Natural Language Query Examples

The AgentEventAnalyzer supports these query patterns:

### Error Investigation
- "what errors happened in [service] [timeframe]?"
- "show me database connection failures"
- "find authentication errors in the last hour"

### Test Analysis  
- "analyze failing tests in [component]"
- "show test failures related to [feature]"
- "find tests that started failing recently"

### Correlation Tracing
- "trace request [id] across all services"
- "follow user [id] journey through the system" 
- "show timeline for correlation [id]"

### Pattern Analysis
- "what are common error patterns?"
- "show trending issues in [timeframe]"
- "find recurring failures in [service]"

## Performance

### Local Embeddings (Apple M4)
- **Model**: nomic-embed-text-v1 (768 dimensions)
- **Performance**: 2-5ms per embedding
- **Throughput**: 200-500 embeddings/second
- **Memory**: ~500MB model + ~100MB working memory

### Event Processing
- **Buffer Size**: 1000 events (configurable)
- **Batch Processing**: 100 events per batch
- **Flush Interval**: 5 seconds (configurable)
- **Correlation Tracking**: In-memory with LRU eviction

## Configuration

### Environment Variables

```bash
# Vector Database (Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key

# Semantic Search Settings  
SEMANTIC_SEARCH_CACHE_TTL=3600
SEMANTIC_SEARCH_ENABLE_CACHE=true

# Local Embeddings (optional - uses OpenAI if not configured)
# No model path needed - Nomic embeddings are bundled with @legion/nomic
# LOCAL_EMBEDDING_MODEL_PATH=./models/nomic-embed-text-v1
```

## Testing

```bash
# Run all tests
npm test

# Run integration tests
npm test -- --testMatch="**/__tests__/integration/**"

# Run unified event system test
npm test -- --testMatch="**/unified-event-system.test.js"
```

## License

MIT