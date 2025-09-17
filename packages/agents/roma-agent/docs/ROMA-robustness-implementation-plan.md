# ROMA Agent Robustness Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation plan for improving the robustness and reliability of the ROMA agent. Each task includes checkboxes for tracking completion status.

**Target Completion**: 4 weeks  
**Priority Focus**: Tool registry initialization, progress monitoring, error recovery

---

## Phase 1: Critical Tool Registry Fix (Priority 1) ✅ COMPLETED 2025-09-17
**Goal**: Ensure tool registry is always available and properly initialized  
**Timeline**: Days 1-3

### 1.1 Fix Tool Registry Initialization in ROMAAgent

#### File: `src/ROMAAgent.js`

- [x] **Add tool registry validation in initialize() method**
  ```javascript
  // Line ~165 after strategyResolver.initialize()
  if (!this.toolRegistry) {
    throw new Error('Tool registry not initialized');
  }
  ```

- [x] **Add fallback tool registry initialization**
  ```javascript
  // Line ~176 in initializeDependenciesFromResourceManager()
  if (!toolRegistry) {
    this.logger.warn('ToolRegistry singleton not available, creating new instance');
    toolRegistry = new ToolRegistry();
    await toolRegistry.initialize();
  }
  ```

- [x] **Pass toolRegistry to progressStream in execute()**
  ```javascript
  // Line ~250 in execute() method
  this.progressStream = new TaskProgressStream({
    toolRegistry: this.toolRegistry,
    logger: this.logger
  });
  ```

- [x] **Add getter for toolRegistry with validation**
  ```javascript
  // Add new method around line 210
  getToolRegistry() {
    if (!this.toolRegistry) {
      throw new Error('Tool registry not available - ensure initialize() was called');
    }
    return this.toolRegistry;
  }
  ```

### 1.2 Fix Strategy Tool Registry Access

#### File: `src/core/strategies/ExecutionStrategy.js`

- [x] **Add toolRegistry validation in constructor**
  ```javascript
  // Line ~20 in constructor
  if (options.toolRegistry) {
    this.toolRegistry = options.toolRegistry;
  } else {
    console.warn('ExecutionStrategy: toolRegistry not provided');
  }
  ```

- [x] **Create getter method with initialization check**
  ```javascript
  // Add new method around line 80
  async getToolRegistry() {
    if (!this.toolRegistry) {
      // Try to get from singleton
      const { ToolRegistry } = await import('@legion/tools-registry');
      this.toolRegistry = await ToolRegistry.getInstance();
    }
    return this.toolRegistry;
  }
  ```

- [x] **Update initialize() to ensure toolRegistry**
  ```javascript
  // Line ~27 in initialize()
  if (!this.toolRegistry) {
    await this.getToolRegistry();
  }
  ```

### 1.3 Update Strategy Resolver

#### File: `src/core/strategies/ExecutionStrategyResolver.js`

- [x] **Validate toolRegistry before strategy creation**
  ```javascript
  // Line ~54 in createStrategyInstance()
  if (!dependencies.toolRegistry) {
    this.logger.warn('Creating strategy without toolRegistry');
  }
  ```

- [x] **Ensure toolRegistry is passed to all strategies**
  ```javascript
  // Line ~56 in createStrategyInstance()
  const strategyDeps = {
    ...dependencies,
    toolRegistry: dependencies.toolRegistry || await this.getToolRegistry()
  };
  ```

- [x] **Add toolRegistry recovery method**
  ```javascript
  // Add new method around line 100
  async getToolRegistry() {
    if (this.dependencies.toolRegistry) {
      return this.dependencies.toolRegistry;
    }
    const { ToolRegistry } = await import('@legion/tools-registry');
    return await ToolRegistry.getInstance();
  }
  ```

### 1.4 Testing

- [x] **Create unit test for toolRegistry initialization**
  - File: `__tests__/unit/toolRegistryInit.test.js`
  - Test null toolRegistry handling
  - Test fallback initialization
  - Test singleton pattern

- [x] **Create integration test for tool execution flow**
  - File: `__tests__/integration/toolExecutionFlow.test.js`
  - Test tool discovery
  - Test tool execution
  - Test error handling

---

