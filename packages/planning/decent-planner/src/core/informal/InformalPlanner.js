/**
 * InformalPlanner - Main orchestrator for informal planning phase
 * Coordinates decomposition, tool discovery, and validation
 */

import { ComplexityClassifier } from './ComplexityClassifier.js';
import { TaskDecomposer } from './TaskDecomposer.js';
import { ToolFeasibilityChecker } from './ToolFeasibilityChecker.js';
import { DecompositionValidator } from './DecompositionValidator.js';
import { TaskNode } from './types/TaskNode.js';

export class InformalPlanner {
  constructor(llmClient, toolRegistry, options = {}) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    
    // Default options
    this.options = {
      maxDepth: options.maxDepth || 5,
      confidenceThreshold: options.confidenceThreshold || 0.7,
      strictValidation: options.strictValidation !== false,
      minSubtasks: options.minSubtasks || 2,
      maxTools: options.maxTools || 10,
      ...options
    };
    
    // Initialize components
    this.classifier = new ComplexityClassifier(llmClient);
    this.decomposer = new TaskDecomposer(llmClient, this.classifier);
    this.feasibilityChecker = new ToolFeasibilityChecker(toolRegistry, llmClient, {
      confidenceThreshold: this.options.confidenceThreshold,
      maxTools: this.options.maxTools
    });
    this.validator = new DecompositionValidator();
  }

  /**
   * Main planning method - orchestrates the entire informal planning process
   * @param {string} goal - The goal to plan for
   * @param {Object} context - Optional context (domain, constraints, etc.)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Complete planning result with hierarchy, validation, and statistics
   */
  async plan(goal, context = {}, progressCallback = null, cancellationChecker = null) {
    if (!goal || goal.trim() === '') {
      throw new Error('Goal description is required');
    }
    
    const startTime = Date.now();
    
    try {
      // Check for cancellation before starting
      if (cancellationChecker) {
        console.log('🔍 InformalPlanner: Calling cancellationChecker at start...');
        cancellationChecker();
      }
      
      // Step 1: Classify the goal
      if (progressCallback) progressCallback('🔍 Classifying task complexity...');
      const classification = await this.classifier.classify(goal, context);
      
      // Check for cancellation after classification
      if (cancellationChecker) {
        console.log('🔍 InformalPlanner: Calling cancellationChecker after classification...');
        cancellationChecker();
      }
      
      // Step 2: Decompose if COMPLEX, or create single node if SIMPLE
      let hierarchy;
      if (classification.complexity === 'COMPLEX') {
        if (progressCallback) progressCallback('🌳 Decomposing complex task into subtasks...');
        // Check for cancellation before decomposition
        if (cancellationChecker) cancellationChecker();
        
        // Recursively decompose
        hierarchy = await this.decomposer.decomposeRecursively(
          goal, 
          context,
          { 
            maxDepth: this.options.maxDepth,
            progressCallback: progressCallback,
            cancellationChecker: cancellationChecker
          }
        );
      } else {
        if (progressCallback) progressCallback('✅ Simple task identified - no decomposition needed');
        // Create single SIMPLE task node
        hierarchy = new TaskNode({
          description: goal,
          complexity: 'SIMPLE',
          reasoning: classification.reasoning
        });
      }
      
      // Check for cancellation after decomposition
      if (cancellationChecker) cancellationChecker();
      
      // Step 3: Validate the decomposition structure only (no tools/feasibility)
      if (progressCallback) progressCallback('✔️ Validating task hierarchy structure...');
      const validation = this.validateStructureOnly(hierarchy);
      
      // Step 5: Generate statistics
      if (progressCallback) progressCallback('📊 Generating planning statistics...');
      const statistics = this.generateStatistics(hierarchy);
      
      // Step 6: Create metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        plannerVersion: '1.0.0',
        processingTime: Date.now() - startTime,
        options: this.options,
        context: context
      };
      
      // Return complete result
      return {
        hierarchy,
        validation,
        statistics,
        metadata
      };
      
    } catch (error) {
      // Re-throw with context
      throw new Error(`Informal planning failed: ${error.message}`);
    }
  }

  /**
   * Discover tools for all SIMPLE tasks in the hierarchy
   * @private
   */
  async discoverTools(node) {
    if (node.complexity === 'SIMPLE') {
      // Discover tools for this task
      const feasibility = await this.feasibilityChecker.checkTaskFeasibility(node);
      // The checker already annotates the node with tools and feasibility
    }
    
    // Recurse into subtasks
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        await this.discoverTools(subtask);
      }
    }
  }

  /**
   * Generate statistics about the decomposition
   * @private
   */
  generateStatistics(hierarchy) {
    const stats = {
      totalTasks: 0,
      simpleTasks: 0,
      complexTasks: 0,
      feasibleTasks: 0,
      infeasibleTasks: 0,
      maxDepth: 0,
      averageSubtasks: 0,
      totalTools: 0,
      uniqueTools: new Set()
    };
    
    const complexTaskSubtaskCounts = [];
    
    this.traverseHierarchy(hierarchy, (node, depth) => {
      stats.totalTasks++;
      
      if (node.complexity === 'SIMPLE') {
        stats.simpleTasks++;
        
        if (node.feasible === true) {
          stats.feasibleTasks++;
        } else if (node.feasible === false) {
          stats.infeasibleTasks++;
        }
        
        // Count tools
        if (node.tools && node.tools.length > 0) {
          stats.totalTools += node.tools.length;
          node.tools.forEach(tool => stats.uniqueTools.add(tool.name));
        }
      } else if (node.complexity === 'COMPLEX') {
        stats.complexTasks++;
        
        if (node.subtasks && node.subtasks.length > 0) {
          complexTaskSubtaskCounts.push(node.subtasks.length);
        }
      }
      
      if (depth > stats.maxDepth) {
        stats.maxDepth = depth;
      }
    });
    
    // Calculate average subtasks for COMPLEX tasks
    if (complexTaskSubtaskCounts.length > 0) {
      const sum = complexTaskSubtaskCounts.reduce((a, b) => a + b, 0);
      stats.averageSubtasks = sum / complexTaskSubtaskCounts.length;
    }
    
    // Convert Set to count
    stats.uniqueToolsCount = stats.uniqueTools.size;
    stats.uniqueTools = Array.from(stats.uniqueTools);
    
    return stats;
  }

  /**
   * Validate only structure and dependencies (no feasibility)
   * @private
   */
  validateStructureOnly(hierarchy) {
    const structure = this.validator.validateStructure(hierarchy);
    const dependencies = this.validator.validateDependencies(hierarchy, {
      strictDependencies: false // More lenient for informal phase
    });
    const completeness = this.validator.validateCompleteness(hierarchy, {
      minSubtasks: this.options.minSubtasks || 2
    });

    const valid = structure.valid && dependencies.valid && completeness.valid;

    return {
      valid,
      structure,
      dependencies,
      completeness,
      feasibility: {
        overallFeasible: null, // Not checked in informal phase
        message: 'Feasibility checking deferred to formal phase'
      }
    };
  }

  /**
   * Traverse hierarchy with callback
   * @private
   */
  traverseHierarchy(node, callback, depth = 0) {
    callback(node, depth);
    
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        this.traverseHierarchy(subtask, callback, depth + 1);
      }
    }
  }

  /**
   * Generate a human-readable planning report
   * @param {Object} planResult - Result from plan()
   * @returns {string} Formatted report
   */
  generateReport(planResult) {
    const lines = [
      '=== Informal Planning Report ===',
      '',
      `Goal: ${planResult.hierarchy.description}`,
      `Complexity: ${planResult.hierarchy.complexity}`,
      `Processing Time: ${planResult.metadata.processingTime}ms`,
      '',
      '## Statistics',
      `Total Tasks: ${planResult.statistics.totalTasks}`,
      `  - Simple: ${planResult.statistics.simpleTasks}`,
      `  - Complex: ${planResult.statistics.complexTasks}`,
      `Feasible Tasks: ${planResult.statistics.feasibleTasks}/${planResult.statistics.simpleTasks}`,
      `Max Depth: ${planResult.statistics.maxDepth}`,
      `Unique Tools: ${planResult.statistics.uniqueToolsCount}`,
      '',
      '## Validation',
      `Overall Valid: ${planResult.validation.valid ? 'YES' : 'NO'}`,
      `  - Structure: ${planResult.validation.structure.valid ? 'Valid' : 'Invalid'}`,
      `  - Dependencies: ${planResult.validation.dependencies.valid ? 'Valid' : 'Invalid'}`,
      `  - Completeness: ${planResult.validation.completeness.valid ? 'Valid' : 'Invalid'}`,
      `  - Feasibility: ${planResult.validation.feasibility.overallFeasible ? 'Feasible' : 'Infeasible'}`,
      ''
    ];
    
    // Add issues if any
    if (!planResult.validation.valid) {
      lines.push('## Issues');
      
      if (planResult.validation.structure.errors && planResult.validation.structure.errors.length > 0) {
        lines.push('Structure Errors:');
        planResult.validation.structure.errors.forEach(err => {
          lines.push(`  - ${err.message}`);
        });
      }
      
      if (planResult.validation.feasibility.infeasibleTasks && planResult.validation.feasibility.infeasibleTasks.length > 0) {
        lines.push('Infeasible Tasks:');
        planResult.validation.feasibility.infeasibleTasks.forEach(task => {
          lines.push(`  - ${task}`);
        });
      }
      
      lines.push('');
    }
    
    // Add hierarchy outline
    lines.push('## Task Hierarchy');
    this.addHierarchyToReport(planResult.hierarchy, lines, 0);
    
    return lines.join('\n');
  }

  /**
   * Add hierarchy outline to report
   * @private
   */
  addHierarchyToReport(node, lines, depth) {
    const indent = '  '.repeat(depth);
    const marker = node.complexity === 'SIMPLE' ? '○' : '●';
    let line = `${indent}${marker} ${node.description} [${node.complexity}]`;
    
    if (node.complexity === 'SIMPLE') {
      if (node.feasible === true) {
        line += ' ✓';
        if (node.tools && node.tools.length > 0) {
          line += ` (${node.tools.length} tools)`;
        }
      } else if (node.feasible === false) {
        line += ' ✗';
      }
    }
    
    lines.push(line);
    
    if (node.subtasks && node.subtasks.length > 0) {
      for (const subtask of node.subtasks) {
        this.addHierarchyToReport(subtask, lines, depth + 1);
      }
    }
  }
}