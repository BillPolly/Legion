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

// Tool system exports
export { ToolRegistry } from './tools/ToolRegistry.js';
export { ToolDependencyManager } from './tools/ToolDependencyManager.js';
export { SchemaGenerator } from './tools/SchemaGenerator.js';

// RDF exports
export { NamespaceManager } from './rdf/NamespaceManager.js';
export { RDFSerializer } from './rdf/RDFSerializer.js';
export { RDFParser } from './rdf/RDFParser.js';

// Reconstruction exports
export { ObjectReconstructor } from './reconstruction/ObjectReconstructor.js';

// Export utilities
export { JSONSchemaGenerator } from './export/JSONSchemaGenerator.js';
export { PropertyGraphExporter } from './export/PropertyGraphExporter.js';

// Storage exports
export * from './storage/index.js';

// Gellish CNL exports
export * from './gellish/index.js';

// Main system export
export { KnowledgeGraphSystem } from './system/KnowledgeGraphSystem.js';

// Example exports
export { WeatherTool } from './examples/WeatherTool.js';
export {
  fullRoundTripExample,
  testRDFParsing,
  comprehensiveExample,
  relationshipReificationExample,
  beliefSystemExample
} from './examples/usage-examples.js';

// Import for default export
import { KnowledgeGraphSystem } from './system/KnowledgeGraphSystem.js';

// Default export for convenience
export default KnowledgeGraphSystem;