## Phase 2: Progress Monitoring Enhancement (Priority 2) ✅ COMPLETED 2025-09-17
**Goal**: Provide granular, percentage-based progress tracking  
**Timeline**: Days 4-7

### 2.1 Create Progress Calculator ✅ COMPLETED

#### New File: `src/core/progress/ProgressCalculator.js`

- [x] **Create base class structure**
  ```javascript
  export class ProgressCalculator {
    constructor(totalSteps, options = {}) {
      this.totalSteps = totalSteps;
      this.completedSteps = 0;
      this.weights = options.weights || {};
      this.startTime = Date.now();
    }
  }
  ```

- [x] **Implement percentage calculation**
  ```javascript
  calculatePercentage() {
    if (this.totalSteps === 0) return 0;
    return Math.round((this.completedSteps / this.totalSteps) * 100);
  }
  ```

- [x] **Add time estimation**
  ```javascript
  estimateRemainingTime() {
    const elapsed = Date.now() - this.startTime;
    const avgTimePerStep = elapsed / Math.max(1, this.completedSteps);
    const remainingSteps = this.totalSteps - this.completedSteps;
    return Math.round(avgTimePerStep * remainingSteps);
  }
  ```

- [x] **Implement weighted progress**
  ```javascript
  calculateWeightedProgress(subtaskProgress) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const [taskId, progress] of Object.entries(subtaskProgress)) {
      const weight = this.weights[taskId] || 1;
      totalWeight += weight;
      weightedSum += progress * weight;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  ```

### 2.2 Enhance TaskProgressStream ✅ COMPLETED

#### File: `src/core/TaskProgressStream.js`

- [x] **Add ProgressCalculator integration**
  ```javascript
  // Line ~15 in constructor
  this.progressCalculator = null;
  this.subtaskProgress = new Map();
  ```

- [x] **Implement percentage tracking**
  ```javascript
  // Add new method around line 50
  updateProgress(taskId, status, details = {}) {
    if (status === 'started') {
      this.subtaskProgress.set(taskId, 0);
    } else if (status === 'completed') {
      this.subtaskProgress.set(taskId, 100);
    }
    
    const percentage = this.calculateOverallProgress();
    const remaining = this.progressCalculator?.estimateRemainingTime();
    
    this.emit('progress', {
      taskId,
      percentage,
      estimatedTimeRemaining: remaining,
      ...details
    });
  }
  ```

- [x] **Add subtask detail tracking**
  ```javascript
  // Add new method around line 70
  trackSubtask(subtask) {
    this.emit('subtask_registered', {
      id: subtask.id,
      description: subtask.description,
      weight: subtask.weight || 1,
      status: 'pending'
    });
  }
  ```

### 2.3 Update Strategy Progress Reporting ✅ COMPLETED

#### File: `src/core/strategies/RecursiveExecutionStrategy.js`

- [x] **Emit progress for decomposition**
  ```javascript
  // Line ~340 in decompose()
  emitter.custom('decomposition_progress', {
    taskId,
    phase: 'analyzing',
    percentage: 10,
    message: 'Analyzing task complexity'
  });
  ```

- [x] **Track subtask execution progress**
  ```javascript
  // Line ~200 in execute()
  const progressCalculator = new ProgressCalculator(subtasks.length);
  emitter.custom('execution_plan', {
    taskId,
    totalSubtasks: subtasks.length,
    estimatedTime: progressCalculator.estimateInitialTime()
  });
  ```

- [x] **Emit completion percentages**
  ```javascript
  // Line ~250 in subtask execution loop
  progressCalculator.markComplete(subtask.id);
  emitter.custom('progress_update', {
    taskId,
    subtaskId: subtask.id,
    percentage: progressCalculator.calculatePercentage(),
    remainingTime: progressCalculator.estimateRemainingTime()
  });
  ```

#### File: `src/core/strategies/AtomicExecutionStrategy.js`

- [x] **Add progress for tool execution**
  ```javascript
  // Line ~235 before tool execution
  emitter.custom('tool_progress', {
    tool: toolName,
    phase: 'initializing',
    percentage: 30
  });
  ```

