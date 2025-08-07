/**
 * RuleStrategy - Rule-based BT generation strategy
 * 
 * Uses conditional rules to generate BT structures based on:
 * - Goal patterns and keywords
 * - Available actions
 * - Context conditions
 * - Resource constraints
 */

import { PlanningStrategy } from './PlanningStrategy.js';

/**
 * Planning rule definition
 */
export class PlanningRule {
  constructor(name, condition, action, options = {}) {
    this.name = name;
    this.condition = condition; // Function that returns boolean
    this.action = action;       // Function that returns BT structure or nodes
    this.priority = options.priority || 0;
    this.enabled = options.enabled !== false;
    this.description = options.description || `Rule: ${name}`;
    this.tags = options.tags || [];
  }

  /**
   * Check if rule matches the planning context
   * @param {Object} context - Planning context
   * @returns {Promise<boolean>} True if rule applies
   */
  async matches(context) {
    if (!this.enabled) return false;
    
    try {
      const result = await this.condition(context);
      return Boolean(result);
    } catch (error) {
      console.warn(`Rule '${this.name}' condition failed:`, error.message);
      return false;
    }
  }

  /**
   * Execute rule action to generate BT nodes
   * @param {Object} context - Planning context
   * @returns {Promise<Object|Array>} BT structure or array of nodes
   */
  async execute(context) {
    try {
      return await this.action(context);
    } catch (error) {
      throw new Error(`Rule '${this.name}' execution failed: ${error.message}`);
    }
  }
}

export class RuleStrategy extends PlanningStrategy {
  constructor(options = {}) {
    super(options);
    this.rules = [];
    this.maxRulesApplied = options.maxRulesApplied || 10;
    this.stopOnFirstMatch = options.stopOnFirstMatch || false;
    this.sortByPriority = options.sortByPriority !== false;
  }

  /**
   * Add a planning rule
   * @param {string} name - Rule name
   * @param {Function} condition - Condition function
   * @param {Function} action - Action function
   * @param {Object} options - Rule options
   */
  addRule(name, condition, action, options = {}) {
    const rule = new PlanningRule(name, condition, action, options);
    this.rules.push(rule);
    
    // Sort by priority if enabled
    if (this.sortByPriority) {
      this.rules.sort((a, b) => b.priority - a.priority);
    }
    
    this.debug(`Added rule: ${name} (priority: ${rule.priority})`);
  }

