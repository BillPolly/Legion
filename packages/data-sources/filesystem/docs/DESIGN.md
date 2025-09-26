# Filesystem DataSource Design

## Overview

The Filesystem DataSource provides server-side filesystem access implementing the Legion DataSource interface. It enables synchronous file and directory operations including reading, writing, querying metadata, searching contents, and watching for changes.

## Core Architecture

### DataSource Interface Implementation

The `FileSystemDataSource` class implements the standard DataSource interface with filesystem-specific operations:

```javascript
class FileSystemDataSource {
  // Core DataSource methods
  query(querySpec) { /* synchronous filesystem queries */ }
  subscribe(querySpec, callback) { /* file/directory watching */ }
  getSchema() { /* filesystem schema definition */ }
  update(updateSpec) { /* file/directory modifications */ }
  validate(data) { /* validate file operations */ }
}
```

### Query Specification

The filesystem query system supports comprehensive querying of both metadata and content:

```javascript
{
  type: 'file' | 'directory' | 'any',
  path: '/path/to/resource',
  operation: 'metadata' | 'content' | 'list' | 'search' | 'exists',
  
  // For metadata queries
  metadata: ['size', 'mtime', 'ctime', 'atime', 'mode', 'uid', 'gid', 'type'],
  
  // For content queries  
  encoding: 'utf8' | 'base64' | 'buffer',
  range: { start: 0, end: 1000 },  // For partial reads
  
  // For search queries
  pattern: 'glob' | 'regex',
  value: '*.js' | '/test.*\.js$/i',
  recursive: true,
  depth: 3,
  
  // For list queries
  filter: {
    type: 'file' | 'directory',
    size: { gt: 1000, lt: 10000 },
    mtime: { after: Date, before: Date },
    name: 'pattern'
  },
  sort: 'name' | 'size' | 'mtime',
  order: 'asc' | 'desc',
  limit: 100,
  offset: 0
}
```

### Handle Integration

The filesystem DataSource works with two specialized Handle types:

#### ServerFileHandle

Extends the base Handle class for file operations:

```javascript
class ServerFileHandle extends Handle {
  constructor(dataSource, path) {
    super(dataSource);
    this.path = path;
  }
  
  // Get file metadata
  value() {
    return this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'metadata'
    });
  }
  
  // Read file content
  content(encoding = 'utf8') {
    return this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'content',
      encoding
    });
  }
  
  // Read partial content
  range(start, end, encoding = 'utf8') {
    return this.dataSource.query({
      type: 'file',
      path: this.path,
      operation: 'content',
      encoding,
      range: { start, end }
    });
  }
  
  // Write content
  write(content, encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'write',
      content,
      encoding
    });
  }
  
  // Append content
  append(content, encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'append',
      content,
      encoding
    });
  }
  
  // Delete file
  delete() {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'delete'
    });
  }
  
  // Copy file
  copyTo(destinationPath) {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'copy',
      destination: destinationPath
    });
  }
  
  // Move/rename file
  moveTo(destinationPath) {
    return this.dataSource.update({
      type: 'file',
      path: this.path,
      operation: 'move',
      destination: destinationPath
    });
  }
  
  // Watch for changes
  watch(callback) {
    return this.dataSource.subscribe({
      type: 'file',
      path: this.path,
      events: ['change', 'delete', 'rename']
    }, callback);
  }
}
```

#### ServerDirectoryHandle

Extends the base Handle class for directory operations:

```javascript
class ServerDirectoryHandle extends Handle {
  constructor(dataSource, path) {
    super(dataSource);
    this.path = path;
  }
  
  // Get directory metadata
  value() {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'metadata'
    });
  }
  
  // List directory contents
  list(options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'list',
      ...options
    });
  }
  
  // Search directory recursively
  search(pattern, options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'search',
      pattern: options.regex ? 'regex' : 'glob',
      value: pattern,
      recursive: options.recursive !== false,
      depth: options.depth,
      filter: options.filter
    });
  }
  
  // Get file handle
  file(filename) {
    const filePath = path.join(this.path, filename);
    return new ServerFileHandle(this.dataSource, filePath);
  }
  
  // Get subdirectory handle
  directory(dirname) {
    const dirPath = path.join(this.path, dirname);
    return new ServerDirectoryHandle(this.dataSource, dirPath);
  }
  
  // Create subdirectory
  createDirectory(dirname) {
    return this.dataSource.update({
      type: 'directory',
      path: path.join(this.path, dirname),
      operation: 'create'
    });
  }
  
  // Create file
  createFile(filename, content = '', encoding = 'utf8') {
    return this.dataSource.update({
      type: 'file',
      path: path.join(this.path, filename),
      operation: 'create',
      content,
      encoding
    });
  }
  
  // Delete directory (recursive optional)
  delete(recursive = false) {
    return this.dataSource.update({
      type: 'directory',
      path: this.path,
      operation: 'delete',
      recursive
    });
  }
  
  // Watch directory for changes
  watch(callback, options = {}) {
    return this.dataSource.subscribe({
      type: 'directory',
      path: this.path,
      recursive: options.recursive,
      events: ['add', 'delete', 'change', 'rename']
    }, callback);
  }
  
  // Find files by content
  findByContent(searchString, options = {}) {
    return this.dataSource.query({
      type: 'directory',
      path: this.path,
      operation: 'search',
      contentSearch: {
        text: searchString,
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        regex: options.regex,
        filePattern: options.filePattern || '*'
      },
      recursive: options.recursive !== false
    });
  }
}
```

