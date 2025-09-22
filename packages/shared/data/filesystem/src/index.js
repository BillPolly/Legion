/**
 * @legion/filesystem - Filesystem Handle abstractions with pluggable ResourceManagers
 * 
 * This package provides a unified filesystem API that works across different environments:
 * 
 * Key Concepts:
 * - DirectoryHandle & FileHandle: Universal filesystem abstractions extending @legion/handle
 * - ResourceManager implementations: Pluggable backends (Local, Remote, Indexed)
 * - Same API regardless of environment: Node.js, Browser, or specialized storage
 * 
 * Example usage:
 * 
 * ```javascript
 * import { DirectoryHandle, LocalFileSystemResourceManager } from '@legion/filesystem';
 * 
 * // Create a ResourceManager for your environment
 * const resourceManager = new LocalFileSystemResourceManager({ 
 *   rootPath: '/home/user/project' 
 * });
 * 
 * // Create a DirectoryHandle for the root
 * const rootDir = new DirectoryHandle(resourceManager, '/');
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
 * The same Handle abstractions work with different ResourceManager implementations:
 * - LocalFileSystemResourceManager: Direct Node.js filesystem access
 * - RemoteFileSystemResourceManager: Browser File API or HTTP-based filesystem
 * - IndexedFileSystemResourceManager: Search-enabled filesystem with full-text indexing
 */

// Handle abstractions - universal filesystem API
export { DirectoryHandle, FileHandle } from './handles/index.js';

// ResourceManager implementations - pluggable backends
export { 
  LocalFileSystemResourceManager,
  RemoteFileSystemResourceManager,
  ActorRemoteFileSystemResourceManager 
} from './resourcemanagers/index.js';

// Server components for Actor-based filesystem
export { FileSystemActor } from './server/FileSystemActor.js';
export { FileSystemProtocol } from './protocol/FileSystemProtocol.js';

// Convenience factory functions
export function createLocalFileSystem(options = {}) {
  const resourceManager = new LocalFileSystemResourceManager(options);
  const rootPath = options.startPath || '/';
  return new DirectoryHandle(resourceManager, rootPath);
}

// Future convenience factories:
// export function createRemoteFileSystem(apiUrl, options = {}) { ... }
// export function createIndexedFileSystem(indexUrl, options = {}) { ... }