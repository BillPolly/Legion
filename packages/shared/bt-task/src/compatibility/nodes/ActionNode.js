/**
 * ActionNode - Compatibility wrapper for actor-BT migration
 * 
 * Wraps ActionStrategy in a class interface compatible with actor-BT
 */

import { BehaviorTreeNode } from '../BehaviorTreeNode.js';
import { NodeStatus } from '../NodeStatus.js';

export class ActionNode extends BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    if (!config.tool) {
      throw new Error('ActionNode requires tool specification');
    }
    
    this.toolName = config.tool;
    this.params = config.params || {};
    this.outputVariable = config.outputVariable;
  }

  async executeNode(context) {
    try {
      // Get the tool from registry
      const tool = await this.toolRegistry.getTool(this.toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${this.toolName}`);
      }
      
      // Resolve parameters with @ syntax
      const resolvedParams = this.resolveParams(this.params, context);
      
      // Execute the tool
      const result = await tool.execute(resolvedParams);
      
      // Store result in artifacts if outputVariable specified
      if (this.outputVariable && context.artifacts) {
        context.artifacts[this.outputVariable] = {
          value: result.data || result,
          timestamp: Date.now()
        };
      }
      
      return {
        status: result.success ? NodeStatus.SUCCESS : NodeStatus.FAILURE,
        data: result.data || result,
        error: result.error
      };
      
    } catch (error) {
      return {
        status: NodeStatus.FAILURE,
        error: error.message
      };
    }
  }

  getMetadata() {
    return {
      name: this.config.name || `Action:${this.toolName}`,
      description: `Execute tool: ${this.toolName}`,
      type: 'action'
    };
  }
}