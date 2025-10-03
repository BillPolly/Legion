/**
 * EntityDeduplicator - Detects and merges duplicate entities
 *
 * Uses semantic search to find similar entities and merges them,
 * preserving all provenance information.
 */

import { ObjectId } from 'mongodb';

export class EntityDeduplicator {
  constructor(knowledgeGraphStore, semanticSearch) {
    if (!knowledgeGraphStore) {
      throw new Error('KnowledgeGraphStore is required');
    }
    if (!semanticSearch) {
      throw new Error('SemanticSearch service is required');
    }

    this.store = knowledgeGraphStore;
    this.semanticSearch = semanticSearch;
  }

  /**
   * Find entities similar to the given entity using semantic search
   *
   * @param {Object} entity - Entity to find duplicates for
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Promise<Array>} - Array of similar entities with similarity scores
   */
  async findSimilarEntities(entity, threshold = 0.85) {
    // Search semantic index for similar entities
    const query = `${entity.label} ${entity.ontologyType}`;

    const results = await this.semanticSearch.semanticSearch('knowledge-entities', query, {
      limit: 10,
      threshold
    });

    // Filter out the entity itself if it's already indexed
    const filtered = results.filter(r => {
      if (!entity._id) return true;
      const entityIdStr = entity._id.toString();
      const resultIdStr = r.metadata?.mongoId || r.id;
      return entityIdStr !== resultIdStr;
    });

    // Fetch full entities from MongoDB
    const similarEntities = [];
    for (const result of filtered) {
      const mongoId = result.metadata?.mongoId || result.id;

      try {
        const fullEntity = await this.store.findEntityById(mongoId);

        if (fullEntity) {
          similarEntities.push({
            entity: fullEntity,
            similarity: result._similarity || result.score
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch entity ${mongoId}:`, error.message);
      }
    }

    return similarEntities;
  }

  /**
   * Merge two entities together
   *
   * Merges sourceEntity into targetEntity:
   * - Combines attributes (target wins on conflicts)
   * - Merges provenance (all sentences from both)
   * - Updates all relationships pointing to source
   * - Soft-deletes source entity
   *
   * @param {string|ObjectId} sourceId - Entity to merge from
   * @param {string|ObjectId} targetId - Entity to merge into
   * @returns {Promise<Object>} - Merge result
   */
  async mergeEntities(sourceId, targetId) {
    const sourceObjectId = typeof sourceId === 'string' ? new ObjectId(sourceId) : sourceId;
    const targetObjectId = typeof targetId === 'string' ? new ObjectId(targetId) : targetId;

    // Fetch both entities
    const [source, target] = await Promise.all([
      this.store.findEntityById(sourceObjectId),
      this.store.findEntityById(targetObjectId)
    ]);

    if (!source) {
      throw new Error(`Source entity ${sourceId} not found`);
    }
    if (!target) {
      throw new Error(`Target entity ${targetId} not found`);
    }

    // Merge attributes (target wins on conflicts)
    const mergedAttributes = {
      ...source.attributes,
      ...target.attributes
    };

    // Merge provenance
    const mergedMentions = Array.from(new Set([
      ...(source.provenance?.mentionedIn || []),
      ...(target.provenance?.mentionedIn || [])
    ]));

    const mergedExtractedFrom = Array.from(new Set([
      ...(source.provenance?.extractedFrom || []),
      ...(target.provenance?.extractedFrom || [])
    ]));

    // Use highest confidence score
    const mergedConfidence = Math.max(
      source.provenance?.confidence || 0,
      target.provenance?.confidence || 0
    );

    // Update target entity with merged data
    await this.store.updateEntity(targetObjectId, {
      attributes: mergedAttributes,
      provenance: {
        ...target.provenance,
        mentionedIn: mergedMentions,
        extractedFrom: mergedExtractedFrom,
        confidence: mergedConfidence,
        extractionMethod: 'merged'
      }
    });

    // Update all relationships pointing to source → point to target
    await this._updateRelationshipReferences(sourceObjectId, targetObjectId);

    // Soft-delete source entity
    await this.store.updateEntity(sourceObjectId, {
      deletedAt: new Date(),
      mergedInto: targetObjectId
    });

    return {
      success: true,
      sourceId: sourceObjectId,
      targetId: targetObjectId,
      mergedAttributes: Object.keys(mergedAttributes).length,
      mergedMentions: mergedMentions.length,
      updatedRelationships: await this._countUpdatedRelationships(sourceObjectId, targetObjectId)
    };
  }

  /**
   * Update all relationships that reference the source entity
   * @private
   */
  async _updateRelationshipReferences(sourceId, targetId) {
    if (!this.store.connected) await this.store.connect();

    // Update relationships where source is the subject (from)
    await this.store.collection.updateMany(
      {
        graphType: 'relationship',
        from: sourceId,
        deletedAt: null
      },
      {
        $set: { from: targetId, updatedAt: new Date() }
      }
    );

    // Update relationships where source is the object (to)
    await this.store.collection.updateMany(
      {
        graphType: 'relationship',
        to: sourceId,
        deletedAt: null
      },
      {
        $set: { to: targetId, updatedAt: new Date() }
      }
    );
  }

  /**
   * Count how many relationships were updated
   * @private
   */
  async _countUpdatedRelationships(sourceId, targetId) {
    const relationships = await this.store.findRelationshipsConnectedTo(targetId);

    // Count relationships that were previously connected to source
    return relationships.filter(rel => {
      return (rel.from.toString() === targetId.toString() || rel.to.toString() === targetId.toString());
    }).length;
  }

  /**
   * Check if an entity should be merged based on similarity
   *
   * @param {Object} entity - New entity to check
   * @param {number} threshold - Similarity threshold
   * @returns {Promise<Object|null>} - Target entity to merge into, or null if no merge needed
   */
  async checkForDuplicate(entity, threshold = 0.85) {
    const similar = await this.findSimilarEntities(entity, threshold);

    if (similar.length === 0) {
      return null;
    }

    // Return the most similar entity
    const mostSimilar = similar.reduce((max, current) => {
      return current.similarity > max.similarity ? current : max;
    }, similar[0]);

    return mostSimilar.entity;
  }

  /**
   * Auto-deduplicate: check for duplicates and merge if found
   *
   * @param {Object} entity - New entity to deduplicate
   * @param {number} threshold - Similarity threshold
   * @returns {Promise<Object>} - Result with action taken
   */
  async autoDeduplicate(entity, threshold = 0.85) {
    const duplicate = await this.checkForDuplicate(entity, threshold);

    if (!duplicate) {
      return {
        action: 'no_duplicate',
        entity
      };
    }

    // Entity is new, we need to insert it first before merging
    if (!entity._id) {
      const newEntityId = await this.store.insertEntity(entity);
      entity._id = newEntityId;
    }

    // Merge into existing duplicate
    const mergeResult = await this.mergeEntities(entity._id, duplicate._id);

    return {
      action: 'merged',
      sourceId: entity._id,
      targetId: duplicate._id,
      mergeResult
    };
  }
}
