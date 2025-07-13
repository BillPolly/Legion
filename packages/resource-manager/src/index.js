/**
 * @jsenvoy/resource-manager - Process lifecycle and agent orchestration for jsEnvoy
 * 
 * This package provides resource management capabilities for jsEnvoy applications,
 * including process lifecycle management, agent orchestration, and dependency management.
 */

// Export base resource classes
export { default as Resource } from './base/Resource.js';
export { default as ResourceStatus } from './base/ResourceStatus.js';
export { default as DependencyGraph } from './base/DependencyGraph.js';

// Export process management
export { default as ProcessResource } from './process/ProcessResource.js';
export { default as ProcessOrchestrator } from './process/ProcessOrchestrator.js';
export { default as HealthChecker } from './process/HealthChecker.js';

// Export agent management  
export { default as AgentResource } from './agent/AgentResource.js';
export { default as SessionManager } from './agent/SessionManager.js';

// Export integration layer
export { default as ResourceTool } from './integration/ResourceTool.js';
export { default as ResourceModuleFactory } from './integration/ResourceModuleFactory.js';

// Export utilities
export { default as PromptTemplate } from './utils/PromptTemplate.js';