/**
 * @legion/tasks - Task execution framework for Legion agents
 * 
 * This package provides the core task execution framework that can be used
 * by any Legion agent implementation. It includes:
 * 
 * - Task: Framework-agnostic task representation with conversation history and artifacts
 * - TaskStrategy: Minimal base class for pluggable execution strategies
 * - TaskManager: Manages task hierarchy and execution flow
 * - ArtifactRegistry: Manages artifacts with proper structure and formatting
 * - ExecutionContext: Dependency injection container for agent services
 */

// Core framework classes
export { default as Task } from './core/Task.js';
export { default as TaskStrategy } from './core/TaskStrategy.js';
export { default as TaskManager } from './core/TaskManager.js';
export { default as ArtifactRegistry } from './core/ArtifactRegistry.js';
export { default as ExecutionContext } from './core/ExecutionContext.js';

// Version and metadata
export const version = '1.0.0';
export const name = '@legion/tasks';