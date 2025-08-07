/**
 * ProfileTool - Dynamically generated tool for a specific profile
 * 
 * Each profile becomes its own tool with a simplified interface
 */

import { Tool, ToolResult } from '@legion/tool-system';
import { GenericPlanner } from '@legion/llm-planner';
import { LLMClient } from '@legion/llm';

export class ProfileTool extends Tool {
  constructor(profile, profileManager, resourceManager) {
    super();
    this.profile = profile;
    this.profileManager = profileManager;
    this.resourceManager = resourceManager;
    this.name = profile.toolName;
    this.description = profile.description;
  }

  /**
   * Get all tool descriptions for this profile
   * @returns {Array} Array of tool descriptions
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: this.profile.toolName,
          description: this.profile.description,
          parameters: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: `Natural language description of what needs to be accomplished using ${this.profile.name} profile`
              },
              saveAs: {
                type: 'string',
                description: 'Optional name to save the plan in context for later execution'
              }
            },
            required: ['task']
          }
        }
      }
    ];
  }

  /**
   * Execute the tool
   * @param {Object} args - The tool arguments
   * @returns {ToolResult} Tool execution result
   */
  async execute(args) {
    // Handle toolCall format if provided
    if (args.function) {
      const { name: functionName, arguments: funcArgs } = args.function;
      let parsedArgs;

      try {
        parsedArgs = typeof funcArgs === 'string' ? JSON.parse(funcArgs) : funcArgs;
      } catch (error) {
        return ToolResult.failure(`Invalid arguments: ${error.message}`);
      }

      // Since this tool only has one function, we can directly process it
      if (functionName !== this.profile.toolName) {
        return ToolResult.failure(`Unknown function: ${functionName}. Expected: ${this.profile.toolName}`);
      }

      return await this._createPlan(parsedArgs);
    }
    
    // Direct args format
    return await this._createPlan(args);
  }

  /**
   * Create a plan using this profile
   * @param {Object} args - Arguments
   * @returns {ToolResult} Planning result
   * @private
   */
  async _createPlan(args) {
    const { task, saveAs } = args;

    try {
      console.log(`Creating ${this.profile.name} plan for task: ${task}`);

      // Create planning context from profile
      const planningContext = await this.profileManager.createPlanningContext(this.profile, task);

      // Create LLM client and module loader for planning
      const llmClient = await this._createLLMClient();
      const moduleLoader = await this._getOrCreateModuleLoader();

      // Create and execute planner
      const planner = new GenericPlanner({
        llmClient: llmClient,
        moduleLoader: moduleLoader,
        maxSteps: planningContext.maxSteps
      });

      console.log(`Planning with ${this.profile.name} profile:`, {
        actionsCount: planningContext.allowableActions?.length || 0,
        maxSteps: planningContext.maxSteps
      });

      const plan = await planner.createPlan(planningContext);

      const result = {
        success: true,
        profile: this.profile.name,
        profileDescription: this.profile.description,
        requiredModules: this.profile.requiredModules || [],
        plan: plan,
        planId: plan.id || `plan_${Date.now()}`,
        createdAt: new Date().toISOString(),
        note: this.profile.requiredModules?.length > 0 ? 
          `Make sure to load required modules first: ${this.profile.requiredModules.join(', ')}` : 
          undefined
      };

      // TODO: Save to context if requested (when context management is available)
      if (saveAs) {
        result.savedAs = saveAs;
        result.saveNote = `Plan created but context saving not yet implemented. Use the plan object directly.`;
      }

      return ToolResult.success(result);

    } catch (error) {
      console.error(`Error creating plan with ${this.profile.name} profile:`, error);
      return ToolResult.failure(`Planning failed: ${error.message}`, {
        profile: this.profile.name,
        task: task
      });
    }
  }

  /**
   * Create LLM client for planning
   * @returns {LLMClient} Configured LLM client
   * @private
   */
  async _createLLMClient() {
    // Try to get existing LLM client from resource manager
    try {
      const existingClient = this.resourceManager.llmClient;
      if (existingClient) {
        return existingClient;
      }
    } catch (error) {
      // Client doesn't exist, create new one
    }

    // Create new LLM client
    const anthropicKey = this.resourceManager.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment variables. Please set it in your .env file.');
    }

    const llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022' // Use current Claude 3.5 Sonnet model
    });

    // Register for reuse
    this.resourceManager.register('llmClient', llmClient);

    return llmClient;
  }

  /**
   * Get or create ModuleLoader for plan validation
   * @returns {ModuleLoader} Configured ModuleLoader
   * @private
   */
  async _getOrCreateModuleLoader() {
    // Try to get existing ModuleLoader from resource manager
    try {
      const existingLoader = this.resourceManager.moduleLoader;
      if (existingLoader) {
        return existingLoader;
      }
    } catch (error) {
      // ModuleLoader doesn't exist, create new one
    }

    // Create new ModuleLoader
    const { ModuleLoader } = await import('@legion/module-loader');
    const moduleLoader = new ModuleLoader();
    await moduleLoader.initialize();

    // Register for reuse
    this.resourceManager.register('moduleLoader', moduleLoader);

    return moduleLoader;
  }
}