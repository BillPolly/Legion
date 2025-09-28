/**
 * @legion/filesystem - Filesystem Handle abstractions with pluggable DataSources
 * 
 * This package provides a unified filesystem API that works across different environments:
 * 
 * Key Concepts:
 * - DirectoryHandle & FileHandle: Universal filesystem abstractions extending @legion/handle
 * - DataSource implementations: Pluggable backends (Local, Remote, Indexed)
 * - Same API regardless of environment: Node.js, Browser, or specialized storage
 * 
 * Example usage:
 * 
 * ```javascript
 * import { DirectoryHandle, LocalFileSystemDataSource } from '@legion/filesystem';
 * 
 * // Create a DataSource for your environment
 * const dataSource = new LocalFileSystemDataSource({ 
 *   rootPath: '/home/user/project' 
 * });
 * 
 * // Create a DirectoryHandle for the root
 * const rootDir = new DirectoryHandle(dataSource, '/');
 * 
 * // Navigate and manipulate files using the same API
 * const srcDir = rootDir.directory('src');
 * const indexFile = srcDir.file('index.js');
 * 
 * // Read file content
 * const content = indexFile.text();
 * 
 * // Write file content  
 * indexFile.write('console.log("Hello World");');
 * 
 * // List directory contents
 * const files = srcDir.list();
 * 
 * // Search for files
 * const jsFiles = srcDir.search('*.js', { recursive: true });
 * 
 * // Watch for changes
 * const watcher = indexFile.watch((changes) => {
 *   console.log('File changed:', changes);
 * });
 * ```
 * 
 * The same Handle abstractions work with different DataSource implementations:
 * - LocalFileSystemDataSource: Direct Node.js filesystem access
 * - RemoteFileSystemDataSource: Browser File API or HTTP-based filesystem
 * - IndexedFileSystemDataSource: Search-enabled filesystem with full-text indexing
 */

// Handle abstractions - universal filesystem API
export { DirectoryHandle, FileHandle } from './handles/index.js';

// DataSource implementations - pluggable backends
export { 
  LocalFileSystemDataSource,
  RemoteFileSystemDataSource,
  ActorRemoteFileSystemDataSource 
} from './datasources/index.js';

// Server components for Actor-based filesystem
export { FileSystemActor } from './server/FileSystemActor.js';
export { FileSystemProtocol } from './protocol/FileSystemProtocol.js';

// Convenience factory functions
export function createLocalFileSystem(options = {}) {
  const dataSource = new LocalFileSystemDataSource(options);
  const rootPath = options.startPath || '/';
  return new DirectoryHandle(dataSource, rootPath);
}

// Future convenience factories:
// export function createRemoteFileSystem(apiUrl, options = {}) { ... }
// export function createIndexedFileSystem(indexUrl, options = {}) { ... }