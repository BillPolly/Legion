/**
 * DependencyResolver - Analyzes and resolves task dependencies
 * Handles dependency graph resolution, circular dependency detection,
 * and execution order optimization
 * 
 * Features:
 * - Dependency graph construction and analysis
 * - Circular dependency detection
 * - Topological sorting for execution order
 * - Dynamic dependency injection
 * - Resource availability checking
 * - Dependency caching and optimization
 */

import { Logger } from '../utils/Logger.js';
import { 
  CircularDependencyError,
  DependencyError,
  DependencyResolutionError 
} from '../errors/ROMAErrors.js';
import {
  MAX_DEPENDENCY_DEPTH,
  DEPENDENCY_RESOLUTION_TIMEOUT,
  DEFAULT_TASK_PRIORITY,
  TOOL_EXECUTION_BASE_TIME,
  COMPOSITE_TASK_TIME_MULTIPLIER,
  MIN_TASK_TIME_ESTIMATE,
  MAX_TASK_TIME_ESTIMATE,
  TEXT_LENGTH_TIME_MULTIPLIER,
  DEFAULT_TASK_TIME_ESTIMATE,
  COMPLEXITY_NODE_WEIGHT,
  COMPLEXITY_EDGE_WEIGHT,
  COMPLEXITY_MAX_FANIN_WEIGHT,
  ID_RANDOM_SUFFIX_LENGTH,
  ID_STRING_RADIX,
  ID_SUBSTRING_START
} from '../constants/SystemConstants.js';

export class DependencyResolver {
  constructor(injectedDependencies = {}) {
    // Dependency injection
    this.toolRegistry = injectedDependencies.toolRegistry;
    this.resourceManager = injectedDependencies.resourceManager;
    this.llmClient = injectedDependencies.llmClient;
    this.logger = injectedDependencies.logger || new Logger('DependencyResolver');
    
    // Configuration
    this.cache = injectedDependencies.useCache !== false ? new Map() : null;
    this.maxDepth = injectedDependencies.maxDepth || MAX_DEPENDENCY_DEPTH;
    this.timeout = injectedDependencies.timeout || DEPENDENCY_RESOLUTION_TIMEOUT;
    this.circularDetection = injectedDependencies.circularDetection !== false;
    
    // Store original dependencies for inspection/testing
    this.injectedDependencies = injectedDependencies;
    
    // Dependency tracking state
    this.dependencyGraph = new Map();
    this.resolvedDependencies = new Map();
    this.pendingResolutions = new Set();
  }

  /**
   * Update dependencies for testing/reconfiguration
   * @param {Object} newDependencies - Updated dependencies
   */
  updateDependencies(newDependencies) {
    if (newDependencies.toolRegistry !== undefined) {
      this.toolRegistry = newDependencies.toolRegistry;
    }
    if (newDependencies.resourceManager !== undefined) {
      this.resourceManager = newDependencies.resourceManager;
    }
    if (newDependencies.llmClient !== undefined) {
      this.llmClient = newDependencies.llmClient;
    }
    if (newDependencies.logger !== undefined) {
      this.logger = newDependencies.logger;
    }

    // Update configuration
    if (newDependencies.maxDepth !== undefined) {
      this.maxDepth = newDependencies.maxDepth;
    }
    if (newDependencies.timeout !== undefined) {
      this.timeout = newDependencies.timeout;
    }
    if (newDependencies.circularDetection !== undefined) {
      this.circularDetection = newDependencies.circularDetection;
    }

    this.logger.debug('DependencyResolver dependencies updated', {
      updatedKeys: Object.keys(newDependencies)
    });
  }

  /**
   * Get current dependencies for inspection
   * @returns {Object} - Current dependency state
   */
  getCurrentDependencies() {
    return {
      toolRegistry: this.toolRegistry,
      resourceManager: this.resourceManager,
      llmClient: this.llmClient,
      logger: this.logger,
      maxDepth: this.maxDepth,
      timeout: this.timeout,
      circularDetection: this.circularDetection,
      cacheEnabled: !!this.cache,
      cacheSize: this.cache ? this.cache.size : 0
    };
  }

