/**
 * Tool Registry Provider Factory
 * 
 * Factory for creating tool registry providers based on configuration.
 * Simplifies provider selection and initialization.
 */

import { MongoDBToolRegistryProvider } from './MongoDBToolRegistryProvider.js';
import { JSONFileToolRegistryProvider } from './JSONFileToolRegistryProvider.js';

export class ToolRegistryProviderFactory {
  /**
   * Create a provider based on configuration
   * @param {string} type - Provider type ('mongodb', 'jsonfile', 'memory')
   * @param {Object} resourceManager - Initialized ResourceManager instance
   * @param {Object} options - Provider-specific options
   * @returns {Promise<IToolRegistryProvider>} Initialized provider instance
   */
  static async createProvider(type, resourceManager, options = {}) {
    const providerType = type.toLowerCase();

    switch (providerType) {
      case 'mongodb':
      case 'mongo':
        if (!resourceManager) {
          throw new Error('ResourceManager required for MongoDB provider');
        }
        return await MongoDBToolRegistryProvider.create(resourceManager, options);

      case 'jsonfile':
      case 'json':
      case 'file':
        return await JSONFileToolRegistryProvider.create(options);

      case 'memory':
        // Could implement in-memory provider if needed
        throw new Error('Memory provider not yet implemented');

      default:
        throw new Error(`Unknown provider type: ${type}. Supported types: mongodb, jsonfile`);
    }
  }

  /**
   * Create provider from environment configuration
   * @param {Object} resourceManager - Initialized ResourceManager instance
   * @returns {Promise<IToolRegistryProvider>} Initialized provider instance
   */
  static async createFromEnvironment(resourceManager) {
    if (!resourceManager?.initialized) {
      throw new Error('ResourceManager must be initialized');
    }

    // Check environment variables for provider configuration
    const providerType = resourceManager.get('env.TOOL_REGISTRY_PROVIDER') || 'jsonfile';
    
    const options = {
      // MongoDB options
      enableSemanticSearch: resourceManager.get('env.TOOL_REGISTRY_SEMANTIC_SEARCH') !== 'false',
      cacheTimeout: parseInt(resourceManager.get('env.TOOL_REGISTRY_CACHE_TIMEOUT') || '300000'),
      batchSize: parseInt(resourceManager.get('env.TOOL_REGISTRY_BATCH_SIZE') || '100'),
      
      // JSON file options
      toolsDatabasePath: resourceManager.get('env.TOOL_REGISTRY_JSON_PATH')
    };

    console.log(`🏭 Creating tool registry provider: ${providerType}`);
    
    return await ToolRegistryProviderFactory.createProvider(providerType, resourceManager, options);
  }

  /**
   * Get available provider types
   * @returns {Array<string>} Available provider type names
   */
  static getAvailableProviders() {
    return ['mongodb', 'jsonfile'];
  }

  /**
   * Get provider capabilities
   * @param {string} type - Provider type
   * @returns {Array<string>} Provider capabilities
   */
  static getProviderCapabilities(type) {
    const providerType = type.toLowerCase();

    switch (providerType) {
      case 'mongodb':
      case 'mongo':
        return [
          'modules', 'tools', 'search', 'semantic_search', 
          'usage_tracking', 'recommendations', 'transactions', 'real_time'
        ];

      case 'jsonfile':
      case 'json':
      case 'file':
        return ['modules', 'tools', 'search', 'usage_tracking'];

      case 'memory':
        return ['modules', 'tools', 'search'];

      default:
        return [];
    }
  }

  /**
   * Validate provider configuration
   * @param {string} type - Provider type
   * @param {Object} resourceManager - ResourceManager instance
   * @param {Object} options - Provider options
   * @returns {Object} Validation result
   */
  static validateProviderConfig(type, resourceManager, options = {}) {
    const providerType = type.toLowerCase();
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    switch (providerType) {
      case 'mongodb':
      case 'mongo':
        if (!resourceManager) {
          result.valid = false;
          result.errors.push('ResourceManager is required for MongoDB provider');
        } else {
          const mongoUrl = resourceManager.get('env.MONGODB_URL');
          if (!mongoUrl) {
            result.valid = false;
            result.errors.push('MONGODB_URL environment variable is required');
          }

          // Check for semantic search dependencies
          if (options.enableSemanticSearch !== false) {
            const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
            const qdrantUrl = resourceManager.get('env.QDRANT_URL');
            
            if (!openaiKey) {
              result.warnings.push('OPENAI_API_KEY not found - semantic search will be disabled');
            }
            if (!qdrantUrl) {
              result.warnings.push('QDRANT_URL not found - using default localhost:6333');
            }
          }
        }
        break;

      case 'jsonfile':
      case 'json':
      case 'file':
        if (options.toolsDatabasePath) {
          // Could add file existence check here
          result.warnings.push('Custom JSON file path specified - ensure file exists and is readable');
        }
        break;

      default:
        result.valid = false;
        result.errors.push(`Unknown provider type: ${type}`);
    }

    return result;
  }

  /**
   * Get recommended provider for environment
   * @param {Object} resourceManager - ResourceManager instance
   * @returns {Object} Recommendation with type and reasoning
   */
  static getRecommendedProvider(resourceManager) {
    if (!resourceManager?.initialized) {
      return {
        type: 'jsonfile',
        reason: 'ResourceManager not available - defaulting to JSON file provider'
      };
    }

    const hasMongoUrl = !!resourceManager.get('env.MONGODB_URL');
    const hasOpenAIKey = !!resourceManager.get('env.OPENAI_API_KEY');
    const hasQdrantUrl = !!resourceManager.get('env.QDRANT_URL');

    if (hasMongoUrl) {
      let reason = 'MongoDB connection available';
      
      if (hasOpenAIKey && hasQdrantUrl) {
        reason += ' with full semantic search capabilities';
      } else if (hasOpenAIKey) {
        reason += ' with basic semantic search (using default Qdrant)';
      } else {
        reason += ' - semantic search disabled (no OpenAI API key)';
      }

      return {
        type: 'mongodb',
        reason
      };
    } else {
      return {
        type: 'jsonfile',
        reason: 'No MongoDB connection - using JSON file provider'
      };
    }
  }
}