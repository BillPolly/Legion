/**
 * Filesystem Query Examples
 * 
 * Demonstrates all the query patterns available for filesystem operations
 * using the Handle query combinator system.
 */

import { DirectoryHandle, FileHandle } from '../src/handles/index.js';
import { LocalFileSystemResourceManager } from '../src/resourcemanagers/LocalFileSystemResourceManager.js';

// Create a ResourceManager instance
const resourceManager = new LocalFileSystemResourceManager({
  rootPath: '/home/user/documents',
  enableWatching: true
});

// Create a DirectoryHandle for the root
const rootDir = new DirectoryHandle(resourceManager, '/home/user/documents');

console.log('=== FILESYSTEM QUERY COMBINATOR EXAMPLES ===\n');

// ============================================================================
// 1. METADATA QUERIES - Get file/directory information
// ============================================================================
console.log('1. METADATA QUERIES\n');

// Query directory metadata
const dirMetadataQuery = {
  find: ['metadata'],
  where: [['directory', '/home/user/documents', 'metadata']]
};
console.log('Directory metadata query:', dirMetadataQuery);
// Returns: [{ path, type: 'directory', exists, size, lastModified, created, permissions, isDirectory, isFile }]

// Query file metadata
const fileMetadataQuery = {
  find: ['metadata'],
  where: [['file', '/home/user/documents/report.pdf', 'metadata']]
};
console.log('File metadata query:', fileMetadataQuery);
// Returns: [{ path, type: 'file', exists, size, lastModified, created, permissions, isDirectory, isFile }]

// ============================================================================
// 2. CONTENT QUERIES - Read file contents
// ============================================================================
console.log('\n2. CONTENT QUERIES\n');

// Read entire file as text
const textContentQuery = {
  find: ['content'],
  where: [['file', '/home/user/documents/notes.txt', 'content']],
  options: { encoding: 'utf8' }
};
console.log('Text content query:', textContentQuery);
// Returns: ['file contents as string']

// Read file as binary
const binaryContentQuery = {
  find: ['content'],
  where: [['file', '/home/user/documents/image.jpg', 'content']],
  options: { encoding: null }
};
console.log('Binary content query:', binaryContentQuery);
// Returns: [Buffer/Uint8Array with binary data]

// Read partial file content with offset and length
const partialContentQuery = {
  find: ['content'],
  where: [['file', '/home/user/documents/large.log', 'content']],
  options: { 
    encoding: 'utf8',
    offset: 1024,    // Start at byte 1024
    length: 512      // Read 512 bytes
  }
};
console.log('Partial content query:', partialContentQuery);
// Returns: ['partial file contents']

// ============================================================================
// 3. LISTING QUERIES - Get directory contents
// ============================================================================
console.log('\n3. LISTING QUERIES\n');

// Simple directory listing
const listQuery = {
  find: ['name', 'type', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', '?name'],
    ['type', '?type'],
    ['metadata', '?metadata']
  ]
};
console.log('Directory listing query:', listQuery);
// Returns: [{ name: 'file1.txt', type: 'file', metadata: {...} }, ...]

// Recursive directory listing
const recursiveListQuery = {
  find: ['name', 'type', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', '?name'],
    ['type', '?type'],
    ['metadata', '?metadata']
  ],
  recursive: true
};
console.log('Recursive listing query:', recursiveListQuery);
// Returns: All files and directories recursively

// Filtered directory listing (only files)
const filteredListQuery = {
  find: ['name', 'type', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', '?name'],
    ['type', '?type'],
    ['metadata', '?metadata']
  ],
  filter: (item) => item.type === 'file'
};
console.log('Filtered listing query (files only):', filteredListQuery);
// Returns: Only file entries, no directories

// ============================================================================
// 4. SEARCH QUERIES - Find files by patterns
// ============================================================================
console.log('\n4. SEARCH QUERIES\n');

