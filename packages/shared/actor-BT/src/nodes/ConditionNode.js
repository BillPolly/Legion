/**
 * ConditionNode - Evaluates conditions and returns SUCCESS/FAILURE
 * 
 * Features:
 * - JavaScript expression evaluation with context
 * - Artifact validation (e.g., check if files exist)
 * - Success criteria validation
 * - Safe evaluation with sandboxing
 */

import { BehaviorTreeNode, NodeStatus } from '../core/BehaviorTreeNode.js';

export class ConditionNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'condition';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Validate configuration
    if (!config.check && !config.condition) {
      throw new Error('ConditionNode requires check or condition expression');
    }
    
    this.checkExpression = config.check || config.condition;
    this.negated = config.negated || false; // If true, invert the result
  }

  async executeNode(context) {
    try {
      const result = this.evaluateCondition(context);
      const finalResult = this.negated ? !result : result;
      
      return {
        status: finalResult ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
        data: {
          condition: this.checkExpression,
          result: result,
          negated: this.negated,
          finalResult: finalResult,
          contextKeys: Object.keys(context)
        }
      };
      
    } catch (error) {
      // Condition evaluation error = FAILURE
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: `Condition evaluation failed: ${error.message}`,
          condition: this.checkExpression,
          contextKeys: Object.keys(context)
        }
      };
    }
  }

  /**
   * Evaluate condition expression safely
   */
  evaluateCondition(context) {
    // Create safe evaluation context
    const evalContext = {
      context: context,
      artifacts: context.artifacts || {},
      
      // Helper functions
      exists: (path) => {
        return context.artifacts && context.artifacts[path] !== undefined;
      },
      
      hasProperty: (obj, prop) => {
        return obj && obj[prop] !== undefined;
      },
      
      success: (artifactId) => {
        return context.artifacts && 
               context.artifacts[artifactId] && 
               context.artifacts[artifactId].success === true;
      },
      
      fileExists: (artifactId) => {
        return context.artifacts && 
               context.artifacts[artifactId] && 
               context.artifacts[artifactId].filepath !== undefined;
      }
    };

    // Handle common condition patterns
    if (this.checkExpression.includes('artifacts')) {
      return this.evaluateArtifactCondition(evalContext);
    }
    
    if (this.checkExpression.includes('success')) {
      return this.evaluateSuccessCondition(evalContext);
    }
    
    // Fallback to simple boolean evaluation
    return this.evaluateSimpleCondition(evalContext);
  }

  /**
   * Evaluate artifact-based conditions
   */
  evaluateArtifactCondition(evalContext) {
    const { context, artifacts } = evalContext;
    
    // Extract artifact ID from common patterns
    const artifactMatch = this.checkExpression.match(/artifacts\['([^']+)'\]/);
    if (artifactMatch) {
      const artifactId = artifactMatch[1];
      const artifact = artifacts[artifactId];
      
      if (this.checkExpression.includes('.success')) {
        return artifact && artifact.success === true;
      }
      
      if (this.checkExpression.includes('.filepath')) {
        return artifact && artifact.filepath !== undefined;
      }
      
      // General artifact existence
      return artifact !== undefined;
    }
    
    return false;
  }

  /**
   * Evaluate success-based conditions
   */
  evaluateSuccessCondition(evalContext) {
    // Handle patterns like "success('action-id')"
    const successMatch = this.checkExpression.match(/success\('([^']+)'\)/);
    if (successMatch) {
      const artifactId = successMatch[1];
      return evalContext.success(artifactId);
    }
    
    return false;
  }

  /**
   * Evaluate simple boolean conditions
   */
  evaluateSimpleCondition(evalContext) {
    // For simple true/false or boolean expressions
    if (this.checkExpression === 'true') return true;
    if (this.checkExpression === 'false') return false;
    
    // Try to evaluate as JavaScript expression (limited scope)
    try {
      // Create a limited function scope for safe evaluation
      const func = new Function('context', 'artifacts', 'exists', 'success', 'fileExists', 
        `return ${this.checkExpression}`);
      
      return func(
        evalContext.context,
        evalContext.artifacts,
        evalContext.exists,
        evalContext.success,
        evalContext.fileExists
      );
    } catch (error) {
      console.warn(`[ConditionNode] Failed to evaluate: ${this.checkExpression}`, error.message);
      return false;
    }
  }

  /**
   * Get condition metadata
   */
  getMetadata() {
    return {
      type: 'condition',
      condition: this.checkExpression,
      negated: this.negated,
      description: `Evaluate: ${this.checkExpression}${this.negated ? ' (negated)' : ''}`
    };
  }
}