  /**
   * Resolve dependencies for a task or set of tasks
   * @param {Object|Array} tasks - Task or array of tasks to resolve dependencies for
   * @param {Object} context - Resolution context with available resources
   * @returns {Promise<Object>} - Resolution result with execution order and dependencies
   */
  async resolveDependencies(taskInputs, executionContext = {}) {
    const normalizedTaskArray = Array.isArray(taskInputs) ? taskInputs : [taskInputs];
    const uniqueResolutionId = this.generateResolutionId();
    
    try {
      // Filter out malformed tasks early
      const validatedTasks = normalizedTaskArray.filter(taskDefinition => {
        if (!taskDefinition || typeof taskDefinition !== 'object') {
          return false;
        }
        // Task must have some form of identifier or be valid
        return taskDefinition.id || taskDefinition.taskId || taskDefinition.name || taskDefinition.description || taskDefinition.operation || taskDefinition.tool;
      });
      
      // Build dependency graph
      const dependencyGraph = await this.buildDependencyGraph(validatedTasks, executionContext);
      
      // Detect circular dependencies
      if (this.circularDetection) {
        const detectedCycles = this.detectCircularDependencies(dependencyGraph);
        if (detectedCycles.length > 0) {
          throw new CircularDependencyError(detectedCycles);
        }
      }
      
      // Perform topological sort to determine execution order
      const sortedExecutionOrder = this.topologicalSort(dependencyGraph);
      
      // Resolve resource dependencies
      const resourceDependencyMap = await this.resolveResourceDependencies(validatedTasks, executionContext);
      
      // Optimize execution plan
      const optimizedExecutionPlan = this.optimizeExecutionPlan(sortedExecutionOrder, dependencyGraph, resourceDependencyMap);
      
      return {
        success: true,
        resolutionId: uniqueResolutionId,
        executionOrder: optimizedExecutionPlan.order,
        dependencyGraph,
        resourceDependencies: resourceDependencyMap,
        parallelGroups: optimizedExecutionPlan.parallelGroups,
        criticalPath: optimizedExecutionPlan.criticalPath,
        estimatedTime: optimizedExecutionPlan.estimatedTime,
        metadata: {
          totalTasks: normalizedTaskArray.length,
          dependencyCount: this.countDependencies(dependencyGraph),
          complexity: this.calculateComplexity(dependencyGraph),
          resolver: 'DependencyResolver',
          timestamp: Date.now()
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        resolutionId: uniqueResolutionId,
        metadata: {
          resolver: 'DependencyResolver',
          timestamp: Date.now()
        }
      };
    }
  }

  /**
   * Build dependency graph from tasks
   * @param {Array} tasks - Tasks to analyze
   * @param {Object} context - Analysis context
   * @returns {Promise<Map>} - Dependency graph
   */
  async buildDependencyGraph(taskDefinitions, analysisContext) {
    const dependencyGraph = new Map();
    const taskLookupMap = new Map();
    
    // Filter out null/undefined tasks and validate
    const validatedTaskList = taskDefinitions.filter(taskDefinition => {
      if (!taskDefinition || typeof taskDefinition !== 'object') {
        return false;
      }
      // Task must have some form of identifier or be valid
      return taskDefinition.id || taskDefinition.taskId || taskDefinition.name || taskDefinition.description || taskDefinition.operation || taskDefinition.tool;
    });
    
    // Index tasks by ID
    for (const taskDefinition of validatedTaskList) {
      const uniqueTaskId = this.getTaskId(taskDefinition);
      taskLookupMap.set(uniqueTaskId, taskDefinition);
      dependencyGraph.set(uniqueTaskId, {
        task: taskDefinition,
        dependencies: new Set(),
        dependents: new Set(),
        resourceRequirements: this.extractResourceRequirements(taskDefinition),
        estimatedTime: this.estimateTaskTime(taskDefinition),
        priority: taskDefinition.priority || DEFAULT_TASK_PRIORITY
      });
    }
    
    // Analyze explicit dependencies
    for (const taskDefinition of validatedTaskList) {
      const uniqueTaskId = this.getTaskId(taskDefinition);
      const dependencyNode = dependencyGraph.get(uniqueTaskId);
      
      if (taskDefinition.dependencies) {
        for (const explicitDependencyId of taskDefinition.dependencies) {
          if (dependencyGraph.has(explicitDependencyId)) {
            dependencyNode.dependencies.add(explicitDependencyId);
            dependencyGraph.get(explicitDependencyId).dependents.add(uniqueTaskId);
          }
        }
      }
      
      // Analyze implicit dependencies
      const implicitDependencyIds = await this.analyzeImplicitDependencies(taskDefinition, taskLookupMap, analysisContext);
      for (const implicitDepId of implicitDependencyIds) {
        if (dependencyGraph.has(implicitDepId)) {
          dependencyNode.dependencies.add(implicitDepId);
          dependencyGraph.get(implicitDepId).dependents.add(uniqueTaskId);
        }
      }
    }
    
    return dependencyGraph;
  }

  /**
   * Analyze implicit dependencies between tasks
   * @param {Object} task - Task to analyze
   * @param {Map} taskMap - Map of all tasks
   * @param {Object} context - Analysis context
   * @returns {Promise<Array>} - Array of implicit dependency IDs
   */
  async analyzeImplicitDependencies(targetTask, taskLookupMap, analysisContext) {
    const discoveredDependencies = [];
    
    // Resource-based dependencies
    const resourceBasedDeps = this.analyzeResourceDependencies(targetTask, taskLookupMap);
    discoveredDependencies.push(...resourceBasedDeps);
    
    // Data flow dependencies
    const dataFlowBasedDeps = this.analyzeDataFlowDependencies(targetTask, taskLookupMap);
    discoveredDependencies.push(...dataFlowBasedDeps);
    
    // Tool dependencies
    const toolBasedDeps = await this.analyzeToolDependencies(targetTask, taskLookupMap, analysisContext);
    discoveredDependencies.push(...toolBasedDeps);
    
    // Semantic dependencies (using LLM if available)
    if (this.llmClient && analysisContext.analyzeSemanticDependencies) {
      const semanticBasedDeps = await this.analyzeSemanticDependencies(targetTask, taskLookupMap, analysisContext);
      discoveredDependencies.push(...semanticBasedDeps);
    }
    
    return [...new Set(discoveredDependencies)]; // Remove duplicates
  }

  /**
   * Analyze resource-based dependencies
   * @param {Object} task - Task to analyze
   * @param {Map} taskMap - Map of all tasks
   * @returns {Array} - Resource dependency IDs
   */
  analyzeResourceDependencies(task, taskMap) {
    const dependencies = [];
    const taskResources = this.extractResourceRequirements(task);
    
    for (const [otherId, otherTask] of taskMap) {
      if (otherId === this.getTaskId(task)) continue;
      
      const otherResources = this.extractResourceRequirements(otherTask);
      
      // Check if this task requires resources produced by other task
      for (const required of taskResources.inputs) {
        if (otherResources.outputs.includes(required)) {
          dependencies.push(otherId);
        }
      }
      
      // Check for resource conflicts that require serialization
      for (const resource of taskResources.exclusive) {
        if (otherResources.exclusive.includes(resource)) {
          // Add dependency based on priority or creation order
          if (otherTask.priority > task.priority || 
              (!task.priority && !otherTask.priority && otherId < this.getTaskId(task))) {
            dependencies.push(otherId);
          }
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Analyze data flow dependencies
   * @param {Object} task - Task to analyze
   * @param {Map} taskMap - Map of all tasks
   * @returns {Array} - Data flow dependency IDs
   */
  analyzeDataFlowDependencies(task, taskMap) {
    const dependencies = [];
    
    // Check for input/output parameter dependencies
    if (task.inputs || task.params) {
      const requiredInputs = this.extractDataInputs(task);
      
      for (const [otherId, otherTask] of taskMap) {
        if (otherId === this.getTaskId(task)) continue;
        
        const outputs = this.extractDataOutputs(otherTask);
        
        // Check if any required inputs are provided by other task outputs
        for (const input of requiredInputs) {
          if (outputs.includes(input)) {
            dependencies.push(otherId);
          }
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Analyze tool-based dependencies
   * @param {Object} task - Task to analyze
   * @param {Map} taskMap - Map of all tasks
   * @param {Object} context - Analysis context
   * @returns {Promise<Array>} - Tool dependency IDs
   */
  async analyzeToolDependencies(task, taskMap, context) {
    const dependencies = [];
    
    if (!task.tool && !task.toolName) {
      return dependencies;
    }
    
    const toolName = task.tool || task.toolName;
    
    // Check if tool has prerequisites
    if (this.toolRegistry) {
      try {
        const tool = await this.toolRegistry.getTool(toolName);
        if (tool && tool.dependencies) {
          // Find tasks that provide required tools/capabilities
          for (const [otherId, otherTask] of taskMap) {
            if (otherId === this.getTaskId(task)) continue;
            
            const otherTool = otherTask.tool || otherTask.toolName;
            if (tool.dependencies.includes(otherTool)) {
              dependencies.push(otherId);
            }
          }
        }
      } catch (error) {
        // Tool not found or error retrieving - continue without tool dependencies
        this.logger.debug('Tool dependency analysis skipped', {
          toolName,
          reason: error.message,
          taskId: this.getTaskId(task)
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Analyze semantic dependencies using LLM
   * @param {Object} task - Task to analyze
   * @param {Map} taskMap - Map of all tasks
   * @param {Object} context - Analysis context
   * @returns {Promise<Array>} - Semantic dependency IDs
   */
  async analyzeSemanticDependencies(task, taskMap, context) {
    try {
      const taskDescriptions = Array.from(taskMap.entries()).map(([id, t]) => ({
        id,
        description: t.description || t.operation || t.prompt || `Task ${id}`
      }));
      
      const prompt = this.buildSemanticAnalysisPrompt(task, taskDescriptions);
      
      const response = await this.llmClient.complete({
        messages: [
          { role: 'system', content: 'You are a task dependency analyzer. Identify logical dependencies between tasks.' },
          { role: 'user', content: prompt }
        ]
      });
      
      return this.parseSemanticDependencies(response.content || response, taskMap);
      
    } catch (error) {
      // Semantic analysis failed - return empty dependencies
      this.logger.debug('Semantic dependency analysis failed', {
        taskId: this.getTaskId(task),
        reason: error.message
      });
      return [];
    }
  }

  /**
   * Detect circular dependencies in graph
   * @param {Map} graph - Dependency graph
   * @returns {Array} - Array of circular dependency paths
   */
  detectCircularDependencies(dependencyGraph) {
    const detectedCycles = [];
    const visitedNodes = new Set();
    const activeRecursionPath = new Set();
    
    const depthFirstSearch = (currentNodeId, traversalPath = []) => {
      if (activeRecursionPath.has(currentNodeId)) {
        // Found a cycle
        const cycleStartIndex = traversalPath.indexOf(currentNodeId);
        if (cycleStartIndex >= 0) {
          detectedCycles.push([...traversalPath.slice(cycleStartIndex), currentNodeId]);
        }
        return;
      }
      
      if (visitedNodes.has(currentNodeId)) {
        return;
      }
      
      visitedNodes.add(currentNodeId);
      activeRecursionPath.add(currentNodeId);
      traversalPath.push(currentNodeId);
      
      const currentNode = dependencyGraph.get(currentNodeId);
      if (currentNode) {
        for (const dependencyId of currentNode.dependencies) {
          depthFirstSearch(dependencyId, [...traversalPath]);
        }
      }
      
      activeRecursionPath.delete(currentNodeId);
    };
    
    for (const nodeId of dependencyGraph.keys()) {
      if (!visitedNodes.has(nodeId)) {
        depthFirstSearch(nodeId);
      }
    }
    
    return detectedCycles;
  }

  /**
   * Perform topological sort on dependency graph
   * @param {Map} graph - Dependency graph
   * @returns {Array} - Topologically sorted task IDs
   */
  topologicalSort(graph) {
    const sorted = [];
    const inDegree = new Map();
    const queue = [];
    
    // Calculate in-degrees
    for (const [nodeId, node] of graph) {
      inDegree.set(nodeId, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(nodeId);
      }
    }
    
    // Process nodes with no dependencies
    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);
      
      const currentNode = graph.get(current);
      if (currentNode) {
        for (const dependent of currentNode.dependents) {
          const newInDegree = inDegree.get(dependent) - 1;
          inDegree.set(dependent, newInDegree);
          
          if (newInDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }
    
    if (sorted.length !== graph.size) {
      throw new DependencyResolutionError('Circular dependency detected during topological sort');
    }
    
    return sorted;
  }

  /**
   * Resolve resource dependencies
   * @param {Array} tasks - Tasks to check resources for
   * @param {Object} context - Resolution context
   * @returns {Promise<Object>} - Resource dependency information
   */
  async resolveResourceDependencies(tasks, context) {
    const resourceMap = new Map();
    const conflicts = [];
    const missing = [];
    
    for (const task of tasks) {
      const requirements = this.extractResourceRequirements(task);
      const taskId = this.getTaskId(task);
      
      resourceMap.set(taskId, requirements);
      
      // Check for resource availability
      for (const resource of [...requirements.inputs, ...requirements.exclusive]) {
        if (!this.isResourceAvailable(resource, context)) {
          missing.push({ taskId, resource, type: 'missing' });
        }
      }
      
      // Check for conflicts
      for (const [otherTaskId, otherRequirements] of resourceMap) {
        if (otherTaskId === taskId) continue;
        
        for (const resource of requirements.exclusive) {
          if (otherRequirements.exclusive.includes(resource)) {
            conflicts.push({
              resource,
              tasks: [taskId, otherTaskId],
              type: 'exclusive_conflict'
            });
          }
        }
      }
    }
    
    return {
      resourceMap,
      conflicts,
      missing,
      available: this.getAvailableResources(context)
    };
  }

  /**
   * Optimize execution plan
   * @param {Array} executionOrder - Initial execution order
   * @param {Map} graph - Dependency graph
   * @param {Object} resourceDependencies - Resource dependency information
   * @returns {Object} - Optimized execution plan
   */
  optimizeExecutionPlan(executionOrder, graph, resourceDependencies) {
    // Identify parallel execution opportunities
    const parallelGroups = this.identifyParallelGroups(executionOrder, graph);
    
    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(graph);
    
    // Estimate total execution time
    const estimatedTime = this.estimateExecutionTime(executionOrder, graph, parallelGroups);
    
    // Priority-based reordering within parallel groups
    const optimizedOrder = this.applyPriorityOptimization(executionOrder, graph, parallelGroups);
    
    return {
      order: optimizedOrder,
      parallelGroups,
      criticalPath,
      estimatedTime,
      optimizations: {
        parallelization: parallelGroups.length,
        criticalPathLength: criticalPath.length,
        timeReduction: this.calculateTimeReduction(executionOrder, optimizedOrder, graph)
      }
    };
  }

  /**
   * Identify tasks that can run in parallel
   * @param {Array} executionOrder - Execution order
   * @param {Map} graph - Dependency graph
   * @returns {Array} - Array of parallel groups
   */
  identifyParallelGroups(executionOrder, graph) {
    const groups = [];
    const processed = new Set();
    
    for (let i = 0; i < executionOrder.length; i++) {
      if (processed.has(i)) continue;
      
      const currentTask = executionOrder[i];
      const group = [currentTask];
      processed.add(i);
      
      // Find tasks that can run in parallel with current task
      for (let j = i + 1; j < executionOrder.length; j++) {
        if (processed.has(j)) continue;
        
        const otherTask = executionOrder[j];
        
        if (this.canRunInParallel(currentTask, otherTask, graph, group)) {
          group.push(otherTask);
          processed.add(j);
        }
      }
      
      if (group.length > 1) {
        groups.push({
          tasks: group,
          estimatedTime: Math.max(...group.map(taskId => graph.get(taskId).estimatedTime)),
          parallelFactor: group.length
        });
      }
    }
    
    return groups;
  }

  /**
   * Check if two tasks can run in parallel
   * @param {string} task1Id - First task ID
   * @param {string} task2Id - Second task ID
   * @param {Map} graph - Dependency graph
   * @param {Array} existingGroup - Existing parallel group
   * @returns {boolean} - Whether tasks can run in parallel
   */
  canRunInParallel(task1Id, task2Id, graph, existingGroup = []) {
    const task1 = graph.get(task1Id);
    const task2 = graph.get(task2Id);
    
    if (!task1 || !task2) return false;
    
    // Check for direct dependencies
    if (task1.dependencies.has(task2Id) || task2.dependencies.has(task1Id)) {
      return false;
    }
    
    // Check for transitive dependencies
    if (this.hasTransitiveDependency(task1Id, task2Id, graph) || 
        this.hasTransitiveDependency(task2Id, task1Id, graph)) {
      return false;
    }
    
    // Check for resource conflicts
    const resources1 = task1.resourceRequirements;
    const resources2 = task2.resourceRequirements;
    
    for (const resource of resources1.exclusive) {
      if (resources2.exclusive.includes(resource) || resources2.inputs.includes(resource)) {
        return false;
      }
    }
    
    // Check compatibility with existing group members
    for (const groupTaskId of existingGroup) {
      if (!this.canRunInParallel(task2Id, groupTaskId, graph)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check for transitive dependencies
   * @param {string} fromId - Source task ID
   * @param {string} toId - Target task ID
   * @param {Map} graph - Dependency graph
   * @returns {boolean} - Whether there's a transitive dependency
   */
  hasTransitiveDependency(fromId, toId, graph, visited = new Set()) {
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    
    const node = graph.get(fromId);
    if (!node) return false;
    
    for (const depId of node.dependencies) {
      if (depId === toId) return true;
      if (this.hasTransitiveDependency(depId, toId, graph, visited)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate critical path through dependency graph
   * @param {Map} graph - Dependency graph
   * @returns {Array} - Critical path task IDs
   */
  calculateCriticalPath(graph) {
    const paths = new Map();
    const criticalPath = [];
    
    // Initialize paths
    for (const taskId of graph.keys()) {
      paths.set(taskId, { time: 0, path: [] });
    }
    
    // Calculate longest path to each node
    const sortedTasks = this.topologicalSort(graph);
    
    for (const taskId of sortedTasks) {
      const node = graph.get(taskId);
      let maxTime = 0;
      let maxPath = [];
      
      for (const depId of node.dependencies) {
        const depPath = paths.get(depId);
        if (depPath.time > maxTime) {
          maxTime = depPath.time;
          maxPath = [...depPath.path];
        }
      }
      
      paths.set(taskId, {
        time: maxTime + node.estimatedTime,
        path: [...maxPath, taskId]
      });
    }
    
    // Find the path with maximum total time
    let maxTotalTime = 0;
    let longestPath = [];
    
    for (const [taskId, pathInfo] of paths) {
      if (pathInfo.time > maxTotalTime) {
        maxTotalTime = pathInfo.time;
        longestPath = pathInfo.path;
      }
    }
    
    return longestPath;
  }

  /**
   * Extract resource requirements from task
   * @param {Object} task - Task to analyze
   * @returns {Object} - Resource requirements
   */
  extractResourceRequirements(task) {
    const requirements = {
      inputs: [],
      outputs: [],
      exclusive: [],
      shared: []
    };
    
    // Explicit resource declarations
    if (task.resources) {
      requirements.inputs.push(...(task.resources.inputs || []));
      requirements.outputs.push(...(task.resources.outputs || []));
      requirements.exclusive.push(...(task.resources.exclusive || []));
      requirements.shared.push(...(task.resources.shared || []));
    }
    
    // Infer from tool requirements
    if (task.tool || task.toolName) {
      const toolName = task.tool || task.toolName;
      requirements.inputs.push(`tool:${toolName}`);
      
      // Some tools require exclusive access
      if (['file_write', 'database_write', 'process_execute'].includes(toolName)) {
        requirements.exclusive.push(`tool:${toolName}`);
      }
    }
    
    // Infer from input/output parameters
    if (task.inputs) {
      Object.keys(task.inputs).forEach(key => {
        requirements.inputs.push(`param:${key}`);
      });
    }
    
    if (task.outputs) {
      Object.keys(task.outputs).forEach(key => {
        requirements.outputs.push(`param:${key}`);
      });
    }
    
    return requirements;
  }

  /**
   * Extract data inputs from task
   * @param {Object} task - Task to analyze
   * @returns {Array} - Data input identifiers
   */
  extractDataInputs(task) {
    const inputs = [];
    
    if (task.inputs) {
      inputs.push(...Object.keys(task.inputs));
    }
    
    if (task.params) {
      inputs.push(...Object.keys(task.params));
    }
    
    // Look for variable references in description
    const description = task.description || task.operation || task.prompt || '';
    const variablePattern = /\$\{(\w+)\}|\$(\w+)\b/g;
    let match;
    
    while ((match = variablePattern.exec(description)) !== null) {
      inputs.push(match[1] || match[2]);
    }
    
    return [...new Set(inputs)]; // Remove duplicates
  }

  /**
   * Extract data outputs from task
   * @param {Object} task - Task to analyze
   * @returns {Array} - Data output identifiers
   */
  extractDataOutputs(task) {
    const outputs = [];
    
    if (task.outputs) {
      outputs.push(...Object.keys(task.outputs));
    }
    
    if (task.produces) {
      outputs.push(...(Array.isArray(task.produces) ? task.produces : [task.produces]));
    }
    
    // Default output based on task ID
    outputs.push(this.getTaskId(task));
    
    return [...new Set(outputs)]; // Remove duplicates
  }

  /**
   * Check if resource is available
   * @param {string} resource - Resource identifier
   * @param {Object} context - Resolution context
   * @returns {boolean} - Whether resource is available
   */
  isResourceAvailable(resource, context) {
    const availableResources = this.getAvailableResources(context);
    return availableResources.includes(resource);
  }

  /**
   * Get available resources from context
   * @param {Object} context - Resolution context
   * @returns {Array} - Available resource identifiers
   */
  getAvailableResources(context) {
    const resources = [];
    
    // Add explicitly declared available resources
    if (context.availableResources) {
      resources.push(...context.availableResources);
    }
    
    // Add tool resources if toolRegistry is available
    if (this.toolRegistry && context.includeToolResources !== false) {
      // This would need to be implemented based on toolRegistry interface
      // resources.push(...this.toolRegistry.getAvailableTools().map(tool => `tool:${tool.name}`));
    }
    
    // Add default system resources
    resources.push('cpu', 'memory', 'disk', 'network');
    
    return [...new Set(resources)]; // Remove duplicates
  }

  /**
   * Estimate task execution time
   * @param {Object} task - Task to estimate
   * @returns {number} - Estimated time in milliseconds
   */
  estimateTaskTime(task) {
    // Use explicit time estimate if provided
    if (task.estimatedTime) {
      return task.estimatedTime;
    }
    
    // Base estimates by task type
    if (task.tool || task.toolName) {
      return TOOL_EXECUTION_BASE_TIME;
    }
    
    if (task.subtasks) {
      return task.subtasks.length * COMPOSITE_TASK_TIME_MULTIPLIER;
    }
    
    if (task.description || task.operation || task.prompt) {
      const length = (task.description || task.operation || task.prompt).length;
      return Math.max(MIN_TASK_TIME_ESTIMATE, Math.min(length * TEXT_LENGTH_TIME_MULTIPLIER, MAX_TASK_TIME_ESTIMATE));
    }
    
    return DEFAULT_TASK_TIME_ESTIMATE;
  }

  /**
   * Estimate total execution time
   * @param {Array} executionOrder - Execution order
   * @param {Map} graph - Dependency graph
   * @param {Array} parallelGroups - Parallel execution groups
   * @returns {number} - Estimated total time in milliseconds
   */
  estimateExecutionTime(executionOrder, graph, parallelGroups) {
    let totalTime = 0;
    const processedTasks = new Set();
    
    // Process parallel groups
    for (const group of parallelGroups) {
      const groupTime = Math.max(...group.tasks.map(taskId => {
        processedTasks.add(taskId);
        return graph.get(taskId).estimatedTime;
      }));
      totalTime += groupTime;
    }
    
    // Process remaining sequential tasks
    for (const taskId of executionOrder) {
      if (!processedTasks.has(taskId)) {
        totalTime += graph.get(taskId).estimatedTime;
      }
    }
    
    return totalTime;
  }

  /**
   * Apply priority-based optimization
   * @param {Array} executionOrder - Original execution order
   * @param {Map} graph - Dependency graph
   * @param {Array} parallelGroups - Parallel groups
   * @returns {Array} - Optimized execution order
   */
  applyPriorityOptimization(executionOrder, graph, parallelGroups) {
    const optimized = [...executionOrder];
    
    // Sort tasks within parallel groups by priority
    for (const group of parallelGroups) {
      group.tasks.sort((a, b) => {
        const priorityA = graph.get(a).priority;
        const priorityB = graph.get(b).priority;
        return priorityB - priorityA; // Higher priority first
      });
    }
    
    return optimized;
  }

  /**
   * Calculate execution time reduction from optimization
   * @param {Array} originalOrder - Original execution order
   * @param {Array} optimizedOrder - Optimized execution order
   * @param {Map} graph - Dependency graph
   * @returns {number} - Time reduction in milliseconds
   */
  calculateTimeReduction(originalOrder, optimizedOrder, graph) {
    const originalTime = originalOrder.reduce((total, taskId) => {
      return total + graph.get(taskId).estimatedTime;
    }, 0);
    
    const optimizedTime = this.estimateExecutionTime(optimizedOrder, graph, []);
    
    return originalTime - optimizedTime;
  }

  /**
   * Count total dependencies in graph
   * @param {Map} graph - Dependency graph
   * @returns {number} - Total dependency count
   */
  countDependencies(graph) {
    let count = 0;
    for (const node of graph.values()) {
      count += node.dependencies.size;
    }
    return count;
  }

  /**
   * Calculate graph complexity
   * @param {Map} graph - Dependency graph
   * @returns {number} - Complexity score
   */
  calculateComplexity(graph) {
    const nodeCount = graph.size;
    const edgeCount = this.countDependencies(graph);
    const maxDependencies = Math.max(...Array.from(graph.values()).map(n => n.dependencies.size));
    
    // Complexity based on nodes, edges, and maximum fan-in
    return (nodeCount * COMPLEXITY_NODE_WEIGHT) + 
           (edgeCount * COMPLEXITY_EDGE_WEIGHT) + 
           (maxDependencies * COMPLEXITY_MAX_FANIN_WEIGHT);
  }

  /**
   * Build semantic analysis prompt
   * @param {Object} task - Task to analyze
   * @param {Array} taskDescriptions - All task descriptions
   * @returns {string} - Analysis prompt
   */
  buildSemanticAnalysisPrompt(task, taskDescriptions) {
    const taskDescription = task.description || task.operation || task.prompt;
    
    return `
Analyze the following task and identify which other tasks it logically depends on:

Target Task: "${taskDescription}"

Available Tasks:
${taskDescriptions.map(t => `- ${t.id}: ${t.description}`).join('\n')}

Please respond with a JSON array of task IDs that the target task depends on:
["task-id-1", "task-id-2", ...]

Consider these dependency types:
- Data dependencies (needs output from another task)
- Prerequisite dependencies (must happen after another task)
- Setup dependencies (requires preparation by another task)
- Logical sequence dependencies (makes sense to happen after)

Respond only with the JSON array.`.trim();
  }

  /**
   * Parse semantic dependencies from LLM response
   * @param {string} response - LLM response
   * @param {Map} taskMap - Map of all tasks
   * @returns {Array} - Parsed dependency IDs
   */
  parseSemanticDependencies(response, taskMap) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return [];
      
      const dependencies = JSON.parse(jsonMatch[0]);
      
      // Validate that dependencies exist in task map
      return dependencies.filter(depId => taskMap.has(depId));
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Get task ID from task object
   * @param {Object} task - Task object
   * @returns {string} - Task ID
   */
  getTaskId(task) {
    return task.id || task.taskId || task.name || 
           `task-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Generate resolution ID
   * @returns {string} - Unique resolution ID
   */
  generateResolutionId() {
    return `resolution-${Date.now()}-${Math.random().toString(ID_STRING_RADIX).substr(ID_SUBSTRING_START, ID_RANDOM_SUFFIX_LENGTH)}`;
  }

  /**
   * Clear dependency cache
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache ? this.cache.size : 0,
      enabled: !!this.cache
    };
  }
}
