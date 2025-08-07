/**
 * Factory functions for creating planners
 */

import { 
  TemplatePlanningStrategy,
  RuleBasedPlanningStrategy
} from '../core/execution/planning/index.js';

/**
 * Create a simple template-based planning strategy
 * @param {Object} templates - Planning templates
 * @returns {TemplatePlanningStrategy} Template planning strategy
 */
export function createTemplatePlanner(templates = {}) {
  return new TemplatePlanningStrategy(templates);
}

/**
 * Create a rule-based planning strategy
 * @param {Array} rules - Array of {condition, action} rule objects
 * @returns {RuleBasedPlanningStrategy} Rule-based planning strategy
 */
export function createRulePlanner(rules = []) {
  const planner = new RuleBasedPlanningStrategy();
  rules.forEach(rule => {
    planner.addRule(rule.condition, rule.action);
  });
  return planner;
}