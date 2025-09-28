// Import and initialize object extensions (must be first)
import './serialization/ObjectExtensions.js';

// Core exports
export { KGEngine } from './core/KGEngine.js';
export { IDManager, idManager } from './core/IDManager.js';
export { QueryBuilder } from './core/QueryBuilder.js';

// Relationship exports
export { Relationship } from './relationships/Relationship.js';
export { KnowsRelationship } from './relationships/KnowsRelationship.js';
export { WorksWithRelationship } from './relationships/WorksWithRelationship.js';

// Belief system exports
export { Belief } from './beliefs/Belief.js';
export { MethodExecution } from './beliefs/MethodExecution.js';

// Serialization exports
export { ClassSerializer } from './serialization/ClassSerializer.js';

// Tool system exports (KG-specific, not duplicating @legion/tools-registry)
export { KGToolRegistry } from './tools/KGToolRegistry.js';
export { ToolDependencyManager } from './tools/ToolDependencyManager.js';
export { KGSchemaGenerator } from './tools/KGSchemaGenerator.js';

// RDF exports - now from extracted package
export { NamespaceManager, RDFSerializer, RDFParser } from '@legion/kg-rdf';

// Reconstruction exports
export { ObjectReconstructor } from './reconstruction/ObjectReconstructor.js';

// Export utilities
export { JSONSchemaGenerator } from './export/JSONSchemaGenerator.js';
export { PropertyGraphExporter } from './export/PropertyGraphExporter.js';

// Storage exports
export * from './storage/index.js';

// Query exports
export * from './query/index.js';

// Gellish CNL exports - now from extracted package (optional dependency)
// export * from '@legion/kg-gellish';

// Main system export
export { KnowledgeGraphSystem } from './system/KnowledgeGraphSystem.js';

// Example code has been removed - tests now use inline mocks as needed

// Import for default export
import { KnowledgeGraphSystem } from './system/KnowledgeGraphSystem.js';

// Default export for convenience
export default KnowledgeGraphSystem;
