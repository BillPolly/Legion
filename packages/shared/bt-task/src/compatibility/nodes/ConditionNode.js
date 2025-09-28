/**
 * ConditionNode - Compatibility wrapper for actor-BT migration
 * 
 * Wraps ConditionStrategy in a class interface compatible with actor-BT
 */

import { BehaviorTreeNode } from '../BehaviorTreeNode.js';
import { NodeStatus } from '../NodeStatus.js';

export class ConditionNode extends BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    if (!config.condition) {
      throw new Error('ConditionNode requires condition specification');
    }
    
    this.condition = config.condition;
  }

  async executeNode(context) {
    try {
      // Evaluate condition
      const conditionMet = await this.evaluateCondition(context);
      
      if (!conditionMet) {
        // Condition not met - skip children
        return {
          status: NodeStatus.SUCCESS,
          data: { conditionMet: false }
        };
      }
      
      // Condition met - execute children
      if (!this.children || this.children.length === 0) {
        return { 
          status: NodeStatus.SUCCESS, 
          data: { conditionMet: true }
        };
      }
      
      const results = [];
      
      for (const child of this.children) {
        const result = await child.execute(context);
        results.push(result);
        
        // Propagate failure
        if (result.status === NodeStatus.FAILURE) {
          return {
            status: NodeStatus.FAILURE,
            data: { conditionMet: true, results },
            error: result.error
          };
        }
        
        // Propagate running status
        if (result.status === NodeStatus.RUNNING) {
          return {
            status: NodeStatus.RUNNING,
            data: { conditionMet: true, results }
          };
        }
      }
      
      // All children succeeded
      return {
        status: NodeStatus.SUCCESS,
        data: { conditionMet: true, results }
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        error: `Condition evaluation failed: ${error.message}`
      };
    }
  }

  async evaluateCondition(context) {
    // Handle string conditions
    if (typeof this.condition === 'string') {
      // Check for artifact reference
      if (this.condition.startsWith('@')) {
        const value = this.resolveParams({ value: this.condition }, context).value;
        return !!value;
      }
      
      // Simple evaluation (in production, use a safer evaluator)
      try {
        // Create a safe evaluation context
        const evalContext = {
          artifacts: context.artifacts || {},
          ...context
        };
        
        // Replace @ references in the condition string
        let processedCondition = this.condition;
        const artifactPattern = /@(\w+(?:\.\w+)*)/g;
        processedCondition = processedCondition.replace(artifactPattern, (match, path) => {
          const resolved = this.resolveParams({ value: `@${path}` }, context).value;
          return JSON.stringify(resolved);
        });
        
        // Use Function constructor for safer evaluation than eval
        const evaluator = new Function('context', `
          with(context) {
            return ${processedCondition};
          }
        `);
        
        return evaluator(evalContext);
      } catch (error) {
        console.warn(`Condition evaluation error: ${error.message}`);
        return false;
      }
    }
    
    // Handle function conditions
    if (typeof this.condition === 'function') {
      return this.condition(context);
    }
    
    // Default to truthy check
    return !!this.condition;
  }

  getMetadata() {
    return {
      name: this.config.name || 'Condition',
      description: `Execute children if condition is met: ${this.condition}`,
      type: 'condition'
    };
  }
}