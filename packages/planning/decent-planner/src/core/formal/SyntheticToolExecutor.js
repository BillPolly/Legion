/**
 * SyntheticToolExecutor - Executes synthetic tools by running their stored BTs
 * 
 * Key insight: The executionPlan IS a complete, valid BT - just execute it directly
 */

export class SyntheticToolExecutor {
  constructor(btExecutor) {
    if (!btExecutor) {
      throw new Error('BehaviorTreeExecutor is required');
    }
    this.btExecutor = btExecutor;
  }

  /**
   * Execute a synthetic tool by running its stored BT
   * @param {SyntheticTool} tool - The synthetic tool to execute
   * @param {Object} inputs - Input parameters for the tool
   * @param {Object} parentContext - Parent execution context
   * @returns {Promise<Object>} Execution result with outputs
   */
  async execute(tool, inputs = {}, parentContext = {}) {
    if (!tool || !tool.executionPlan) {
      return {
        success: false,
        error: 'Invalid synthetic tool: missing executionPlan',
        outputs: {}
      };
    }
    
    try {
      // Create execution context for the BT
      const btContext = this.createBTContext(inputs, parentContext);
      
      // Execute the stored BT directly - it's already valid and complete
      const btResult = await this.btExecutor.executeTree(
        tool.executionPlan,  // This IS the BT, ready to execute
        btContext
      );
      
      // Extract outputs from BT execution results
      const outputs = this.extractOutputs(btResult, tool.outputSchema);
      
      // Return tool execution result
      return {
        success: btResult.success || btResult.status === 'SUCCESS',
        outputs,
        metadata: {
          toolName: tool.name,
          executionTime: btResult.executionTime,
          btStatus: btResult.status
        }
      };
      
    } catch (error) {
      // Propagate errors with context
      return {
        success: false,
        error: `Synthetic tool ${tool.name} execution failed: ${error.message}`,
        outputs: {}
      };
    }
  }

  /**
   * Create BT execution context from tool inputs
   */
  createBTContext(inputs, parentContext) {
    return {
      // Inputs become part of the artifacts available to the BT
      artifacts: {
        ...inputs  // Tool inputs are available as artifacts in the BT
      },
      // Preserve parent metadata if needed
      parentContext: {
        ...parentContext,
        // But don't leak parent artifacts - isolation
        artifacts: undefined
      }
    };
  }

  /**
   * Extract outputs from BT execution results
   */
  extractOutputs(btResult, outputSchema = {}) {
    const outputs = {};
    
    // BT results typically have artifacts or data
    const btArtifacts = btResult.artifacts || btResult.data || {};
    
    // Map BT artifacts to tool outputs based on schema
    for (const [key, schema] of Object.entries(outputSchema)) {
      if (btArtifacts[key] !== undefined) {
        outputs[key] = btArtifacts[key];
      }
    }
    
    // If no schema, return all artifacts as outputs
    if (Object.keys(outputSchema).length === 0) {
      return btArtifacts;
    }
    
    return outputs;
  }

  /**
   * Check if a tool is synthetic
   */
  static isSynthetic(tool) {
    return !!(tool && (tool.type === 'synthetic' || tool.executionPlan));
  }
}