// Search by name pattern (wildcard)
const wildcardSearchQuery = {
  find: ['path', 'name', 'type', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', 'matches', '*.pdf'],  // Wildcard pattern
    ['path', '?path'],
    ['type', '?type'],
    ['metadata', '?metadata']
  ]
};
console.log('Wildcard search query:', wildcardSearchQuery);
// Returns: All PDF files in directory

// Recursive search with pattern
const recursiveSearchQuery = {
  find: ['path', 'name', 'type', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', 'matches', 'test*.js'],
    ['path', '?path'],
    ['type', '?type'],
    ['metadata', '?metadata']
  ],
  recursive: true,
  limit: 10  // Limit results to 10 items
};
console.log('Recursive search query:', recursiveSearchQuery);
// Returns: Up to 10 JS test files from entire tree

// Complex search with multiple conditions
const complexSearchQuery = {
  find: ['path', 'name', 'type', 'size'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', 'matches', '*.log'],
    ['type', 'file'],
    ['size', '>', 1024 * 1024]  // Files larger than 1MB
  ],
  recursive: true
};
console.log('Complex search query:', complexSearchQuery);
// Returns: Log files larger than 1MB

// ============================================================================
// 5. STREAM QUERIES - Get file streams
// ============================================================================
console.log('\n5. STREAM QUERIES\n');

// Create read stream
const readStreamQuery = {
  find: ['stream'],
  where: [['file', '/home/user/documents/video.mp4', 'readStream']],
  options: {
    encoding: null,
    start: 0,        // Start position
    end: 1024 * 1024 // Read first 1MB
  }
};
console.log('Read stream query:', readStreamQuery);
// Returns: [ReadableStream]

// Create write stream
const writeStreamQuery = {
  find: ['stream'],
  where: [['file', '/home/user/documents/output.txt', 'writeStream']],
  options: {
    encoding: 'utf8',
    flags: 'a'  // Append mode
  }
};
console.log('Write stream query:', writeStreamQuery);
// Returns: [WritableStream]

// ============================================================================
// 6. WATCH QUERIES - Subscribe to file changes
// ============================================================================
console.log('\n6. WATCH QUERIES\n');

// Watch single file for changes
const watchFileQuery = {
  find: ['event', 'data'],
  where: [['file', '/home/user/documents/config.json', 'change']]
};
console.log('Watch file query:', watchFileQuery);
// Subscribe returns: { id, unsubscribe() }
// Callback receives: [{ event: 'change'|'rename', path, timestamp }]

// Watch directory for changes
const watchDirectoryQuery = {
  find: ['path', 'event', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['event', '?event'],
    ['path', '?path'],
    ['metadata', '?metadata']
  ]
};
console.log('Watch directory query:', watchDirectoryQuery);
// Notifies on any file/directory changes in watched directory

// Recursive directory watching
const recursiveWatchQuery = {
  find: ['path', 'event', 'metadata'],
  where: [
    ['parent', '/home/user/documents'],
    ['event', '?event'],
    ['path', '?path'],
    ['metadata', '?metadata']
  ],
  recursive: true
};
console.log('Recursive watch query:', recursiveWatchQuery);
// Watches entire directory tree for changes

// ============================================================================
// 7. ADVANCED QUERY PATTERNS
// ============================================================================
console.log('\n7. ADVANCED QUERY PATTERNS\n');

// Query with custom projections
const projectionQuery = {
  find: ['name', 'size', 'modified'],  // Select specific fields
  where: [
    ['parent', '/home/user/documents'],
    ['type', 'file'],
    ['name', '?name'],
    ['size', '?size'],
    ['lastModified', '?modified']
  ]
};
console.log('Projection query:', projectionQuery);
// Returns only specified fields

// Query with joins (find files with same name in different directories)
const joinQuery = {
  find: ['path1', 'path2'],
  where: [
    ['parent', '/home/user/documents/dir1', '?file1'],
    ['parent', '/home/user/documents/dir2', '?file2'],
    ['?file1', 'name', '?name'],
    ['?file2', 'name', '?name']  // Same name constraint
  ]
};
console.log('Join query:', joinQuery);
// Returns pairs of files with matching names