- [x] **Track LLM request progress**
  ```javascript
  // Line ~300 in executeLLM()
  emitter.custom('llm_progress', {
    phase: 'sending_request',
    percentage: 40,
    tokensExpected: params.maxTokens
  });
  ```

### 2.4 Testing ✅ COMPLETED

- [x] **Unit test ProgressCalculator**
  - File: `__tests__/unit/progress/ProgressCalculator.test.js`
  - Test percentage calculations
  - Test time estimation
  - Test weighted progress

- [x] **Integration test progress events**
  - File: `__tests__/integration/progressTracking.test.js`
  - Test event emission
  - Test percentage accuracy
  - Test time estimation

---

## Phase 3: Error Recovery & Retry Logic (Priority 3) ✅ COMPLETED 2025-09-17
**Goal**: Implement robust error handling and recovery mechanisms  
**Timeline**: Days 8-12

### 3.1 Enhance RetryHandler from prompt-manager (In Progress)

**DECISION**: Use existing RetryHandler from `@legion/prompt-manager` as foundation instead of creating new RetryManager

#### Integration: Use existing RetryHandler

- [ ] **Use RetryHandler from prompt-manager**
  - Existing proven implementation at `/packages/prompting/prompt-manager/src/RetryHandler.js`
  - Already integrated with PromptManager for LLM workflows
  - Includes error feedback generation for retry improvement
  - Has attempt history tracking and configuration management

- [x] **Keep RetryManager for advanced features**
  - Created at `src/core/retry/RetryManager.js` with exponential backoff + jitter
  - Includes circuit breaker pattern for cascade failure prevention
  - Provides error classification system for different retry policies
  - Offers operation-specific retry configurations

- [ ] **Integration approach**
  ```javascript
  // AtomicExecutionStrategy uses RetryHandler for LLM requests
  import { RetryHandler } from '@legion/prompt-manager';
  
  // And RetryManager for tool execution with circuit breaker
  import { RetryManager } from '../retry/RetryManager.js';
  ```

### 3.2 Enhance Error Recovery

#### File: `src/errors/ErrorRecovery.js`

- [x] **Add strategy fallback mechanism**
  ```javascript
  async fallbackStrategy(task, originalStrategy, error) {
    this.logger.warn(`Strategy ${originalStrategy} failed, trying fallback`, {
      error: error.message,
      taskId: task.id || 'unknown'
    });

    const fallbackMap = {
      'RecursiveExecutionStrategy': 'AtomicExecutionStrategy',
      'ParallelExecutionStrategy': 'SequentialExecutionStrategy',
      'SequentialExecutionStrategy': 'AtomicExecutionStrategy',
      'OptimizedExecutionStrategy': 'RecursiveExecutionStrategy'
    };

    const fallback = fallbackMap[originalStrategy];
    if (fallback) {
      this.logger.info(`Using fallback strategy: ${fallback}`, {
        originalStrategy,
        taskId: task.id || 'unknown'
      });

      return {
        success: true,
        action: 'strategy_fallback',
        fallbackStrategy: fallback,
        message: `Falling back from ${originalStrategy} to ${fallback}`,
        delay: 1000
      };
    }

    return {
      success: false,
      action: 'no_fallback_available',
      message: `No fallback strategy available for ${originalStrategy}`
    };
  }
  ```

- [x] **Implement partial result recovery**
  ```javascript
  recoverPartialResults(executionContext, error) {
    const completed = executionContext.getCompletedSubtasks ?
      executionContext.getCompletedSubtasks() : [];
    const pending = executionContext.getPendingSubtasks ?
      executionContext.getPendingSubtasks() : [];
    const failed = executionContext.getFailedSubtasks ?
      executionContext.getFailedSubtasks() : [];

    const recoverable = this.isRecoverable(error);
    const total = completed.length + pending.length + failed.length;
    const completionPercentage = total === 0 ? 0 : (completed.length / total) * 100;

    return {
      partial: true,
      completed,
      pending,
      failed,
      error: error.message,
      errorType: this.classifyError(error),
      recoverable,
      completionPercentage: Math.round(completionPercentage),
      canResume: recoverable && pending.length > 0,
      resumeStrategy: recoverable ? this.suggestResumeStrategy(completed, pending, failed) : null
    };
  }
  ```

