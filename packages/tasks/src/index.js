/**
 * @legion/tasks - Task execution framework for Legion agents
 * 
 * This package provides the core task execution framework that can be used
 * by any Legion agent implementation. It now uses pure prototypal inheritance:
 * 
 * - TaskStrategy: Base prototype containing all task functionality
 * - createTask: Factory function for creating tasks with strategy prototypes
 * - Task: DEPRECATED - Kept temporarily for backward compatibility
 * - TaskManager: Manages task hierarchy and execution flow
 * - ArtifactRegistry: Manages artifacts with proper structure and formatting
 * - ExecutionContext: Dependency injection container for task-specific services
 * - GlobalContext: Root context containing global resources (ResourceManager, ToolRegistry, etc.)
 */

// Core framework - new prototypal system
export { default as TaskStrategy } from './core/TaskStrategy.js';
export { createTask } from './core/createTask.js';

// DEPRECATED - Task class kept temporarily for compatibility
export { default as Task } from './core/Task.js';

// Supporting classes
export { default as TaskManager } from './core/TaskManager.js';
export { default as ArtifactRegistry } from './core/ArtifactRegistry.js';
export { default as ExecutionContext } from './core/ExecutionContext.js';
export { default as GlobalContext } from './core/GlobalContext.js';

// Version and metadata
export const version = '1.0.0';
export const name = '@legion/tasks';