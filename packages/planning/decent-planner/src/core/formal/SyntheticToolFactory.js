/**
 * SyntheticToolFactory - Transforms BTs into synthetic tools
 */

import { SyntheticTool } from './SyntheticTool.js';

export class SyntheticToolFactory {
  constructor() {
    // Counter for unique tool naming
    this.toolCounter = 0;
  }

  /**
   * Create a synthetic tool from a behavior tree
   * @param {Object} behaviorTree - The BT to wrap as a tool
   * @param {Object} taskNode - The task node this BT implements
   * @returns {SyntheticTool} The synthetic tool
   */
  createFromBT(behaviorTree, taskNode) {
    // Generate unique tool name
    const toolName = this.generateToolName(taskNode);
    
    // Extract interface from BT and hints
    const interface_ = this.extractInterface(behaviorTree, taskNode);
    
    // Generate schemas from interface
    const schemas = this.generateSchemas(interface_);
    
    // Generate metadata
    const metadata = this.generateMetadata(taskNode, behaviorTree);
    
    // Create the synthetic tool
    return new SyntheticTool({
      name: toolName,
      description: taskNode.description || `Synthetic tool for ${taskNode.id}`,
      inputSchema: schemas.inputSchema,
      outputSchema: schemas.outputSchema,
      executionPlan: behaviorTree,
      metadata
    });
  }

  /**
   * Generate a unique tool name
   */
  generateToolName(taskNode) {
    this.toolCounter++;
    const taskId = taskNode.id || 'unnamed';
    return `task_${this.toolCounter}_${taskId}`;
  }

  /**
   * Extract inputs and outputs from BT
   * The BT planner has already determined the correct inputs/outputs
   */
  extractInterface(behaviorTree, ioHints = {}) {
    const interface_ = {
      inputs: [],
      outputs: []
    };
    
    // Extract inputs from BT (parameters that reference context.inputs)
    const inputs = this.extractInputReferences(behaviorTree);
    interface_.inputs.push(...inputs);
    
    // Extract outputs from BT (outputVariables)
    const outputs = this.extractOutputVariables(behaviorTree);
    interface_.outputs.push(...outputs);
    
    // Deduplicate
    interface_.inputs = [...new Set(interface_.inputs)];
    interface_.outputs = [...new Set(interface_.outputs)];
    
    return interface_;
  }

  /**
   * Recursively extract input references from BT
   * Look for {{context.inputs.XXX}} patterns
   */
  extractInputReferences(node, inputs = []) {
    if (!node) return inputs;
    
    // Check params for input references
    if (node.params) {
      const paramStr = JSON.stringify(node.params);
      // Match {{context.inputs.XXX}} or {{inputs.XXX}} patterns
      const matches = paramStr.matchAll(/\{\{(?:context\.)?inputs\.(\w+)\}\}/g);
      for (const match of matches) {
        const inputName = match[1];
        if (!inputs.includes(inputName)) {
          inputs.push(inputName);
        }
      }
    }
    
    // Recursively check children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.extractInputReferences(child, inputs);
      }
    }
    
    // Check child (for retry nodes)
    if (node.child) {
      this.extractInputReferences(node.child, inputs);
    }
    
    return inputs;
  }

  /**
   * Recursively extract outputVariables from BT
   */
  extractOutputVariables(node, outputs = []) {
    if (!node) return outputs;
    
    // Check current node for outputVariable
    if (node.outputVariable && !outputs.includes(node.outputVariable)) {
      outputs.push(node.outputVariable);
    }
    
    // Recursively check children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.extractOutputVariables(child, outputs);
      }
    }
    
    // Check child (for retry nodes)
    if (node.child) {
      this.extractOutputVariables(node.child, outputs);
    }
    
    return outputs;
  }

  /**
   * Generate metadata from task and BT
   */
  generateMetadata(taskNode, behaviorTree) {
    return {
      sourceTaskId: taskNode.id,
      sourceTaskDescription: taskNode.description,
      level: taskNode.level,
      parentTaskId: taskNode.parentId,
      btId: behaviorTree.id,
      createdAt: Date.now()
    };
  }

  /**
   * Create executor function for the BT
   */
  createExecutor(behaviorTree) {
    // Return a function that will execute the BT
    // In practice, this would interface with the BT executor
    return function executeSyntheticTool(inputs) {
      // This is a placeholder - actual execution would:
      // 1. Create isolated context with inputs
      // 2. Execute the behaviorTree
      // 3. Collect outputs
      // 4. Return results
      return {
        behaviorTree,
        inputs
      };
    };
  }

  /**
   * Generate input/output schemas from interface
   */
  generateSchemas(interface_) {
    const inputSchema = {};
    const outputSchema = {};
    
    // Create basic schemas (in practice, these could be inferred from BT)
    for (const input of interface_.inputs) {
      inputSchema[input] = {
        type: 'object',  // Use 'object' as generic type
        required: false
      };
    }
    
    for (const output of interface_.outputs) {
      outputSchema[output] = {
        type: 'object'  // Use 'object' as generic type
      };
    }
    
    return { inputSchema, outputSchema };
  }
}