- [x] **Add error classification**
  ```javascript
  classifyError(error) {
    const message = error.message || '';
    const code = error.code || '';
    const stack = error.stack || '';

    const classifications = {
      'ECONNREFUSED': 'network',
      'ENOTFOUND': 'network',
      'ECONNRESET': 'network',
      'ETIMEDOUT': 'timeout',
      'ESOCKETTIMEDOUT': 'timeout',
      'Rate limit': 'rate_limit',
      'Too many requests': 'rate_limit',
      'Invalid JSON': 'parsing',
      'JSON.parse': 'parsing',
      'Tool not found': 'tool_missing',
      'Tool execution failed': 'tool_failure',
      'LLM error': 'llm_failure',
      'OpenAI error': 'llm_failure',
      'Token limit exceeded': 'llm_token_limit',
      'Authentication failed': 'auth_error',
      'Permission denied': 'permission_error',
      'Out of memory': 'resource_exhausted',
      'Strategy failed': 'strategy_error',
      'Circular dependency': 'circular_dependency',
      'Validation failed': 'validation_error'
    };

    if (code) {
      for (const [pattern, type] of Object.entries(classifications)) {
        if (code.includes(pattern)) {
          return type;
        }
      }
    }

    const lowerMessage = message.toLowerCase();
    for (const [pattern, type] of Object.entries(classifications)) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return type;
      }
    }

    if (stack) {
      if (stack.includes('TimeoutError')) return 'timeout';
      if (stack.includes('NetworkError')) return 'network';
      if (stack.includes('ValidationError')) return 'validation_error';
      if (stack.includes('ParseError')) return 'parsing';
    }

    const errorType = error.constructor.name;
    if (errorType === 'TimeoutError') return 'timeout';
    if (errorType === 'NetworkError') return 'network';
    if (errorType === 'ValidationError') return 'validation_error';
    if (errorType === 'SyntaxError') return 'parsing';

    return 'unknown';
  }
  ```

### 3.3 Add Validation Layer

#### New File: `src/core/validation/ExecutionValidator.js`

- [x] **Create validation framework**
  ```javascript
  export class ExecutionValidator {
    constructor(options = {}) {
      this.preValidators = [];
      this.postValidators = [];
      this.logger = options.logger || new Logger('ExecutionValidator');
      this.toolRegistry = options.toolRegistry || null;
      this.enableStrictValidation = options.enableStrictValidation !== false;
      this.customValidators = new Map();

      this.registerDefaultValidators();
    }
  }
  ```

- [x] **Implement pre-execution validation**
  ```javascript
  async validateBeforeExecution(task, context) {
    const errors = [];
    const warnings = [];

    const structureResult = await this.validateTaskStructure(task);
    errors.push(...structureResult.errors);
    warnings.push(...structureResult.warnings);

    if (task.tool || task.toolName) {
      const toolResult = await this.validateToolExists(task.tool || task.toolName);
      if (!toolResult.exists) {
        errors.push(`Tool not found: ${task.tool || task.toolName}`);
      } else if (toolResult.warnings) {
        warnings.push(...toolResult.warnings);
      }
    }

    if (task.requires && Array.isArray(task.requires)) {
      const contextResult = await this.validateContextRequirements(task.requires, context);
      errors.push(...contextResult.errors);
      warnings.push(...contextResult.warnings);
    }

    if (task.inputSchema && (task.params || task.parameters || task.inputs)) {
      const inputResult = await this.validateInputParameters(task);
      errors.push(...inputResult.errors);
      warnings.push(...inputResult.warnings);
    }

    for (const validator of this.preValidators) {
      const result = await validator(task, context);
      if (result?.errors) errors.push(...result.errors);
      if (result?.warnings) warnings.push(...result.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      phase: 'pre-execution'
    };
  }
  ```

