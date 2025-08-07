/**
 * Relationship Service for the Absolute Minimal Model
 * Handles attribute-based relationships in the 3-field structure
 */

import { Capability } from '../types/Capability';
import { ValidationResult, ValidationResultBuilder } from '../types/ValidationResult';
import { ICapabilityStorage } from '../storage/ICapabilityStorage';

export class RelationshipService {
  constructor(private storage: ICapabilityStorage) {}

  /**
   * Get all children of a capability (capabilities that have this as subtypeOf)
   */
  async getChildren(parentId: string): Promise<Capability[]> {
    if (!parentId || parentId.trim() === '') {
      throw new Error('Parent ID is required');
    }

    // Query attributes.subtypeOf = parentId
    return await this.storage.findByAttribute('subtypeOf', parentId);
  }

  /**
   * Get the parent of a capability (from attributes.subtypeOf)
   */
  async getParent(childId: string): Promise<Capability | null> {
    if (!childId || childId.trim() === '') {
      throw new Error('Child ID is required');
    }

    const child = await this.storage.get(childId);
    if (!child || !child.attributes.subtypeOf) {
      return null;
    }

    return await this.storage.get(child.attributes.subtypeOf);
  }

  /**
   * Get all parts of a capability (capabilities that have this as partOf)
   */
  async getParts(capabilityId: string): Promise<Capability[]> {
    if (!capabilityId || capabilityId.trim() === '') {
      throw new Error('Capability ID is required');
    }

    // Query attributes.partOf = capabilityId
    return await this.storage.findByAttribute('partOf', capabilityId);
  }

  /**
   * Get what a capability is part of (from attributes.partOf)
   */
  async getPartOf(partId: string): Promise<Capability | null> {
    if (!partId || partId.trim() === '') {
      throw new Error('Part ID is required');
    }

    const part = await this.storage.get(partId);
    if (!part || !part.attributes.partOf) {
      return null;
    }

    return await this.storage.get(part.attributes.partOf);
  }

  /**
   * Get all capabilities that use this capability (capabilities that have this as uses)
   */
  async getUsedBy(capabilityId: string): Promise<Capability[]> {
    if (!capabilityId || capabilityId.trim() === '') {
      throw new Error('Capability ID is required');
    }

    // Query attributes.uses = capabilityId
    return await this.storage.findByAttribute('uses', capabilityId);
  }

  /**
   * Get what a capability uses (from attributes.uses)
   */
  async getUses(capabilityId: string): Promise<Capability | null> {
    if (!capabilityId || capabilityId.trim() === '') {
      throw new Error('Capability ID is required');
    }

    const capability = await this.storage.get(capabilityId);
    if (!capability || !capability.attributes.uses) {
      return null;
    }

    return await this.storage.get(capability.attributes.uses);
  }

  /**
   * Get all capabilities required by this capability (from attributes.requires)
   */
  async getRequiredCapabilities(capabilityId: string): Promise<Capability[]> {
    if (!capabilityId || capabilityId.trim() === '') {
      throw new Error('Capability ID is required');
    }

    const capability = await this.storage.get(capabilityId);
    if (!capability || !capability.attributes.requires || !Array.isArray(capability.attributes.requires)) {
      return [];
    }

    const required: Capability[] = [];
    for (const requiredId of capability.attributes.requires) {
      const requiredCapability = await this.storage.get(requiredId);
      if (requiredCapability) {
        required.push(requiredCapability);
      }
    }

    return required;
  }

  /**
   * Get all capabilities that require this capability
   */
  async getRequiredBy(capabilityId: string): Promise<Capability[]> {
    if (!capabilityId || capabilityId.trim() === '') {
      throw new Error('Capability ID is required');
    }

    // Query attributes.requires array contains capabilityId
    return await this.storage.findByAttribute('requires', capabilityId);
  }

