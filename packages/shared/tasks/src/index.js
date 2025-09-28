/**
 * @legion/tasks - Pure JavaScript Task Execution Framework
 * 
 * This package provides the core task execution framework without any external dependencies.
 * It can run in any JavaScript environment (browser, Node.js, etc.).
 * 
 * Core Features:
 * - TaskStrategy: Base prototype containing all task functionality
 * - EnhancedTaskStrategy: Extended prototype with common patterns
 * - createTask: Factory function for creating tasks with strategy prototypes
 * - Task: Legacy class (kept for backward compatibility)
 * - TaskManager: Manages task hierarchy and execution flow
 * - ArtifactRegistry: Manages artifacts with proper structure
 * - ExecutionContext: Dependency injection container for task-specific services
 * - Context Handle System: Handle/proxy pattern for context management
 * 
 * All functionality is implemented in pure JavaScript with no external dependencies.
 */

// Core framework - prototypal system
export { default as TaskStrategy } from './core/TaskStrategy.js';
export { default as EnhancedTaskStrategy } from './core/EnhancedTaskStrategy.js';
export { createTask, default as createTaskFactory } from './core/createTask.js';

// Legacy Task class (kept for backward compatibility)
export { default as Task } from './core/Task.js';

// Supporting classes
export { default as TaskManager } from './core/TaskManager.js';
export { default as ArtifactRegistry } from './core/ArtifactRegistry.js';
export { default as ExecutionContext } from './core/ExecutionContext.js';

// Context Handle/DataSource infrastructure
export { ContextHandle } from './core/ContextHandle.js';
export { ContextResourceManager } from './core/ContextResourceManager.js';
export { ContextDataSource } from './core/ContextDataSource.js';

// Utility functions
export { generateId, generateShortId, generatePrefixedId } from './utils/id.js';
export { joinPath, dirname, basename, extname, isAbsolute, resolve } from './utils/path.js';
export { defer, delay, createDeferred, withTimeout, retry } from './utils/async.js';

// Version and metadata
export const version = '1.0.0';
export const name = '@legion/tasks';