- [x] **Add post-execution verification**
  ```javascript
  async validateAfterExecution(task, result, context) {
    const checks = [];
    const errors = [];
    const warnings = [];

    if (task.outputSchema) {
      const schemaResult = await this.validateSchema(result, task.outputSchema);
      checks.push({ name: 'output_schema', passed: schemaResult.valid, details: schemaResult });
      if (!schemaResult.valid) {
        errors.push(`Output schema validation failed: ${schemaResult.errors.join(', ')}`);
      }
    }

    if (task.createsFiles && Array.isArray(task.createsFiles)) {
      for (const filePath of task.createsFiles) {
        const fileResult = await this.validateFileExists(filePath);
        checks.push({ name: `file_${filePath}`, passed: fileResult.exists, details: fileResult });
        if (!fileResult.exists) {
          errors.push(`Expected file not created: ${filePath}`);
        }
      }
    }

    if (task.tool || task.toolName) {
      const toolResult = await this.validateToolResult(result, task);
      checks.push({ name: 'tool_result_format', passed: toolResult.valid, details: toolResult });
      if (!toolResult.valid) {
        errors.push(`Tool result validation failed: ${toolResult.errors.join(', ')}`);
      }
    }

    if (task.validators && Array.isArray(task.validators)) {
      for (const validator of task.validators) {
        const passed = await validator(result, context, task);
        checks.push({ name: validator.name || 'custom_validator', passed: Boolean(passed) });
        if (!passed) {
          errors.push(`Custom validator failed: ${validator.name || 'unknown'}`);
        }
      }
    }

    for (const [name, validator] of this.customValidators) {
      const validatorResult = await validator(result, context, task);
      checks.push({ name, passed: validatorResult.valid || false, details: validatorResult });
      if (!validatorResult.valid) {
        errors.push(`${name} validation failed: ${validatorResult.message || 'unknown error'}`);
      }
    }

    for (const validator of this.postValidators) {
      const validatorResult = await validator(task, result, context);
      if (validatorResult?.errors) errors.push(...validatorResult.errors);
      if (validatorResult?.warnings) warnings.push(...validatorResult.warnings);
      if (validatorResult?.checks) checks.push(...validatorResult.checks);
    }

    return {
      valid: checks.length === 0 || checks.every(c => c.passed),
      checks,
      errors,
      warnings,
      phase: 'post-execution'
    };
  }
  ```

### 3.4 Testing

- [ ] **Unit test RetryManager**
  - File: `__tests__/unit/retry/RetryManager.test.js`
  - Test exponential backoff
  - Test circuit breaker
  - Test retry conditions

- [x] **Unit test error classification**
  - File: `__tests__/unit/errors/ErrorRecovery.test.js`
  - Test error types
  - Test recovery strategies
  - Test fallback mechanisms

- [x] **Integration test error recovery**
  - File: `__tests__/integration/ErrorRecoveryIntegration.test.js`
  - Test network failures
  - Test LLM failures
  - Test tool failures

---

## Phase 4: Strategy Selection Intelligence (Priority 4)
**Goal**: Improve strategy selection based on task characteristics  
**Timeline**: Days 13-16

### 4.1 Create Task Analyzer

#### New File: `src/analysis/TaskAnalyzer.js`

- [x] **Implement complexity scoring**
  ```javascript
  async analyzeComplexity(task) {
    const analysis = {
      structural: 0,
      computational: 0,
      dependency: 0,
      overallComplexity: 0,
      factors: []
    };

    if (task.subtasks && Array.isArray(task.subtasks)) {
      analysis.structural += task.subtasks.length * 0.2;
      analysis.factors.push(`${task.subtasks.length} subtasks`);

      const nestedLevels = this.calculateNestingLevels(task.subtasks);
      analysis.structural += nestedLevels * 0.3;
      if (nestedLevels > 1) {
        analysis.factors.push(`${nestedLevels} nesting levels`);
      }
    }

    if (task.tool || task.toolName) {
      analysis.computational += 0.3;
      analysis.factors.push('tool execution');
    }

    if (task.execute || task.fn) {
      analysis.computational += 0.4;
      analysis.factors.push('custom function');
    }

    if (task.prompt || task.description) {
      analysis.computational += 0.5;
      analysis.factors.push('LLM processing');
    }

    if (task.dependencies && Array.isArray(task.dependencies)) {
      analysis.dependency += task.dependencies.length * 0.15;
      analysis.factors.push(`${task.dependencies.length} dependencies`);
    }

    analysis.overallComplexity = Math.min(
      analysis.structural + analysis.computational + analysis.dependency,
      1.0
    );

    return analysis;
  }
  ```

