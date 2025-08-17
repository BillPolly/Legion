/**
 * FormalPlanner - Main orchestrator for bottom-up BT synthesis
 */

import { FormalPlanResult } from './FormalPlanResult.js';
import { LevelProcessor } from './LevelProcessor.js';
import { AugmentedToolRegistry } from './AugmentedToolRegistry.js';

export class FormalPlanner {
  constructor(dependencies = {}) {
    this.planner = dependencies.planner;
    this.validator = dependencies.validator;
    this.toolFactory = dependencies.toolFactory;
    this.artifactMapper = dependencies.artifactMapper;
    this.toolRegistry = dependencies.toolRegistry;
    
    // Create level processor
    this.levelProcessor = new LevelProcessor({
      planner: this.planner,
      validator: this.validator,
      toolFactory: this.toolFactory
    });
  }

  /**
   * Main synthesis method - orchestrates bottom-up BT generation
   */
  async synthesize(taskHierarchy) {
    const result = new FormalPlanResult();
    
    try {
      // Validate input
      if (!taskHierarchy) {
        result.success = false;
        result.addValidationError('No task hierarchy provided');
        result.errors = ['No task hierarchy provided'];
        return result;
      }
      
      // Identify levels in bottom-up order
      const levels = this.traverseBottomUp(taskHierarchy);
      console.log(`Processing ${levels.length} levels: ${levels.join(' -> ')}`);
      
      // Create augmented tool registry
      const augmentedRegistry = new AugmentedToolRegistry(this.toolRegistry);
      
      // Track results for each level
      const levelResults = [];
      const allSyntheticTools = [];
      
      // Process each level from bottom to top
      for (const level of levels) {
        console.log(`\nProcessing level ${level}...`);
        
        // Skip root level for now
        if (level === 0) {
          continue;
        }
        
        // Process all nodes at this level
        const levelResult = await this.processLevel(
          taskHierarchy, 
          level, 
          allSyntheticTools
        );
        
        if (!levelResult.success) {
          result.success = false;
          for (const error of levelResult.errors) {
            result.addValidationError(error);
          }
          result.errors = levelResult.errors;
          return result;
        }
        
        // Add synthetic tools to registry for use at parent level
        for (const tool of levelResult.syntheticTools) {
          augmentedRegistry.addSyntheticTool(tool);
          allSyntheticTools.push(tool);
        }
        
        levelResults.push({
          level,
          ...levelResult
        });
      }
      
      // Build root BT using all synthetic tools
      console.log('\nBuilding root BT...');
      let rootBT;
      try {
        rootBT = await this.buildRootBT(taskHierarchy, allSyntheticTools);
      } catch (error) {
        result.success = false;
        result.addValidationError(error.message);
        result.errors = [error.message];
        return result;
      }
      
      // Aggregate results
      return this.aggregateResults(levelResults, rootBT);
      
    } catch (error) {
      result.success = false;
      result.addValidationError(`Synthesis failed: ${error.message}`);
      result.errors = [`Synthesis failed: ${error.message}`];
      return result;
    }
  }

  /**
   * Traverse hierarchy to identify levels in bottom-up order
   */
  traverseBottomUp(hierarchy) {
    const levels = new Set();
    
    const traverse = (node) => {
      if (!node) return;
      
      // Add this node's level
      if (node.level !== undefined) {
        levels.add(node.level);
      }
      
      // Traverse children
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };
    
    traverse(hierarchy);
    
    // Return levels in descending order (bottom-up)
    return Array.from(levels).sort((a, b) => b - a);
  }

  /**
   * Process all nodes at a specific level
   */
  async processLevel(hierarchy, level, syntheticTools) {
    // Collect nodes at this level
    const nodes = this.levelProcessor.collectNodesAtDepth(hierarchy, level);
    
    console.log(`Found ${nodes.length} nodes at level ${level}`);
    
    // Get available tools (real + synthetic from lower levels)
    const realTools = await this.toolRegistry.searchTools('') || [];
    const availableTools = this.levelProcessor.gatherTools(realTools, syntheticTools);
    
    // Process nodes
    const result = await this.levelProcessor.processNodes(nodes, availableTools);
    
    return result;
  }

  /**
   * Build root BT using synthetic tools from children
   */
  async buildRootBT(hierarchy, syntheticTools) {
    // If root is SIMPLE, just plan it directly
    if (hierarchy.complexity === 'SIMPLE') {
      const realTools = await this.toolRegistry.searchTools('') || [];
      const allTools = this.levelProcessor.gatherTools(realTools, syntheticTools);
      
      const planResult = await this.levelProcessor.planTask(hierarchy, allTools);
      
      if (!planResult.success) {
        throw new Error(`Failed to plan root task: ${planResult.error || 'Unknown error'}`);
      }
      
      return planResult.behaviorTree;
    }
    
    // For COMPLEX root, use synthetic tools from children
    const planResult = await this.levelProcessor.planTask(
      hierarchy,
      syntheticTools,
      { useSyntheticOnly: true }
    );
    
    if (!planResult.success) {
      throw new Error(`Failed to plan complex root: ${planResult.error || 'Unknown error'}`);
    }
    
    // Validate the root BT
    const validation = await this.validator.validate(
      planResult.behaviorTree,
      syntheticTools
    );
    
    if (!validation.valid) {
      throw new Error(`Root BT validation failed: ${validation.errors.join(', ')}`);
    }
    
    return planResult.behaviorTree;
  }

  /**
   * Aggregate results from all levels into final plan
   */
  aggregateResults(levelResults, rootBT) {
    const result = new FormalPlanResult();
    
    result.success = true;
    result.rootBT = rootBT;
    result.rootBehaviorTree = rootBT;
    
    // Collect all synthetic tools
    for (const levelResult of levelResults) {
      const tools = levelResult.syntheticTools || [];
      for (const tool of tools) {
        result.addSyntheticTool(tool);
      }
    }
    
    // Store level plans
    for (const lr of levelResults) {
      result.addLevelPlan(lr.level, {
        processedNodes: lr.processedNodes,
        behaviorTrees: lr.behaviorTrees
      });
    }
    
    // Also store as array for tests that expect it
    result.levelPlans = levelResults.map(lr => ({
      level: lr.level,
      processedNodes: lr.processedNodes,
      behaviorTrees: lr.behaviorTrees
    }));
    
    // Aggregate artifacts (simplified for now)
    result.artifacts = this.artifactMapper?.createAggregateArtifact(
      levelResults.map(lr => lr.artifacts || {})
    ) || {};
    
    // Validation summary
    result.setValidation({
      valid: true,
      errors: [],
      warnings: [],
      levelsProcessed: levelResults.length,
      syntheticToolsCreated: Object.keys(result.syntheticTools).length
    });
    
    // Add errors field for compatibility
    result.errors = [];
    
    return result;
  }
}