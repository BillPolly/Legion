/**
 * @module @legion/km-entity-store
 * MongoDB-backed storage for knowledge graph entity and relationship instances
 */

export { KnowledgeGraphStore } from './KnowledgeGraphStore.js';
export { EntityDeduplicator } from './EntityDeduplicator.js';
export { ProvenanceTracker } from './ProvenanceTracker.js';
export { OntologyInstanceExtractor } from './OntologyInstanceExtractor.js';
export { knowledgeGraphSchema, validateEntity, validateRelationship } from './schemas/knowledge-graph.schema.js';