- [ ] **Add pattern recognition**
  ```javascript
  recognizePattern(task) {
    const patterns = {
      'simple_tool': /^(create|write|read|delete|update)\s+\w+/i,
      'multi_step': /(then|after|next|finally)/i,
      'analysis': /(analyze|investigate|research|explore)/i,
      'generation': /(generate|create|build|develop)/i
    };
    
    const description = task.description || '';
    for (const [name, pattern] of Object.entries(patterns)) {
      if (pattern.test(description)) {
        return name;
      }
    }
    return 'unknown';
  }
  ```

- [x] **Implement strategy recommendation**
  ```javascript
  async recommendStrategy(complexityAnalysis, dependencyAnalysis, resourceAnalysis, parallelizationAnalysis, context) {
    const recommendation = {
      strategy: 'AtomicExecutionStrategy',
      reasoning: [],
      alternatives: [],
      parameters: {}
    };

    if (dependencyAnalysis.hasCircular) {
      recommendation.strategy = 'AtomicExecutionStrategy';
      recommendation.reasoning.push('Circular dependencies detected, requiring atomic execution');
      return recommendation;
    }

    if (parallelizationAnalysis.canParallelize && parallelizationAnalysis.efficiency > 0.6) {
      recommendation.strategy = 'ParallelExecutionStrategy';
      recommendation.reasoning.push(`High parallelization efficiency (${Math.round(parallelizationAnalysis.efficiency * 100)}%)`);
      recommendation.parameters.maxConcurrency = Math.min(parallelizationAnalysis.maxParallelism, 10);
      recommendation.alternatives.push({
        strategy: 'SequentialExecutionStrategy',
        reason: 'Conservative fallback if parallel execution fails'
      });
    } else if (complexityAnalysis.overallComplexity > 0.6 && !dependencyAnalysis.hasCircular) {
      recommendation.strategy = 'RecursiveExecutionStrategy';
      recommendation.reasoning.push(`High complexity (${Math.round(complexityAnalysis.overallComplexity * 100)}%) benefits from recursive decomposition`);
      recommendation.alternatives.push({
        strategy: 'SequentialExecutionStrategy',
        reason: 'Fallback for linear execution if recursion fails'
      });
    } else if (dependencyAnalysis.count > 0) {
      recommendation.strategy = 'SequentialExecutionStrategy';
      recommendation.reasoning.push(`${dependencyAnalysis.count} dependencies require ordered execution`);
      recommendation.alternatives.push({
        strategy: 'AtomicExecutionStrategy',
        reason: 'Simplest fallback for ordered tasks'
      });
    } else {
      recommendation.reasoning.push('Simple task structure suitable for atomic execution');
    }

    return recommendation;
  }
  ```

### 4.2 Update ExecutionStrategyResolver

#### File: `src/core/strategies/ExecutionStrategyResolver.js`

- [ ] **Integrate TaskAnalyzer**
  ```javascript
  // Line ~15 in constructor
  this.taskAnalyzer = new TaskAnalyzer();
  ```

- [ ] **Fix atomic flag handling**
  ```javascript
  // Line ~80 in selectStrategy()
  if (task.atomic === true) {
    this.logger.info('Atomic flag set, using AtomicExecutionStrategy');
    return this.getStrategy('AtomicExecutionStrategy');
  }
  ```

- [ ] **Add smart heuristics**
  ```javascript
  // Line ~90 in selectStrategy()
  const recommendation = this.taskAnalyzer.recommendStrategy(task, context);
  this.logger.debug(`TaskAnalyzer recommends: ${recommendation}`);
  
  // Check if recommended strategy can handle the task
  const strategy = this.getStrategy(recommendation);
  if (strategy && strategy.canHandle(task, context)) {
    return strategy;
  }
  ```

- [ ] **Support manual override**
  ```javascript
  // Line ~70 in selectStrategy()
  if (task.strategy) {
    const override = this.getStrategy(task.strategy);
    if (override) {
      this.logger.info(`Using manual strategy override: ${task.strategy}`);
      return override;
    }
  }
  ```

### 4.3 Testing

- [x] **Unit test TaskAnalyzer**
  - File: `__tests__/unit/analysis/TaskAnalyzer.test.js`
  - Test complexity scoring
  - Test pattern recognition
  - Test recommendations