// Aggregation-style query (count files by extension)
const aggregateQuery = {
  find: ['extension', 'count'],
  where: [
    ['parent', '/home/user/documents'],
    ['type', 'file'],
    ['extension', '?ext']
  ],
  aggregate: {
    groupBy: 'extension',
    count: true
  }
};
console.log('Aggregation query:', aggregateQuery);
// Returns file counts by extension

// ============================================================================
// 8. HANDLE METHOD QUERY COMBINATORS
// ============================================================================
console.log('\n8. HANDLE METHOD QUERY COMBINATORS\n');

// The Handle base class provides query combinator methods
const fileHandle = new FileHandle(resourceManager, '/home/user/documents/data.json');

// Using Handle's query() method directly
const directQuery = fileHandle.query({
  find: ['content'],
  where: [['file', fileHandle.path, 'content']]
});
console.log('Direct Handle query:', directQuery);

// Using Handle's where() combinator
const whereQuery = fileHandle
  .where('type', 'file')
  .where('size', '>', 1024)
  .find(['name', 'size']);
console.log('Where combinator query:', whereQuery);

// Using Handle's select() combinator for projections
const selectQuery = fileHandle
  .select('name', 'size', 'lastModified')
  .where('parent', '/home/user/documents');
console.log('Select combinator query:', selectQuery);

// ============================================================================
// 9. REACTIVE QUERIES WITH SUBSCRIPTIONS
// ============================================================================
console.log('\n9. REACTIVE QUERIES WITH SUBSCRIPTIONS\n');

// Subscribe to query results that update automatically
const subscription = resourceManager.subscribe(
  {
    find: ['name', 'size'],
    where: [
      ['parent', '/home/user/documents'],
      ['type', 'file'],
      ['extension', '.txt']
    ]
  },
  (results) => {
    console.log('Text files changed:', results);
  }
);

// The subscription will fire whenever:
// - A .txt file is added/removed/modified in the directory
// - File sizes change
// - Files are renamed

// Unsubscribe when done
// subscription.unsubscribe();

// ============================================================================
// 10. TRANSACTION-STYLE QUERIES
// ============================================================================
console.log('\n10. TRANSACTION-STYLE QUERIES\n');

// Batch multiple operations in a transaction-like pattern
const transactionQuery = {
  transaction: [
    {
      operation: 'write',
      path: '/home/user/documents/file1.txt',
      content: 'Content 1'
    },
    {
      operation: 'write', 
      path: '/home/user/documents/file2.txt',
      content: 'Content 2'
    },
    {
      operation: 'move',
      source: '/home/user/documents/old.txt',
      target: '/home/user/documents/archive/old.txt'
    }
  ],
  atomic: true  // All or nothing
};
console.log('Transaction query:', transactionQuery);
// Executes all operations atomically

// ============================================================================
// PRACTICAL EXAMPLES
// ============================================================================
console.log('\n=== PRACTICAL EXAMPLES ===\n');

// Example 1: Find all JavaScript files modified in the last 24 hours
const recentJsFiles = {
  find: ['path', 'name', 'lastModified'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', 'matches', '*.js'],
    ['lastModified', '>', new Date(Date.now() - 24*60*60*1000).toISOString()]
  ],
  recursive: true
};
console.log('Recent JS files:', recentJsFiles);

// Example 2: Find duplicate files by size
const duplicatesBySize = {
  find: ['path', 'size'],
  where: [
    ['parent', '/home/user/documents'],
    ['type', 'file'],
    ['size', '?size']
  ],
  having: {
    count: '>', 1  // Groups with more than 1 file
  },
  groupBy: 'size'
};
console.log('Duplicate files by size:', duplicatesBySize);

// Example 3: Monitor configuration files for changes
const configWatcher = {
  find: ['path', 'event', 'content'],
  where: [
    ['parent', '/home/user/documents'],
    ['name', 'matches', '*.{json,yaml,toml,ini}'],
    ['event', 'change']
  ],
  recursive: true,
  debounce: 1000  // Debounce rapid changes
};
console.log('Config file watcher:', configWatcher);

// Clean up
resourceManager.destroy();