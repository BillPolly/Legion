/**
 * SDModule - Main module class for SD package
 * 
 * Extends Legion's Module class to provide tool discovery and registration
 * for the Software Development autonomous agent system
 */

import { Module } from '@legion/tools-registry';
import { DecentPlanner } from '@legion/decent-planner';
import { SDPlanningProfile } from './profiles/SDPlanningProfile.js';
import { DesignDatabaseService } from './services/DesignDatabaseService.js';
import { fileURLToPath } from 'url';

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
  constructor() {
    super();
    this.name = 'sd';
    this.description = 'Software Development autonomous agent system with Legion DecentPlanner integration';
    this.version = '1.0.0';
    
    // NEW: Set metadata path for automatic loading
    this.metadataPath = './tools-metadata.json';
    
    this.resourceManager = null;
    this.profileManager = null;
    this.llmClient = null;
    this.decentPlanner = null;
    this.designDatabase = null;
  }

  /**
   * Override getModulePath to support proper path resolution
   */
  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new SDModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the SD module
   */
  async initialize() {
    await super.initialize();
    
    // Get LLM client from ResourceManager
    this.llmClient = await this.getLLMClient();
    
    // Initialize design database connection
    await this.initializeDatabase();
    
    // Register all tools first (needed for planner)
    await this.registerTools();
    
    // Initialize Legion's DecentPlanner
    this.decentPlanner = new DecentPlanner({
      maxDepth: 6, // SD workflows can be deep
      confidenceThreshold: 0.8, // High confidence for software development
      enableFormalPlanning: true,
      validateBehaviorTrees: true
    });
    await this.decentPlanner.initialize();
    
    // Initialize planning profiles
    this.profileManager = new SDPlanningProfile(this.decentPlanner);
    
    console.log('[SDModule] Initialized with', this.getTools().length, 'tools and DecentPlanner integration');
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
    this.designDatabase = new DesignDatabaseService(this.resourceManager);
    await this.designDatabase.initialize();
    
    console.log('[SDModule] Design database connected');
  }

  /**
   * Register all SD tools - ONLY ONE WAY: metadata-driven approach
   */
  async registerTools() {
    console.log('[SDModule] Using ONLY metadata-driven tool registration');
    
    // Create tools using metadata (proper Legion pattern)
    const tools = [
      { key: 'parse_requirements', class: RequirementParserTool },
      { key: 'generate_user_stories', class: UserStoryGeneratorTool },
      { key: 'generate_acceptance_criteria', class: AcceptanceCriteriaGeneratorTool },
      { key: 'identify_bounded_contexts', class: BoundedContextGeneratorTool },
      { key: 'model_entities', class: EntityModelingTool },
      { key: 'design_aggregates', class: AggregateDesignTool },
      { key: 'extract_domain_events', class: DomainEventExtractorTool },
      { key: 'design_layers', class: LayerGeneratorTool },
      { key: 'generate_use_cases', class: UseCaseGeneratorTool },
      { key: 'design_interfaces', class: InterfaceDesignTool },
      { key: 'database_connect', class: DatabaseConnectionTool },
      { key: 'store_artifact', class: ArtifactStorageTool },
      { key: 'retrieve_context', class: ContextRetrievalTool }
    ];

    for (const { key, class: ToolClass } of tools) {
      const tool = this.createToolFromMetadata(key, ToolClass);
      // Pass module dependencies to tool (like GeminiToolsModule pattern)
      if (tool.config !== undefined) {
        Object.assign(tool, {
          resourceManager: this.resourceManager,
          designDatabase: this.designDatabase,
          llmClient: this.llmClient
        });
      } else {
        tool.resourceManager = this.resourceManager;
        tool.designDatabase = this.designDatabase;
        tool.llmClient = this.llmClient;
      }
      
      this.registerTool(tool.name, tool);
    }
  }

  /**
   * Register a tool - delegates to base class
   * @param {Tool} tool - Tool instance to register
   */
  registerTool(tool) {
    if (!tool.name) {
      throw new Error('Tool must have a name property');
    }
    super.registerTool(tool.name, tool);
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
   * Plan a software development goal using Legion's DecentPlannerRefactored
   * @param {string} goal - Development goal (e.g., "Build a user authentication system")
   * @param {Object} context - Additional context for planning
   * @returns {Promise<Object>} Planning result with decomposition and behavior trees
   */
  async planDevelopment(goal, context = {}) {
    if (!this.decentPlanner) {
      throw new Error('SDModule not initialized. Call initialize() first.');
    }
    
    const sdContext = {
      ...context,
      methodology: 'SD-6-Methodology',
      frameworks: ['DDD', 'Clean Architecture', 'Immutable Design', 'Flux', 'TDD', 'Clean Code'],
      toolset: Array.from(this.tools.keys()),
      databaseConnected: this.designDatabase?.connected || false
    };
    
    return await this.decentPlanner.plan(goal, sdContext);
  }

  /**
   * Get the DecentPlannerRefactored instance for direct access
   * @returns {DecentPlannerRefactored} The planner instance
   */
  getPlanner() {
    return this.decentPlanner;
  }


  /**
   * Get module metadata
   * @returns {Object} Module metadata
   */
  getMetadata() {
    return {
      name: 'sd',
      version: '1.0.0',
      description: 'Software Development autonomous agent system with Legion DecentPlannerRefactored integration',
      toolCount: this.getTools().length,
      profileCount: this.profileManager ? this.profileManager.listProfiles().length : 0,
      hasPlanner: !!this.decentPlanner,
      databaseConnected: this.designDatabase?.connected || false,
      requiredDependencies: ['ANTHROPIC_API_KEY'],
      optionalDependencies: ['MONGODB_URI']
    };
  }

  /**
   * Invoke a specific SD tool (standard Legion pattern)
   * @param {string} toolName - The name of the tool to invoke
   * @param {Object} params - The parameters for the tool
   * @returns {Promise<Object>} The result of the operation
   */
  async invoke(toolName, params) {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Unknown SD tool: ${toolName}`,
        data: {}
      };
    }
    
    // Tools return wrapped results via their execute() method
    return await tool.execute(params);
  }

  /**
   * Get module statistics (standard Legion pattern)
   * @returns {Object} Module statistics
   */
  getStatistics() {
    const tools = this.getTools();
    return {
      toolCount: tools.length,
      tools: tools.map(tool => tool.name),
      name: this.name,
      version: this.version,
      description: this.description,
      databaseConnected: !!this.designDatabase,
      plannerReady: !!this.decentPlanner
    };
  }
}
