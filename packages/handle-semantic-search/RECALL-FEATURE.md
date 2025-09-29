# Recall Feature - Semantic Search and Handle Instantiation

## Overview

The **recall** feature enables you to search for handles using natural language and get back fully instantiated, ready-to-use handle objects in a single call.

## Why Recall?

Traditional search returns metadata about matches, but you still need to manually instantiate handles before use. **Recall** combines search and instantiation in one step:

```javascript
// Traditional: Search → Choose → Restore
const searchResults = await semanticSearch.searchHandles('cat photo');
const uri = searchResults.results[0].handleURI;
const handle = await semanticSearch.restoreHandle(uri);

// Recall: One step!
const recalled = await semanticSearch.recallHandles('cat photo');
const handle = recalled[0].handle; // Already instantiated!
```

## API

### `recallHandles(query, options)`

Searches semantically and returns instantiated handles.

**Parameters:**
- `query` (string): Natural language search query
- `options` (object): Search options
  - `limit` (number): Maximum results (default: 10)
  - `threshold` (number): Similarity threshold (default: 0.7)
  - `handleTypes` (array): Filter by handle types
  - `server` (string): Filter by server

**Returns:**
Array of objects with:
- `handle`: Instantiated handle ready to use
- `searchResult`: Complete search metadata
- `handleURI`: The handle's URI
- `similarity`: Semantic similarity score (0-1)
- `handleType`: Type of handle (mongodb, file, etc.)

## Usage Examples

### Example 1: Recall Database Handle

```javascript
const resourceManager = await ResourceManager.getInstance();
const semanticSearch = await resourceManager.createHandleSemanticSearch();

// Store some database handles
await semanticSearch.storeHandle('legion://local/mongodb/users_db/users');
await semanticSearch.storeHandle('legion://local/mongodb/products_db/products');

// Recall using natural language
const recalled = await semanticSearch.recallHandles('user management database', {
  limit: 1
});

// Use the handle immediately
const { handle, similarity } = recalled[0];
console.log(`Found with ${similarity} similarity`);

const users = await handle.find({ active: true });
console.log(`Found ${users.length} active users`);
```

### Example 2: Recall Image File (Tested ✅)

```javascript
// Store image file
const imagePath = '/path/to/cat-photo.jpg';
await semanticSearch.storeHandle(`legion://local/filesystem${imagePath}`);

// Recall using natural language
const recalled = await semanticSearch.recallHandles('cat photo picture', {
  limit: 5,
  threshold: 0.6
});

// Use the recalled handle
const { handle, similarity } = recalled[0];
console.log(`Found cat photo with similarity: ${similarity}`);
console.log(`File path: ${handle.filePath}`);

// Read the file
const content = await fs.readFile(handle.filePath);
```

**Test Results:**
- ✅ Successfully stored cat-photo.jpg
- ✅ Recalled with query "cat photo" (similarity: 0.679)
- ✅ Recalled with query "photo of a cat" (similarity: 0.701)
- ✅ Handle type correctly identified as 'file'
- ✅ Handle ready to use for file operations

### Example 3: Filter by Handle Type

```javascript
// Recall only file handles
const files = await semanticSearch.recallHandles('documentation', {
  handleTypes: ['file']
});

// All results are file handles
for (const item of files) {
  console.log(`${item.handle.filePath} (${item.similarity})`);
}
```

### Example 4: Multiple Results

```javascript
// Get top 5 most relevant handles
const recalled = await semanticSearch.recallHandles('e-commerce shopping cart', {
  limit: 5,
  threshold: 0.7
});

for (const item of recalled) {
  console.log(`\nHandle: ${item.handleURI}`);
  console.log(`Similarity: ${item.similarity.toFixed(3)}`);
  console.log(`Type: ${item.handleType}`);
  console.log(`Matched gloss: ${item.searchResult.matchedGloss.content}`);

  // Handle is ready to use
  if (item.handle.resourceType === 'mongodb') {
    const count = await item.handle.count();
    console.log(`Documents: ${count}`);
  }
}
```

## Result Object Structure

Each recalled item contains:

```javascript
{
  // Instantiated handle (ready to use)
  handle: MongoHandle | FileHandle | ...,

  // Complete search metadata
  searchResult: {
    handleURI: 'legion://local/mongodb/users',
    handleType: 'mongodb',
    similarity: 0.85,
    matchedGloss: {
      type: 'functional',
      content: 'User management database storing...',
      keywords: ['users', 'authentication', 'profiles']
    },
    metadata: { /* extracted metadata */ },
    indexed_at: '2025-09-29T20:00:00Z'
  },

  // Quick access properties
  handleURI: 'legion://local/mongodb/users',
  similarity: 0.85,
  handleType: 'mongodb'
}
```

## Error Handling

Recall gracefully handles handles that can't be instantiated:

```javascript
const recalled = await semanticSearch.recallHandles('database');

// Only includes handles that were successfully instantiated
// Handles that failed (e.g., deleted resources) are skipped automatically
```

## Performance

- **Parallel Instantiation**: Handles are instantiated concurrently
- **Automatic Filtering**: Failed instantiations don't block other results
- **Cached Handles**: ResourceManager caches handle instances

## When to Use Each Method

| Method | Use Case |
|--------|----------|
| `recallHandles()` | **Primary method** - When you want to use handles immediately |
| `searchHandles()` | When you want to inspect metadata before instantiating |
| `restoreHandle()` | When you already know the exact URI |

## Tested With

- ✅ MongoDB handles
- ✅ File handles (including image files)
- ✅ Directory handles
- ✅ Multiple handle types
- ✅ Empty results
- ✅ Error scenarios

## Test Coverage

- **Unit Tests**: 30/30 passing (100%)
- **Integration Tests**: Multiple test suites covering:
  - Basic recall workflow
  - Image file recall (cat-photo.jpg)
  - Filtering and options
  - Error handling
  - Practical use cases

## Next Steps

Try the recall feature:

```javascript
const resourceManager = await ResourceManager.getInstance();
const semanticSearch = await resourceManager.createHandleSemanticSearch();

// Store a handle
await semanticSearch.storeHandle('legion://local/mongodb/mydb/collection');

// Recall it using natural language
const recalled = await semanticSearch.recallHandles('my database collection');

// Use it immediately!
const data = await recalled[0].handle.find({ active: true });
```

The recall feature makes semantic search practical and easy to use!