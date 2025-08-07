# @legion/semantic-search

Intelligent semantic search provider for the Legion framework, enabling natural language search across any type of document or data using AI-powered embeddings.

## Features

- 🔍 **Natural Language Search** - Search using everyday language, not just keywords
- 🎯 **Semantic Understanding** - Finds conceptually similar content, not just exact matches
- ⚡ **Hybrid Search** - Combines semantic and keyword search for best results
- 📊 **Similarity Matching** - Find documents similar to a reference document
- 🚀 **High Performance** - Embedding caching, batch processing, and optimized vector search
- 🔧 **Legion Integration** - Works seamlessly with ResourceManager and storage providers
- 📝 **Multi-format Support** - Documents, code, logs, JSON, or any text data

## Installation

```bash
npm install @legion/semantic-search
```

## Quick Start

```javascript
import { ResourceManager } from '@legion/tools';
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

## License

MIT