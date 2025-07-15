/**
 * CodeAgentWrapper - Wrapper class to make CodeAgent work with JSON module system
 * 
 * This wrapper handles the async initialization of CodeAgent and provides
 * methods that match the JSON module tool definitions.
 */

import { CodeAgent } from './agent/CodeAgent.js';

/**
 * Wrapper class that provides a synchronous constructor interface
 * while handling CodeAgent's async initialization internally
 */
class CodeAgentWrapper {
  constructor(config = {}) {
    // Store config for later use
    this.config = config;
    
    // Track initialization state
    this._initialized = false;
    this._initializationPromise = null;
    this._agent = null;
    
    // Map to track working directories to agent instances
    this._agentInstances = new Map();
  }

  /**
   * Get or create an agent instance for a specific working directory
   * @private
   */
  async _getAgentForDirectory(workingDirectory) {
    // Check if we already have an agent for this directory
    if (this._agentInstances.has(workingDirectory)) {
      return this._agentInstances.get(workingDirectory);
    }

    // Create new agent instance
    const agent = new CodeAgent(this.config);
    
    // Initialize it with the working directory
    await agent.initialize(workingDirectory);
    
    // Cache for future use
    this._agentInstances.set(workingDirectory, agent);
    
    return agent;
  }

  /**
   * Develop a complete application from requirements
   * This method is called by the JSON module system
   */
  async develop(params) {
    // Handle case where params might be undefined
    if (!params) {
      throw new Error('Parameters are required for develop');
    }
    
    const { 
      workingDirectory, 
      task, 
      requirements = {}, 
      projectType,
      config = {} 
    } = params;

    try {
      // Merge config with instance config
      const mergedConfig = { ...this.config, ...config };
      if (projectType) {
        mergedConfig.projectType = projectType;
      }

      // Create agent with merged config
      const agent = new CodeAgent(mergedConfig);
      await agent.initialize(workingDirectory);

      // Prepare requirements object
      const developRequirements = {
        task,
        requirements
      };

      // Call develop method
      const result = await agent.develop(developRequirements);
      
      // Add working directory to result
      return {
        ...result,
        workingDirectory
      };
    } catch (error) {
      // Extract error details
      const errorPhase = error.message.includes('initialization') ? 'initialization' : 
                        error.message.includes('Planning') ? 'planning' :
                        error.message.includes('Generation') ? 'generation' :
                        error.message.includes('Testing') ? 'testing' :
                        error.message.includes('Quality') ? 'quality' :
                        error.message.includes('Fix') ? 'fixing' : 'unknown';
      
      // GenericTool expects the error to be thrown, not an object
      // The error message will be used by ToolResult.failure()
      throw new Error(error.message);
    }
  }

  /**
   * Fix specific errors in existing code
   * This method is called by the JSON module system
   */
  async fix(params) {
    // Handle case where params might be undefined
    if (!params) {
      throw new Error('Parameters are required for fix');
    }
    
    const { 
      workingDirectory, 
      errors = [], 
      requirements = {} 
    } = params;

    try {
      // Get or create agent for this directory
      const agent = await this._getAgentForDirectory(workingDirectory);

      // Prepare fix requirements
      const fixRequirements = {
        errors,
        ...requirements
      };

      // Call fix method
      const result = await agent.fix(fixRequirements);
      
      // Get list of modified files from agent state
      const modifiedFiles = agent.generatedFiles ? Array.from(agent.generatedFiles) : [];
      
      // Add files modified to result
      return {
        ...result,
        filesModified: modifiedFiles
      };
    } catch (error) {
      // Extract error details
      const errorPhase = error.message.includes('initialization') ? 'initialization' : 
                        error.message.includes('analyzing') ? 'analysis' :
                        error.message.includes('applying') ? 'fixing' :
                        error.message.includes('Quality') ? 'quality' : 'unknown';
      
      // GenericTool expects the error to be thrown, not an object
      // The error message will be used by ToolResult.failure()
      throw new Error(error.message);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Clean up all agent instances
    this._agentInstances.clear();
  }
}

export default CodeAgentWrapper;