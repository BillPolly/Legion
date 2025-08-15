/**
 * SDModule - Main module class for SD package
 * 
 * Extends Legion's Module class to provide tool discovery and registration
 * for the Software Development autonomous agent system
 */

import { Module } from '@legion/tools-registry';
import { SDPlanningProfile } from './profiles/SDPlanningProfile.js';

// Import tools (to be implemented)
import { RequirementParserTool } from './tools/requirements/RequirementParserTool.js';
import { UserStoryGeneratorTool } from './tools/requirements/UserStoryGeneratorTool.js';
import { AcceptanceCriteriaGeneratorTool } from './tools/requirements/AcceptanceCriteriaGeneratorTool.js';

import { BoundedContextGeneratorTool } from './tools/domain/BoundedContextGeneratorTool.js';
import { EntityModelingTool } from './tools/domain/EntityModelingTool.js';
import { AggregateDesignTool } from './tools/domain/AggregateDesignTool.js';
import { DomainEventExtractorTool } from './tools/domain/DomainEventExtractorTool.js';

import { LayerGeneratorTool } from './tools/architecture/LayerGeneratorTool.js';
import { UseCaseGeneratorTool } from './tools/architecture/UseCaseGeneratorTool.js';
import { InterfaceDesignTool } from './tools/architecture/InterfaceDesignTool.js';

import { DatabaseConnectionTool } from './tools/database/DatabaseConnectionTool.js';
import { ArtifactStorageTool } from './tools/database/ArtifactStorageTool.js';
import { ContextRetrievalTool } from './tools/database/ContextRetrievalTool.js';

export default class SDModule extends Module {
  constructor(dependencies = {}) {
    super('SDModule', dependencies);
    this.resourceManager = dependencies.resourceManager || dependencies;
    this.profileManager = null;
    this.llmClient = null;
    this.designDatabase = null;
    this.tools = new Map();
  }

  /**
   * Initialize the SD module
   */
  async initialize() {
    // Get LLM client from ResourceManager
    this.llmClient = await this.getLLMClient();
    
    // Initialize planning profiles
    this.profileManager = new SDPlanningProfile();
    
    // Initialize design database connection
    await this.initializeDatabase();
    
    // Register all tools
    await this.registerTools();
    
    console.log('[SDModule] Initialized with', this.tools.size, 'tools');
  }

  /**
   * Get LLM client from ResourceManager
   */
  async getLLMClient() {
    // Try to get existing LLM client from resource manager
    try {
      const existingClient = this.resourceManager.get('llmClient');
      if (existingClient) {
        return existingClient;
      }
    } catch (error) {
      // Client doesn't exist, create new one
    }

    // Get API key from ResourceManager (automatically loaded from .env)
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found. Please set it in your .env file.');
    }

    // Import and create LLM client
    const { LLMClient } = await import('@legion/llm');
    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022'
    });

    // Store for reuse
    this.resourceManager.set('llmClient', llmClient);
    
    return llmClient;
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    const mongoUri = this.resourceManager.get('env.MONGODB_URI') || 
                     'mongodb://localhost:27017/sd-design';
    
    // Database initialization will be implemented with DatabaseConnectionTool
    this.designDatabase = {
      uri: mongoUri,
      connected: false // Will be set to true when tools are implemented
    };
  }

  /**
   * Register all SD tools
   */
  async registerTools() {
    const toolDependencies = {
      resourceManager: this.resourceManager,
      llmClient: this.llmClient,
      designDatabase: this.designDatabase
    };

    // Requirements tools
    this.registerTool(new RequirementParserTool(toolDependencies));
    this.registerTool(new UserStoryGeneratorTool(toolDependencies));
    this.registerTool(new AcceptanceCriteriaGeneratorTool(toolDependencies));
    
    // Domain modeling tools
    this.registerTool(new BoundedContextGeneratorTool(toolDependencies));
    this.registerTool(new EntityModelingTool(toolDependencies));
    this.registerTool(new AggregateDesignTool(toolDependencies));
    this.registerTool(new DomainEventExtractorTool(toolDependencies));
    
    // Architecture tools
    this.registerTool(new LayerGeneratorTool(toolDependencies));
    this.registerTool(new UseCaseGeneratorTool(toolDependencies));
    this.registerTool(new InterfaceDesignTool(toolDependencies));
    
    // Database tools
    this.registerTool(new DatabaseConnectionTool(toolDependencies));
    this.registerTool(new ArtifactStorageTool(toolDependencies));
    this.registerTool(new ContextRetrievalTool(toolDependencies));
  }

  /**
   * Register a tool
   * @param {Tool} tool - Tool instance to register
   */
  registerTool(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name property');
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all tools (required by Module interface)
   * @returns {Array<Tool>} Array of all registered tools
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   * @param {string} name - Tool name
   * @returns {Tool|null} Tool instance or null if not found
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Get available profiles
   * @returns {Array} List of available SD profiles
   */
  getProfiles() {
    return this.profileManager.listProfiles();
  }

  /**
   * Get a specific profile
   * @param {string} name - Profile name
   * @returns {Object|null} Profile configuration or null
   */
  getProfile(name) {
    return this.profileManager.getProfile(name);
  }

  /**
   * Create a Legion-compatible factory method
   * @param {ResourceManager} resourceManager - Resource manager instance
   * @returns {Promise<SDModule>} Initialized SD module
   */
  static async create(resourceManager) {
    const module = new SDModule({ resourceManager });
    await module.initialize();
    return module;
  }

  /**
   * Get module metadata
   * @returns {Object} Module metadata
   */
  getMetadata() {
    return {
      name: 'sd',
      version: '1.0.0',
      description: 'Software Development autonomous agent system',
      toolCount: this.tools.size,
      profileCount: this.profileManager ? this.profileManager.listProfiles().length : 0,
      requiredDependencies: ['ANTHROPIC_API_KEY'],
      optionalDependencies: ['MONGODB_URI']
    };
  }
}