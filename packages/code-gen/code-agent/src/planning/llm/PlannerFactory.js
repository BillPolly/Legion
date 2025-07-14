/**
 * PlannerFactory - Factory for creating configured LLM planners
 * 
 * This factory provides static methods for creating GenericLLMPlanner instances
 * configured for specific planning tasks (requirements, directory, dependencies, etc.).
 */

import { GenericLLMPlanner } from './GenericLLMPlanner.js';
import { RequirementAnalyzerConfig } from './configs/RequirementAnalyzerConfig.js';
// TODO: Import other configs as they're created
// import { DirectoryPlannerConfig } from './configs/DirectoryPlannerConfig.js';
// import { DependencyPlannerConfig } from './configs/DependencyPlannerConfig.js';
// import { FrontendArchitecturePlannerConfig } from './configs/FrontendArchitecturePlannerConfig.js';
// import { BackendArchitecturePlannerConfig } from './configs/BackendArchitecturePlannerConfig.js';
// import { APIInterfacePlannerConfig } from './configs/APIInterfacePlannerConfig.js';

class PlannerFactory {
  /**
   * Create a RequirementAnalyzer planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createRequirementAnalyzer(llmClient) {
    return new GenericLLMPlanner(llmClient, RequirementAnalyzerConfig);
  }

  /**
   * Create a DirectoryPlanner planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createDirectoryPlanner(llmClient) {
    // TODO: Implement when DirectoryPlannerConfig is ready
    throw new Error('DirectoryPlanner not yet implemented');
    // return new GenericLLMPlanner(llmClient, DirectoryPlannerConfig);
  }

  /**
   * Create a DependencyPlanner planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createDependencyPlanner(llmClient) {
    // TODO: Implement when DependencyPlannerConfig is ready
    throw new Error('DependencyPlanner not yet implemented');
    // return new GenericLLMPlanner(llmClient, DependencyPlannerConfig);
  }

  /**
   * Create a FrontendArchitecturePlanner planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createFrontendArchitecturePlanner(llmClient) {
    // TODO: Implement when FrontendArchitecturePlannerConfig is ready
    throw new Error('FrontendArchitecturePlanner not yet implemented');
    // return new GenericLLMPlanner(llmClient, FrontendArchitecturePlannerConfig);
  }

  /**
   * Create a BackendArchitecturePlanner planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createBackendArchitecturePlanner(llmClient) {
    // TODO: Implement when BackendArchitecturePlannerConfig is ready
    throw new Error('BackendArchitecturePlanner not yet implemented');
    // return new GenericLLMPlanner(llmClient, BackendArchitecturePlannerConfig);
  }

  /**
   * Create an APIInterfacePlanner planner
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createAPIInterfacePlanner(llmClient) {
    // TODO: Implement when APIInterfacePlannerConfig is ready
    throw new Error('APIInterfacePlanner not yet implemented');
    // return new GenericLLMPlanner(llmClient, APIInterfacePlannerConfig);
  }

  /**
   * Create a planner by type name
   * @param {string} plannerType - Type of planner to create
   * @param {Object} llmClient - LLM client instance
   * @returns {GenericLLMPlanner} Configured planner
   */
  static createPlannerByType(plannerType, llmClient) {
    switch (plannerType.toLowerCase()) {
      case 'requirement':
      case 'requirements':
      case 'requirementanalyzer':
        return this.createRequirementAnalyzer(llmClient);
      
      case 'directory':
      case 'directoryplanner':
        return this.createDirectoryPlanner(llmClient);
      
      case 'dependency':
      case 'dependencies':
      case 'dependencyplanner':
        return this.createDependencyPlanner(llmClient);
      
      case 'frontend':
      case 'frontendarchitecture':
      case 'frontendarchitectureplanner':
        return this.createFrontendArchitecturePlanner(llmClient);
      
      case 'backend':
      case 'backendarchitecture':
      case 'backendarchitectureplanner':
        return this.createBackendArchitecturePlanner(llmClient);
      
      case 'api':
      case 'apiinterface':
      case 'apiinterfaceplanner':
        return this.createAPIInterfacePlanner(llmClient);
      
      default:
        throw new Error(`Unknown planner type: ${plannerType}`);
    }
  }

  /**
   * Get list of available planner types
   * @returns {Array} Array of planner type names
   */
  static getAvailablePlannerTypes() {
    return [
      'RequirementAnalyzer',
      'DirectoryPlanner',
      'DependencyPlanner',
      'FrontendArchitecturePlanner',
      'BackendArchitecturePlanner',
      'APIInterfacePlanner'
    ];
  }

  /**
   * Get list of implemented planner types
   * @returns {Array} Array of implemented planner type names
   */
  static getImplementedPlannerTypes() {
    return [
      'RequirementAnalyzer'
      // TODO: Add others as they're implemented
    ];
  }

  /**
   * Check if a planner type is implemented
   * @param {string} plannerType - Type to check
   * @returns {boolean} True if implemented
   */
  static isImplemented(plannerType) {
    return this.getImplementedPlannerTypes().includes(plannerType);
  }
}

export { PlannerFactory };