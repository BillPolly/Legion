/**
 * KnowledgeGraphStore - MongoDB storage for knowledge graph items
 *
 * Unified storage for both entities and relationships using property graph model.
 * Uses MongoDB ObjectId as canonical identifier across all stores.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { validateEntity, validateRelationship, knowledgeGraphIndexes } from './schemas/knowledge-graph.schema.js';
import { isPhysicalEntity, isState, isProcess, isTask, inferCategory } from '../../ontology/src/bootstrap/upper-level-ontology.js';

export class KnowledgeGraphStore {
  constructor(config = {}) {
    this.connectionString = config.connectionString || config.mongoUri || 'mongodb://localhost:27017';
    this.databaseName = config.database || 'knowledge-graph';
    this.collectionName = config.collection || 'knowledge_graph';
    this.hierarchyTraversal = config.hierarchyTraversal || null; // Optional - needed for category inference

    this.client = null;
    this.db = null;
    this.collection = null;
    this.connected = false;
  }

  /**
   * Connect to MongoDB and ensure indexes
   */
  async connect() {
    if (this.connected) return;

    this.client = new MongoClient(this.connectionString);
    await this.client.connect();

    this.db = this.client.db(this.databaseName);
    this.collection = this.db.collection(this.collectionName);

    // Ensure indexes
    await this._ensureIndexes();

    this.connected = true;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
    }
  }

  /**
   * Ensure all indexes exist
   * @private
   */
  async _ensureIndexes() {
    for (const indexSpec of knowledgeGraphIndexes) {
      try {
        await this.collection.createIndex(indexSpec.key, { name: indexSpec.name });
      } catch (error) {
        // Index might already exist
        if (!error.message.includes('already exists')) {
          console.warn(`Failed to create index ${indexSpec.name}:`, error.message);
        }
      }
    }
  }

  // ============================================================================
  // ENTITY OPERATIONS
  // ============================================================================

  /**
   * Insert new entity
   *
   * @param {Object} entity - Entity data
   * @param {string} entity.ontologyType - Type from ontology (e.g., "kg:CentrifugalPump")
   * @param {string} entity.label - Human-readable label
   * @param {Object} entity.attributes - Domain-specific properties
   * @param {Object} entity.provenance - Provenance metadata
   * @returns {Promise<ObjectId>} - MongoDB ObjectId of inserted entity
   */
  async insertEntity(entity) {
    if (!this.connected) await this.connect();

    const now = new Date();
    const doc = {
      graphType: 'entity',
      ontologyType: entity.ontologyType,
      label: entity.label,
      from: null,
      to: null,
      attributes: entity.attributes || {},
      provenance: entity.provenance,
      temporal: entity.temporal || { validFrom: now, validTo: null },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      mergedInto: null
    };

    validateEntity(doc);

    const result = await this.collection.insertOne(doc);
    return result.insertedId;
  }

  /**
   * Find entities matching filter
   *
   * @param {Object} filter - MongoDB filter
   * @param {Object} options - Query options (limit, skip, sort)
   * @returns {Promise<Array>} - Array of entities
   */
  async findEntities(filter = {}, options = {}) {
    if (!this.connected) await this.connect();

    const query = {
      graphType: 'entity',
      deletedAt: null,  // Exclude soft-deleted
      ...filter
    };

    let cursor = this.collection.find(query);

    if (options.limit) cursor = cursor.limit(options.limit);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.sort) cursor = cursor.sort(options.sort);

    return await cursor.toArray();
  }

  /**
   * Find single entity by ID
   *
   * @param {string|ObjectId} id - Entity ID
   * @returns {Promise<Object|null>} - Entity or null
   */
  async findEntityById(id) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    return await this.collection.findOne({
      _id: objectId,
      graphType: 'entity',
      deletedAt: null
    });
  }

  /**
   * Update entity
   *
   * @param {string|ObjectId} id - Entity ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Update result
   */
  async updateEntity(id, updates) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await this.collection.updateOne(
      { _id: objectId, graphType: 'entity', deletedAt: null },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    return result;
  }

  /**
   * Delete entity (soft delete)
   *
   * @param {string|ObjectId} id - Entity ID
   * @returns {Promise<Object>} - Delete result
   */
  async deleteEntity(id) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    return await this.updateEntity(objectId, { deletedAt: new Date() });
  }

  // ============================================================================
  // RELATIONSHIP OPERATIONS
  // ============================================================================

  /**
   * Insert new relationship
   *
   * @param {Object} relationship - Relationship data
   * @param {string} relationship.ontologyType - Type from ontology (e.g., "kg:connectsTo")
   * @param {string|ObjectId} relationship.from - Subject entity ID
   * @param {string|ObjectId} relationship.to - Object entity ID
   * @param {Object} relationship.attributes - Domain-specific properties
   * @param {Object} relationship.provenance - Provenance metadata
   * @returns {Promise<ObjectId>} - MongoDB ObjectId of inserted relationship
   */
  async insertRelationship(relationship) {
    if (!this.connected) await this.connect();

    const now = new Date();
    const doc = {
      graphType: 'relationship',
      ontologyType: relationship.ontologyType,
      label: relationship.label || relationship.ontologyType.replace('kg:', ''),
      from: typeof relationship.from === 'string' ? new ObjectId(relationship.from) : relationship.from,
      to: typeof relationship.to === 'string' ? new ObjectId(relationship.to) : relationship.to,
      attributes: relationship.attributes || {},
      provenance: relationship.provenance,
      temporal: relationship.temporal || { validFrom: now, validTo: null },
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      mergedInto: null
    };

    validateRelationship(doc);

    const result = await this.collection.insertOne(doc);
    return result.insertedId;
  }

  /**
   * Find relationships matching filter
   *
   * @param {Object} filter - MongoDB filter
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of relationships
   */
  async findRelationships(filter = {}, options = {}) {
    if (!this.connected) await this.connect();

    const query = {
      graphType: 'relationship',
      deletedAt: null,
      ...filter
    };

    let cursor = this.collection.find(query);

    if (options.limit) cursor = cursor.limit(options.limit);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.sort) cursor = cursor.sort(options.sort);

    return await cursor.toArray();
  }

  /**
   * Find relationships FROM a specific entity
   *
   * @param {string|ObjectId} entityId - Subject entity ID
   * @returns {Promise<Array>} - Array of relationships
   */
  async findRelationshipsFrom(entityId) {
    const objectId = typeof entityId === 'string' ? new ObjectId(entityId) : entityId;

    return await this.findRelationships({ from: objectId });
  }

  /**
   * Find relationships TO a specific entity
   *
   * @param {string|ObjectId} entityId - Object entity ID
   * @returns {Promise<Array>} - Array of relationships
   */
  async findRelationshipsTo(entityId) {
    const objectId = typeof entityId === 'string' ? new ObjectId(entityId) : entityId;

    return await this.findRelationships({ to: objectId });
  }

  /**
   * Find all relationships connected to an entity (either from or to)
   *
   * @param {string|ObjectId} entityId - Entity ID
   * @returns {Promise<Array>} - Array of relationships
   */
  async findRelationshipsConnectedTo(entityId) {
    if (!this.connected) await this.connect();

    const objectId = typeof entityId === 'string' ? new ObjectId(entityId) : entityId;

    return await this.findRelationships({
      $or: [
        { from: objectId },
        { to: objectId }
      ]
    });
  }

  /**
   * Update relationship
   *
   * @param {string|ObjectId} id - Relationship ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Update result
   */
  async updateRelationship(id, updates) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await this.collection.updateOne(
      { _id: objectId, graphType: 'relationship', deletedAt: null },
      {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      }
    );

    return result;
  }

  /**
   * Delete relationship (soft delete)
   *
   * @param {string|ObjectId} id - Relationship ID
   * @returns {Promise<Object>} - Delete result
   */
  async deleteRelationship(id) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    return await this.updateRelationship(objectId, { deletedAt: new Date() });
  }

  // ============================================================================
  // GENERIC GRAPH OPERATIONS
  // ============================================================================

  /**
   * Find any graph item (entity or relationship) by ID
   *
   * @param {string|ObjectId} id - Item ID
   * @returns {Promise<Object|null>} - Graph item or null
   */
  async findGraphItem(id) {
    if (!this.connected) await this.connect();

    const objectId = typeof id === 'string' ? new ObjectId(id) : id;

    return await this.collection.findOne({
      _id: objectId,
      deletedAt: null
    });
  }

  /**
   * Find graph items by mention (which sentence mentioned them)
   *
   * @param {string} sentenceId - Sentence ID
   * @returns {Promise<Array>} - Array of graph items
   */
  async findByMention(sentenceId) {
    if (!this.connected) await this.connect();

    return await this.collection.find({
      'provenance.mentionedIn': sentenceId,
      deletedAt: null
    }).toArray();
  }

  /**
   * Find graph items by ontology type
   *
   * @param {string} ontologyType - Type from ontology
   * @returns {Promise<Array>} - Array of graph items
   */
  async findByType(ontologyType) {
    if (!this.connected) await this.connect();

    return await this.collection.find({
      ontologyType,
      deletedAt: null
    }).toArray();
  }

  /**
   * Get statistics about the knowledge graph
   *
   * @returns {Promise<Object>} - Statistics object
   */
  async getStatistics() {
    if (!this.connected) await this.connect();

    const [totalEntities, totalRelationships, byType] = await Promise.all([
      this.collection.countDocuments({ graphType: 'entity', deletedAt: null }),
      this.collection.countDocuments({ graphType: 'relationship', deletedAt: null }),
      this.collection.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: { graphType: '$graphType', ontologyType: '$ontologyType' }, count: { $sum: 1 } } }
      ]).toArray()
    ]);

    return {
      totalEntities,
      totalRelationships,
      total: totalEntities + totalRelationships,
      byType: byType.reduce((acc, item) => {
        const key = `${item._id.graphType}:${item._id.ontologyType}`;
        acc[key] = item.count;
        return acc;
      }, {})
    };
  }

  // ============================================================================
  // CATEGORY INFERENCE HELPERS
  // ============================================================================

  /**
   * Infer category for an entity's ontologyType
   *
   * Requires hierarchyTraversal to be configured in constructor.
   *
   * @param {string} ontologyType - The kg:* type to categorize
   * @returns {Promise<string|null>} - 'PhysicalEntity', 'State', 'Process', 'Task', or null
   */
  async inferCategory(ontologyType) {
    if (!this.hierarchyTraversal) {
      throw new Error('hierarchyTraversal is required for category inference. Pass it in constructor config.');
    }

    const getAncestors = this.hierarchyTraversal.getAncestors.bind(this.hierarchyTraversal);
    return await inferCategory(ontologyType, getAncestors);
  }

  /**
   * Find all PhysicalEntity instances
   *
   * @param {Object} additionalFilter - Additional MongoDB filter criteria
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} - Array of physical entities
   */
  async findPhysicalEntities(additionalFilter = {}, options = {}) {
    if (!this.hierarchyTraversal) {
      throw new Error('hierarchyTraversal is required. Pass it in constructor config.');
    }
    if (!this.connected) await this.connect();

    // Get all entities
    const allEntities = await this.findEntities(additionalFilter, options);

    // Filter to only PhysicalEntity descendants
    const getAncestors = this.hierarchyTraversal.getAncestors.bind(this.hierarchyTraversal);
    const physicalEntities = [];

    for (const entity of allEntities) {
      if (await isPhysicalEntity(entity.ontologyType, getAncestors)) {
        physicalEntities.push(entity);
      }
    }

    return physicalEntities;
  }

  /**
   * Find all State instances
   *
   * @param {Object} additionalFilter - Additional MongoDB filter criteria
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} - Array of states
   */
  async findStates(additionalFilter = {}, options = {}) {
    if (!this.hierarchyTraversal) {
      throw new Error('hierarchyTraversal is required. Pass it in constructor config.');
    }
    if (!this.connected) await this.connect();

    const allEntities = await this.findEntities(additionalFilter, options);
    const getAncestors = this.hierarchyTraversal.getAncestors.bind(this.hierarchyTraversal);
    const states = [];

    for (const entity of allEntities) {
      if (await isState(entity.ontologyType, getAncestors)) {
        states.push(entity);
      }
    }

    return states;
  }

  /**
   * Find all Process instances
   *
   * @param {Object} additionalFilter - Additional MongoDB filter criteria
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} - Array of processes
   */
  async findProcesses(additionalFilter = {}, options = {}) {
    if (!this.hierarchyTraversal) {
      throw new Error('hierarchyTraversal is required. Pass it in constructor config.');
    }
    if (!this.connected) await this.connect();

    const allEntities = await this.findEntities(additionalFilter, options);
    const getAncestors = this.hierarchyTraversal.getAncestors.bind(this.hierarchyTraversal);
    const processes = [];

    for (const entity of allEntities) {
      if (await isProcess(entity.ontologyType, getAncestors)) {
        processes.push(entity);
      }
    }

    return processes;
  }

  /**
   * Find all Task instances
   *
   * @param {Object} additionalFilter - Additional MongoDB filter criteria
   * @param {Object} options - Query options (limit, sort, etc.)
   * @returns {Promise<Array>} - Array of tasks
   */
  async findTasks(additionalFilter = {}, options = {}) {
    if (!this.hierarchyTraversal) {
      throw new Error('hierarchyTraversal is required. Pass it in constructor config.');
    }
    if (!this.connected) await this.connect();

    const allEntities = await this.findEntities(additionalFilter, options);
    const getAncestors = this.hierarchyTraversal.getAncestors.bind(this.hierarchyTraversal);
    const tasks = [];

    for (const entity of allEntities) {
      if (await isTask(entity.ontologyType, getAncestors)) {
        tasks.push(entity);
      }
    }

    return tasks;
  }

  /**
   * Find process preconditions (States required by a Process)
   *
   * @param {ObjectId|string} processId - Process entity ID
   * @returns {Promise<Array>} - Array of State entities
   */
  async findProcessPreconditions(processId) {
    if (!this.connected) await this.connect();

    const relationships = await this.findRelationshipsFrom(processId);

    // Find relationships of type kg:requiresPrecondition
    const preconditionRels = relationships.filter(rel =>
      rel.ontologyType === 'kg:requiresPrecondition'
    );

    // Fetch the State entities
    const preconditions = [];
    for (const rel of preconditionRels) {
      const state = await this.findEntityById(rel.to);
      if (state) {
        preconditions.push(state);
      }
    }

    return preconditions;
  }

  /**
   * Find process postconditions (States produced by a Process)
   *
   * @param {ObjectId|string} processId - Process entity ID
   * @returns {Promise<Array>} - Array of State entities
   */
  async findProcessPostconditions(processId) {
    if (!this.connected) await this.connect();

    const relationships = await this.findRelationshipsFrom(processId);

    // Find relationships of type kg:producesPostcondition
    const postconditionRels = relationships.filter(rel =>
      rel.ontologyType === 'kg:producesPostcondition'
    );

    // Fetch the State entities
    const postconditions = [];
    for (const rel of postconditionRels) {
      const state = await this.findEntityById(rel.to);
      if (state) {
        postconditions.push(state);
      }
    }

    return postconditions;
  }

  /**
   * Find entities transformed by a Process
   *
   * @param {ObjectId|string} processId - Process entity ID
   * @returns {Promise<Array>} - Array of PhysicalEntity entities
   */
  async findProcessTransforms(processId) {
    if (!this.connected) await this.connect();

    const relationships = await this.findRelationshipsFrom(processId);

    // Find relationships of type kg:transforms
    const transformsRels = relationships.filter(rel =>
      rel.ontologyType === 'kg:transforms'
    );

    // Fetch the PhysicalEntity entities
    const transforms = [];
    for (const rel of transformsRels) {
      const entity = await this.findEntityById(rel.to);
      if (entity) {
        transforms.push(entity);
      }
    }

    return transforms;
  }
}