- [ ] **Integration test strategy selection**
  - File: `__tests__/integration/ROMAAgentWithTaskAnalyzer.test.js` (partial coverage, add atomic flag/manual override scenarios)
  - Test atomic flag handling
  - Test pattern-based selection
  - Test manual overrides

---

## Phase 5: Testing & Verification (Priority 5)
**Goal**: Comprehensive test coverage for all improvements  
**Timeline**: Days 17-20

### 5.1 Unit Test Suite

- [ ] **Create test fixtures**
  ```javascript
  // File: __tests__/fixtures/tasks.js
  export const simpleTasks = [
    { description: 'Write hello world to file', atomic: true },
    { description: 'Read configuration file', tool: 'file_read' }
  ];
  
  export const complexTasks = [
    { description: 'Build a complete web application with frontend and backend' },
    { description: 'Analyze codebase and generate documentation' }
  ];
  ```

- [ ] **Mock LLM responses**
  ```javascript
  // File: __tests__/fixtures/llmResponses.js
  export const mockDecomposition = {
    subtasks: [
      { id: '1', description: 'Setup project' },
      { id: '2', description: 'Create files' }
    ],
    strategy: 'sequential'
  };
  ```

### 5.2 Integration Test Suite

- [x] **End-to-end execution test**
  ```javascript
  // File: __tests__/integration/ROMAAgent.integration.test.js
  describe('ROMAAgent Integration', () => {
    it('executes real tasks end-to-end with retries and recovery', async () => {
      const agent = new ROMAAgent();
      await agent.initialize();

      const result = await agent.execute({
        description: 'Generate project README with summary',
        maxRetries: 3
      });

      expect(result.success).toBe(true);
      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.retryCount).toBeLessThanOrEqual(3);
    });
  });
  ```

- [x] **Progress event verification**
  ```javascript
  // File: __tests__/integration/progressTracking.test.js
  it('emits detailed progress events with percentages and timestamps', async () => {
    const agent = new ROMAAgent();
    await agent.initialize();

    const events = [];
    agent.on('progress', event => events.push(event));

    await agent.execute({ description: 'Execute tracked task', atomic: true });

    const progressEvents = events.filter(e => e.type === 'progress_update' || e.status === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);
    progressEvents.forEach(event => {
      expect(event.taskId).toBeDefined();
      if (event.percentage !== undefined) {
        expect(event.percentage).toBeGreaterThanOrEqual(0);
        expect(event.percentage).toBeLessThanOrEqual(100);
      }
    });
  });
  ```

### 5.3 Performance Benchmarks

- [x] **Create benchmark suite**
  ```javascript
  // File: __tests__/integration/PerformanceBenchmarks.test.js
  describe('ROMA Agent Performance Benchmarks', () => {
    it('measures strategy execution times and concurrency', async () => {
      const agent = new ROMAAgent({ maxConcurrency: 4, enableTaskAnalyzer: true });
      await agent.initialize();

      const concurrentTasks = Array.from({ length: 10 }, (_, index) => ({
        id: `concurrent-${index}`,
        tool: 'calculator',
        params: { expression: `${index + 1} * 2` }
      }));

      const startTime = Date.now();
      const results = await Promise.all(concurrentTasks.map(task => agent.execute(task)));

      results.forEach(result => expect(result.success).toBe(true));
      expect(Date.now() - startTime).toBeLessThan(20000);
    });
  });
  ```

- [x] **Track performance metrics**
  ```javascript
  // File: __tests__/integration/PerformanceBenchmarks.test.js
  it('tracks learning performance and keeps analysis fast', async () => {
    const analyzer = new TaskAnalyzer({ enableLearning: true, maxHistorySize: 1000 });

    for (let i = 0; i < 500; i++) {
      analyzer.recordPerformance(
        i % 2 === 0 ? 'AtomicExecutionStrategy' : 'ParallelExecutionStrategy',
        { complexity: { overallComplexity: Math.random() } },
        { success: Math.random() > 0.1, duration: Math.random() * 2000 + 500 }
      );
    }

    const analysisStart = Date.now();
    const analysis = await analyzer.analyzeTask({ id: 'perf-test', tool: 'calculator' });
    const analysisTime = Date.now() - analysisStart;

    expect(analysis.recommendation.strategy).toBeDefined();
    expect(analysisTime).toBeLessThan(100);
  });
  ```