  /**
   * Add a child relationship (set subtypeOf in child)
   */
  async addChild(parentId: string, childId: string): Promise<boolean> {
    if (!parentId || parentId.trim() === '') {
      throw new Error('Parent ID is required');
    }
    if (!childId || childId.trim() === '') {
      throw new Error('Child ID is required');
    }

    // Validate the relationship
    const parent = await this.storage.get(parentId);
    const child = await this.storage.get(childId);
    
    if (!parent) {
      throw new Error(`Parent capability '${parentId}' not found`);
    }
    if (!child) {
      throw new Error(`Child capability '${childId}' not found`);
    }

    const validation = await this.validateRelationship(parent, child, 'subtypeOf');
    if (!validation.isValid) {
      throw new Error(`Relationship validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Update child's subtypeOf attribute
    const updated = await this.storage.update(childId, {
      attributes: { subtypeOf: parentId }
    });

    return updated !== null;
  }

  /**
   * Remove a child relationship (remove subtypeOf from child)
   */
  async removeChild(parentId: string, childId: string): Promise<boolean> {
    if (!parentId || parentId.trim() === '') {
      throw new Error('Parent ID is required');
    }
    if (!childId || childId.trim() === '') {
      throw new Error('Child ID is required');
    }

    const child = await this.storage.get(childId);
    if (!child || child.attributes.subtypeOf !== parentId) {
      return false; // Relationship doesn't exist
    }

    // Remove subtypeOf attribute
    const updated = await this.storage.update(childId, {
      attributes: { subtypeOf: null }
    });

    return updated !== null;
  }

  /**
   * Add a part relationship (set partOf in part)
   */
  async addPart(wholeId: string, partId: string): Promise<boolean> {
    if (!wholeId || wholeId.trim() === '') {
      throw new Error('Whole ID is required');
    }
    if (!partId || partId.trim() === '') {
      throw new Error('Part ID is required');
    }

    // Validate the relationship
    const whole = await this.storage.get(wholeId);
    const part = await this.storage.get(partId);
    
    if (!whole) {
      throw new Error(`Whole capability '${wholeId}' not found`);
    }
    if (!part) {
      throw new Error(`Part capability '${partId}' not found`);
    }

    const validation = await this.validateRelationship(whole, part, 'partOf');
    if (!validation.isValid) {
      throw new Error(`Relationship validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Update part's partOf attribute
    const updated = await this.storage.update(partId, {
      attributes: { partOf: wholeId }
    });

    // Also add to whole's parts array if it exists
    if (whole.attributes.parts && Array.isArray(whole.attributes.parts)) {
      if (!whole.attributes.parts.includes(partId)) {
        const newParts = [...whole.attributes.parts, partId];
        await this.storage.update(wholeId, {
          attributes: { parts: newParts }
        });
      }
    } else {
      await this.storage.update(wholeId, {
        attributes: { parts: [partId] }
      });
    }

    return updated !== null;
  }

  /**
   * Remove a part relationship
   */
  async removePart(wholeId: string, partId: string): Promise<boolean> {
    if (!wholeId || wholeId.trim() === '') {
      throw new Error('Whole ID is required');
    }
    if (!partId || partId.trim() === '') {
      throw new Error('Part ID is required');
    }

    const part = await this.storage.get(partId);
    const whole = await this.storage.get(wholeId);
    
    if (!part || part.attributes.partOf !== wholeId) {
      return false; // Relationship doesn't exist
    }

    // Remove partOf attribute from part
    await this.storage.update(partId, {
      attributes: { partOf: null }
    });

    // Remove from whole's parts array
    if (whole && whole.attributes.parts && Array.isArray(whole.attributes.parts)) {
      const newParts = whole.attributes.parts.filter(id => id !== partId);
      await this.storage.update(wholeId, {
        attributes: { parts: newParts }
      });
    }

    return true;
  }

  /**
   * Add a uses relationship
   */
  async addUses(userId: string, usedId: string): Promise<boolean> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required');
    }
    if (!usedId || usedId.trim() === '') {
      throw new Error('Used ID is required');
    }

    // Validate the relationship
    const user = await this.storage.get(userId);
    const used = await this.storage.get(usedId);
    
    if (!user) {
      throw new Error(`User capability '${userId}' not found`);
    }
    if (!used) {
      throw new Error(`Used capability '${usedId}' not found`);
    }

    const validation = await this.validateRelationship(user, used, 'uses');
    if (!validation.isValid) {
      throw new Error(`Relationship validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Update user's uses attribute
    const updated = await this.storage.update(userId, {
      attributes: { uses: usedId }
    });

    return updated !== null;
  }

  /**
   * Remove a uses relationship
   */
  async removeUses(userId: string): Promise<boolean> {
    if (!userId || userId.trim() === '') {
      throw new Error('User ID is required');
    }

    const updated = await this.storage.update(userId, {
      attributes: { uses: null }
    });

    return updated !== null;
  }

  /**
   * Get the complete relationship tree for a capability
   */
  async getRelationshipTree(capabilityId: string): Promise<{
    capability: Capability;
    parent?: Capability | null;
    children: Capability[];
    parts: Capability[];
    partOf?: Capability | null;
    uses?: Capability | null;
    usedBy: Capability[];
    requires: Capability[];
    requiredBy: Capability[];
  }> {
    const capability = await this.storage.get(capabilityId);
    if (!capability) {
      throw new Error(`Capability '${capabilityId}' not found`);
    }

    const [parent, children, parts, partOf, uses, usedBy, requires, requiredBy] = await Promise.all([
      this.getParent(capabilityId),
      this.getChildren(capabilityId),
      this.getParts(capabilityId),
      this.getPartOf(capabilityId),
      this.getUses(capabilityId),
      this.getUsedBy(capabilityId),
      this.getRequiredCapabilities(capabilityId),
      this.getRequiredBy(capabilityId)
    ]);

    return {
      capability,
      parent,
      children,
      parts,
      partOf,
      uses,
      usedBy,
      requires,
      requiredBy
    };
  }

  /**
   * Validate a relationship between two capabilities
   */
  async validateRelationship(
    source: Capability, 
    target: Capability, 
    relationshipType: 'subtypeOf' | 'partOf' | 'uses'
  ): Promise<ValidationResult> {
    const builder = new ValidationResultBuilder();

    // Prevent self-references
    if (source.id === target.id) {
      builder.addConstraintViolation(relationshipType, 'Capability cannot have relationship with itself');
    }

    // Check for circular dependencies
    const hasCircularDependency = await this.checkCircularDependency(source.id, target.id, relationshipType);
    if (hasCircularDependency) {
      builder.addConstraintViolation(relationshipType, 'Circular dependency detected');
    }

    return builder.build();
  }

  /**
   * Check for circular dependencies
   */
  private async checkCircularDependency(
    sourceId: string, 
    targetId: string, 
    relationshipType: 'subtypeOf' | 'partOf' | 'uses'
  ): Promise<boolean> {
    const visited = new Set<string>();
    
    const checkPath = async (currentId: string): Promise<boolean> => {
      if (visited.has(currentId)) {
        return currentId === sourceId; // Found a cycle back to source
      }
      
      visited.add(currentId);
      
      const current = await this.storage.get(currentId);
      if (!current) {
        return false;
      }

      let nextId: string | undefined;
      switch (relationshipType) {
        case 'subtypeOf':
          nextId = current.attributes.subtypeOf;
          break;
        case 'partOf':
          nextId = current.attributes.partOf;
          break;
        case 'uses':
          nextId = current.attributes.uses;
          break;
      }

      if (nextId) {
        return await checkPath(nextId);
      }

      return false;
    };

    return await checkPath(targetId);
  }

  /**
   * Get relationship statistics
   */
  async getRelationshipStats(): Promise<{
    totalRelationships: number;
    subtypeRelationships: number;
    partOfRelationships: number;
    usesRelationships: number;
    requiresRelationships: number;
  }> {
    const allCapabilities = await this.storage.findAll();
    
    let subtypeCount = 0;
    let partOfCount = 0;
    let usesCount = 0;
    let requiresCount = 0;

    for (const capability of allCapabilities) {
      if (capability.attributes.subtypeOf) subtypeCount++;
      if (capability.attributes.partOf) partOfCount++;
      if (capability.attributes.uses) usesCount++;
      if (capability.attributes.requires && Array.isArray(capability.attributes.requires)) {
        requiresCount += capability.attributes.requires.length;
      }
    }

    return {
      totalRelationships: subtypeCount + partOfCount + usesCount + requiresCount,
      subtypeRelationships: subtypeCount,
      partOfRelationships: partOfCount,
      usesRelationships: usesCount,
      requiresRelationships: requiresCount
    };
  }
}
