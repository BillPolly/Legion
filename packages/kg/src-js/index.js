/**
 * Unified Capability Ontology - Main Export
 * ES6 JavaScript version
 * 
 * This package implements the unified capability ontology that consolidates
 * all functional units (tasks, skills, tools, packages, etc.) into a single
 * flexible data model using hierarchical kind paths.
 */

// Core types
export * from './types/index.js';

// Utilities
export { KindUtils } from './utils/KindUtils.js';

// Storage (to be converted)
// export { MongoConnection } from './storage/MongoConnection.js';
// export { MongoCapabilityStorage } from './storage/MongoCapabilityStorage.js';

// Services (to be converted)
// export { CapabilityService } from './services/CapabilityService.js';
// export { RelationshipService } from './services/RelationshipService.js';