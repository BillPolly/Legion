/**
 * Factory functions for easy unified-planner setup
 * 
 * Provides convenient functions to create pre-configured planner instances
 * similar to the original llm-planner and recursive-planner APIs.
 */

import { PlannerEngine, PlanningRequest } from './core/PlannerEngine.js';
import { LLMStrategy } from './strategies/LLMStrategy.js';
import { TemplateStrategy } from './strategies/TemplateStrategy.js';
import { RuleStrategy } from './strategies/RuleStrategy.js';
import { PromptTemplateLoader } from './templates/PromptTemplateLoader.js';

/**
 * Create a simple LLM-based planner (like original llm-planner)
 * @param {Object} llmClient - LLM client instance
 * @param {Object} options - Configuration options
 * @returns {Object} Configured planner with simple API
 */
export function createLLMPlanner(llmClient, options = {}) {
  // Create engine with LLM strategy
  const engine = new PlannerEngine({
    debugMode: options.debugMode,
    maxRetries: options.maxRetries,
    strictMode: options.strictMode
  });

  // Create and register LLM strategy
  const templateLoader = options.templateLoader || new PromptTemplateLoader(options.templatesDir);
  const llmStrategy = new LLMStrategy(llmClient, {
    templateLoader,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    debugMode: options.debugMode
  });

  engine.registerStrategy('llm', llmStrategy);

  // Return simple API (compatible with original llm-planner)
  return {
    /**
     * Create a BT plan (compatible with original createPlan API)
     * @param {Object} request - Planning request
     * @returns {Promise<Object>} Generated BT plan
     */
    async createPlan(request) {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      const result = await engine.createPlan(planningRequest, 'llm');
      return result.bt;
    },

    /**
     * Get engine statistics
     */
    getStats: () => engine.getStats(),
    
    /**
     * Access underlying engine for advanced usage
     */
    engine,
    
    /**
     * Create template loader (utility)
     */
    createTemplateLoader: (templatesDir) => new PromptTemplateLoader(templatesDir)
  };
}

/**
 * Create a multi-strategy planner (like original recursive-planner)
 * @param {Object} options - Configuration options
 * @returns {Object} Configured planner with multiple strategies
 */
export function createMultiStrategyPlanner(options = {}) {
  const engine = new PlannerEngine({
    debugMode: options.debugMode,
    maxRetries: options.maxRetries,
    strictMode: options.strictMode
  });

  // Register strategies based on options
  if (options.llmClient) {
    const templateLoader = options.templateLoader || new PromptTemplateLoader();
    const llmStrategy = new LLMStrategy(options.llmClient, {
      templateLoader,
      model: options.model,
      debugMode: options.debugMode
    });
    engine.registerStrategy('llm', llmStrategy);
  }

  if (options.templates) {
    const templateStrategy = new TemplateStrategy(options.templates, {
      debugMode: options.debugMode
    });
    engine.registerStrategy('template', templateStrategy);
  }

  if (options.rules || options.enableRules !== false) {
    const ruleStrategy = new RuleStrategy({
      debugMode: options.debugMode
    });
    
    // Add default rules if provided
    if (options.rules) {
      for (const [name, rule] of Object.entries(options.rules)) {
        ruleStrategy.addRule(name, rule.condition, rule.action, rule.options);
      }
    }
    
    engine.registerStrategy('rule', ruleStrategy);
  }

  return {
    /**
     * Create plan using specified strategy
     * @param {Object} request - Planning request
     * @param {string} strategy - Strategy name
     * @returns {Promise<Object>} Generated BT plan
     */
    async createPlan(request, strategy = 'llm') {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      const result = await engine.createPlan(planningRequest, strategy);
      return result.bt;
    },

    /**
     * Create multiple plans using different strategies
     * @param {Object} request - Planning request
     * @param {Array<string>} strategies - Strategy names
     * @returns {Promise<Array>} Generated plans
     */
    async createMultiplePlans(request, strategies) {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      return await engine.createMultiplePlans(planningRequest, strategies);
    },

    /**
     * Find best strategy for request
     * @param {Object} request - Planning request
     * @param {Array<string>} candidates - Candidate strategies
     * @returns {Promise<string>} Best strategy name
     */
    async selectBestStrategy(request, candidates) {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      return await engine.selectBestStrategy(planningRequest, candidates);
    },

    /**
     * Access individual strategies
     */
    getStrategy: (name) => engine.getStrategy(name),
    listStrategies: () => engine.listStrategies(),
    
    /**
     * Engine access
     */
    engine,
    
    /**
     * Get engine statistics
     */
    getStats: () => engine.getStats()
  };
}

