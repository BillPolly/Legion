/**
 * DecentPlanner - Main orchestrator for hierarchical planning
 * 
 * Coordinates decomposition, tool discovery, and behavior tree generation
 */

import { TaskDecomposer } from './TaskDecomposer.js';
import { ContextHints } from './ContextHints.js';
import { ToolDiscoveryAdapter } from './ToolDiscoveryAdapter.js';
import { PlanSynthesizer } from './PlanSynthesizer.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';
import toolRegistry from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

export class DecentPlanner {
  constructor(llmClient, options = {}) {
    // If no llmClient provided, get it from ResourceManager
    if (!llmClient) {
      const resourceManager = ResourceManager.getInstance();
      const llmClientOrPromise = resourceManager.get('llmClient');
      
      if (!llmClientOrPromise) {
        throw new Error('LLM client is required but not available from ResourceManager');
      }
      
      // Store the client or promise - will be resolved in initialize()
      this.llmClientPromise = llmClientOrPromise;
      this.llmClient = null; // Will be set in initialize()
    } else {
      this.llmClient = llmClient;
      this.llmClientPromise = null;
    }
    this.toolRegistry = null; // Will be initialized lazily
    this.options = options;
    
    // Initialize components (will be completed in initialize() if llmClient is a promise)
    this.decomposer = null;
    this.contextHints = new ContextHints();
    this.toolDiscovery = null;
    this.synthesizer = null;
    this.planner = null;
    
    // Initialize validator (doesn't need llmClient)
    this.validator = new BTValidator({
      strictMode: true,
      validateTools: true
    });
    
    // Track decomposition state
    this.hierarchy = null;
    this.simpleTasks = [];
    this.behaviorTrees = {};
  }

  /**
   * Initialize async components
   * Must be called before using the planner
   */
  async initialize() {
    // Resolve llmClient if it was a promise
    if (this.llmClientPromise && !this.llmClient) {
      if (typeof this.llmClientPromise.then === 'function') {
        this.llmClient = await this.llmClientPromise;
      } else {
        this.llmClient = this.llmClientPromise;
      }
      
      if (!this.llmClient) {
        throw new Error('Failed to get LLM client from ResourceManager');
      }
    }
    
    // Now initialize components that need llmClient
    if (!this.decomposer) {
      this.decomposer = new TaskDecomposer(this.llmClient);
    }
    
    if (!this.synthesizer) {
      this.synthesizer = new PlanSynthesizer({
        llmClient: this.llmClient,
        toolDiscovery: this.toolDiscovery,
        contextHints: this.contextHints
      });
    }
    
    if (!this.planner) {
      this.planner = new Planner({
        llmClient: this.llmClient,
        tools: null // Will provide tools per task
      });
    }
    
    if (!this.toolRegistry) {
      // Use ToolRegistry singleton
      this.toolRegistry = toolRegistry;
      
      // Initialize tool discovery
      this.toolDiscovery = {
        discoverTools: async (query, options = {}) => {
          // Handle both string and object queries
          const searchQuery = typeof query === 'string' 
            ? query 
            : (query?.description || String(query));
          return await this.toolRegistry.searchTools(searchQuery, options);
        },
        getToolByName: async (name) => {
          return await this.toolRegistry.getTool(name);
        }
      };
      
      // Update synthesizer with tool discovery
      this.synthesizer.toolDiscovery = this.toolDiscovery;
    }
    
    return this;
  }


  /**
   * Plan a complex task through hierarchical decomposition
   * @param {string} goal - The goal to achieve
   * @param {Object} options - Planning options
   * @returns {Promise<PlanResult>} Complete hierarchical plan
   */
  async plan(goal, options = {}) {
    // Ensure initialization
    await this.initialize();
    
    // Use bottom-up synthesis by default, with option to use legacy top-down
    if (options.useBottomUp !== false) {
      return this.planWithSynthesis(goal, options);
    }
    return this.planLegacy(goal, options);
  }
  
