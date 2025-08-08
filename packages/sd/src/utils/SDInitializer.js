/**
 * SDInitializer - Centralized initialization for SD agents with proper LLM setup
 * 
 * Ensures proper initialization chain:
 * ResourceManager → LLMClient → Database → Agents
 */

import { LLMClient } from '@legion/llm';
import { DesignDatabaseService } from '../services/DesignDatabaseService.js';

export class SDInitializer {
  constructor() {
    this.resourceManager = null;
    this.llmClient = null;
    this.dbService = null;
    this.isInitialized = false;
  }

  /**
   * Initialize with ResourceManager
   */
  async initializeWithResourceManager(resourceManager) {
    if (this.isInitialized) {
      return {
        resourceManager: this.resourceManager,
        llmClient: this.llmClient,
        dbService: this.dbService
      };
    }

    this.resourceManager = resourceManager;
    
    // Initialize LLM client with Anthropic API key
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
    
    if (anthropicKey) {
      this.llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: anthropicKey
      });
      console.log('✅ LLM client initialized with Anthropic');
    } else if (openaiKey) {
      this.llmClient = new LLMClient({
        provider: 'openai',
        apiKey: openaiKey
      });
      console.log('✅ LLM client initialized with OpenAI');
    } else {
      throw new Error('No LLM API key found in environment (ANTHROPIC_API_KEY or OPENAI_API_KEY)');
    }

    // Register LLM client in ResourceManager for global access
    resourceManager.register('llmClient', this.llmClient);
    
    // Register SDModule-like object for backward compatibility
    resourceManager.register('sdModule', {
      llmClient: this.llmClient
    });

    // Initialize database service
    this.dbService = new DesignDatabaseService(resourceManager);
    await this.dbService.initialize();
    resourceManager.register('dbService', this.dbService);

    this.isInitialized = true;
    
    return {
      resourceManager: this.resourceManager,
      llmClient: this.llmClient,
      dbService: this.dbService
    };
  }

  /**
   * Initialize without ResourceManager (for testing)
   */
  async initializeStandalone(apiKey, provider = 'anthropic') {
    if (this.isInitialized) {
      return {
        llmClient: this.llmClient,
        dbService: this.dbService
      };
    }

    // Create standalone LLM client
    this.llmClient = new LLMClient({
      provider,
      apiKey
    });

    // Create minimal resource manager for compatibility
    this.resourceManager = {
      get: (key) => {
        if (key === 'llmClient') return this.llmClient;
        if (key === 'sdModule') return { llmClient: this.llmClient };
        if (key === 'dbService') return this.dbService;
        if (key.startsWith('env.')) {
          const envKey = key.replace('env.', '');
          return process.env[envKey];
        }
        return null;
      },
      register: () => {}
    };

    // Initialize database service with minimal resource manager
    this.dbService = new DesignDatabaseService(this.resourceManager);
    await this.dbService.initialize();

    this.isInitialized = true;

    return {
      resourceManager: this.resourceManager,
      llmClient: this.llmClient,
      dbService: this.dbService
    };
  }

  /**
   * Create agent configuration with all dependencies
   */
  getAgentConfig() {
    if (!this.isInitialized) {
      throw new Error('SDInitializer not initialized. Call initializeWithResourceManager() or initializeStandalone() first');
    }

    return {
      llmClient: this.llmClient,
      dbService: this.dbService,
      resourceManager: this.resourceManager,
      designDatabase: this.dbService
    };
  }

  /**
   * Create tool dependencies
   */
  getToolDependencies() {
    if (!this.isInitialized) {
      throw new Error('SDInitializer not initialized');
    }

    return {
      llmClient: this.llmClient,
      designDatabase: this.dbService,
      resourceManager: this.resourceManager
    };
  }

  /**
   * Initialize an agent with proper dependencies
   */
  async initializeAgent(AgentClass, additionalConfig = {}) {
    const config = {
      ...this.getAgentConfig(),
      ...additionalConfig
    };

    const agent = new AgentClass(config);
    
    // Initialize the agent
    if (agent.initialize) {
      await agent.initialize();
    }

    return agent;
  }

  /**
   * Initialize multiple agents
   */
  async initializeAgents(agentClasses) {
    const agents = {};
    
    for (const [name, AgentClass] of Object.entries(agentClasses)) {
      agents[name] = await this.initializeAgent(AgentClass);
      console.log(`✅ ${name} agent initialized`);
    }

    return agents;
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      hasLLM: !!this.llmClient,
      hasDB: !!this.dbService,
      hasResourceManager: !!this.resourceManager
    };
  }
}

// Singleton instance for convenience
export const sdInitializer = new SDInitializer();