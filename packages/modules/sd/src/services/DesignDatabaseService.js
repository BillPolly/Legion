/**
 * DesignDatabaseService - Real MongoDB integration for SD artifacts
 * 
 * This service manages storage and retrieval of software design artifacts
 * using Legion's MongoDB provider through ResourceManager
 */

import { MongoDBProvider } from '@legion/storage';

export class DesignDatabaseService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.mongoProvider = null;
    this.connected = false;
  }

  /**
   * Initialize database connection using ResourceManager
   */
  async initialize() {
    if (this.connected) return;

    // Get MongoDB URL from ResourceManager (loaded from .env)
    const mongoUrl = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017/search_demo';
    const database = this.resourceManager.get('env.MONGODB_DATABASE') || 'sd_design';
    
    console.log(`[DesignDatabaseService] Connecting to MongoDB: ${mongoUrl}`);
    
    this.mongoProvider = new MongoDBProvider({
      connectionString: mongoUrl,
      database: database
    });

    await this.mongoProvider.connect();
    this.connected = true;

    // Create indexes for better performance
    await this.createIndexes();
    
    console.log(`[DesignDatabaseService] Connected to database: ${database}`);
  }

  /**
   * Create MongoDB indexes for SD collections
   */
  async createIndexes() {
    try {
      // Artifacts collection indexes
      await this.mongoProvider.createIndex('sd_artifacts', { 
        projectId: 1, 
        type: 1, 
        timestamp: -1 
      });
      await this.mongoProvider.createIndex('sd_artifacts', { 
        agentId: 1, 
        timestamp: -1 
      });
      await this.mongoProvider.createIndex('sd_artifacts', { 
        'metadata.toolName': 1 
      });

      // Context collection indexes  
      await this.mongoProvider.createIndex('sd_context', {
        projectId: 1,
        contextType: 1,
        timestamp: -1
      });

      console.log('[DesignDatabaseService] Created MongoDB indexes');
    } catch (error) {
      console.warn('[DesignDatabaseService] Index creation failed:', error.message);
    }
  }

  /**
   * Store a design artifact
   * @param {Object} artifact - The artifact to store
   * @returns {Object} Stored artifact with MongoDB _id
   */
  async storeArtifact(artifact) {
    if (!this.connected) {
      await this.initialize();
    }

    const enrichedArtifact = {
      ...artifact,
      _id: undefined, // Let MongoDB generate
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.mongoProvider.insert('sd_artifacts', enrichedArtifact);
    const insertedId = result.insertedIds[0];

    console.log(`[DesignDatabaseService] Stored artifact ${artifact.type} with ID: ${insertedId}`);

    return {
      ...enrichedArtifact,
      _id: insertedId,
      id: insertedId.toString()
    };
  }

  /**
   * Retrieve artifacts by type and query
   * @param {string} type - Artifact type
   * @param {Object} query - Query parameters
   * @returns {Array} Found artifacts
   */
  async retrieveArtifacts(type, query = {}) {
    if (!this.connected) {
      await this.initialize();
    }

    const searchQuery = {
      type,
      ...query
    };

    const results = await this.mongoProvider.find('sd_artifacts', searchQuery, {
      sort: { timestamp: -1, createdAt: -1 },
      limit: query.limit || 100
    });

    console.log(`[DesignDatabaseService] Retrieved ${results.length} ${type} artifacts`);
    
    return results.map(doc => ({
      ...doc,
      id: doc._id.toString()
    }));
  }

  /**
   * Retrieve single artifact by ID
   * @param {string} artifactId - The artifact ID
   * @returns {Object|null} Found artifact
   */
  async getArtifactById(artifactId) {
    if (!this.connected) {
      await this.initialize();
    }

    // Handle both ObjectId and string formats
    const query = artifactId.length === 24 && /^[0-9a-fA-F]{24}$/.test(artifactId) 
      ? { _id: artifactId } 
      : { id: artifactId };

    const result = await this.mongoProvider.findOne('sd_artifacts', query);
    
    if (result) {
      return {
        ...result,
        id: result._id.toString()
      };
    }
    
    return null;
  }

  /**
   * Store context for LLM decision making
   * @param {Object} context - Context data
   * @returns {Object} Stored context
   */
  async storeContext(context) {
    if (!this.connected) {
      await this.initialize();
    }

    const contextDoc = {
      ...context,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.mongoProvider.insert('sd_context', contextDoc);
    const insertedId = result.insertedIds[0];

    console.log(`[DesignDatabaseService] Stored context ${context.contextType} with ID: ${insertedId}`);

    return {
      ...contextDoc,
      _id: insertedId,
      id: insertedId.toString()
    };
  }

  /**
   * Retrieve context by type and project
   * @param {string} contextType - Type of context
   * @param {string} projectId - Project identifier
   * @returns {Array} Found contexts
   */
  async retrieveContext(contextType, projectId) {
    if (!this.connected) {
      await this.initialize();
    }

    const results = await this.mongoProvider.find('sd_context', {
      contextType,
      projectId
    }, {
      sort: { createdAt: -1 },
      limit: 10
    });

    console.log(`[DesignDatabaseService] Retrieved ${results.length} ${contextType} contexts for project ${projectId}`);
    
    return results.map(doc => ({
      ...doc,
      id: doc._id.toString()
    }));
  }

  /**
   * Get project statistics
   * @param {string} projectId - Project identifier
   * @returns {Object} Project statistics
   */
  async getProjectStats(projectId) {
    if (!this.connected) {
      await this.initialize();
    }

    const pipeline = [
      { $match: { projectId } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          lastUpdated: { $max: '$createdAt' }
        }
      }
    ];

    const stats = await this.mongoProvider.aggregate('sd_artifacts', pipeline);
    
    return {
      projectId,
      artifactCounts: stats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      totalArtifacts: stats.reduce((sum, item) => sum + item.count, 0),
      lastActivity: stats.reduce((latest, item) => 
        item.lastUpdated > latest ? item.lastUpdated : latest, new Date(0))
    };
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.mongoProvider && this.connected) {
      await this.mongoProvider.disconnect();
      this.connected = false;
      console.log('[DesignDatabaseService] Disconnected from MongoDB');
    }
  }

  /**
   * Health check - verify database connectivity
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      if (!this.connected) {
        await this.initialize();
      }

      // Test basic operation
      await this.mongoProvider.find('sd_artifacts', {}, { limit: 1 });
      
      return {
        status: 'healthy',
        connected: this.connected,
        database: this.mongoProvider.databaseName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}