## Core Operations

### Metadata Queries

Retrieve comprehensive file/directory information:

```javascript
const metadata = dataSource.query({
  type: 'file',
  path: '/path/to/file.txt',
  operation: 'metadata',
  metadata: ['size', 'mtime', 'ctime', 'mode', 'type']
});

// Returns:
{
  path: '/path/to/file.txt',
  name: 'file.txt',
  size: 1024,
  mtime: Date,
  ctime: Date,
  mode: 0o644,
  type: 'file',
  isDirectory: false,
  isFile: true,
  isSymbolicLink: false
}
```

### Content Operations

Read and manipulate file contents:

```javascript
// Read entire file
const content = dataSource.query({
  type: 'file',
  path: '/path/to/file.txt',
  operation: 'content',
  encoding: 'utf8'
});

// Read partial content (for large files)
const chunk = dataSource.query({
  type: 'file',
  path: '/path/to/large.log',
  operation: 'content',
  range: { start: 0, end: 1000 },
  encoding: 'utf8'
});

// Read as buffer
const buffer = dataSource.query({
  type: 'file',
  path: '/path/to/image.png',
  operation: 'content',
  encoding: 'buffer'
});
```

### Directory Listing

List and filter directory contents:

```javascript
const files = dataSource.query({
  type: 'directory',
  path: '/path/to/dir',
  operation: 'list',
  filter: {
    type: 'file',
    size: { gt: 1000 },
    name: '*.js'
  },
  sort: 'mtime',
  order: 'desc',
  limit: 20
});

// Returns array of:
[{
  name: 'file.js',
  path: '/path/to/dir/file.js',
  type: 'file',
  size: 2048,
  mtime: Date
}]
```

### Content Search

Search for files by content:

```javascript
const results = dataSource.query({
  type: 'directory',
  path: '/project',
  operation: 'search',
  contentSearch: {
    text: 'TODO',
    caseSensitive: false,
    filePattern: '*.js'
  },
  recursive: true
});

// Returns:
[{
  file: '/project/src/index.js',
  line: 42,
  column: 5,
  match: '// TODO: implement this feature',
  context: {
    before: ['line 40', 'line 41'],
    after: ['line 43', 'line 44']
  }
}]
```

### Pattern Matching

Find files by name patterns:

```javascript
// Glob pattern
const jsFiles = dataSource.query({
  type: 'directory',
  path: '/project',
  operation: 'search',
  pattern: 'glob',
  value: '**/*.js',
  recursive: true
});

// Regex pattern
const testFiles = dataSource.query({
  type: 'directory',
  path: '/project',
  operation: 'search',
  pattern: 'regex',
  value: '.*\\.test\\.js$',
  recursive: true
});
```

### Write Operations

Modify filesystem through update specifications:

```javascript
// Create file
dataSource.update({
  type: 'file',
  path: '/path/to/new.txt',
  operation: 'create',
  content: 'Hello World',
  encoding: 'utf8'
});

// Update file
dataSource.update({
  type: 'file',
  path: '/path/to/existing.txt',
  operation: 'write',
  content: 'Updated content',
  encoding: 'utf8'
});

// Append to file
dataSource.update({
  type: 'file',
  path: '/path/to/log.txt',
  operation: 'append',
  content: 'New log entry\n',
  encoding: 'utf8'
});

// Create directory
dataSource.update({
  type: 'directory',
  path: '/path/to/newdir',
  operation: 'create',
  recursive: true  // Create parent directories if needed
});

// Delete (file or directory)
dataSource.update({
  type: 'directory',
  path: '/path/to/remove',
  operation: 'delete',
  recursive: true  // For directories with contents
});
```

### File Watching

Subscribe to filesystem changes:

```javascript
// Watch single file
const subscription = dataSource.subscribe({
  type: 'file',
  path: '/path/to/config.json',
  events: ['change', 'delete']
}, (event) => {
  console.log('File changed:', event);
  // { type: 'change', path: '/path/to/config.json', stats: {...} }
});

// Watch directory recursively
const dirWatch = dataSource.subscribe({
  type: 'directory',
  path: '/project/src',
  recursive: true,
  events: ['add', 'delete', 'change'],
  filter: { name: '*.js' }
}, (event) => {
  console.log('Directory change:', event);
  // { type: 'add', path: '/project/src/new.js', stats: {...} }
});

// Unsubscribe
subscription.unsubscribe();
```

## Usage Examples

### Basic File Operations

