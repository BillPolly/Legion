/**
 * ProfileManager - Manages planning profiles for domain-specific planning
 * 
 * Profiles provide pre-configured environments with:
 * - Required modules and tools
 * - Domain-specific allowable actions
 * - Context prompts for better LLM understanding
 * - Default inputs/outputs for common workflows
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

class ProfileManager {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.profiles = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the profile manager by loading all available profiles
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.loadBuiltinProfiles();
      this.initialized = true;
      console.log(`ProfileManager initialized with ${this.profiles.size} profiles`);
    } catch (error) {
      console.error('Failed to initialize ProfileManager:', error);
      throw error;
    }
  }

  /**
   * Load built-in profiles from the profiles directory
   */
  async loadBuiltinProfiles() {
    const profilesDir = join(__dirname, 'profiles');
    
    try {
      const files = await fs.readdir(profilesDir);
      const profileFiles = files.filter(file => file.endsWith('.json'));

      // Sort to prioritize verified profiles
      profileFiles.sort((a, b) => {
        if (a.includes('-verified') && !b.includes('-verified')) return -1;
        if (!a.includes('-verified') && b.includes('-verified')) return 1;
        return a.localeCompare(b);
      });

      // Track loaded profile names to avoid duplicates
      const loadedProfiles = new Set();

      for (const file of profileFiles) {
        try {
          const profilePath = join(profilesDir, file);
          const profileContent = await fs.readFile(profilePath, 'utf8');
          const profile = JSON.parse(profileContent);
          
          if (profile && profile.name) {
            // Skip if we already loaded a verified version
            if (loadedProfiles.has(profile.name)) {
              console.log(`Skipping ${file} - already loaded verified version`);
              continue;
            }
            
            await this.registerProfile(profile);
            loadedProfiles.add(profile.name);
            console.log(`Loaded profile: ${profile.name}${profile.verified ? ' (verified)' : ''}`);
          } else {
            console.warn(`Profile file ${file} does not contain a valid profile`);
          }
        } catch (error) {
          console.warn(`Failed to load profile from ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Profiles directory not found, using no built-in profiles');
    }
  }

  /**
   * Register a planning profile
   * @param {Object} profile - The profile definition
   */
  async registerProfile(profile) {
    const validation = this.validateProfile(profile);
    if (!validation.isValid) {
      throw new Error(`Invalid profile ${profile.name}: ${validation.errors.join(', ')}`);
    }

    this.profiles.set(profile.name, profile);
  }

  /**
   * Get a profile by name
   * @param {string} name - Profile name
   * @returns {Object|null} The profile or null if not found
   */
  getProfile(name) {
    return this.profiles.get(name) || null;
  }

  /**
   * List all available profiles
   * @returns {Array} Array of profile information
   */
  listProfiles() {
    return Array.from(this.profiles.values()).map(profile => ({
      name: profile.name,
      description: profile.description,
      requiredModules: profile.requiredModules || [],
      actionCount: profile.allowableActions?.length || 0
    }));
  }

  /**
   * Prepare a profile for planning by ensuring required modules are loaded
   * @param {string} profileName - Name of the profile to prepare
   * @returns {Object} Prepared profile with resolved tools
   */
  async prepareProfile(profileName) {
    const profile = this.getProfile(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    console.log(`Preparing profile: ${profileName}`);

    // Load required modules if they're specified
    if (profile.requiredModules && profile.requiredModules.length > 0) {
      const moduleLoader = this.resourceManager.get('moduleLoader');
      if (moduleLoader) {
        console.log(`[ProfileManager] Loading required modules for ${profileName}:`, profile.requiredModules);
        
        const loadResults = { loaded: [], failed: [] };
        for (const moduleName of profile.requiredModules) {
          try {
            // Check if module is already loaded
            if (moduleLoader.hasModule(moduleName)) {
              console.log(`[ProfileManager] Module '${moduleName}' already loaded`);
              loadResults.loaded.push(moduleName);
            } else {
              // Try to load the module
              await moduleLoader.loadModuleByName(moduleName);
              console.log(`[ProfileManager] Successfully loaded module '${moduleName}'`);
              loadResults.loaded.push(moduleName);
            }
          } catch (error) {
            console.warn(`[ProfileManager] Failed to load required module '${moduleName}':`, error.message);
            loadResults.failed.push({ module: moduleName, error: error.message });
          }
        }
        
        // Add load results to profile
        profile.moduleLoadResults = loadResults;
        
        if (loadResults.failed.length > 0) {
          console.warn(`[ProfileManager] Some required modules failed to load for profile '${profileName}'`);
        }
      } else {
        console.warn('[ProfileManager] ModuleLoader not available, cannot load required modules');
      }
    }

    const preparedProfile = {
      ...profile,
      preparedAt: new Date().toISOString()
    };

    return preparedProfile;
  }

  /**
   * Create planning context from profile
   * @param {Object} profile - The prepared profile
   * @param {string} description - User's planning request
   * @returns {Promise<Object>} Planning context for LLM planner
   */
  async createPlanningContext(profile, description) {
    // Get actions dynamically from tools if using allowedTools
    let actions;
    
    if (profile.allowedTools && Array.isArray(profile.allowedTools)) {
      // New format: dynamically load tool schemas
      actions = await this._loadToolSchemas(profile.allowedTools);
    } else if (profile.allowableActions) {
      // Legacy format: use static definitions
      actions = profile.allowableActions;
    } else {
      throw new Error(`Profile ${profile.name} has neither allowedTools nor allowableActions`);
    }
    
    // Convert JSON profile actions to planner format
    const convertedActions = actions.map(action => {
      // Check if inputs/outputs are already arrays (old format) or objects (new JSON format)
      let inputKeys, outputKeys;
      
      if (Array.isArray(action.inputs)) {
        // Old format - already arrays
        inputKeys = action.inputs;
      } else {
        // New JSON format - extract keys from objects
        inputKeys = Object.keys(action.inputs || {});
      }
      
      if (Array.isArray(action.outputs)) {
        // Old format - already arrays
        outputKeys = action.outputs;
      } else {
        // New JSON format - extract keys from objects
        outputKeys = Object.keys(action.outputs || {});
      }
      
      const convertedAction = {
        type: action.type,
        description: action.description,
        inputs: inputKeys,
        outputs: outputKeys
      };
      
      // Preserve full input/output schemas if available (for better LLM prompts)
      if (!Array.isArray(action.inputs) && typeof action.inputs === 'object') {
        convertedAction.inputSchema = action.inputs;
      }
      if (!Array.isArray(action.outputs) && typeof action.outputs === 'object') {
        convertedAction.outputSchema = action.outputs;
      }
      
      // Mark required inputs
      if (convertedAction.inputSchema) {
        convertedAction.requiredInputs = [];
        for (const [key, schema] of Object.entries(convertedAction.inputSchema)) {
          if (schema.required !== false) {
            convertedAction.requiredInputs.push(key);
          }
        }
      }
      
      // Add examples if present
      if (action.examples) {
        convertedAction.examples = action.examples;
      }
      
      // Preserve tool and function fields if present (needed for execution)
      if (action.tool) {
        convertedAction.tool = action.tool;
      }
      if (action.function) {
        convertedAction.function = action.function;
      }
      
      return convertedAction;
    });

    // Validate and fix action types against available tools
    const validatedActions = await this._validateAndFixActionTypes(convertedActions);

    const context = {
      description: description,
      inputs: profile.defaultInputs || ['user_request'],
      requiredOutputs: profile.defaultOutputs || ['completed_task'],
      allowableActions: validatedActions,
      maxSteps: profile.maxSteps || 20,
      initialInputData: {
        user_request: description,
        profile_context: profile.contextPrompts?.join('\n') || ''
      }
    };

    // Add profile-specific context to the description
    if (profile.contextPrompts && profile.contextPrompts.length > 0) {
      context.description = `${profile.contextPrompts.join('\n')}\n\nTask: ${description}`;
    }

    console.log(`Created planning context for profile ${profile.name}:`);
    console.log(`- Actions: ${context.allowableActions.length}`);
    console.log(`- Max steps: ${context.maxSteps}`);
    console.log(`- Context prompts: ${profile.contextPrompts?.length || 0}`);

    return context;
  }

  /**
   * Validate a profile definition
   * @param {Object} profile - Profile to validate
   * @returns {Object} Validation result
   */
  validateProfile(profile) {
    const errors = [];

    if (!profile.name || typeof profile.name !== 'string') {
      errors.push('Profile must have a string name');
    }

    if (!profile.toolName || typeof profile.toolName !== 'string') {
      errors.push('Profile must have a string toolName');
    } else if (!/^[a-z][a-z0-9_]*$/.test(profile.toolName)) {
      errors.push('toolName must start with lowercase letter and contain only lowercase letters, numbers, and underscores');
    }

    if (!profile.description || typeof profile.description !== 'string') {
      errors.push('Profile must have a string description');
    }

    if (profile.requiredModules && !Array.isArray(profile.requiredModules)) {
      errors.push('requiredModules must be an array');
    }

    if (!profile.allowableActions || !Array.isArray(profile.allowableActions)) {
      errors.push('allowableActions must be an array and is required');
    } else {
      for (let i = 0; i < profile.allowableActions.length; i++) {
        const action = profile.allowableActions[i];
        if (!action.type || typeof action.type !== 'string') {
          errors.push(`allowableActions[${i}] must have a string type`);
        }
        if (!action.description || typeof action.description !== 'string') {
          errors.push(`allowableActions[${i}] must have a string description`);
        }
        if (!action.inputs || typeof action.inputs !== 'object') {
          errors.push(`allowableActions[${i}] must have inputs object`);
        }
        if (!action.outputs || typeof action.outputs !== 'object') {
          errors.push(`allowableActions[${i}] must have outputs object`);
        }
      }
    }

    if (profile.contextPrompts && !Array.isArray(profile.contextPrompts)) {
      errors.push('contextPrompts must be an array');
    }

    if (profile.maxSteps && (typeof profile.maxSteps !== 'number' || profile.maxSteps < 1)) {
      errors.push('maxSteps must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Dynamically load tool schemas from ModuleLoader
   * @private
   * @param {Array<string>} toolNames - List of tool names to load
   * @returns {Promise<Array>} Array of action definitions with full schemas
   */
  async _loadToolSchemas(toolNames) {
    // Get ModuleLoader from ResourceManager
    const moduleLoader = this.resourceManager.get('moduleLoader');
    if (!moduleLoader) {
      console.warn('ModuleLoader not available - cannot load tool schemas dynamically');
      return [];
    }

    const actions = [];
    const missingTools = [];

    for (const toolName of toolNames) {
      try {
        const tool = await moduleLoader.getToolByNameOrAlias(toolName);
        if (!tool) {
          missingTools.push(toolName);
          continue;
        }

        // Convert tool to action format
        const action = {
          type: tool.name,
          description: tool.description || `Execute ${tool.name}`,
          inputs: [],
          outputs: [],
          inputSchema: {},
          outputSchema: {}
        };

        // Extract schema information
        if (tool.inputSchema) {
          // Handle Zod schemas
          if (tool.inputSchema._def && tool.inputSchema._def.shape) {
            const shape = tool.inputSchema._def.shape();
            action.inputSchema = {};
            action.inputs = [];
            
            for (const [key, zodType] of Object.entries(shape)) {
              action.inputs.push(key);
              
              // Extract type information from Zod
              let type = 'string';
              let description = '';
              let required = true;
              
              if (zodType._def) {
                // Get base type
                if (zodType._def.typeName === 'ZodString') type = 'string';
                else if (zodType._def.typeName === 'ZodNumber') type = 'number';
                else if (zodType._def.typeName === 'ZodBoolean') type = 'boolean';
                else if (zodType._def.typeName === 'ZodArray') type = 'array';
                else if (zodType._def.typeName === 'ZodObject') type = 'object';
                else if (zodType._def.typeName === 'ZodOptional') {
                  required = false;
                  // Get inner type
                  if (zodType._def.innerType?._def?.typeName === 'ZodString') type = 'string';
                  else if (zodType._def.innerType?._def?.typeName === 'ZodNumber') type = 'number';
                  else if (zodType._def.innerType?._def?.typeName === 'ZodBoolean') type = 'boolean';
                }
                
                // Get description if available
                if (zodType._def.description) {
                  description = zodType._def.description;
                }
              }
              
              action.inputSchema[key] = {
                type,
                description,
                required
              };
            }
          } else if (tool.inputSchema.properties) {
            // JSON Schema format
            action.inputSchema = tool.inputSchema.properties;
            action.inputs = Object.keys(tool.inputSchema.properties);
            
            // Mark required fields
            if (tool.inputSchema.required) {
              for (const key of Object.keys(tool.inputSchema.properties)) {
                if (action.inputSchema[key]) {
                  action.inputSchema[key].required = tool.inputSchema.required.includes(key);
                }
              }
            }
          } else if (typeof tool.inputSchema === 'object') {
            // Direct object format
            action.inputSchema = tool.inputSchema;
            action.inputs = Object.keys(tool.inputSchema);
          }
        }

        // For outputs, we typically don't have detailed schemas, so use generic
        if (tool.outputSchema) {
          if (tool.outputSchema.properties) {
            action.outputSchema = tool.outputSchema.properties;
            action.outputs = Object.keys(tool.outputSchema.properties);
          } else if (typeof tool.outputSchema === 'object') {
            action.outputSchema = tool.outputSchema;
            action.outputs = Object.keys(tool.outputSchema);
          }
        } else {
          // Default outputs
          action.outputs = ['result', 'success'];
        }

        actions.push(action);
        console.log(`Loaded tool schema for: ${toolName}`);
      } catch (error) {
        console.warn(`Failed to load tool ${toolName}: ${error.message}`);
        missingTools.push(toolName);
      }
    }

    if (missingTools.length > 0) {
      console.warn(`Missing tools: ${missingTools.join(', ')}`);
    }

    return actions;
  }

  /**
   * Validate and fix action types against available tools
   * @param {Array} actions - Array of action objects
   * @returns {Promise<Array>} Array of validated actions with corrected tool names
   * @private
   */
  async _validateAndFixActionTypes(actions) {
    // Get ModuleLoader from ResourceManager
    const moduleLoader = this.resourceManager.get('moduleLoader');
    if (!moduleLoader) {
      console.warn('[ProfileManager] ModuleLoader not available, skipping tool validation');
      return actions;
    }

    const validatedActions = [];
    const warnings = [];
    const suggestions = [];

    for (const action of actions) {
      // Check if the action type exists as a tool
      const toolExists = await moduleLoader.hasToolByNameOrAlias(action.type);
      
      if (toolExists) {
        // Tool exists, use as-is
        validatedActions.push(action);
      } else {
        // Tool doesn't exist, try to find a replacement
        const actualTool = await this._findReplacementTool(moduleLoader, action.type);
        
        if (actualTool) {
          // Found a replacement, update the action
          const updatedAction = { ...action, type: actualTool };
          validatedActions.push(updatedAction);
          warnings.push(`Mapped '${action.type}' -> '${actualTool}'`);
        } else {
          // No replacement found, keep original but warn
          validatedActions.push(action);
          suggestions.push(`Tool '${action.type}' not available. Check profile configuration.`);
        }
      }
    }

    // Log warnings and suggestions
    if (warnings.length > 0) {
      console.log('[ProfileManager] Tool mappings applied:', warnings);
    }
    if (suggestions.length > 0) {
      console.warn('[ProfileManager] Tool validation issues:', suggestions);
    }

    return validatedActions;
  }

  /**
   * Find a replacement tool for an invalid action type
   * @param {ModuleLoader} moduleLoader - ModuleLoader instance
   * @param {string} actionType - Invalid action type
   * @returns {Promise<string|null>} Replacement tool name or null
   * @private
   */
  async _findReplacementTool(moduleLoader, actionType) {
    // Common mappings based on our analysis
    const commonMappings = {
      'execute_command': 'command_executor',
      'write_file': 'file_write',
      'read_file': 'file_read', 
      'create_directory': 'directory_create',
      'list_directory': 'directory_list',
      'validate_code': 'validate_javascript'
    };

    // Check direct mapping first
    if (commonMappings[actionType]) {
      const mapped = commonMappings[actionType];
      const exists = await moduleLoader.hasToolByNameOrAlias(mapped);
      if (exists) {
        return mapped;
      }
    }

    // Try to find similar tools by name matching
    const allTools = await moduleLoader.getAllToolNames(false);
    const actionParts = actionType.split('_');
    
    for (const tool of allTools) {
      // Check if tool contains any of the action parts
      if (actionParts.some(part => tool.includes(part))) {
        return tool;
      }
    }

    return null;
  }
}

export { ProfileManager };