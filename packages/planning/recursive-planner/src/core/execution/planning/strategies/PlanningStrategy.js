/**
 * Planning strategy interface and base implementations
 */

import { PlanStep } from '../../../../foundation/types/interfaces/interfaces.js';
import { PlanningError } from '../../../../foundation/types/errors/errors.js';
import { ValidationUtils } from '../../../../foundation/utils/validation/ValidationUtils.js';
import { IdGenerator } from '../../../../foundation/utils/generators/IdGenerator.js';
import { PromptBuilder } from '../prompts/PromptBuilder.js';

/**
 * Base planning strategy interface
 */
export class PlanningStrategy {
  constructor() {
    if (new.target === PlanningStrategy) {
      throw new Error('PlanningStrategy is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Generate a plan for achieving the goal
   * @param {string} goal - The goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array<PlanStep>>} Generated plan
   */
  async generatePlan(goal, tools, context) {
    throw new Error('generatePlan method must be implemented by subclass');
  }

  /**
   * Replan after a failure or change
   * @param {Array<PlanStep>} currentPlan - Current plan
   * @param {PlanStep} failedStep - Step that failed
   * @param {Object} context - Current context
   * @returns {Promise<Array<PlanStep>>} Updated plan
   */
  async replan(currentPlan, failedStep, context) {
    throw new Error('replan method must be implemented by subclass');
  }

  /**
   * Optimize plan for better execution
   * @param {Array<PlanStep>} plan - Plan to optimize
   * @returns {Promise<Array<PlanStep>>} Optimized plan
   */
  async optimizePlan(plan) {
    return plan; // Default: no optimization
  }

  /**
   * Validate a generated plan
   * @param {Array<PlanStep>} plan - Plan to validate
   * @param {Array<Executable>} tools - Available tools
   * @throws {PlanningError} If plan is invalid
   */
  validatePlan(plan, tools) {
    ValidationUtils.array(plan, 'plan');
    
    if (plan.length === 0) {
      throw new PlanningError('Plan cannot be empty');
    }

    const toolNames = new Set(tools.map(t => t.name));
    const stepIds = new Set();
    
    for (const step of plan) {
      ValidationUtils.planStep(step);
      
      // Check for duplicate step IDs
      if (stepIds.has(step.id)) {
        throw new PlanningError(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
      
      // Check if tool exists
      if (!toolNames.has(step.tool)) {
        throw new PlanningError(`Tool not available: ${step.tool}`);
      }
      
      // Check dependencies
      for (const depId of step.dependencies || []) {
        if (!stepIds.has(depId)) {
          // Dependencies must reference existing steps that come before this one
          const depExists = plan.slice(0, plan.indexOf(step)).some(s => s.id === depId);
          if (!depExists) {
            throw new PlanningError(`Invalid dependency: ${depId} for step ${step.id}`);
          }
        }
      }
    }
  }

  /**
   * Analyze plan for parallel execution opportunities
   * @param {Array<PlanStep>} plan - Plan to analyze
   * @returns {Array<Array<string>>} Groups of step IDs that can run in parallel
   */
  findParallelGroups(plan) {
    const groups = [];
    const processed = new Set();
    
    while (processed.size < plan.length) {
      const currentGroup = [];
      
      for (const step of plan) {
        if (processed.has(step.id)) continue;
        
        // Check if all dependencies are already processed
        const canRun = (step.dependencies || []).every(depId => processed.has(depId));
        
        if (canRun) {
          currentGroup.push(step.id);
        }
      }
      
      if (currentGroup.length === 0) {
        // Circular dependency or other issue
        break;
      }
      
      groups.push(currentGroup);
      currentGroup.forEach(id => processed.add(id));
    }
    
    return groups;
  }
}

/**
 * Simple template-based planning strategy
 */
export class TemplatePlanningStrategy extends PlanningStrategy {
  constructor(templates = {}) {
    super();
    this.templates = templates;
  }

  /**
   * Add a planning template
   * @param {string} pattern - Goal pattern to match
   * @param {Array<Object>} template - Template plan steps
   */
  addTemplate(pattern, template) {
    this.templates[pattern] = template;
  }

  /**
   * Generate plan using templates
   * @param {string} goal - Goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array<PlanStep>>} Generated plan
   */
  async generatePlan(goal, tools, context) {
    const toolNames = new Set(tools.map(t => t.name));
    
    // Find matching template
    let matchedTemplate = null;
    for (const [pattern, template] of Object.entries(this.templates)) {
      if (this.matchesPattern(goal, pattern)) {
        matchedTemplate = template;
        break;
      }
    }
    
    if (!matchedTemplate) {
      throw new PlanningError(`No template found for goal: ${goal}`);
    }
    
    // Create plan steps from template
    const plan = matchedTemplate.map((templateStep, index) => {
      // Check if required tool is available
      if (!toolNames.has(templateStep.tool)) {
        throw new PlanningError(`Required tool not available: ${templateStep.tool}`);
      }
      
      return new PlanStep(
        templateStep.id || IdGenerator.generateStepId(`template_${index}`),
        templateStep.description,
        templateStep.tool,
        templateStep.params || {},
        templateStep.dependencies || [],
        templateStep.saveOutputs || null
      );
    });
    
    this.validatePlan(plan, tools);
    return plan;
  }

  /**
   * Check if goal matches pattern
   * @param {string} goal - Goal string
   * @param {string} pattern - Pattern to match
   * @returns {boolean} True if matches
   */
  matchesPattern(goal, pattern) {
    // Simple keyword matching - could be enhanced with regex
    const goalLower = goal.toLowerCase();
    const patternLower = pattern.toLowerCase();
    return goalLower.includes(patternLower);
  }

  async replan(currentPlan, failedStep, context) {
    // For template strategy, just regenerate from template
    return this.generatePlan(context.goal, context.tools, context);
  }
}

/**
 * Rule-based planning strategy
 */
export class RuleBasedPlanningStrategy extends PlanningStrategy {
  constructor() {
    super();
    this.rules = [];
  }

  /**
   * Add a planning rule
   * @param {Function} condition - Function that returns true if rule applies
   * @param {Function} action - Function that returns plan steps
   */
  addRule(condition, action) {
    ValidationUtils.function(condition, 'condition');
    ValidationUtils.function(action, 'action');
    
    this.rules.push({ condition, action });
  }

  /**
   * Generate plan using rules
   * @param {string} goal - Goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array<PlanStep>>} Generated plan
   */
  async generatePlan(goal, tools, context) {
    const planContext = { goal, tools, context };
    const plan = [];
    
    // Apply all matching rules
    for (const rule of this.rules) {
      if (rule.condition(planContext)) {
        const steps = await rule.action(planContext);
        if (Array.isArray(steps)) {
          plan.push(...steps);
        } else if (steps) {
          plan.push(steps);
        }
      }
    }
    
    if (plan.length === 0) {
      throw new PlanningError(`No rules generated steps for goal: ${goal}`);
    }
    
    this.validatePlan(plan, tools);
    return plan;
  }

  async replan(currentPlan, failedStep, context) {
    // Re-run rule-based planning with updated context
    const updatedContext = {
      ...context,
      failedStep,
      currentPlan
    };
    
    return this.generatePlan(context.goal, context.tools, updatedContext);
  }
}

/**
 * LLM-based planning strategy for complex reasoning
 */
export class LLMPlanningStrategy extends PlanningStrategy {
  constructor(llm, options = {}) {
    super();
    this.llm = llm;
    this.maxRetries = options.maxRetries || 2;
    this.examples = options.examples || [];
    this.includeResourceEstimation = options.includeResourceEstimation || false;
    this.promptBuilder = new PromptBuilder({
      debugMode: options.debugMode || false
    });
  }

  /**
   * Generate plan using LLM reasoning
   * @param {string} goal - Goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array<PlanStep>>} Generated plan
   */
  async generatePlan(goal, tools, context) {
    if (!this.llm) {
      throw new PlanningError('LLM provider not configured for LLM planning strategy');
    }

    // Check if this is a fix request with a specialized prompt
    if (context.fixPrompt) {
      console.log(`[LLM Planning] Using fix prompt for plan correction`);
      
      try {
        const response = await this.llm.complete(context.fixPrompt, {
          temperature: 0.2, // Even lower temperature for fixing
          maxTokens: 2000
        });
        
        const plan = this._parsePlanResponse(response);
        this.validatePlan(plan, tools);
        
        console.log(`[LLM Planning] Generated fixed plan with ${plan.length} steps`);
        return plan;
      } catch (error) {
        throw new PlanningError(`Failed to fix plan: ${error.message}`, goal, tools);
      }
    }

    // Use PromptBuilder to generate prompt with examples and validation feedback
    const enhancedContext = { 
      ...context, 
      examples: this.examples,
      attemptNumber: context.attemptNumber || 1
    };
    
    const prompt = this.promptBuilder.buildPlanningPrompt(goal, tools, enhancedContext);
    
    try {
      console.log(`[LLM Planning] Attempt ${enhancedContext.attemptNumber} for goal: ${goal.substring(0, 50)}...`);
      
      const response = await this.llm.complete(prompt, {
        temperature: 0.3, // Lower temperature for more consistent planning
        maxTokens: 2000
      });
      
      const plan = this._parsePlanResponse(response);
      
      // Do basic validation here (Planner will do comprehensive validation)
      this.validatePlan(plan, tools);
      
      console.log(`[LLM Planning] Generated plan with ${plan.length} steps`);
      return plan;
      
    } catch (error) {
      console.warn(`[LLM Planning] Failed: ${error.message}`);
      throw new PlanningError(`LLM planning failed: ${error.message}`, goal, tools);
    }
  }

  async replan(currentPlan, failedStep, context) {
    if (!this.llm) {
      throw new PlanningError('LLM provider not configured for replanning');
    }

    const replanPrompt = this.promptBuilder.buildReplanningPrompt(currentPlan, failedStep, context);
    
    try {
      const response = await this.llm.complete(replanPrompt, {
        temperature: 0.4,
        maxTokens: 1500
      });
      
      const newPlan = this._parsePlanResponse(response);
      this.validatePlan(newPlan, context.tools);
      
      console.log(`[LLM Replanning] Generated new plan with ${newPlan.length} steps`);
      return newPlan;
      
    } catch (error) {
      console.error(`[LLM Replanning] Failed: ${error.message}`);
      throw new PlanningError(`LLM replanning failed: ${error.message}`, context.goal, context.tools);
    }
  }


  /**
   * Parse LLM response into plan steps
   * @param {string} response - LLM response
   * @returns {Array<PlanStep>} Parsed plan steps
   */
  _parsePlanResponse(response) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = response.trim();
      
      // Handle markdown code blocks - more flexible regex
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }
      
      // Find JSON array in response - handle whitespace better
      const jsonMatch = jsonText.match(/(\[[\s\S]*\])/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      
      // Clean up any trailing content after the JSON - be more conservative
      const cleanJson = jsonText.trim();
      
      
      const planData = JSON.parse(cleanJson);
      
      if (!Array.isArray(planData)) {
        throw new Error('Plan response must be an array');
      }
      
      // Convert to PlanStep objects
      const plan = planData.map((stepData, index) => {
        this._validateStepData(stepData, index);
        
        return new PlanStep(
          stepData.id,
          stepData.description,
          stepData.tool,
          stepData.params || {},
          stepData.dependencies || [],
          stepData.saveOutputs || null
        );
      });
      
      return plan;
      
    } catch (error) {
      throw new PlanningError(`Failed to parse LLM plan response: ${error.message}. Response: ${response.substring(0, 200)}...`);
    }
  }

  /**
   * Validate individual step data from LLM response
   * @param {Object} stepData - Step data to validate
   * @param {number} index - Step index for error reporting
   */
  _validateStepData(stepData, index) {
    if (!stepData.id || typeof stepData.id !== 'string') {
      throw new Error(`Step ${index}: 'id' must be a non-empty string`);
    }
    
    if (!stepData.description || typeof stepData.description !== 'string') {
      throw new Error(`Step ${index}: 'description' must be a non-empty string`);
    }
    
    if (!stepData.tool || typeof stepData.tool !== 'string') {
      throw new Error(`Step ${index}: 'tool' must be a non-empty string`);
    }
    
    if (stepData.params && typeof stepData.params !== 'object') {
      throw new Error(`Step ${index}: 'params' must be an object`);
    }
    
    if (stepData.dependencies && !Array.isArray(stepData.dependencies)) {
      throw new Error(`Step ${index}: 'dependencies' must be an array`);
    }
  }

}

/**
 * Sequential planning strategy (simplest implementation)
 */
export class SequentialPlanningStrategy extends PlanningStrategy {
  constructor(defaultTool = null) {
    super();
    this.defaultTool = defaultTool;
  }

  /**
   * Generate simple sequential plan
   * @param {string} goal - Goal to achieve
   * @param {Array<Executable>} tools - Available tools
   * @param {Object} context - Execution context
   * @returns {Promise<Array<PlanStep>>} Generated plan
   */
  async generatePlan(goal, tools, context) {
    if (tools.length === 0) {
      throw new PlanningError('No tools available for planning');
    }
    
    // Create a simple sequential plan using available tools
    const plan = [];
    const toolToUse = this.defaultTool || tools[0].name;
    
    // Check if tool exists
    if (!tools.some(t => t.name === toolToUse)) {
      throw new PlanningError(`Default tool not available: ${toolToUse}`);
    }
    
    // Create a single step that uses the goal as input
    const step = new PlanStep(
      IdGenerator.generateStepId('sequential'),
      `Execute goal: ${goal}`,
      toolToUse,
      { goal, context }
    );
    
    plan.push(step);
    
    this.validatePlan(plan, tools);
    return plan;
  }

  async replan(currentPlan, failedStep, context) {
    // For sequential strategy, just retry with the same plan
    return currentPlan.map(step => {
      if (step.id === failedStep.id) {
        // Reset the failed step
        const newStep = new PlanStep(
          step.id,
          step.description,
          step.tool,
          step.params,
          step.dependencies
        );
        return newStep;
      }
      return step;
    });
  }
}