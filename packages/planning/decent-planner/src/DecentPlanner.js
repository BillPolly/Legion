/**
 * DecentPlanner - Main planner that orchestrates informal and formal planning phases
 */

import { InformalPlanner } from './core/informal/index.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';
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
    this.informalPlanner = null; // Will be initialized lazily
    
    // Cancellation support
    this.cancelled = false;
    
    // Options
    this.options = {
      // Informal planner options
      maxDepth: options.maxDepth || 5,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      strictValidation: options.strictValidation !== false,
      
      // Formal planner options
      enableFormalPlanning: options.enableFormalPlanning !== false,
      validateBehaviorTrees: options.validateBehaviorTrees !== false,
      
      ...options
    };
    
    // Initialize formal planner (from @legion/planner package)
    if (this.options.enableFormalPlanning) {
      this.formalPlanner = new Planner({ llmClient });
      this.btValidator = new BTValidator();
    }
  }

  /**
   * Cancel the current planning operation
   */
  cancel() {
    console.log('🛑🛑🛑 DecentPlanner.cancel() called 🛑🛑🛑');
    console.log('🛑 Setting cancelled flag to true...');
    this.cancelled = true;
    console.log('✅ DecentPlanner cancelled flag set to:', this.cancelled);
  }

  /**
   * Reset cancellation flag
   */
  resetCancellation() {
    this.cancelled = false;
  }

  /**
   * Check if planning has been cancelled and throw error if so
   */
  checkCancellation() {
    console.log('🔍 Checking cancellation, cancelled flag is:', this.cancelled);
    if (this.cancelled) {
      console.log('🛑 THROWING CANCELLATION ERROR - Planning was cancelled');
      throw new Error('Planning operation was cancelled');
    }
  }

  /**
   * Initialize the planner with ToolRegistry singleton
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
      
      // Update formal planner with resolved client
      if (this.options.enableFormalPlanning && this.formalPlanner) {
        this.formalPlanner = new Planner({ llmClient: this.llmClient });
      }
    }
    
    if (!this.toolRegistry) {
      const toolRegistryModule = await import('@legion/tools-registry');
      this.toolRegistry = toolRegistryModule.default; // It's already the singleton instance
      
      // Initialize informal planner now that we have toolRegistry
      this.informalPlanner = new InformalPlanner(this.llmClient, this.toolRegistry, {
        maxDepth: this.options.maxDepth,
        confidenceThreshold: this.options.confidenceThreshold,
        strictValidation: this.options.strictValidation
      });
    }
  }

  /**
   * Run only the informal planning phase
   * @param {string} goal - The goal to achieve
   * @param {Object} context - Optional context
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Informal planning result
   */
  async planInformalOnly(goal, context = {}, progressCallback = null) {
    if (!goal || goal.trim() === '') {
      throw new Error('Goal is required');
    }
    
    // Ensure planner is initialized
    await this.initialize();
    
    const startTime = Date.now();
    const result = {
      goal,
      context,
      phase: 'informal'
    };
    
    try {
      // Reset cancellation flag at start of new planning
      this.resetCancellation();
      
      // Phase 1: Informal Planning (Decomposition)
      console.log('Starting informal planning phase...');
      if (progressCallback) {
        progressCallback('Starting task decomposition...');
      }
      
      // Check for cancellation before starting
      this.checkCancellation();
      
      const informalResult = await this.informalPlanner.plan(goal, context, progressCallback, () => this.checkCancellation());
      
      // Check for cancellation after completion
      this.checkCancellation();
      
      result.informal = informalResult;
      
      if (progressCallback) {
        progressCallback('Task decomposition completed. Validating results...');
      }
      
      // Always mark informal planning as successful if we got a hierarchy
      // The validation results are just informational for the formal phase
      result.success = true;
      result.validation = informalResult.validation;
      result.processingTime = Date.now() - startTime;
      result.summary = this.generateInformalSummary(result);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.processingTime = Date.now() - startTime;
      throw new Error(`Informal planning failed: ${error.message}`);
    }
  }

  /**
   * Discover tools for all SIMPLE tasks in a hierarchy
   * @param {Object} hierarchy - Task hierarchy from informal planning
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Tool discovery results with detailed debug info
   */
  async discoverToolsForHierarchy(hierarchy, progressCallback = null) {
    if (!hierarchy) {
      throw new Error('Hierarchy is required for tool discovery');
    }
    
    // Ensure planner is initialized
    await this.initialize();
    
    const startTime = Date.now();
    const results = {
      hierarchy,
      toolDiscovery: [],
      statistics: {
        totalSimpleTasks: 0,
        feasibleTasks: 0,
        infeasibleTasks: 0,
        totalTools: 0,
        uniqueTools: new Set()
      }
    };
    
    try {
      // Reset cancellation flag
      this.resetCancellation();
      
      if (progressCallback) {
        progressCallback('🔧 Starting tool discovery for SIMPLE tasks...');
      }
      
      // Find all SIMPLE tasks in hierarchy
      const simpleTasks = [];
      this.traverseHierarchy(hierarchy, (node) => {
        if (node.complexity === 'SIMPLE') {
          simpleTasks.push(node);
        }
      });
      
      results.statistics.totalSimpleTasks = simpleTasks.length;
      
      if (progressCallback) {
        progressCallback(`Found ${simpleTasks.length} SIMPLE tasks to process`);
      }
      
      // Process each SIMPLE task
      for (let i = 0; i < simpleTasks.length; i++) {
        const task = simpleTasks[i];
        
        // Check for cancellation
        this.checkCancellation();
        
        if (progressCallback) {
          progressCallback(`🔧 Discovering tools for task ${i + 1}/${simpleTasks.length}: "${task.description}"`);
        }
        
        try {
          // Get detailed tool discovery info
          const discoveryResult = await this.informalPlanner.feasibilityChecker.checkTaskFeasibility(task);
          
          // ADD DISCOVERED TOOLS TO THE TASK NODE - This was missing!
          if (discoveryResult && discoveryResult.feasible && discoveryResult.debug && discoveryResult.debug.step3_merged) {
            // Add the discovered tools directly to the task node
            task.tools = discoveryResult.debug.step3_merged || [];
            task.feasible = true;
            
            console.log(`[DecentPlanner] Added ${task.tools.length} tools to task "${task.description}"`);
          } else {
            // No tools found or task not feasible
            task.tools = [];
            task.feasible = false;
          }
          
          // Store detailed results for debugging
          results.toolDiscovery.push({
            taskId: task.id || `task-${i}`,
            taskDescription: task.description,
            discoveryResult
          });
          
          // Update statistics
          if (task.feasible) {
            results.statistics.feasibleTasks++;
            if (task.tools) {
              results.statistics.totalTools += task.tools.length;
              task.tools.forEach(tool => results.statistics.uniqueTools.add(tool.name));
            }
          } else {
            results.statistics.infeasibleTasks++;
          }
          
        } catch (error) {
          console.error(`Tool discovery failed for task "${task.description}":`, error);
          
          // Mark as infeasible and store error
          task.tools = [];
          task.feasible = false;
          results.statistics.infeasibleTasks++;
          
          results.toolDiscovery.push({
            taskId: task.id || `task-${i}`,
            taskDescription: task.description,
            error: error.message,
            discoveryResult: null
          });
        }
      }
      
      // Finalize statistics
      results.statistics.uniqueToolsCount = results.statistics.uniqueTools.size;
      results.statistics.uniqueTools = Array.from(results.statistics.uniqueTools);
      results.processingTime = Date.now() - startTime;
      results.success = true;
      
      if (progressCallback) {
        progressCallback(`✅ Tool discovery completed: ${results.statistics.feasibleTasks}/${results.statistics.totalSimpleTasks} tasks feasible`);
      }
      
      return results;
      
    } catch (error) {
      results.success = false;
      results.error = error.message;
      results.processingTime = Date.now() - startTime;
      throw new Error(`Tool discovery failed: ${error.message}`);
    }
  }

  /**
   * Run the formal planning phase using informal results
   * @param {Object} informalResult - Result from planInformalOnly()
   * @returns {Promise<Object>} Formal planning result
   */
  async planFormal(informalResult) {
    if (!informalResult || !informalResult.informal) {
      throw new Error('Valid informal result is required for formal planning');
    }
    
    if (!informalResult.success) {
      throw new Error('Cannot run formal planning on failed informal result');
    }
    
    const startTime = Date.now();
    const result = {
      goal: informalResult.goal,
      context: informalResult.context,
      phase: 'formal',
      informalResult
    };
    
    try {
      // Phase 2: Formal Planning (Behavior Tree Synthesis)
      if (this.options.enableFormalPlanning) {
        console.log('Starting formal planning phase...');
        try {
          const formalResult = await this.synthesizeFormalPlan(informalResult.informal.hierarchy);
          result.formal = formalResult;
          
          // Validate behavior trees if enabled
          if (this.options.validateBehaviorTrees && formalResult.behaviorTrees) {
            const validationResults = await this.validateBehaviorTrees(
              formalResult.behaviorTrees,
              informalResult.informal.hierarchy
            );
            result.formal.validation = validationResults;
          }
        } catch (error) {
          console.warn('Formal planning not fully implemented yet:', error.message);
          result.formal = {
            status: 'not_implemented',
            message: 'Formal planning phase is pending implementation'
          };
        }
      } else {
        result.formal = {
          status: 'disabled',
          message: 'Formal planning is disabled in options'
        };
      }
      
      // Success
      result.success = true;
      result.processingTime = Date.now() - startTime;
      result.summary = this.generateFormalSummary(result);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.processingTime = Date.now() - startTime;
      throw new Error(`Formal planning failed: ${error.message}`);
    }
  }

  /**
   * Main planning method - runs both informal and formal planning
   * @param {string} goal - The goal to achieve
   * @param {Object} context - Optional context
   * @returns {Promise<Object>} Complete planning result
   */
  async plan(goal, context = {}) {
    if (!goal || goal.trim() === '') {
      throw new Error('Goal is required');
    }
    
    // Ensure planner is initialized
    await this.initialize();
    
    const startTime = Date.now();
    const result = {
      goal,
      context,
      phases: {}
    };
    
    try {
      // Phase 1: Informal Planning (Decomposition)
      console.log('Starting informal planning phase...');
      const informalResult = await this.informalPlanner.plan(goal, context);
      result.phases.informal = informalResult;
      
      // Check if informal planning succeeded
      if (!informalResult.validation.valid) {
        result.success = false;
        result.reason = 'Informal planning validation failed';
        result.errors = this.extractValidationErrors(informalResult.validation);
        return result;
      }
      
      // Check feasibility
      if (!informalResult.validation.feasibility.overallFeasible) {
        result.success = false;
        result.reason = 'Goal is not feasible with available tools';
        result.infeasibleTasks = informalResult.validation.feasibility.infeasibleTasks;
        return result;
      }
      
      // Phase 2: Formal Planning (Behavior Tree Synthesis)
      if (this.options.enableFormalPlanning) {
        console.log('Starting formal planning phase...');
        try {
          const formalResult = await this.synthesizeFormalPlan(informalResult.hierarchy);
          result.phases.formal = formalResult;
          
          // Validate behavior trees if enabled
          if (this.options.validateBehaviorTrees && formalResult.behaviorTrees) {
            const validationResults = await this.validateBehaviorTrees(
              formalResult.behaviorTrees,
              informalResult.hierarchy
            );
            result.phases.formal.validation = validationResults;
          }
        } catch (error) {
          console.warn('Formal planning not fully implemented yet:', error.message);
          result.phases.formal = {
            status: 'not_implemented',
            message: 'Formal planning phase is pending implementation'
          };
        }
      }
      
      // Success
      result.success = true;
      result.processingTime = Date.now() - startTime;
      result.summary = this.generateSummary(result);
      
      return result;
      
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.processingTime = Date.now() - startTime;
      throw new Error(`Planning failed: ${error.message}`);
    }
  }

  /**
   * Synthesize formal plan from informal hierarchy
   * @private
   */
  async synthesizeFormalPlan(hierarchy) {
    // This will use the @legion/planner package to create behavior trees
    // For now, we'll create a placeholder structure
    
    const behaviorTrees = [];
    
    // Convert each SIMPLE task to a behavior tree
    this.traverseHierarchy(hierarchy, (node) => {
      if (node.complexity === 'SIMPLE' && node.feasible && node.tools) {
        // Create a simple behavior tree for this task
        const bt = {
          id: node.id || `task-${Date.now()}`,
          description: node.description,
          type: 'sequence',
          children: node.tools.map(tool => ({
            type: 'action',
            tool: tool.name,
            confidence: tool.confidence,
            inputs: node.suggestedInputs || [],
            outputs: node.suggestedOutputs || []
          }))
        };
        behaviorTrees.push(bt);
      }
    });
    
    return {
      behaviorTrees,
      count: behaviorTrees.length,
      status: 'synthesized'
    };
  }

  /**
   * Validate behavior trees
   * @private
   */
  async validateBehaviorTrees(behaviorTrees, hierarchy) {
    const results = [];
    
    for (const bt of behaviorTrees) {
      try {
        // Use BTValidator from @legion/bt-validator
        const validation = await this.btValidator.validate(bt);
        results.push({
          id: bt.id,
          valid: validation.valid,
          errors: validation.errors || []
        });
      } catch (error) {
        results.push({
          id: bt.id,
          valid: false,
          errors: [error.message]
        });
      }
    }
    
    return {
      allValid: results.every(r => r.valid),
      results
    };
  }

  /**
   * Extract validation errors from informal result
   * @private
   */
  extractValidationErrors(validation) {
    const errors = [];
    
    if (!validation.structure.valid) {
      errors.push(...validation.structure.errors);
    }
    
    if (!validation.dependencies.valid) {
      errors.push(...(validation.dependencies.errors || []));
    }
    
    if (!validation.completeness.valid) {
      errors.push(...(validation.completeness.issues || []));
    }
    
    return errors;
  }

  /**
   * Traverse hierarchy helper
   * @private
   */
  traverseHierarchy(node, callback) {
    callback(node);
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        this.traverseHierarchy(subtask, callback);
      }
    }
  }

  /**
   * Generate planning summary
   * @private
   */
  generateSummary(result) {
    const summary = {
      goal: result.goal,
      success: result.success
    };
    
    if (result.phases.informal) {
      const informal = result.phases.informal;
      summary.informal = {
        totalTasks: informal.statistics.totalTasks,
        simpleTasks: informal.statistics.simpleTasks,
        complexTasks: informal.statistics.complexTasks,
        feasibleTasks: informal.statistics.feasibleTasks,
        maxDepth: informal.statistics.maxDepth,
        valid: informal.validation.valid
      };
    }
    
    if (result.phases.formal) {
      summary.formal = {
        status: result.phases.formal.status,
        behaviorTrees: result.phases.formal.count || 0
      };
    }
    
    summary.processingTime = result.processingTime;
    
    return summary;
  }

  /**
   * Generate summary for informal-only results
   * @private
   */
  generateInformalSummary(result) {
    const summary = {
      goal: result.goal,
      success: result.success,
      phase: 'informal'
    };
    
    if (result.informal) {
      const informal = result.informal;
      summary.informal = {
        totalTasks: informal.statistics.totalTasks,
        simpleTasks: informal.statistics.simpleTasks,
        complexTasks: informal.statistics.complexTasks,
        feasibleTasks: informal.statistics.feasibleTasks,
        maxDepth: informal.statistics.maxDepth,
        valid: informal.validation.valid
      };
    }
    
    summary.processingTime = result.processingTime;
    
    return summary;
  }

  /**
   * Generate summary for formal-only results
   * @private
   */
  generateFormalSummary(result) {
    const summary = {
      goal: result.goal,
      success: result.success,
      phase: 'formal'
    };
    
    if (result.formal) {
      summary.formal = {
        status: result.formal.status,
        behaviorTrees: result.formal.count || 0
      };
    }
    
    summary.processingTime = result.processingTime;
    
    return summary;
  }

  /**
   * Generate human-readable report
   * @param {Object} planResult - Result from plan()
   * @returns {string} Formatted report
   */
  generateReport(planResult) {
    const lines = [
      '=== DECENT Planning Report ===',
      '',
      `Goal: ${planResult.goal}`,
      `Success: ${planResult.success ? 'YES' : 'NO'}`,
      `Processing Time: ${planResult.processingTime}ms`,
      ''
    ];
    
    // Informal phase report
    if (planResult.phases.informal) {
      lines.push('## Informal Planning Phase');
      const informalReport = this.informalPlanner.generateReport(planResult.phases.informal);
      lines.push(...informalReport.split('\n').map(line => '  ' + line));
      lines.push('');
    }
    
    // Formal phase report
    if (planResult.phases.formal) {
      lines.push('## Formal Planning Phase');
      lines.push(`  Status: ${planResult.phases.formal.status}`);
      if (planResult.phases.formal.behaviorTrees) {
        lines.push(`  Behavior Trees Generated: ${planResult.phases.formal.count}`);
        if (planResult.phases.formal.validation) {
          lines.push(`  Validation: ${planResult.phases.formal.validation.allValid ? 'PASSED' : 'FAILED'}`);
        }
      }
      lines.push('');
    }
    
    // Summary
    if (planResult.summary) {
      lines.push('## Summary');
      lines.push(JSON.stringify(planResult.summary, null, 2).split('\n').map(line => '  ' + line).join('\n'));
    }
    
    return lines.join('\n');
  }
}