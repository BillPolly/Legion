/**
 * AgentRegistry - Central registry for storing and managing agent configurations
 * Provides CRUD operations, search, filtering, and import/export capabilities
 * Now uses MongoDB persistence through AgentRepository
 */

import { AgentRepository } from './AgentRepository.js';

/**
 * Simple validation function for agent configuration
 * @param {Object} config - Agent configuration to validate
 * @returns {Object} Validation result
 */
function validateAgentConfig(config) {
  const errors = [];
  
  if (!config || !config.agent) {
    errors.push('Configuration must have an agent property');
    return { valid: false, errors };
  }
  
  const agent = config.agent;
  
  // Check required fields
  if (!agent.id) errors.push('Agent ID is required');
  if (!agent.name) errors.push('Agent name is required');
  if (!agent.type) errors.push('Agent type is required');
  if (!agent.version) errors.push('Agent version is required');
  if (!agent.llm) errors.push('LLM configuration is required');
  
  if (agent.llm) {
    if (!agent.llm.provider) errors.push('LLM provider is required');
    if (!agent.llm.model) errors.push('LLM model is required');
  }
  
  // Validate agent type
  const validTypes = ['conversational', 'task', 'analytical', 'creative'];
  if (agent.type && !validTypes.includes(agent.type)) {
    errors.push(`Invalid agent type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // Validate version format
  if (agent.version && !/^\d+\.\d+\.\d+$/.test(agent.version)) {
    errors.push('Version must be in format X.Y.Z');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export class AgentRegistry {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.repository = new AgentRepository(resourceManager);
    this.metadata = new Map(); // Lightweight metadata cache
    this.initialized = false;
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize the MongoDB repository
    await this.repository.initialize();
    this.initialized = true;
  }

  /**
   * Register a new agent configuration
   * @param {Object} agentConfig - Agent configuration
   * @param {Object} options - Registration options
   * @returns {Promise<Object>} Registration result
   */
  async registerAgent(agentConfig, options = {}) {
    try {
      // Validate configuration
      const validation = validateAgentConfig(agentConfig);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid configuration: ${validation.errors.join(', ')}`
        };
      }

      const agentId = agentConfig.agent.id;
      
      // Check for duplicates if not allowing updates
      const existingAgent = await this.repository.getAgentById(agentId);
      if (existingAgent && !options.allowUpdate) {
        return {
          success: false,
          error: `Agent with ID ${agentId} already exists`
        };
      }

      // Prepare agent data for storage
      const agentData = {
        name: agentConfig.agent.name,
        type: agentConfig.agent.type,
        description: agentConfig.agent.description,
        version: agentConfig.agent.version,
        agentId: agentId,
        configuration: agentConfig,
        metadata: {
          tags: agentConfig.agent.tags || [],
          provider: agentConfig.agent.llm?.provider,
          model: agentConfig.agent.llm?.model
        },
        status: 'registered'
      };

      // If updating existing agent, preserve the MongoDB _id
      if (existingAgent && options.allowUpdate) {
        agentData._id = existingAgent._id;
      }

      // Save to repository
      const saveResult = await this.repository.saveAgent(agentData);
      
      if (!saveResult.success) {
        return {
          success: false,
          error: `Failed to save agent: ${saveResult.error}`
        };
      }

      // Update metadata cache
      this._updateMetadata(agentConfig);

      return {
        success: true,
        agentId: agentId,
        version: agentConfig.agent.version,
        id: saveResult.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Agent configuration or null
   */
  async getAgent(agentId) {
    try {
      const agent = await this.repository.getAgentById(agentId);
      
      // Return the original configuration format if agent exists
      if (agent && agent.configuration) {
        return {
          ...agent.configuration,
          registeredAt: agent.createdAt?.toISOString(),
          updatedAt: agent.updatedAt?.toISOString()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting agent ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * List all agents with optional filtering
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} List of agents
   */
  async listAgents(filters = {}) {
    try {
      // Convert AgentRegistry filters to AgentRepository format
      const repositoryFilters = {};
      
      if (filters.type) {
        repositoryFilters.type = filters.type;
      }
      
      if (filters.provider) {
        // We need to search by the provider in the configuration, not just metadata
        repositoryFilters.$or = [
          { 'metadata.provider': filters.provider },
          { 'configuration.agent.llm.provider': filters.provider }
        ];
      }
      
      if (filters.tags && filters.tags.length > 0) {
        repositoryFilters.tags = filters.tags;
      }

      // Get agents from repository
      const agents = await this.repository.listAgents(repositoryFilters);

      // Convert back to original configuration format
      return agents.map(agent => ({
        ...agent.configuration,
        registeredAt: agent.createdAt?.toISOString(),
        updatedAt: agent.updatedAt?.toISOString()
      })).filter(agent => agent.agent); // Ensure valid configuration structure
    } catch (error) {
      console.error('Error listing agents:', error.message);
      return [];
    }
  }

  /**
   * Search agents by name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching agents
   */
  async searchAgents(query) {
    try {
      // Use repository search functionality
      const agents = await this.repository.listAgents({ search: query });

      // Convert back to original configuration format
      return agents.map(agent => ({
        ...agent.configuration,
        registeredAt: agent.createdAt?.toISOString(),
        updatedAt: agent.updatedAt?.toISOString()
      })).filter(agent => agent.agent); // Ensure valid configuration structure
    } catch (error) {
      console.error('Error searching agents:', error.message);
      return [];
    }
  }

  /**
   * Delete an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAgent(agentId) {
    try {
      // Use repository delete method (includes cascade deletion)
      const deleteResult = await this.repository.deleteAgent(agentId);
      
      if (!deleteResult.success) {
        return {
          success: false,
          error: `Agent ${agentId} not found`
        };
      }

      // Remove from metadata cache
      this.metadata.delete(agentId);

      return {
        success: true,
        agentId: agentId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get agent metadata without full configuration
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Agent metadata
   */
  async getAgentMetadata(agentId) {
    try {
      const agent = await this.repository.getAgentById(agentId);
      if (!agent) return null;

      const config = agent.configuration?.agent || {};
      const capabilities = config.capabilities || [];
      
      // Count tools
      let toolCount = 0;
      if (Array.isArray(capabilities)) {
        for (const cap of capabilities) {
          toolCount += (cap.tools || []).length;
        }
      } else if (capabilities.tools) {
        toolCount = capabilities.tools.length;
      }

      return {
        id: config.id || agent.agentId,
        name: config.name || agent.name,
        type: config.type || agent.type,
        version: config.version || agent.version,
        description: config.description || agent.description,
        tags: config.tags || agent.metadata?.tags || [],
        provider: config.llm?.provider || agent.metadata?.provider,
        model: config.llm?.model || agent.metadata?.model,
        capabilityCount: Array.isArray(capabilities) ? capabilities.length : (capabilities.tools ? 1 : 0),
        toolCount: toolCount,
        registeredAt: agent.createdAt?.toISOString(),
        updatedAt: agent.updatedAt?.toISOString()
      };
    } catch (error) {
      console.error(`Error getting metadata for agent ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Export agents to JSON
   * @param {Array<string>} agentIds - Agent IDs to export (empty for all)
   * @returns {Promise<Object>} Exported data
   */
  async exportAgents(agentIds = []) {
    try {
      let agents;
      
      if (agentIds.length > 0) {
        // Get specific agents
        agents = [];
        for (const agentId of agentIds) {
          const agent = await this.repository.getAgentById(agentId);
          if (agent && agent.configuration) {
            agents.push({
              ...agent.configuration,
              registeredAt: agent.createdAt?.toISOString(),
              updatedAt: agent.updatedAt?.toISOString()
            });
          }
        }
      } else {
        // Get all agents
        const repositoryAgents = await this.repository.listAgents({}, { limit: 1000 });
        agents = repositoryAgents.map(agent => ({
          ...agent.configuration,
          registeredAt: agent.createdAt?.toISOString(),
          updatedAt: agent.updatedAt?.toISOString()
        })).filter(agent => agent.agent);
      }

      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        agents: agents
      };
    } catch (error) {
      console.error('Error exporting agents:', error.message);
      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        agents: [],
        error: error.message
      };
    }
  }

  /**
   * Import agents from JSON
   * @param {Object} importData - Import data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importAgents(importData, options = {}) {
    const results = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const agentConfig of importData.agents) {
      const agentId = agentConfig.agent.id;
      
      try {
        // Check for conflicts
        const existingAgent = await this.repository.getAgentById(agentId);
        if (existingAgent && !options.overwrite) {
          results.skipped++;
          continue;
        }

        // Validate configuration
        const validation = validateAgentConfig(agentConfig);
        if (!validation.valid) {
          results.errors.push({
            agentId: agentId,
            error: validation.errors.join(', ')
          });
          continue;
        }

        // Use the registerAgent method to ensure proper storage
        const registerResult = await this.registerAgent(agentConfig, { allowUpdate: options.overwrite });
        
        if (registerResult.success) {
          results.imported++;
        } else {
          results.errors.push({
            agentId: agentId,
            error: registerResult.error
          });
        }
      } catch (error) {
        results.errors.push({
          agentId: agentId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get registry statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    try {
      // Use repository statistics
      const repoStats = await this.repository.getStatistics();
      
      // Convert repository format to registry format
      const stats = {
        totalAgents: repoStats.totalAgents,
        byType: {},
        byProvider: {},
        byStatus: {},
        recentlyCreated: repoStats.recentlyCreated,
        totalDeployments: repoStats.totalDeployments,
        activeDeployments: repoStats.activeDeployments
      };

      // Convert aggregation arrays to objects
      for (const typeInfo of repoStats.byType) {
        stats.byType[typeInfo._id] = typeInfo.count;
      }

      for (const statusInfo of repoStats.byStatus) {
        stats.byStatus[statusInfo._id] = statusInfo.count;
      }

      // Get additional provider and version stats from agents
      const agents = await this.repository.listAgents({}, { limit: 1000 });
      const byProvider = {};
      const byVersion = {};

      for (const agent of agents) {
        const config = agent.configuration?.agent;
        
        if (config?.llm?.provider) {
          byProvider[config.llm.provider] = (byProvider[config.llm.provider] || 0) + 1;
        }
        
        if (config?.version) {
          byVersion[config.version] = (byVersion[config.version] || 0) + 1;
        }
      }

      stats.byProvider = byProvider;
      stats.byVersion = byVersion;

      return stats;
    } catch (error) {
      console.error('Error getting statistics:', error.message);
      return {
        totalAgents: 0,
        byType: {},
        byProvider: {},
        byStatus: {},
        byVersion: {},
        recentlyCreated: 0,
        totalDeployments: 0,
        activeDeployments: 0
      };
    }
  }

  /**
   * Update metadata cache
   * @private
   */
  _updateMetadata(agentConfig) {
    const config = agentConfig.agent;
    const capabilities = config.capabilities || [];
    
    let toolCount = 0;
    for (const cap of capabilities) {
      toolCount += (cap.tools || []).length;
    }

    this.metadata.set(config.id, {
      id: config.id,
      name: config.name,
      type: config.type,
      version: config.version,
      tags: config.tags || [],
      provider: config.llm?.provider,
      capabilityCount: capabilities.length,
      toolCount: toolCount
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Clean up the repository connection
    if (this.repository) {
      await this.repository.cleanup();
    }
    
    this.metadata.clear();
    this.initialized = false;
  }
}