  /**
   * Plan using bottom-up synthesis (new default)
   * @param {string} goal - The goal to achieve
   * @param {Object} options - Planning options
   * @returns {Promise<PlanResult>} Complete hierarchical plan
   */
  async planWithSynthesis(goal, options = {}) {
    try {
      // Reset state
      this.hierarchy = null;
      this.simpleTasks = [];
      this.behaviorTrees = {};
      
      // Options with defaults
      const planOptions = {
        domain: 'general',
        maxDepth: 5,
        maxWidth: 10,
        debug: false,
        ...options
      };
      
      if (planOptions.debug) {
        console.log('[DecentPlanner] Starting hierarchical planning with bottom-up synthesis');
      }
      
      // Step 1: Recursive decomposition (top-down)
      const decomposition = await this._recursiveDecompose(goal, {
        level: 0,
        domain: planOptions.domain,
        parentOutputs: [],
        maxDepth: planOptions.maxDepth
      });
      
      if (!decomposition.success) {
        return {
          success: false,
          error: `Decomposition failed: ${decomposition.error}`,
          data: null
        };
      }
      
      this.hierarchy = decomposition.hierarchy;
      
      if (planOptions.debug) {
        console.log(`[DecentPlanner] Decomposed into ${this.simpleTasks.length} simple tasks`);
      }
      
      // Step 2: Bottom-up synthesis and validation
      const synthesisResult = await this.synthesizer.synthesize(this.hierarchy, planOptions);
      const rootSubtree = synthesisResult.rootSubtree;
      
      if (!rootSubtree || !rootSubtree._isValid) {
        return {
          success: false,
          error: `Synthesis failed: ${rootSubtree?.validation?.errors?.join(', ') || 'Unknown error'}`,
          data: {
            hierarchy: this.hierarchy,
            validatedSubtree: rootSubtree,
            validationErrors: rootSubtree.validation.errors
          }
        };
      }
      
      // Step 3: Extract execution plan from validated subtree
      const executionPlan = rootSubtree.toExecutionPlan();
      
      // Step 4: Get final I/O contract
      const contract = rootSubtree.getContract();
      
      return {
        success: true,
        data: {
          hierarchy: this.hierarchy,
          validatedSubtree: rootSubtree,
          rootBehaviorTree: rootSubtree.behaviorTree,
          behaviorTrees: synthesisResult.behaviorTrees,
          executionPlan: executionPlan,
          contract: contract,
          statistics: {
            totalTasks: rootSubtree.getTotalTasks(),
            decompositionLevels: this._getMaxDepth(this.hierarchy),
            validatedLevels: this._countValidatedLevels(rootSubtree),
            totalNodes: this._countBTNodes(rootSubtree.behaviorTree)
          }
        },
        error: null
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Planning error: ${error.message}`,
        data: null
      };
    }
  }
  
  /**
   * Legacy planning method (top-down, no synthesis)
   * @param {string} goal - The goal to achieve
   * @param {Object} options - Planning options
   * @returns {Promise<PlanResult>} Complete hierarchical plan
   */
  async planLegacy(goal, options = {}) {
    try {
      // Reset state
      this.hierarchy = null;
      this.simpleTasks = [];
      this.behaviorTrees = {};
      
      // Options with defaults
      const planOptions = {
        domain: 'general',
        maxDepth: 5,
        maxWidth: 10,
        debug: false,
        ...options
      };
      
      if (planOptions.debug) {
        console.log('[DecentPlanner] Starting hierarchical planning for:', goal);
      }
      
      // Step 1: Recursive decomposition
      const decomposition = await this._recursiveDecompose(goal, {
        level: 0,
        domain: planOptions.domain,
        parentOutputs: [],
        maxDepth: planOptions.maxDepth
      });
      
      if (!decomposition.success) {
        return {
          success: false,
          error: `Decomposition failed: ${decomposition.error}`,
          data: null
        };
      }
      
      this.hierarchy = decomposition.hierarchy;
      
      if (planOptions.debug) {
        console.log(`[DecentPlanner] Decomposed into ${this.simpleTasks.length} simple tasks`);
      }
      
      // Step 2: Generate behavior trees for each simple task
      const planningResults = await this._planSimpleTasks(planOptions);
      
      if (!planningResults.success) {
        return {
          success: false,
          error: `Planning failed: ${planningResults.error}`,
          data: null
        };
      }
      
      // Step 3: Create execution plan
      const executionPlan = this._createExecutionPlan();
      
      // Step 4: Aggregate expected artifacts
      const artifacts = this._aggregateArtifacts();
      
      return {
        success: true,
        data: {
          hierarchy: this.hierarchy,
          behaviorTrees: this.behaviorTrees,
          artifacts: artifacts,
          executionPlan: executionPlan,
          statistics: {
            totalTasks: this.simpleTasks.length,
            decompositionLevels: this._getMaxDepth(this.hierarchy),
            totalNodes: this._countTotalNodes()
          }
        },
        error: null
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Planning error: ${error.message}`,
        data: null
      };
    }
  }

