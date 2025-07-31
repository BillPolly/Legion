/**
 * PlanModuleAnalyzer - Analyzes plans to extract required modules and tools
 * 
 * This class handles all plan-specific logic for determining what modules
 * and tools are needed for plan execution. It keeps plan knowledge separate
 * from the general-purpose module loading system.
 */

export class PlanModuleAnalyzer {
  /**
   * Extract all required tool names from a plan
   * @param {Object} plan - The plan to analyze
   * @returns {Array<string>} Array of unique tool names required
   */
  extractRequiredTools(plan) {
    const tools = new Set();
    
    if (!plan || !plan.steps) {
      return [];
    }
    
    this._extractToolsFromSteps(plan.steps, tools);
    return Array.from(tools);
  }

  /**
   * Extract required modules from plan metadata
   * @param {Object} plan - The plan to analyze
   * @returns {Array<string>} Array of module names required
   */
  extractRequiredModules(plan) {
    if (!plan) {
      return [];
    }
    
    // Check for modules at plan level (newer format)
    if (plan.modules && Array.isArray(plan.modules)) {
      return plan.modules;
    }
    
    // Check for modules in metadata (older format)
    if (plan.metadata && plan.metadata.requiredModules) {
      return plan.metadata.requiredModules;
    }
    
    return [];
  }

  /**
   * Get essential modules that should always be loaded for plan execution
   * @returns {Array<string>} Array of essential module identifiers
   */
  getEssentialModules() {
    return ['file', 'command-executor'];
  }

  /**
   * Analyze a plan and return all module/tool requirements
   * @param {Object} plan - The plan to analyze
   * @returns {Object} Analysis result with requiredModules, requiredTools, and essentialModules
   */
  analyzePlan(plan) {
    return {
      requiredTools: this.extractRequiredTools(plan),
      requiredModules: this.extractRequiredModules(plan),
      essentialModules: this.getEssentialModules(),
      allRequiredModules: [
        ...this.getEssentialModules(),
        ...this.extractRequiredModules(plan)
      ]
    };
  }

  /**
   * Check if tools are missing from available tools
   * @param {Array<string>} requiredTools - Tools needed by the plan
   * @param {Array<string>} availableTools - Tools currently available
   * @returns {Array<string>} Array of missing tool names
   */
  findMissingTools(requiredTools, availableTools) {
    const availableSet = new Set(availableTools);
    return requiredTools.filter(tool => !availableSet.has(tool));
  }

  /**
   * Recursively extract tools from plan steps
   * @private
   * @param {Array} steps - Steps to analyze
   * @param {Set} tools - Set to collect tool names
   */
  _extractToolsFromSteps(steps, tools) {
    for (const step of steps) {
      // Extract tools from actions
      if (step.actions) {
        for (const action of step.actions) {
          // Use explicit tool name if present, otherwise use action type
          const toolName = action.tool || action.type;
          if (toolName) {
            tools.add(toolName);
          }
        }
      }
      
      // Recursively process nested steps
      if (step.steps && Array.isArray(step.steps)) {
        this._extractToolsFromSteps(step.steps, tools);
      }
    }
  }
}