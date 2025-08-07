/**
 * Storage interface for the Minimal 2-Field Capability Model
 * Optimized for 2-field structure: _id, subtypeOf, attributes
 */

import { Capability, ICapability } from '../types/Capability';

export interface ICapabilityStorage {
  /**
   * Connect to the storage backend
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the storage backend
   */
  disconnect(): Promise<void>;

  /**
   * Create a new capability in storage
   */
  create(capability: Capability): Promise<Capability>;

  /**
   * Get a capability by ID
   */
  get(id: string): Promise<Capability | null>;

  /**
   * Update a capability (partial updates supported)
   */
  update(id: string, updates: Partial<ICapability>): Promise<Capability | null>;

  /**
   * Delete a capability by ID
   */
  delete(id: string): Promise<boolean>;


  /**
   * Find capabilities by attribute key-value pair
   * Optimized for the attribute-based minimal model
   */
  findByAttribute(attributeKey: string, value: any): Promise<Capability[]>;

  /**
   * Find capabilities by multiple attribute criteria
   */
  findByAttributes(criteria: Record<string, any>): Promise<Capability[]>;

  /**
   * Find capabilities with complex query criteria
   */
  findCapabilities(criteria: SearchCriteria): Promise<Capability[]>;

  /**
   * Get all capabilities (use with caution)
   */
  findAll(): Promise<Capability[]>;

  /**
   * Clear all capabilities (for testing only)
   */
  clear(): Promise<void>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<StorageStats>;
}

export interface SearchCriteria {
  // Attribute-based filtering (optimized for minimal model)
  attributes?: Record<string, any>;
  
  // Relationship filtering (now attribute-based)
  subtypeOf?: string;
  partOf?: string;
  uses?: string;
  hasParts?: boolean; // Has any parts
  
  // Value-based filtering
  minCost?: number;
  maxCost?: number;
  
  // Date filtering (now in attributes)
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  
  // Text search
  nameContains?: string;
  descriptionContains?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: string; // attribute key to sort by
  sortOrder?: 'asc' | 'desc';
}

export interface StorageStats {
  totalCapabilities: number;
  capabilitiesBySubtype: Record<string, number>;
  averageAttributeCount: number;
  totalAttributes: number;
  indexStats?: any;
}

export interface StorageConfig {
  connectionString: string;
  database: string;
  collection: string;
  options?: {
    maxPoolSize?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
  };
}