### 5.4 Coverage Reports

- [ ] **Configure Jest coverage**
  ```json
  // In package.json
  "jest": {
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/**/*.test.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 90,
        "statements": 90
      }
    }
  }
  ```

- [ ] **Create coverage npm scripts**
  ```json
  "scripts": {
    "test:coverage": "jest --coverage",
    "test:coverage:html": "jest --coverage --coverageReporters=html"
  }
  ```

---

## Implementation Schedule

### Week 1 (Days 1-5)
- [x] Complete Phase 1: Tool Registry Fix ✅ 2025-09-17
- [x] Start Phase 2: Progress Monitoring
- [ ] Daily testing of changes
- [ ] Documentation updates

### Week 2 (Days 6-10)
- [x] Complete Phase 2: Progress Monitoring
- [ ] Complete Phase 3: Error Recovery
- [x] Integration testing
- [x] Performance benchmarking

### Week 3 (Days 11-15)
- [ ] Complete Phase 4: Strategy Selection
- [ ] Start Phase 5: Testing Suite
- [ ] Code review and refactoring
- [ ] Documentation review

### Week 4 (Days 16-20)
- [ ] Complete Phase 5: Testing Suite
- [ ] Final integration testing
- [ ] Performance optimization
- [ ] Deployment preparation

---

## Success Criteria

### Functional Requirements
- [ ] Tool registry available 100% of the time
- [ ] Progress events emitted at least every 5 seconds
- [ ] Retry logic handles transient failures
- [ ] Strategy selection respects atomic flag
- [ ] All tests passing with >90% coverage

### Performance Requirements
- [ ] Simple tasks execute in <5 seconds
- [ ] Complex tasks show progress within 2 seconds
- [ ] Memory usage stays under 512MB
- [ ] No memory leaks after 100 executions

### Quality Requirements
- [ ] Zero critical bugs in production
- [ ] All error messages are actionable
- [ ] Documentation is complete and accurate
- [ ] Code follows Clean Code principles

---

## Risk Mitigation

### Technical Risks
- [ ] **Risk**: Breaking changes to existing API
  - **Mitigation**: All changes maintain backward compatibility
  - **Validation**: Run existing test suite before each phase

- [ ] **Risk**: Performance degradation
  - **Mitigation**: Benchmark before and after changes
  - **Validation**: Performance tests in CI/CD

### Process Risks
- [ ] **Risk**: Scope creep
  - **Mitigation**: Strict adherence to defined phases
  - **Validation**: Daily progress reviews

- [ ] **Risk**: Integration issues
  - **Mitigation**: Test each phase independently
  - **Validation**: Integration tests after each phase

---

## Monitoring and Rollback

### Monitoring Points
- [ ] Tool execution success rate
- [ ] Average execution time
- [ ] Progress event frequency
- [ ] Error recovery success rate
- [ ] Memory usage trends

### Rollback Plan
1. [ ] Each phase can be reverted independently
2. [ ] Feature flags for new functionality
3. [ ] Versioned releases for easy rollback
4. [ ] Database migrations are reversible

---

## Documentation Updates

### Code Documentation
- [ ] JSDoc comments for all new methods
- [ ] README updates for new features
- [ ] API documentation updates
- [ ] Migration guide for breaking changes

### User Documentation
- [ ] Updated usage examples
- [ ] New feature guides
- [ ] Troubleshooting guide
- [ ] Performance tuning guide

---

## Sign-off Checklist

### Before Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Rollback plan tested

### After Deployment
- [ ] Monitor error rates for 24 hours
- [ ] Verify performance metrics
- [ ] Collect user feedback
- [ ] Address any critical issues
- [ ] Plan next iteration

---

## Notes

This implementation plan is designed to be executed incrementally with clear checkpoints for validation. Each phase builds upon the previous one, but can also function independently if needed. The focus is on maintaining stability while improving robustness and reliability.

Regular communication and progress updates should be maintained throughout the implementation to ensure alignment with team expectations and project goals.
