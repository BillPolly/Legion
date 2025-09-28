/**
 * ID Generator Utility
 * Simple ID generation for WordNet entities and relationships
 * Replaces the deprecated idManager from @legion/kg
 */

export class IDGenerator {
  /**
   * Generate a deterministic ID from a seed string
   * @param {string} seed - The seed string for ID generation
   * @returns {string} - Generated ID
   */
  static generateId(seed) {
    // Simple deterministic ID generation
    // In production, could use a hash function for better distribution
    return seed.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Generate a relationship ID from source, target, and type
   * @param {string} sourceId - Source entity ID
   * @param {string} targetId - Target entity ID
   * @param {string} relationType - Type of relationship
   * @returns {string} - Generated relationship ID
   */
  static generateRelationshipId(sourceId, targetId, relationType) {
    return `rel_${relationType}_${sourceId}_to_${targetId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

// Export as a singleton-like object for compatibility
export const idGenerator = {
  generateId: IDGenerator.generateId,
  generateRelationshipId: IDGenerator.generateRelationshipId
};