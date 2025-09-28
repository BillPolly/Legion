/**
 * Filesystem Handle abstractions
 * 
 * Export both DirectoryHandle and FileHandle classes.
 * These provide the universal filesystem API that works with any DataSource implementation.
 */

import { HandleFactory } from './HandleFactory.js';
import { DirectoryHandle } from './DirectoryHandle.js';
import { FileHandle } from './FileHandle.js';

// Register classes with factory to resolve circular dependencies
HandleFactory.setDirectoryHandleClass(DirectoryHandle);
HandleFactory.setFileHandleClass(FileHandle);

export { DirectoryHandle, FileHandle };