/**
 * Create a template-based planner
 * @param {Object} templates - Template definitions
 * @param {Object} options - Configuration options
 * @returns {Object} Template-based planner
 */
export function createTemplatePlanner(templates = {}, options = {}) {
  const engine = new PlannerEngine({
    debugMode: options.debugMode,
    maxRetries: options.maxRetries || 1 // Templates usually don't need retries
  });

  const templateStrategy = new TemplateStrategy(templates, {
    debugMode: options.debugMode,
    caseSensitive: options.caseSensitive
  });

  engine.registerStrategy('template', templateStrategy);

  return {
    /**
     * Create plan using templates
     * @param {Object} request - Planning request
     * @returns {Promise<Object>} Generated BT plan
     */
    async createPlan(request) {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      const result = await engine.createPlan(planningRequest, 'template');
      return result.bt;
    },

    /**
     * Add template
     * @param {string} pattern - Pattern to match
     * @param {Object|Function} template - Template definition
     */
    addTemplate: (pattern, template) => templateStrategy.addTemplate(pattern, template),
    
    /**
     * Remove template
     * @param {string} pattern - Pattern to remove
     */
    removeTemplate: (pattern) => templateStrategy.removeTemplate(pattern),
    
    /**
     * List templates
     */
    listTemplates: () => templateStrategy.listTemplates(),
    
    /**
     * Strategy access
     */
    strategy: templateStrategy,
    engine
  };
}

/**
 * Create a rule-based planner
 * @param {Object} options - Configuration options
 * @returns {Object} Rule-based planner
 */
export function createRulePlanner(options = {}) {
  const engine = new PlannerEngine({
    debugMode: options.debugMode,
    maxRetries: options.maxRetries || 2
  });

  const ruleStrategy = new RuleStrategy({
    debugMode: options.debugMode,
    maxRulesApplied: options.maxRulesApplied,
    stopOnFirstMatch: options.stopOnFirstMatch
  });

  engine.registerStrategy('rule', ruleStrategy);

  return {
    /**
     * Create plan using rules
     * @param {Object} request - Planning request
     * @returns {Promise<Object>} Generated BT plan
     */
    async createPlan(request) {
      const planningRequest = request instanceof PlanningRequest 
        ? request 
        : new PlanningRequest(request);
      
      const result = await engine.createPlan(planningRequest, 'rule');
      return result.bt;
    },

    /**
     * Add rule
     * @param {string} name - Rule name
     * @param {Function} condition - Condition function
     * @param {Function} action - Action function
     * @param {Object} options - Rule options
     */
    addRule: (name, condition, action, options) => 
      ruleStrategy.addRule(name, condition, action, options),
    
    /**
     * Remove rule
     * @param {string} name - Rule name
     */
    removeRule: (name) => ruleStrategy.removeRule(name),
    
    /**
     * Enable/disable rule
     * @param {string} name - Rule name
     * @param {boolean} enabled - Enabled state
     */
    setRuleEnabled: (name, enabled) => ruleStrategy.setRuleEnabled(name, enabled),
    
    /**
     * List rules
     */
    listRules: () => ruleStrategy.listRules(),
    
    /**
     * Add predefined rule types
     */
    addKeywordRule: (name, keywords, action, options) =>
      ruleStrategy.addKeywordRule(name, keywords, action, options),
    
    addToolAvailabilityRule: (name, tools, action, options) =>
      ruleStrategy.addToolAvailabilityRule(name, tools, action, options),
    
    addComplexityRule: (name, minSteps, maxSteps, action, options) =>
      ruleStrategy.addComplexityRule(name, minSteps, maxSteps, action, options),
    
    /**
     * Strategy access
     */
    strategy: ruleStrategy,
    engine
  };
}

/**
 * Create a planning request object
 * @param {Object} params - Request parameters
 * @returns {PlanningRequest} Planning request instance
 */
export function createPlanningRequest(params) {
  return new PlanningRequest(params);
}

/**
 * Create default prompt template loader
 * @param {string} templatesDir - Templates directory
 * @returns {PromptTemplateLoader} Template loader instance
 */
export function createTemplateLoader(templatesDir = null) {
  return new PromptTemplateLoader(templatesDir);
}