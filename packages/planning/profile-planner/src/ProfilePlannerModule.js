/**
 * ProfilePlannerModule - Legion module for profile-based planning
 * 
 * Provides simplified planning interface with pre-configured development profiles
 * that automatically include required tools and domain-specific context prompts.
 */

import { Module } from '@legion/tools';
import { ProfilePlannerTool } from './tools/ProfilePlannerTool.js';
import { ProfileTool } from './tools/ProfileTool.js';
import { ProfileManager } from './ProfileManager.js';

export class ProfilePlannerModule extends Module {
  constructor(dependencies = {}) {
    super(); // Base Module constructor doesn't take dependencies
    this.name = 'ProfilePlannerModule';
    this.config = dependencies; // Store dependencies ourselves
    this.description = 'Profile-based planning for simplified domain-specific task planning';
    this.initialized = false;
  }

  /**
   * Static async factory method following the Async Resource Manager Pattern
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<ProfilePlannerModule>} Initialized module instance
   */
  static async create(resourceManager) {
    const dependencies = {
      resourceManager: resourceManager
    };

    const module = new ProfilePlannerModule(dependencies);
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize profile manager
    this.profileManager = new ProfileManager(this.config.resourceManager);
    await this.profileManager.initialize();
    
    // Initialize the meta tool (for listing profiles, etc.)
    this.profilePlannerTool = new ProfilePlannerTool(this.config);
    await this.profilePlannerTool.initialize();
    
    // Create a tool for each profile
    this.profileTools = [];
    const profiles = this.profileManager.listProfiles();
    
    for (const profileInfo of profiles) {
      const profile = this.profileManager.getProfile(profileInfo.name);
      const profileTool = new ProfileTool(profile, this.profileManager, this.config.resourceManager);
      this.profileTools.push(profileTool);
      console.log(`Created tool: ${profile.toolName} for ${profile.name} profile`);
    }
    
    this.initialized = true;
  }

  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tool instances
   */
  getTools() {
    // Return both the meta tool and all profile-specific tools
    return [
      this.profilePlannerTool,
      ...this.profileTools
    ];
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    // Cleanup resources if needed
    this.initialized = false;
  }

  /**
   * Get module metadata
   * @returns {Object} Module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: '0.0.1',
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'Profile-based planning',
        'Domain-specific context',
        'Pre-configured tool sets',
        'JavaScript development profile',
        'LLM-powered plan generation'
      ]
    };
  }
}

export default ProfilePlannerModule;