```javascript
import { FileSystemDataSource } from '@legion/filesystem-datasource';
import { ServerFileHandle, ServerDirectoryHandle } from '@legion/filesystem-datasource/handles';

// Create data source
const fsDataSource = new FileSystemDataSource({
  rootPath: '/home/user/project',
  permissions: 'rw'  // read-write access
});

// Create handles
const projectDir = new ServerDirectoryHandle(fsDataSource, '/');
const srcDir = projectDir.directory('src');
const configFile = projectDir.file('config.json');

// Read config
const config = JSON.parse(configFile.content());

// Update config
config.version = '2.0.0';
configFile.write(JSON.stringify(config, null, 2));

// List source files
const sourceFiles = srcDir.search('*.js', { recursive: true });
console.log(`Found ${sourceFiles.length} JavaScript files`);

// Watch for changes
const watcher = srcDir.watch((event) => {
  console.log(`File ${event.type}: ${event.path}`);
}, { recursive: true });
```

### Content Analysis

```javascript
// Search for TODOs in codebase
const todos = srcDir.findByContent('TODO', {
  filePattern: '*.{js,ts}',
  recursive: true
});

todos.forEach(result => {
  console.log(`${result.file}:${result.line} - ${result.match}`);
});

// Find large files
const largeFiles = projectDir.list({
  filter: {
    type: 'file',
    size: { gt: 1024 * 1024 }  // > 1MB
  },
  recursive: true,
  sort: 'size',
  order: 'desc'
});

console.log('Large files:', largeFiles.map(f => `${f.name} (${f.size} bytes)`));
```

### Batch Operations

```javascript
// Copy directory structure
function copyDirectory(sourceHandle, destPath) {
  const destHandle = new ServerDirectoryHandle(
    sourceHandle.dataSource, 
    destPath
  );
  
  // Create destination
  sourceHandle.dataSource.update({
    type: 'directory',
    path: destPath,
    operation: 'create'
  });
  
  // List all contents
  const contents = sourceHandle.list({ recursive: true });
  
  // Copy each item
  contents.forEach(item => {
    const relativePath = path.relative(sourceHandle.path, item.path);
    const destItemPath = path.join(destPath, relativePath);
    
    if (item.type === 'directory') {
      sourceHandle.dataSource.update({
        type: 'directory',
        path: destItemPath,
        operation: 'create'
      });
    } else {
      sourceHandle.dataSource.update({
        type: 'file',
        path: item.path,
        operation: 'copy',
        destination: destItemPath
      });
    }
  });
}
```

### Stream Processing

```javascript
// Process large file in chunks
function processLargeFile(fileHandle, chunkSize = 1024 * 1024) {
  const stats = fileHandle.value();
  const totalSize = stats.size;
  let offset = 0;
  
  while (offset < totalSize) {
    const chunk = fileHandle.range(offset, offset + chunkSize);
    processChunk(chunk);
    offset += chunkSize;
  }
}

// Line-by-line processing
function* readLines(fileHandle) {
  const content = fileHandle.content();
  const lines = content.split('\n');
  for (const line of lines) {
    yield line;
  }
}

// Process CSV file
const csvFile = new ServerFileHandle(fsDataSource, '/data/records.csv');
for (const line of readLines(csvFile)) {
  const fields = line.split(',');
  processRecord(fields);
}
```

## Schema Definition

The filesystem DataSource provides schema information for validation and introspection:

```javascript
const schema = fsDataSource.getSchema();

// Returns:
{
  type: 'filesystem',
  operations: {
    query: {
      metadata: ['size', 'mtime', 'ctime', 'atime', 'mode', 'uid', 'gid'],
      content: ['utf8', 'base64', 'buffer'],
      search: ['glob', 'regex', 'content'],
      list: true
    },
    update: {
      create: ['file', 'directory'],
      write: ['file'],
      append: ['file'],
      delete: ['file', 'directory'],
      copy: ['file', 'directory'],
      move: ['file', 'directory']
    },
    subscribe: {
      events: ['change', 'add', 'delete', 'rename'],
      recursive: true
    }
  },
  limits: {
    maxFileSize: 2147483648,  // 2GB
    maxPathLength: 4096,
    maxDirectoryDepth: 32
  }
}
```

## Error Handling

All operations include comprehensive error handling:

```javascript
try {
  const file = new ServerFileHandle(fsDataSource, '/nonexistent.txt');
  const content = file.content();
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('File not found');
  } else if (error.code === 'EACCES') {
    console.log('Permission denied');
  } else {
    console.log('Filesystem error:', error.message);
  }
}
```

## Synchronous Design

All operations are synchronous following the DataSource pattern:

```javascript
// All operations return immediately - no async/await
const files = directory.list();
const content = file.content();
const metadata = file.value();

// Subscriptions are synchronous setup with async callbacks
const subscription = file.watch((event) => {
  // Callback is invoked asynchronously when changes occur
  console.log('File changed');
});
// But subscription setup returns immediately
```

This design eliminates race conditions and simplifies state management while maintaining high performance through efficient caching and batching strategies.