  /**
   * Recursively decompose a task until all leaves are simple
   * @private
   */
  async _recursiveDecompose(task, context) {
    // Check depth limit
    if (context.level >= context.maxDepth) {
      return {
        success: false,
        error: `Max depth ${context.maxDepth} reached`
      };
    }
    
    // Decompose the task
    const decomposition = await this.decomposer.decompose(task, context);
    
    if (!decomposition.success) {
      return decomposition;
    }
    
    // Create task node
    const taskNode = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: task,
      level: context.level,
      complexity: 'COMPLEX', // Parent is complex if it has subtasks
      suggestedInputs: context.parentOutputs,
      suggestedOutputs: [],
      children: [],
      subtasks: [] // For compatibility with synthesizer
    };
    
    // Process each subtask
    for (const subtask of decomposition.subtasks) {
      // Store I/O hints and parent relation
      this.contextHints.addHints(subtask.id, {
        suggestedInputs: subtask.suggestedInputs,
        suggestedOutputs: subtask.suggestedOutputs
      });
      this.contextHints.setParentRelation(subtask.id, taskNode.id);
      
      if (subtask.complexity === 'SIMPLE') {
        // Add to simple tasks list
        const simpleNode = {
          id: subtask.id,
          description: subtask.description,
          level: context.level + 1,
          complexity: 'SIMPLE',
          suggestedInputs: subtask.suggestedInputs,
          suggestedOutputs: subtask.suggestedOutputs,
          parentId: taskNode.id,
          reasoning: subtask.reasoning
        };
        
        this.simpleTasks.push(simpleNode);
        taskNode.children.push(simpleNode);
        taskNode.subtasks.push(simpleNode); // For synthesizer compatibility
        
        // Collect outputs for parent
        taskNode.suggestedOutputs.push(...subtask.suggestedOutputs);
        
      } else {
        // Recurse for complex tasks
        const childContext = {
          ...context,
          level: context.level + 1,
          parentOutputs: subtask.suggestedInputs || []
        };
        
        const childDecomposition = await this._recursiveDecompose(
          subtask.description,
          childContext
        );
        
        if (childDecomposition.success) {
          taskNode.children.push(childDecomposition.hierarchy);
          taskNode.subtasks.push(childDecomposition.hierarchy); // For synthesizer compatibility
          // Bubble up outputs
          taskNode.suggestedOutputs.push(...(childDecomposition.hierarchy.suggestedOutputs || []));
        }
      }
    }
    
