/**
 * LevelProcessor - Handles processing of one level in the hierarchy
 */

export class LevelProcessor {
  constructor(config = {}) {
    this.planner = config.planner;
    this.validator = config.validator;
    this.toolFactory = config.toolFactory;
  }

  /**
   * Process all nodes at a single level
   */
  async processNodes(nodes, availableTools) {
    const result = {
      success: true,
      processedNodes: [],
      skippedNodes: [],
      syntheticTools: [],
      behaviorTrees: [],
      errors: []
    };
    
    for (const node of nodes) {
      try {
        // Only process SIMPLE nodes
        if (node.complexity !== 'SIMPLE') {
          result.skippedNodes.push(node);
          continue;
        }
        
        // Plan the task
        const planResult = await this.planTask(node, availableTools);
        
        if (!planResult.success) {
          result.success = false;
          result.errors.push(`Failed to plan task ${node.id}: ${planResult.error}`);
          continue;
        }
        
        // Create synthetic tool
        const syntheticTool = this.toolFactory.createFromBT(
          planResult.behaviorTree,
          node
        );
        
        // Add to results
        result.processedNodes.push(node);
        result.behaviorTrees.push(planResult.behaviorTree);
        result.syntheticTools.push(syntheticTool);
        
      } catch (error) {
        result.success = false;
        result.errors.push(`Error processing node ${node.id}: ${error.message}`);
      }
    }
    
    return result;
  }

  /**
   * Plan a single task
   */
  async planTask(task, tools, additionalContext = {}) {
    try {
      // Prepare context for planner
      const context = {
        ...additionalContext,
        taskId: task.id,
        level: task.level,
        suggestedInputs: task.suggestedInputs,
        suggestedOutputs: task.suggestedOutputs
      };
      
      // Generate behavior tree
      const behaviorTree = await this.planner.makePlan(
        task.description,
        tools,
        { context }
      );
      
      // Validate the BT
      const validation = await this.validator.validate(behaviorTree, tools);
      
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          validation
        };
      }
      
      return {
        success: true,
        behaviorTree,
        validation
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        validation: { valid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  /**
   * Collect nodes at a specific depth in the hierarchy
   */
  collectNodesAtDepth(root, targetDepth) {
    const nodes = [];
    
    const traverse = (node, currentDepth = 0) => {
      if (!node) return;
      
      if (node.level === targetDepth || currentDepth === targetDepth) {
        nodes.push(node);
      } else if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, currentDepth + 1);
        }
      }
    };
    
    traverse(root);
    return nodes;
  }

  /**
   * Gather tools (real + synthetic)
   */
  gatherTools(realTools, syntheticTools) {
    return [...realTools, ...syntheticTools];
  }

  /**
   * Validate consistency across all BTs at a level
   */
  validateLevelConsistency(plans) {
    const issues = [];
    
    for (const plan of plans) {
      if (!plan.behaviorTree) {
        issues.push(`Plan ${plan.id} has no behavior tree`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}