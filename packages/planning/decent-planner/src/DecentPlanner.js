/**
 * DecentPlanner - Main planner that orchestrates informal and formal planning phases
 */

import { InformalPlanner } from './core/informal/index.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';

export class DecentPlanner {
  constructor(llmClient, options = {}) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    this.llmClient = llmClient;
    this.toolRegistry = null; // Will be initialized lazily
    this.informalPlanner = null; // Will be initialized lazily
    
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
   * Initialize the planner with ToolRegistry singleton
   */
  async initialize() {
    if (!this.toolRegistry) {
      const { ToolRegistry } = await import('@legion/tools-registry');
      this.toolRegistry = await ToolRegistry.getInstance();
      
      // Initialize informal planner now that we have toolRegistry
      this.informalPlanner = new InformalPlanner(this.llmClient, this.toolRegistry, {
        maxDepth: this.options.maxDepth,
        confidenceThreshold: this.options.confidenceThreshold,
        strictValidation: this.options.strictValidation
      });
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