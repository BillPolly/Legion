/**
 * OntologyInstanceExtractor - Extracts entity/relationship instances from NLP results
 *
 * Bridges the gap between NLP extraction and knowledge graph storage.
 * Converts NLP entities/relationships to graph format and stores in MongoDB.
 */

import { ObjectId } from 'mongodb';

export class OntologyInstanceExtractor {
  constructor(config = {}) {
    if (!config.knowledgeGraphStore) {
      throw new Error('KnowledgeGraphStore is required');
    }
    if (!config.semanticSearch) {
      throw new Error('SemanticSearch service is required');
    }
    if (!config.entityDeduplicator) {
      throw new Error('EntityDeduplicator is required');
    }
    if (!config.provenanceTracker) {
      throw new Error('ProvenanceTracker is required');
    }

    this.store = config.knowledgeGraphStore;
    this.semanticSearch = config.semanticSearch;
    this.deduplicator = config.entityDeduplicator;
    this.provenance = config.provenanceTracker;
    this.deduplicationThreshold = config.deduplicationThreshold || 0.85;
  }

  /**
   * Process NLP results and extract entity/relationship instances
   *
   * @param {Object} nlpResult - Result from NLPSystem.processText()
   * @param {string} sentenceId - Unique sentence identifier
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Extraction result with MongoDB IDs
   */
  async extractInstances(nlpResult, sentenceId, options = {}) {
    const { enableDeduplication = true } = options;

    const result = {
      sentenceId,
      entities: [],
      relationships: [],
      statistics: {
        entitiesCreated: 0,
        entitiesMerged: 0,
        relationshipsCreated: 0
      }
    };

    // Map to store entity IDs (NLP identifier → MongoDB ObjectId)
    const entityIdMap = new Map();

    // Extract entities first
    if (nlpResult.extractions?.entityDetails) {
      for (const nlpEntity of nlpResult.extractions.entityDetails) {
        const entityResult = await this._extractEntity(nlpEntity, sentenceId, enableDeduplication);

        result.entities.push(entityResult);
        entityIdMap.set(nlpEntity.text || nlpEntity.label, entityResult.mongoId);

        if (entityResult.action === 'created') {
          result.statistics.entitiesCreated++;
        } else if (entityResult.action === 'merged') {
          result.statistics.entitiesMerged++;
        }
      }
    }

    // Extract relationships
    if (nlpResult.extractions?.relationshipDetails) {
      for (const nlpRel of nlpResult.extractions.relationshipDetails) {
        const relResult = await this._extractRelationship(nlpRel, sentenceId, entityIdMap);

        if (relResult) {
          result.relationships.push(relResult);
          result.statistics.relationshipsCreated++;
        }
      }
    }

    return result;
  }

  /**
   * Extract and store a single entity
   * @private
   */
  async _extractEntity(nlpEntity, sentenceId, enableDeduplication) {
    // Convert NLP entity to knowledge graph format
    const entity = {
      ontologyType: nlpEntity.type,
      label: nlpEntity.text || nlpEntity.label || nlpEntity.type,
      attributes: this._extractEntityAttributes(nlpEntity),
      provenance: {
        mentionedIn: [sentenceId],
        confidence: nlpEntity.confidence || 0.8,
        extractionMethod: 'llm'
      }
    };

    // Check for duplicates if enabled
    if (enableDeduplication) {
      const duplicate = await this.deduplicator.checkForDuplicate(entity, this.deduplicationThreshold);

      if (duplicate) {
        // Add this mention to existing entity
        await this.provenance.addMention(duplicate._id, sentenceId);

        return {
          action: 'merged',
          mongoId: duplicate._id,
          label: entity.label,
          mergedWith: duplicate._id
        };
      }
    }

    // Insert new entity
    const mongoId = await this.store.insertEntity(entity);

    // Index in semantic search with MongoDB ID
    await this._indexEntityInSemanticSearch(mongoId, entity);

    return {
      action: 'created',
      mongoId,
      label: entity.label
    };
  }

