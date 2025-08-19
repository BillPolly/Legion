/**
 * Claude Tools Package - Main Export
 * Provides all Claude Code tools as Legion framework modules
 */

// Main combined module
export { ClaudeToolsModule } from './ClaudeToolsModule.js';

// Module exports
export { FileOperationsModule } from './file-operations/FileOperationsModule.js';
export { SearchNavigationModule } from './search-navigation/SearchNavigationModule.js';
export { TaskManagementModule } from './task-management/TaskManagementModule.js';
export { SystemOperationsModule } from './system-operations/SystemOperationsModule.js';
export { WebToolsModule } from './web-tools/WebToolsModule.js';

// Individual tool exports for convenience
export * from './file-operations/index.js';
export * from './search-navigation/index.js';
export * from './task-management/index.js';
export * from './system-operations/index.js';
export * from './web-tools/index.js';

// Default export - the main ClaudeToolsModule
export { ClaudeToolsModule as default } from './ClaudeToolsModule.js';