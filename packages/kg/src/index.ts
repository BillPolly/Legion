/**
 * Unified Capability Ontology - Main Export
 * 
 * This package implements the unified capability ontology that consolidates
 * all functional units (tasks, skills, tools, packages, etc.) into a single
 * flexible data model using hierarchical kind paths.
 */

// Core types
export * from './types';

// Utilities
export { KindUtils, type KindInfo } from './utils/KindUtils';
export { AttributeValidator, type AttributeDefinition as LegacyAttributeDefinition } from './utils/AttributeValidator';

// Storage
export { 
  type ICapabilityStorage, 
  type SearchCriteria, 
  type StorageStats, 
  type StorageConfig 
} from './storage/ICapabilityStorage';
export { MongoConnection, createDefaultConfig } from './storage/MongoConnection';
export { IndexManager, setupIndexes } from './storage/IndexManager';
export { MongoCapabilityStorage } from './storage/MongoCapabilityStorage';

// Services
export { CapabilityService } from './services/CapabilityService';
export { RelationshipService } from './services/RelationshipService';

// Metamodel
export { MetamodelLoader, type MetamodelEntity, type MetamodelLoadResult } from './metamodel/MetamodelLoader';
export { MetamodelReader, type MetamodelCache, type AttributeDefinition, type ValidationContext } from './metamodel/MetamodelReader';