  /**
   * Extract and store a single relationship
   * @private
   */
  async _extractRelationship(nlpRel, sentenceId, entityIdMap) {
    // Get MongoDB IDs for subject and object entities
    const fromId = entityIdMap.get(nlpRel.subject || nlpRel.from);
    const toId = entityIdMap.get(nlpRel.object || nlpRel.to);

    if (!fromId || !toId) {
      console.warn(`Skipping relationship ${nlpRel.type}: missing entity references`);
      return null;
    }

    // Convert NLP relationship to knowledge graph format
    const relationship = {
      ontologyType: nlpRel.type,
      label: nlpRel.type.replace('kg:', ''),
      from: fromId,
      to: toId,
      attributes: this._extractRelationshipAttributes(nlpRel),
      provenance: {
        mentionedIn: [sentenceId],
        confidence: nlpRel.confidence || 0.8,
        extractionMethod: 'llm'
      }
    };

    // Insert relationship
    const mongoId = await this.store.insertRelationship(relationship);

    // Index in semantic search
    await this._indexRelationshipInSemanticSearch(mongoId, relationship);

    return {
      action: 'created',
      mongoId,
      type: relationship.ontologyType,
      from: fromId,
      to: toId
    };
  }

  /**
   * Extract attributes from NLP entity
   * @private
   */
  _extractEntityAttributes(nlpEntity) {
    const attributes = {};

    // Copy any properties from NLP entity
    if (nlpEntity.properties) {
      Object.assign(attributes, nlpEntity.properties);
    }

    // Add position/offset information if available
    if (nlpEntity.start !== undefined && nlpEntity.end !== undefined) {
      attributes._textPosition = {
        start: nlpEntity.start,
        end: nlpEntity.end
      };
    }

    return attributes;
  }

  /**
   * Extract attributes from NLP relationship
   * @private
   */
  _extractRelationshipAttributes(nlpRel) {
    const attributes = {};

    // Copy any properties from NLP relationship
    if (nlpRel.properties) {
      Object.assign(attributes, nlpRel.properties);
    }

    return attributes;
  }

  /**
   * Index entity in semantic search with MongoDB ID
   * @private
   */
  async _indexEntityInSemanticSearch(mongoId, entity) {
    const mongoIdStr = mongoId.toString();

    // Create multiple perspectives for better semantic matching
    const perspectives = [
      {
        type: 'label',
        text: entity.label
      },
      {
        type: 'type',
        text: `${entity.label} ${entity.ontologyType}`
      },
      {
        type: 'attributes',
        text: `${entity.label} ${Object.values(entity.attributes || {}).join(' ')}`
      }
    ];

    // Index each perspective with the MongoDB ID
    for (const perspective of perspectives) {
      await this.semanticSearch.insert('knowledge-entities', {
        id: mongoIdStr,  // Use MongoDB ID as vector store ID
        text: perspective.text,
        metadata: {
          mongoId: mongoIdStr,
          graphType: 'entity',
          ontologyType: entity.ontologyType,
          label: entity.label,
          perspectiveType: perspective.type
        }
      });
    }
  }

  /**
   * Index relationship in semantic search with MongoDB ID
   * @private
   */
  async _indexRelationshipInSemanticSearch(mongoId, relationship) {
    const mongoIdStr = mongoId.toString();

    const perspectives = [
      {
        type: 'label',
        text: relationship.label
      },
      {
        type: 'type',
        text: `${relationship.label} ${relationship.ontologyType}`
      }
    ];

    for (const perspective of perspectives) {
      await this.semanticSearch.insert('knowledge-relationships', {
        id: mongoIdStr,
        text: perspective.text,
        metadata: {
          mongoId: mongoIdStr,
          graphType: 'relationship',
          ontologyType: relationship.ontologyType,
          label: relationship.label,
          from: relationship.from.toString(),
          to: relationship.to.toString(),
          perspectiveType: perspective.type
        }
      });
    }
  }

  /**
   * Process multiple sentences in batch
   *
   * @param {Array} nlpResults - Array of NLP results
   * @param {Array} sentenceIds - Corresponding sentence IDs
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Aggregated results
   */
  async extractInstancesBatch(nlpResults, sentenceIds, options = {}) {
    if (nlpResults.length !== sentenceIds.length) {
      throw new Error('nlpResults and sentenceIds arrays must have same length');
    }

    const aggregated = {
      sentences: nlpResults.length,
      entities: [],
      relationships: [],
      statistics: {
        entitiesCreated: 0,
        entitiesMerged: 0,
        relationshipsCreated: 0
      }
    };

    for (let i = 0; i < nlpResults.length; i++) {
      const result = await this.extractInstances(nlpResults[i], sentenceIds[i], options);

      aggregated.entities.push(...result.entities);
      aggregated.relationships.push(...result.relationships);
      aggregated.statistics.entitiesCreated += result.statistics.entitiesCreated;
      aggregated.statistics.entitiesMerged += result.statistics.entitiesMerged;
      aggregated.statistics.relationshipsCreated += result.statistics.relationshipsCreated;
    }

    return aggregated;
  }
}
