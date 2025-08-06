/**
 * ProfilePlannerTool - Legion tool for profile-based planning
 * 
 * Provides easy-to-use planning interface with pre-configured profiles
 * that provide domain-specific context and allowable actions
 */

import { Tool, ToolResult } from '@legion/module-loader';
import { GenericPlanner } from '@legion/llm-planner';
import { LLMClient } from '@legion/llm';
import { ProfileManager } from '../ProfileManager.js';

export class ProfilePlannerTool extends Tool {
  constructor(dependencies = {}) {
    super();
    this.name = 'profile_planner';
    this.description = 'Profile-based planning for simplified domain-specific task planning';
    this.resourceManager = dependencies.resourceManager;
    this.profileManager = null;
    this.initialized = false;
  }

  /**
   * Initialize the tool
   */
  async initialize() {
    if (this.initialized) return;

    this.profileManager = new ProfileManager(this.resourceManager);
    await this.profileManager.initialize();
    this.initialized = true;
  }

  /**
   * Get all tool descriptions for multi-function tool
   * @returns {Array} Array of tool descriptions
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'plan_with_profile',
          description: 'Create a plan using a pre-configured development profile (e.g., javascript, python, web)',
          parameters: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                description: 'The development profile to use (javascript, web, general, etc.)'
              },
              task: {
                type: 'string',
                description: 'Natural language description of what needs to be accomplished'
              },
              saveAs: {
                type: 'string',
                description: 'Optional name to save the plan in context for later execution'
              }
            },
            required: ['profile', 'task']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'profile_list',
          description: 'List all available development profiles and their capabilities',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'profile_info',
          description: 'Get detailed information about a specific development profile',
          parameters: {
            type: 'object',
            properties: {
              profile: {
                type: 'string',
                description: 'Name of the profile to get information about'
              }
            },
            required: ['profile']
          }
        }
      }
    ];
  }

  /**
   * Execute the tool based on function name
   * @param {Object} args - The tool arguments
   * @returns {ToolResult} Tool execution result
   */
  async execute(args) {
    await this.initialize();

    // Handle toolCall format if provided
    if (args.function) {
      const { name: functionName, arguments: funcArgs } = args.function;
      let parsedArgs;

      try {
        parsedArgs = typeof funcArgs === 'string' ? JSON.parse(funcArgs) : funcArgs;
      } catch (error) {
        return ToolResult.failure(`Invalid arguments: ${error.message}`);
      }

      switch (functionName) {
        case 'plan_with_profile':
          return await this._planWithProfile(parsedArgs);
        case 'profile_list':
          return await this._profileList(parsedArgs);
        case 'profile_info':
          return await this._profileInfo(parsedArgs);
        default:
          return ToolResult.failure(`Unknown function: ${functionName}`);
      }
    }
    
    // Direct args format - determine which function to call based on args
    if (args.profileName !== undefined) {
      return await this._planWithProfile(args);
    } else if (args.filter !== undefined) {
      return await this._profileList(args);
    } else if (args.name !== undefined) {
      return await this._profileInfo(args);
    }
    
    return ToolResult.failure('Unable to determine which function to call');
  }

  /**
   * Create a plan using a profile
   * @param {Object} args - Arguments
   * @returns {ToolResult} Planning result
   * @private
   */
  async _planWithProfile(args) {
    const { profile: profileName, task, saveAs } = args;

    try {
      console.log(`Creating plan with profile '${profileName}' for task: ${task}`);

      // Get and prepare the profile
      const profile = await this.profileManager.prepareProfile(profileName);
      if (!profile) {
        return ToolResult.failure(`Profile '${profileName}' not found. Use profile_list to see available profiles.`);
      }

      // Create planning context from profile
      const planningContext = await this.profileManager.createPlanningContext(profile, task);

      // Create LLM client and module loader for planning
      const llmClient = await this._createLLMClient();
      const moduleLoader = await this._getOrCreateModuleLoader();

      // Create and execute planner
      const planner = new GenericPlanner({
        llmClient: llmClient,
        moduleLoader: moduleLoader,
        maxSteps: planningContext.maxSteps
      });

      console.log(`Planning with context:`, {
        profile: profileName,
        actionsCount: planningContext.allowableActions.length,
        maxSteps: planningContext.maxSteps
      });

      const plan = await planner.createPlan(planningContext);

      const result = {
        success: true,
        profile: profileName,
        profileDescription: profile.description,
        requiredModules: profile.requiredModules || [],
        plan: plan.toJSON(),
        planId: plan.id || `plan_${Date.now()}`,
        createdAt: new Date().toISOString(),
        note: profile.requiredModules?.length > 0 ? 
          `Make sure to load required modules first: ${profile.requiredModules.join(', ')}` : 
          undefined
      };

      // TODO: Save to context if requested (when context management is available)
      if (saveAs) {
        result.savedAs = saveAs;
        result.saveNote = `Plan created but context saving not yet implemented. Use the plan object directly.`;
      }

      return ToolResult.success(result);

    } catch (error) {
      console.error('Error creating plan with profile:', error);
      return ToolResult.failure(`Planning failed: ${error.message}`, {
        profile: profileName,
        task: task
      });
    }
  }

  /**
   * List all available profiles
   * @param {Object} args - Arguments (unused)
   * @returns {ToolResult} List of profiles
   * @private
   */
  async _profileList(args) {
    try {
      const profiles = this.profileManager.listProfiles();
      
      return ToolResult.success({
        profiles: profiles,
        count: profiles.length,
        available: profiles.map(p => p.name),
        usage: 'Use plan_with_profile <profile_name> "<task_description>" to create a plan'
      });
    } catch (error) {
      return ToolResult.failure(`Failed to list profiles: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a profile
   * @param {Object} args - Arguments
   * @returns {ToolResult} Profile information
   * @private
   */
  async _profileInfo(args) {
    const { profile: profileName } = args;

    try {
      const profile = this.profileManager.getProfile(profileName);
      if (!profile) {
        return ToolResult.failure(`Profile '${profileName}' not found`);
      }

      return ToolResult.success({
        profile: {
          name: profile.name,
          description: profile.description,
          requiredModules: profile.requiredModules || [],
          allowableActions: profile.allowableActions || [],
          contextPrompts: profile.contextPrompts || [],
          maxSteps: profile.maxSteps || 20,
          defaultInputs: profile.defaultInputs || [],
          defaultOutputs: profile.defaultOutputs || [],
          actionCount: profile.allowableActions?.length || 0,
          hasTemplates: !!(profile.templates && Object.keys(profile.templates).length > 0)
        },
        usage: `Use: plan_with_profile ${profile.name} "<your_task_description>"`
      });
    } catch (error) {
      return ToolResult.failure(`Failed to get profile info: ${error.message}`);
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
      const existingClient = this.resourceManager.get('llmClient');
      if (existingClient) {
        return existingClient;
      }
    } catch (error) {
      // Client doesn't exist, create new one
    }

    // Create new LLM client
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
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
      const existingLoader = this.resourceManager.get('moduleLoader');
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