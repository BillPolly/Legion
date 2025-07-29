/**
 * ProfilePlannerModule - Legion module for profile-based planning
 * 
 * Provides simplified planning interface with pre-configured development profiles
 * that automatically include required tools and domain-specific context prompts.
 */

import { Module } from '@legion/module-loader';
import { ProfilePlannerTool } from './tools/ProfilePlannerTool.js';

export class ProfilePlannerModule extends Module {
  constructor(dependencies = {}) {
    super();
    this.name = 'profile-planner';
    this.description = 'Profile-based planning for simplified domain-specific task planning';
    this.dependencies = dependencies;
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
    console.log('ProfilePlannerModule initializing...');
    
    // Initialize tools
    this.profilePlannerTool = new ProfilePlannerTool(this.dependencies);
    await this.profilePlannerTool.initialize();
    
    console.log('ProfilePlannerModule initialized');
  }

  /**
   * Get all tools provided by this module
   * @returns {Array} Array of tool instances
   */
  getTools() {
    return [
      this.profilePlannerTool
    ];
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