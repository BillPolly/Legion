/**
 * @legion/filesystem-datasource - Filesystem DataSource implementation
 * 
 * Provides server-side filesystem access through the DataSource interface
 */

export { FileSystemDataSource } from './FileSystemDataSource.js';

// Handle classes for object-oriented file and directory operations
export { ServerFileHandle } from './handles/ServerFileHandle.js';
export { ServerDirectoryHandle } from './handles/ServerDirectoryHandle.js';