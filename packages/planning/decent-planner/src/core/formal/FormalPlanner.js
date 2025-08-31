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
      
      // Enrich behavior tree with tool IDs before returning
      await this.enrichBehaviorTreeWithToolIds(rootBT);
      
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
    console.log('[FormalPlanner] ========= buildRootBT called =========');
    console.log('[FormalPlanner] hierarchy:', hierarchy);
    
    // If root is SIMPLE, just plan it directly
    if (hierarchy.complexity === 'SIMPLE') {
      console.log('[FormalPlanner] Processing SIMPLE root task');
      console.log(`[FormalPlanner] Root task tools:`, hierarchy.tools);
      
      const realTools = await this.toolRegistry.searchTools('') || [];
      const allTools = this.levelProcessor.gatherTools(realTools, syntheticTools);
      
      console.log(`[FormalPlanner] All tools for planning:`, allTools.map(t => ({name: t.name, type: typeof t})));
      
      const planResult = await this.levelProcessor.planTask(hierarchy, allTools);
      
      if (!planResult.success) {
        throw new Error(`Failed to plan root task: ${planResult.error || 'Unknown error'}`);
      }
      
      console.log('[FormalPlanner] Plan result received, behavior tree generated');
      
      // Use the tools that were discovered for this specific task (hierarchy.tools)
      // These are the actual tool instances that should be attached
      const taskTools = hierarchy.tools || [];
      console.log(`[FormalPlanner] Task-specific tools to attach:`, taskTools.length);
      taskTools.forEach((t, i) => {
        console.log(`[FormalPlanner] Tool ${i}: name="${t.name}", type=${typeof t}, keys=[${Object.keys(t).join(',')}]`);
      });
      
      // Get behavior tree action tool names
      const btToolNames = new Set();
      this.findBTToolNames(planResult.behaviorTree, btToolNames);
      console.log(`[FormalPlanner] BT uses tools:`, Array.from(btToolNames));
      
      // Verify all BT tools are available in task tools
      const taskToolNames = new Set(taskTools.map(t => t.name));
      console.log(`[FormalPlanner] Available task tools:`, Array.from(taskToolNames));
      
      for (const btTool of btToolNames) {
        if (!taskToolNames.has(btTool)) {
          console.log(`[FormalPlanner] ❌ ERROR: BT tool "${btTool}" not found in task tools!`);
        } else {
          console.log(`[FormalPlanner] ✅ BT tool "${btTool}" found in task tools`);
        }
      }
      
      // Attach actual tool instances to the behavior tree
      this.attachActualToolsToTree(planResult.behaviorTree, taskTools);
      
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

  /**
   * Post-processing step to enrich behavior tree with tool IDs
   * Recursively finds action nodes and adds tool_id field based on tool name lookup
   */
  async enrichBehaviorTreeWithToolIds(behaviorTree) {
    if (!behaviorTree || !this.toolRegistry) {
      return;
    }

    console.log('[FormalPlanner] Enriching behavior tree with tool IDs...');
    
    // Create a tool name -> tool ID mapping
    const toolNameToId = new Map();
    
    try {
      // Get all tools from registry
      const allTools = await this.toolRegistry.searchTools('') || [];
      for (const tool of allTools) {
        if (tool.name && tool._id) {
          toolNameToId.set(tool.name, tool._id);
        }
      }
      
      console.log(`[FormalPlanner] Found ${toolNameToId.size} tools for ID mapping`);
      
      // Recursively enrich the tree
      this.enrichNodeWithToolIds(behaviorTree, toolNameToId);
      
      console.log('[FormalPlanner] ✅ Behavior tree enriched with tool IDs');
      
    } catch (error) {
      console.error('[FormalPlanner] ❌ Failed to enrich behavior tree with tool IDs:', error);
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Find all tool names used in behavior tree action nodes
   */
  findBTToolNames(node, toolNames) {
    if (!node) return;
    
    if (node.type === 'action' && node.tool) {
      toolNames.add(node.tool);
    }
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => this.findBTToolNames(child, toolNames));
    }
  }

  /**
   * Attach actual tool instances to action nodes in behavior tree
   */
  attachActualToolsToTree(behaviorTree, tools) {
    if (!behaviorTree || !tools) {
      console.log('[FormalPlanner] ❌ Cannot attach tools: behaviorTree or tools is null');
      return;
    }
    
    console.log('[FormalPlanner] Attaching actual tools to behavior tree...');
    console.log(`[FormalPlanner] BehaviorTree structure:`, JSON.stringify(behaviorTree, null, 2));
    console.log(`[FormalPlanner] Available tools:`, tools.map(t => ({name: t.name, type: typeof t, hasExecute: !!t.execute})));
    
    // Create tool name -> tool instance mapping
    const toolNameToInstance = new Map();
    for (const tool of tools) {
      if (tool.name) {
        toolNameToInstance.set(tool.name, tool);
        console.log(`[FormalPlanner] Mapped tool: ${tool.name} -> ${typeof tool} (execute: ${!!tool.execute})`);
      }
    }
    
    console.log(`[FormalPlanner] Found ${toolNameToInstance.size} tools to attach`);
    
    // Recursively attach tools to action nodes
    this.attachToolsToNode(behaviorTree, toolNameToInstance);
    
    console.log('[FormalPlanner] Tool attachment complete. Final BT:');
    console.log(JSON.stringify(behaviorTree, null, 2));
  }
  
  /**
   * Recursively attach tools to a node and its children
   */
  attachToolsToNode(node, toolNameToInstance) {
    if (!node) {
      console.log(`[FormalPlanner] attachToolsToNode: node is null`);
      return;
    }

    console.log(`[FormalPlanner] Processing node: id="${node.id}", type="${node.type}", tool="${node.tool}"`);

    // If this is an action node with a tool name, replace it with the actual tool object
    if (node.type === 'action' && node.tool) {
      const originalTool = node.tool;
      console.log(`[FormalPlanner] Found action node "${node.id}" with tool "${originalTool}" (type: ${typeof originalTool})`);
      
      if (typeof originalTool === 'string') {
        const toolInstance = toolNameToInstance.get(originalTool);
        if (toolInstance) {
          // Replace the tool name string with the actual tool object
          node.tool = toolInstance;
          console.log(`[FormalPlanner] ✅ REPLACED tool name "${originalTool}" with tool object for node '${node.id}'`);
          console.log(`[FormalPlanner] Tool object has execute method: ${!!toolInstance.execute}`);
        } else {
          console.log(`[FormalPlanner] ❌ Tool instance not found for: ${originalTool}`);
          console.log(`[FormalPlanner] Available tools in map:`, Array.from(toolNameToInstance.keys()));
        }
      } else {
        console.log(`[FormalPlanner] Tool is already an object for node "${node.id}"`);
      }
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      console.log(`[FormalPlanner] Processing ${node.children.length} children of node "${node.id}"`);
      node.children.forEach((child, i) => {
        console.log(`[FormalPlanner] Processing child ${i} of "${node.id}"`);
        this.attachToolsToNode(child, toolNameToInstance);
      });
    } else {
      console.log(`[FormalPlanner] Node "${node.id}" has no children`);
    }
  }

  /**
   * Recursively enrich a node and its children with tool IDs
   */
  enrichNodeWithToolIds(node, toolNameToId) {
    if (!node) return;

    // If this is an action node with a tool, add the tool_id
    if (node.type === 'action' && node.tool) {
      const toolId = toolNameToId.get(node.tool);
      if (toolId) {
        node.tool_id = toolId;
        console.log(`[FormalPlanner] ✅ Enriched action '${node.id}': ${node.tool} -> ${toolId}`);
      } else {
        console.log(`[FormalPlanner] ❌ Tool ID not found for: ${node.tool}`);
      }
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        this.enrichNodeWithToolIds(child, toolNameToId);
      }
    }

    // Process single child (for retry nodes)
    if (node.child) {
      this.enrichNodeWithToolIds(node.child, toolNameToId);
    }
  }
}