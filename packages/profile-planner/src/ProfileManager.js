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
      const profileFiles = files.filter(file => file.endsWith('.js'));

      for (const file of profileFiles) {
        try {
          const profilePath = join(profilesDir, file);
          const profileModule = await import(profilePath);
          
          // Support both named and default exports
          const profile = profileModule.default || profileModule[Object.keys(profileModule)[0]];
          
          if (profile && profile.name) {
            await this.registerProfile(profile);
            console.log(`Loaded profile: ${profile.name}`);
          } else {
            console.warn(`Profile file ${file} does not export a valid profile`);
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

    // For now, just return the profile - module loading will be handled
    // by the user through the module_load command before using the profile
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
   * @returns {Object} Planning context for LLM planner
   */
  createPlanningContext(profile, description) {
    const context = {
      description: description,
      inputs: profile.defaultInputs || ['user_request'],
      requiredOutputs: profile.defaultOutputs || ['completed_task'],
      allowableActions: profile.allowableActions || [],
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

    if (!profile.description || typeof profile.description !== 'string') {
      errors.push('Profile must have a string description');
    }

    if (profile.requiredModules && !Array.isArray(profile.requiredModules)) {
      errors.push('requiredModules must be an array');
    }

    if (profile.allowableActions && !Array.isArray(profile.allowableActions)) {
      errors.push('allowableActions must be an array');
    }

    if (profile.allowableActions) {
      for (let i = 0; i < profile.allowableActions.length; i++) {
        const action = profile.allowableActions[i];
        if (!action.type || typeof action.type !== 'string') {
          errors.push(`allowableActions[${i}] must have a string type`);
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
}

export { ProfileManager };