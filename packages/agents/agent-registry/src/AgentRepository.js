/**
 * AgentRepository - MongoDB persistence layer for agents
 * Handles storage, retrieval, versioning, and querying of agent configurations
 */

import { MongoClient, ObjectId } from 'mongodb';

export class AgentRepository {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    
    // Get MongoDB connection from ResourceManager
    this.connectionString = this.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
    this.databaseName = this.resourceManager.get('env.MONGODB_DATABASE') || 'legion_agents';
    
    this.client = null;
    this.db = null;
    this.collections = {
      agents: null,
      versions: null,
      deployments: null,
      metrics: null
    };
    this.initialized = false;
  }

  /**
   * Initialize MongoDB connection and collections
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Connect to MongoDB
      this.client = new MongoClient(this.connectionString, {
        maxPoolSize: 10
      });
      
      await this.client.connect();
      this.db = this.client.db(this.databaseName);

      // Initialize collections
      this.collections.agents = this.db.collection('agents');
      this.collections.versions = this.db.collection('agent_versions');
      this.collections.deployments = this.db.collection('agent_deployments');
      this.collections.metrics = this.db.collection('agent_metrics');

      // Create indexes
      await this._createIndexes();

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize AgentRepository: ${error.message}`);
    }
  }

  /**
   * Create database indexes for optimal querying
   */
  async _createIndexes() {
    // Agents collection indexes
    await this.collections.agents.createIndex({ name: 1 });
    await this.collections.agents.createIndex({ type: 1 });
    await this.collections.agents.createIndex({ status: 1 });
    await this.collections.agents.createIndex({ createdAt: -1 });
    await this.collections.agents.createIndex({ 'metadata.tags': 1 });

    // Versions collection indexes
    await this.collections.versions.createIndex({ agentId: 1, version: -1 });
    await this.collections.versions.createIndex({ agentId: 1, createdAt: -1 });

    // Deployments collection indexes
    await this.collections.deployments.createIndex({ agentId: 1, environment: 1 });
    await this.collections.deployments.createIndex({ status: 1, deployedAt: -1 });

    // Metrics collection indexes
    await this.collections.metrics.createIndex({ agentId: 1, timestamp: -1 });
    await this.collections.metrics.createIndex({ agentId: 1, metricType: 1, timestamp: -1 });
  }

  /**
   * Save a new agent or update existing one
   */
  async saveAgent(agentData) {
    await this._ensureInitialized();

    const agent = {
      ...agentData,
      _id: agentData._id || new ObjectId(),
      updatedAt: new Date(),
      createdAt: agentData.createdAt || new Date()
    };

    // If agent has an id field, use it as a secondary identifier
    if (agentData.id && !agent.agentId) {
      agent.agentId = agentData.id;
    }

    try {
      const result = await this.collections.agents.replaceOne(
        { _id: agent._id },
        agent,
        { upsert: true }
      );

      // Save version history
      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        await this._saveVersion(agent);
      }

      return {
        success: true,
        id: agent._id.toString(),
        agentId: agent.agentId,
        version: agent.version || '1.0.0'
      };
    } catch (error) {
      throw new Error(`Failed to save agent: ${error.message}`);
    }
  }

  /**
   * Save agent version for history tracking
   */
  async _saveVersion(agent) {
    const version = {
      _id: new ObjectId(),
      agentId: agent._id,
      version: agent.version || '1.0.0',
      configuration: agent.configuration || agent.config,
      metadata: agent.metadata,
      createdAt: new Date(),
      changes: agent.changes || {}
    };

    await this.collections.versions.insertOne(version);
  }

  /**
   * Retrieve agent by ID
   */
  async getAgentById(id) {
    await this._ensureInitialized();

    try {
      // Try to find by _id first
      let agent = null;
      
      if (ObjectId.isValid(id)) {
        agent = await this.collections.agents.findOne({ _id: new ObjectId(id) });
      }
      
      // If not found, try agentId field
      if (!agent) {
        agent = await this.collections.agents.findOne({ agentId: id });
      }

      return agent;
    } catch (error) {
      throw new Error(`Failed to retrieve agent: ${error.message}`);
    }
  }

  /**
   * Retrieve agent by name
   */
  async getAgentByName(name) {
    await this._ensureInitialized();

    try {
      return await this.collections.agents.findOne({ name });
    } catch (error) {
      throw new Error(`Failed to retrieve agent by name: ${error.message}`);
    }
  }

  /**
   * List all agents with optional filtering
   */
  async listAgents(filter = {}, options = {}) {
    await this._ensureInitialized();

    try {
      const query = this._buildQuery(filter);
      const { 
        limit = 100, 
        skip = 0, 
        sort = { createdAt: -1 } 
      } = options;

      const agents = await this.collections.agents
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      return agents;
    } catch (error) {
      throw new Error(`Failed to list agents: ${error.message}`);
    }
  }

  /**
   * Build MongoDB query from filter options
   */
  _buildQuery(filter) {
    const query = {};

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.tags && Array.isArray(filter.tags)) {
      query['metadata.tags'] = { $in: filter.tags };
    }

    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { description: { $regex: filter.search, $options: 'i' } }
      ];
    }

    // Handle $or queries passed from AgentRegistry
    if (filter.$or) {
      query.$or = filter.$or;
    }

    if (filter.createdAfter) {
      query.createdAt = { $gte: new Date(filter.createdAfter) };
    }

    if (filter.createdBefore) {
      query.createdAt = { 
        ...query.createdAt,
        $lte: new Date(filter.createdBefore) 
      };
    }

    return query;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(id, status) {
    await this._ensureInitialized();

    try {
      const update = {
        $set: {
          status,
          updatedAt: new Date()
        }
      };

      let result;
      
      if (ObjectId.isValid(id)) {
        result = await this.collections.agents.updateOne(
          { _id: new ObjectId(id) },
          update
        );
      } else {
        result = await this.collections.agents.updateOne(
          { agentId: id },
          update
        );
      }

      return {
        success: result.modifiedCount > 0,
        modifiedCount: result.modifiedCount
      };
    } catch (error) {
      throw new Error(`Failed to update agent status: ${error.message}`);
    }
  }

  /**
   * Delete agent by ID
   */
  async deleteAgent(id) {
    await this._ensureInitialized();

    try {
      let result;
      
      if (ObjectId.isValid(id)) {
        // Delete agent and all related data
        const agent = await this.getAgentById(id);
        if (agent) {
          // Delete versions
          await this.collections.versions.deleteMany({ agentId: agent._id });
          
          // Delete deployments
          await this.collections.deployments.deleteMany({ agentId: agent._id });
          
          // Delete metrics
          await this.collections.metrics.deleteMany({ agentId: agent._id });
          
          // Delete agent
          result = await this.collections.agents.deleteOne({ _id: agent._id });
        }
      } else {
        // Try with agentId
        const agent = await this.getAgentById(id);
        if (agent) {
          return await this.deleteAgent(agent._id.toString());
        }
      }

      return {
        success: result?.deletedCount > 0,
        deletedCount: result?.deletedCount || 0
      };
    } catch (error) {
      throw new Error(`Failed to delete agent: ${error.message}`);
    }
  }

  /**
   * Get agent versions
   */
  async getAgentVersions(agentId, limit = 10) {
    await this._ensureInitialized();

    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const versions = await this.collections.versions
        .find({ agentId: agent._id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return versions;
    } catch (error) {
      throw new Error(`Failed to get agent versions: ${error.message}`);
    }
  }

  /**
   * Save deployment information
   */
  async saveDeployment(agentId, deploymentData) {
    await this._ensureInitialized();

    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const deployment = {
        _id: new ObjectId(),
        agentId: agent._id,
        ...deploymentData,
        deployedAt: new Date()
      };

      await this.collections.deployments.insertOne(deployment);

      // Update agent with latest deployment info
      await this.collections.agents.updateOne(
        { _id: agent._id },
        {
          $set: {
            'deployment.latest': deployment,
            'deployment.environment': deploymentData.environment,
            'deployment.status': deploymentData.status,
            updatedAt: new Date()
          }
        }
      );

      return {
        success: true,
        deploymentId: deployment._id.toString()
      };
    } catch (error) {
      throw new Error(`Failed to save deployment: ${error.message}`);
    }
  }

  /**
   * Save agent metrics
   */
  async saveMetrics(agentId, metrics) {
    await this._ensureInitialized();

    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const metricDoc = {
        _id: new ObjectId(),
        agentId: agent._id,
        timestamp: new Date(),
        ...metrics
      };

      await this.collections.metrics.insertOne(metricDoc);

      return {
        success: true,
        metricId: metricDoc._id.toString()
      };
    } catch (error) {
      throw new Error(`Failed to save metrics: ${error.message}`);
    }
  }

  /**
   * Get agent metrics
   */
  async getMetrics(agentId, options = {}) {
    await this._ensureInitialized();

    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const {
        metricType,
        startTime,
        endTime,
        limit = 100
      } = options;

      const query = { agentId: agent._id };

      if (metricType) {
        query.metricType = metricType;
      }

      if (startTime || endTime) {
        query.timestamp = {};
        if (startTime) {
          query.timestamp.$gte = new Date(startTime);
        }
        if (endTime) {
          query.timestamp.$lte = new Date(endTime);
        }
      }

      const metrics = await this.collections.metrics
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return metrics;
    } catch (error) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  /**
   * Search agents by capabilities
   */
  async searchByCapabilities(capabilities) {
    await this._ensureInitialized();

    try {
      const query = {
        'configuration.capabilities.tools': {
          $all: Array.isArray(capabilities) ? capabilities : [capabilities]
        }
      };

      const agents = await this.collections.agents
        .find(query)
        .toArray();

      return agents;
    } catch (error) {
      throw new Error(`Failed to search by capabilities: ${error.message}`);
    }
  }

  /**
   * Get agent statistics
   */
  async getStatistics() {
    await this._ensureInitialized();

    try {
      const stats = {
        totalAgents: await this.collections.agents.countDocuments(),
        byType: await this.collections.agents.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ]).toArray(),
        byStatus: await this.collections.agents.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]).toArray(),
        recentlyCreated: await this.collections.agents.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        totalDeployments: await this.collections.deployments.countDocuments(),
        activeDeployments: await this.collections.deployments.countDocuments({
          status: 'active'
        })
      };

      return stats;
    } catch (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }
  }

  /**
   * Ensure repository is initialized
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collections = {
        agents: null,
        versions: null,
        deployments: null,
        metrics: null
      };
      this.initialized = false;
    }
  }
}