    return {
      success: true,
      hierarchy: taskNode
    };
  }

  /**
   * Plan all simple tasks
   * @private
   */
  async _planSimpleTasks(options) {
    const failures = [];
    
    for (const simpleTask of this.simpleTasks) {
      try {
        if (options.debug) {
          console.log(`[DecentPlanner] Planning simple task: ${simpleTask.description}`);
        }
        
        // Get I/O hints for this task
        const hints = this.contextHints.getHints(simpleTask.id);
        
        // Discover relevant tools
        let tools = [];
        try {
          tools = await this.toolDiscovery.discoverTools(simpleTask, {
            maxTools: 10,
            threshold: 0.3
          });
        } catch (toolError) {
          failures.push({
            task: simpleTask.description,
            error: `Tool discovery failed: ${toolError.message}`
          });
          continue;
        }
        
        if (!tools || tools.length === 0) {
          failures.push({
            task: simpleTask.description,
            error: 'No relevant tools found'
          });
          continue;
        }
        
        // Create requirements with I/O hints
        const requirements = this._buildRequirements(simpleTask, hints);
        
        // Generate behavior tree
        const planResult = await this.planner.makePlan(
          requirements,
          tools,
          { debug: options.debug }
        );
        
        if (planResult && planResult.success && planResult.data) {
          this.behaviorTrees[simpleTask.id] = {
            task: simpleTask.description,
            plan: planResult.data.plan,
            tools: tools.map(t => t.name || 'unknown'),
            nodeCount: planResult.data.nodeCount || 0,
            artifacts: {
              inputs: hints.suggestedInputs || [],
              outputs: hints.suggestedOutputs || []
            }
          };
        } else {
          failures.push({
            task: simpleTask.description,
            error: planResult?.error || 'Unknown planning error'
          });
        }
        
      } catch (error) {
        failures.push({
          task: simpleTask.description,
          error: error.message
        });
      }
    }
    
    if (failures.length > 0) {
      return {
        success: false,
        error: `Failed to plan ${failures.length} tasks`,
        failures: failures
      };
    }
    
    return { success: true };
  }

  /**
   * Build requirements string with I/O hints
   * @private
   */
  _buildRequirements(task, hints) {
    let requirements = task.description;
    
    if (hints.suggestedInputs && hints.suggestedInputs.length > 0) {
      requirements += `\n\nExpected inputs: ${hints.suggestedInputs.join(', ')}`;
    }
    
    if (hints.suggestedOutputs && hints.suggestedOutputs.length > 0) {
      requirements += `\nExpected outputs: ${hints.suggestedOutputs.join(', ')}`;
    }
    
    return requirements;
  }

  /**
   * Create ordered execution plan
   * @private
   */
  _createExecutionPlan() {
    if (!this.simpleTasks || this.simpleTasks.length === 0) {
      return [];
    }
    
    // Sort tasks by level (breadth-first) and dependencies
    const sorted = [...this.simpleTasks].sort((a, b) => {
      // Execute shallower tasks first
      if (a.level !== b.level) {
        return a.level - b.level;
      }
      // Within same level, consider dependencies
      return 0;
    });
    
    return sorted.map(task => ({
      taskId: task.id || `unknown-${Date.now()}`,
      description: task.description || 'Unnamed task',
      behaviorTree: this.behaviorTrees[task.id]?.plan || null,
      dependencies: task.suggestedInputs || []
    }));
  }

  /**
   * Aggregate all expected artifacts
   * @private
   */
  _aggregateArtifacts() {
    const artifacts = {
      inputs: new Set(),
      outputs: new Set(),
      intermediate: new Set()
    };
    
    for (const task of this.simpleTasks) {
      const hints = this.contextHints.getHints(task.id);
      
      // Add inputs
      hints.suggestedInputs?.forEach(input => artifacts.inputs.add(input));
      
      // Add outputs
      hints.suggestedOutputs?.forEach(output => artifacts.outputs.add(output));
    }
    
    // Intermediate artifacts are outputs that are also inputs
    for (const output of artifacts.outputs) {
      if (artifacts.inputs.has(output)) {
        artifacts.intermediate.add(output);
      }
    }
    
    return {
      inputs: Array.from(artifacts.inputs),
      outputs: Array.from(artifacts.outputs),
      intermediate: Array.from(artifacts.intermediate)
    };
  }

  /**
   * Get maximum depth of hierarchy
   * @private
   */
  _getMaxDepth(node, currentDepth = 0) {
    if (!node || !node.children || node.children.length === 0) {
      return currentDepth;
    }
    
    return Math.max(
      ...node.children.map(child => this._getMaxDepth(child, currentDepth + 1))
    );
  }

  /**
   * Count total nodes in all behavior trees
   * @private
   */
  _countTotalNodes() {
    let total = 0;
    for (const btData of Object.values(this.behaviorTrees)) {
      total += btData.nodeCount || 0;
    }
    return total;
  }
  
  /**
   * Count validated levels in a subtree
   * @private
   */
  _countValidatedLevels(subtree) {
    if (!subtree._isValid) return 0;
    
    if (subtree.complexity === 'SIMPLE') {
      return 1;
    }
    
    const childLevels = subtree.children.map(child => 
      this._countValidatedLevels(child)
    );
    
    return 1 + Math.max(...childLevels, 0);
  }
  
  /**
   * Count nodes in a behavior tree
   * @private
   */
  _countBTNodes(bt) {
    if (!bt) return 0;
    
    let count = 1; // Count this node
    
    if (bt.children && Array.isArray(bt.children)) {
      for (const child of bt.children) {
        count += this._countBTNodes(child);
      }
    }
    
    if (bt.child) {
      count += this._countBTNodes(bt.child);
    }
    
    return count;
  }
}