  /**
   * Remove a rule by name
   * @param {string} name - Rule name
   * @returns {boolean} True if rule was removed
   */
  removeRule(name) {
    const index = this.rules.findIndex(rule => rule.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.debug(`Removed rule: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable a rule
   * @param {string} name - Rule name
   * @param {boolean} enabled - Enable state
   */
  setRuleEnabled(name, enabled) {
    const rule = this.rules.find(r => r.name === name);
    if (rule) {
      rule.enabled = enabled;
      this.debug(`Rule '${name}' ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get rule by name
   * @param {string} name - Rule name
   * @returns {PlanningRule|null} Rule instance
   */
  getRule(name) {
    return this.rules.find(rule => rule.name === name) || null;
  }

  /**
   * List all rules
   * @returns {Array} Rule information
   */
  listRules() {
    return this.rules.map(rule => ({
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      description: rule.description,
      tags: rule.tags
    }));
  }

  /**
   * Generate BT using rule-based approach
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBT(request, context = {}) {
    this.debug(`Applying rules for: ${request.description}`);
    
    const planningContext = {
      request,
      goal: request.description,
      inputs: request.inputs,
      outputs: request.requiredOutputs,
      actions: request.allowableActions,
      maxSteps: request.maxSteps,
      context,
      strategy: this
    };
    
    // Find matching rules
    const matchingRules = await this.findMatchingRules(planningContext);
    
    if (matchingRules.length === 0) {
      throw new Error(`No rules matched for goal: ${request.description}`);
    }
    
    this.debug(`Found ${matchingRules.length} matching rules`);
    
    // Execute rules to generate BT structure
    const bt = await this.executeRules(matchingRules, planningContext);
    
    return this.applyBTDefaults(bt);
  }

  /**
   * Find all rules that match the planning context
   * @param {Object} context - Planning context
   * @returns {Promise<Array>} Matching rules
   */
  async findMatchingRules(context) {
    const matching = [];
    
    for (const rule of this.rules) {
      if (await rule.matches(context)) {
        matching.push(rule);
        
        if (this.stopOnFirstMatch) {
          break;
        }
      }
    }
    
    return matching;
  }

  /**
   * Execute rules to generate BT structure
   * @param {Array} rules - Rules to execute
   * @param {Object} context - Planning context
   * @returns {Promise<Object>} Generated BT structure
   */
  async executeRules(rules, context) {
    const results = [];
    let rulesApplied = 0;
    
    for (const rule of rules) {
      if (rulesApplied >= this.maxRulesApplied) {
        this.debug(`Reached max rules limit (${this.maxRulesApplied})`);
        break;
      }
      
      try {
        this.debug(`Executing rule: ${rule.name}`);
        const result = await rule.execute(context);
        
        if (result) {
          results.push({ rule: rule.name, result });
          rulesApplied++;
        }
      } catch (error) {
        this.debug(`Rule '${rule.name}' failed: ${error.message}`);
        // Continue with other rules
      }
    }
    
    if (results.length === 0) {
      throw new Error('No rules generated valid BT structures');
    }
    
    // Combine results into final BT structure
    return this.combineRuleResults(results, context);
  }

  /**
   * Combine multiple rule results into a single BT
   * @param {Array} results - Rule execution results
   * @param {Object} context - Planning context
   * @returns {Object} Combined BT structure
   */
  combineRuleResults(results, context) {
    if (results.length === 1) {
      // Single result - return directly
      return results[0].result;
    }
    
    // Multiple results - combine into sequence by default
    const children = results.map((r, index) => {
      if (r.result.type) {
        // Full BT node
        return r.result;
      } else if (Array.isArray(r.result)) {
        // Array of actions - create sequence
        return this.createSequentialBT(r.result, {
          id: `rule_${index}_${r.rule}`,
          description: `Generated by rule: ${r.rule}`
        });
      } else {
        // Single action
        return {
          type: 'action',
          id: `rule_${index}_${r.rule}`,
          ...r.result
        };
      }
    });
    
    return {
      type: 'sequence',
      id: 'rule_based_plan',
      description: `Combined plan from rules: ${results.map(r => r.rule).join(', ')}`,
      children
    };
  }

  /**
   * Check if strategy can handle request
   * @param {PlanningRequest} request - Planning request
   * @returns {Promise<boolean>} True if rules can handle request
   */
  async canHandle(request) {
    const context = {
      request,
      goal: request.description,
      actions: request.allowableActions
    };
    
    const matchingRules = await this.findMatchingRules(context);
    return matchingRules.length > 0;
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      name: this.name || 'RuleStrategy',
      type: 'rule-based',
      description: 'Rule-based BT generation with conditional logic',
      capabilities: ['bt-generation', 'conditional-logic', 'rule-composition'],
      ruleCount: this.rules.length,
      enabledRules: this.rules.filter(r => r.enabled).length,
      maxRulesApplied: this.maxRulesApplied,
      stopOnFirstMatch: this.stopOnFirstMatch,
      rules: this.listRules()
    };
  }

  // Predefined rule builders

  /**
   * Create keyword matching rule
   * @param {string} name - Rule name
   * @param {Array<string>} keywords - Keywords to match
   * @param {Function} action - Action function
   * @param {Object} options - Rule options
   */
  addKeywordRule(name, keywords, action, options = {}) {
    const condition = (context) => {
      const goal = context.goal.toLowerCase();
      return keywords.some(keyword => goal.includes(keyword.toLowerCase()));
    };
    
    this.addRule(name, condition, action, {
      description: `Matches keywords: ${keywords.join(', ')}`,
      tags: ['keyword-matching'],
      ...options
    });
  }

  /**
   * Create tool availability rule
   * @param {string} name - Rule name
   * @param {Array<string>} requiredTools - Required tools
   * @param {Function} action - Action function
   * @param {Object} options - Rule options
   */
  addToolAvailabilityRule(name, requiredTools, action, options = {}) {
    const condition = (context) => {
      const availableTools = new Set(context.actions.map(a => a.type || a.name));
      return requiredTools.every(tool => availableTools.has(tool));
    };
    
    this.addRule(name, condition, action, {
      description: `Requires tools: ${requiredTools.join(', ')}`,
      tags: ['tool-availability'],
      ...options
    });
  }

  /**
   * Create complexity rule
   * @param {string} name - Rule name
   * @param {number} minSteps - Minimum steps
   * @param {number} maxSteps - Maximum steps
   * @param {Function} action - Action function
   * @param {Object} options - Rule options
   */
  addComplexityRule(name, minSteps, maxSteps, action, options = {}) {
    const condition = (context) => {
      return context.maxSteps >= minSteps && context.maxSteps <= maxSteps;
    };
    
    this.addRule(name, condition, action, {
      description: `For ${minSteps}-${maxSteps} steps`,
      tags: ['complexity-based'],
      ...options
    });
  }

  /**
   * Create input/output rule
   * @param {string} name - Rule name
   * @param {Array<string>} inputs - Required inputs
   * @param {Array<string>} outputs - Required outputs
   * @param {Function} action - Action function
   * @param {Object} options - Rule options
   */
  addIORule(name, inputs, outputs, action, options = {}) {
    const condition = (context) => {
      const hasInputs = inputs.length === 0 || inputs.every(input => 
        context.inputs.includes(input)
      );
      const hasOutputs = outputs.length === 0 || outputs.every(output => 
        context.outputs.includes(output)
      );
      return hasInputs && hasOutputs;
    };
    
    this.addRule(name, condition, action, {
      description: `I/O: ${inputs.join(',')} → ${outputs.join(',')}`,
      tags: ['input-output-based'],
      ...options
    });
  }
}