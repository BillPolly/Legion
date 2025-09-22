/**
 * Filesystem ResourceManager implementations
 * 
 * Export different ResourceManager implementations for various environments:
 * - LocalFileSystemResourceManager: Node.js filesystem access
 * - RemoteFileSystemResourceManager: Browser/API-based filesystem access (future)
 * - IndexedFileSystemResourceManager: Search-enabled filesystem access (future)
 */

export { LocalFileSystemResourceManager } from './LocalFileSystemResourceManager.js';
export { RemoteFileSystemResourceManager } from './RemoteFileSystemResourceManager.js';
export { ActorRemoteFileSystemResourceManager } from './ActorRemoteFileSystemResourceManager.js';

// Future implementations:
// export { IndexedFileSystemResourceManager } from './IndexedFileSystemResourceManager.js';