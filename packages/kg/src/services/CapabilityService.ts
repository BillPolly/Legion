/**
 * Capability Service for the Minimal 2-Field Model
 * Handles business logic for 2-field structure: _id, subtypeOf, attributes
 */

import { Capability, CreateCapabilityRequest, UpdateCapabilityRequest } from '../types/Capability';
import { ValidationResult, ValidationResultBuilder } from '../types/ValidationResult';
import { ICapabilityStorage, SearchCriteria } from '../storage/ICapabilityStorage';

export class CapabilityService {
  constructor(private storage: ICapabilityStorage) {}

  /**
   * Create a new capability with validation
   */
  async createCapability(data: CreateCapabilityRequest): Promise<Capability> {
    // Validate the request
    const validation = this.validateCreateRequest(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create the capability (timestamps automatically added to attributes)
    const capability = new Capability(data);

    // Validate the created capability
    const capabilityValidation = await this.validateCapability(capability);
    if (!capabilityValidation.isValid) {
      throw new Error(`Capability validation failed: ${capabilityValidation.errors.map(e => e.message).join(', ')}`);
    }

    // Store in database
    return await this.storage.create(capability);
  }

  /**
   * Get a capability by ID
   */
  async getCapability(id: string): Promise<Capability | null> {
    if (!id || id.trim() === '') {
      throw new Error('Capability ID is required');
    }

    return await this.storage.get(id);
  }

  /**
   * Update a capability
   */
  async updateCapability(id: string, updates: UpdateCapabilityRequest): Promise<Capability | null> {
    if (!id || id.trim() === '') {
      throw new Error('Capability ID is required');
    }

    // Get existing capability
    const existing = await this.storage.get(id);
    if (!existing) {
      return null;
    }

    // Validate updates
    if (updates.attributes) {
      const validation = this.validateAttributeUpdates(existing, updates.attributes);
      if (!validation.isValid) {
        throw new Error(`Update validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Perform update (updatedAt timestamp automatically updated)
    return await this.storage.update(id, updates);
  }

  /**
   * Delete a capability
   */
  async deleteCapability(id: string): Promise<boolean> {
    if (!id || id.trim() === '') {
      throw new Error('Capability ID is required');
    }

    return await this.storage.delete(id);
  }

  /**
   * Find capabilities with search criteria
   */
  async findCapabilities(criteria: SearchCriteria): Promise<Capability[]> {
    return await this.storage.findCapabilities(criteria);
  }


  /**
   * Find capabilities by attribute (optimized for minimal model)
   */
  async findByAttribute(attributeKey: string, value: any): Promise<Capability[]> {
    if (!attributeKey || attributeKey.trim() === '') {
      throw new Error('Attribute key is required');
    }

    return await this.storage.findByAttribute(attributeKey, value);
  }

  /**
   * Find capabilities by multiple attributes
   */
  async findByAttributes(criteria: Record<string, any>): Promise<Capability[]> {
    if (!criteria || Object.keys(criteria).length === 0) {
      throw new Error('At least one attribute criteria is required');
    }

    return await this.storage.findByAttributes(criteria);
  }


  /**
   * Find capabilities by cost range
   */
  async findByCostRange(minCost?: number, maxCost?: number): Promise<Capability[]> {
    return await this.findCapabilities({ minCost, maxCost });
  }

  /**
   * Find capabilities created after a date (now in attributes)
   */
  async findCreatedAfter(date: Date): Promise<Capability[]> {
    return await this.findCapabilities({ createdAfter: date });
  }

  /**
   * Find capabilities updated after a date (now in attributes)
   */
  async findUpdatedAfter(date: Date): Promise<Capability[]> {
    return await this.findCapabilities({ updatedAfter: date });
  }

  /**
   * Search capabilities by name or description
   */
  async searchByText(searchTerm: string): Promise<Capability[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      throw new Error('Search term is required');
    }

    // Use MongoDB text search for better performance
    return await this.findCapabilities({
      nameContains: searchTerm,
      descriptionContains: searchTerm
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    return await this.storage.getStats();
  }

  /**
   * Validate a capability
   */
  async validateCapability(capability: Capability): Promise<ValidationResult> {
    const builder = new ValidationResultBuilder();

    // Validate core fields
    if (!capability.id || capability.id.trim() === '') {
      builder.addFieldRequired('id');
    }

    if (!capability.subtypeOf || capability.subtypeOf.trim() === '') {
      builder.addFieldRequired('subtypeOf');
    }

    // Validate required attributes for minimal model
    if (!capability.attributes.createdAt) {
      builder.addFieldRequired('attributes.createdAt');
    }

    if (!capability.attributes.updatedAt) {
      builder.addFieldRequired('attributes.updatedAt');
    }

    return builder.build();
  }

  /**
   * Validate create request
   */
  private validateCreateRequest(data: CreateCapabilityRequest): ValidationResult {
    const builder = new ValidationResultBuilder();

    if (!data._id || data._id.trim() === '') {
      builder.addFieldRequired('_id');
    }

    if (!data.subtypeOf || data.subtypeOf.trim() === '') {
      builder.addFieldRequired('subtypeOf');
    }

    return builder.build();
  }

  /**
   * Validate attribute updates
   */
  private validateAttributeUpdates(existing: Capability, updates: Record<string, any>): ValidationResult {
    const builder = new ValidationResultBuilder();

    // Validate that critical attributes aren't being removed
    if (updates.hasOwnProperty('createdAt') && !updates.createdAt) {
      builder.addConstraintViolation('attributes.createdAt', 'createdAt cannot be removed');
    }

    return builder.build();
  }

  /**
   * Bulk create capabilities
   */
  async createCapabilities(capabilities: CreateCapabilityRequest[]): Promise<Capability[]> {
    const results: Capability[] = [];
    const errors: string[] = [];

    for (let i = 0; i < capabilities.length; i++) {
      try {
        const capability = await this.createCapability(capabilities[i]);
        results.push(capability);
      } catch (error) {
        errors.push(`Capability ${i} (${capabilities[i]._id}): ${error}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Bulk create failed:\n${errors.join('\n')}`);
    }

    return results;
  }

  /**
   * Check if capability exists
   */
  async exists(id: string): Promise<boolean> {
    const capability = await this.getCapability(id);
    return capability !== null;
  }


  /**
   * Get capability with related capabilities
   */
  async getCapabilityWithRelated(id: string): Promise<{
    capability: Capability | null;
    parent?: Capability | null;
    children: Capability[];
    parts: Capability[];
    partOf?: Capability | null;
    uses?: Capability | null;
    usedBy: Capability[];
  }> {
    const capability = await this.getCapability(id);
    if (!capability) {
      return {
        capability: null,
        children: [],
        parts: [],
        usedBy: []
      };
    }

    // Get related capabilities using attribute-based queries
    const [parent, children, parts, partOf, uses, usedBy] = await Promise.all([
      // Parent (if subtypeOf is set)
      capability.subtypeOf ? this.getCapability(capability.subtypeOf) : null,
      
      // Children (capabilities that have this as subtypeOf)
      this.findCapabilities({ subtypeOf: id }),
      
      // Parts (if this capability has parts)
      capability.attributes.parts ? 
        Promise.all(capability.attributes.parts.map((partId: string) => this.getCapability(partId))) : 
        [],
      
      // Part of (if this is part of something)
      capability.attributes.partOf ? this.getCapability(capability.attributes.partOf) : null,
      
      // Uses (if this uses something)
      capability.attributes.uses ? this.getCapability(capability.attributes.uses) : null,
      
      // Used by (capabilities that use this)
      this.findByAttribute('uses', id)
    ]);

    return {
      capability,
      parent,
      children,
      parts: parts.filter(p => p !== null) as Capability[],
      partOf,
      uses,
      usedBy
    };
  }
}
