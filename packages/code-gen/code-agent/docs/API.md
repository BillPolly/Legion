# Code-Agent API Documentation

## Overview

The `@jsenvoy/code-agent` package provides an AI-powered code generation system with real-world testing capabilities. This document covers the complete API for both the base CodeAgent and the enhanced version with runtime testing.

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Classes](#core-classes)
4. [Enhanced Classes](#enhanced-classes)
5. [Configuration Options](#configuration-options)
6. [Events](#events)
7. [API Reference](#api-reference)

## Installation

```bash
npm install @jsenvoy/code-agent
```

## Quick Start

### Using Base CodeAgent (Mocked Testing)

```javascript
import { CodeAgent } from '@jsenvoy/code-agent';

const agent = new CodeAgent({
  projectType: 'fullstack',
  enableConsoleOutput: true
});

await agent.initialize('./my-project');

const result = await agent.develop({
  projectName: 'My App',
  description: 'A todo list application',
  features: ['CRUD operations', 'User authentication']
});
```

### Using Enhanced CodeAgent (Real Testing)

```javascript
import { EnhancedCodeAgent } from '@jsenvoy/code-agent';

const agent = new EnhancedCodeAgent({
  projectType: 'fullstack',
  enhancedConfig: {
    enableRuntimeTesting: true,
    enableBrowserTesting: true,
    enableLogAnalysis: true
  }
});

await agent.initialize('./my-project');

const result = await agent.develop({
  projectName: 'My App',
  description: 'A todo list application',
  features: ['CRUD operations', 'User authentication']
});
```

## Core Classes

### CodeAgent

The main orchestrator for code generation with mocked testing.

```javascript
class CodeAgent extends EventEmitter {
  constructor(config?: CodeAgentConfig);
  
  // Initialize the agent
  async initialize(workingDirectory: string, options?: InitOptions): Promise<void>;
  
  // Generate a complete project
  async develop(requirements: Requirements): Promise<ProjectSummary>;
  
  // Fix specific issues
  async fix(fixRequirements: FixRequirements): Promise<FixSummary>;
  
  // Get project summary
  getProjectSummary(): ProjectSummary;
}
```

### UnifiedPlanner

AI-powered project planning system.

```javascript
class UnifiedPlanner {
  constructor(config: PlannerConfig);
  
  // Plan a project
  async planProject(requirements: Requirements): Promise<ProjectPlan>;
  
  // Update existing plan
  async updatePlan(currentPlan: ProjectPlan, changes: PlanChanges): Promise<ProjectPlan>;
}
```

## Enhanced Classes

### EnhancedCodeAgent

Extended CodeAgent with real runtime testing capabilities.

```javascript
class EnhancedCodeAgent extends CodeAgent {
  constructor(config?: EnhancedCodeAgentConfig);
  
  // All CodeAgent methods plus:
  
  // Run enhanced quality checks
  async runEnhancedQualityChecks(): Promise<EnhancedQualityResults>;
  
  // Run comprehensive testing
  async runComprehensiveTesting(): Promise<ComprehensiveTestResults>;
  
  // Run enhanced fixing
  async runEnhancedFixing(): Promise<EnhancedFixResults>;
}
```

### RuntimeIntegrationManager

Manages integration with runtime testing tools.

```javascript
class RuntimeIntegrationManager extends EventEmitter {
  constructor(config: RuntimeConfig);
  
  // Initialize runtime components
  async initialize(): Promise<void>;
  
  // Start runtime testing
  async startRuntimeTesting(testConfig: TestConfig): Promise<RuntimeResults>;
  
  // Cleanup resources
  async cleanup(): Promise<void>;
}
```

### EnhancedQualityPhase

Real quality validation with integrated tools.

```javascript
class EnhancedQualityPhase extends EventEmitter {
  constructor(config: QualityConfig);
  
  // Run quality checks
  async runQualityChecks(): Promise<QualityResults>;
  
  // Run ESLint checks
  async runLintChecks(): Promise<LintResults>;
  
  // Run Jest tests
  async runJestTests(): Promise<TestResults>;
}
```

### ComprehensiveTestingPhase

Orchestrated testing across all layers.

```javascript
class ComprehensiveTestingPhase extends EventEmitter {
  constructor(config: TestingConfig);
  
  // Run all tests
  async runAllTests(config: TestRunConfig): Promise<ComprehensiveResults>;
  
  // Run specific test suite
  async runTestSuite(suite: string, config?: TestConfig): Promise<TestResults>;
}
```

### EnhancedFixingPhase

AI-powered fixing with log-based insights.

```javascript
class EnhancedFixingPhase extends EventEmitter {
  constructor(config: FixingConfig);
  
  // Apply fixes
  async applyFixes(failures: TestFailures): Promise<FixResults>;
  
  // Iterative fixing
  async iterativeFix(options: IterativeFixOptions): Promise<IterativeResults>;
  
  // Fix quality issues
  async fixQualityIssues(qualityResults: QualityResults): Promise<QualityFixResults>;
}
```

### SystemHealthMonitor

Monitors system resources during code generation.

```javascript
class SystemHealthMonitor extends EventEmitter {
  constructor(config: HealthConfig);
  
  // Start monitoring
  async start(): Promise<void>;
  
  // Stop monitoring
  async stop(): Promise<void>;
  
  // Get current metrics
  async getCurrentMetrics(): Promise<SystemMetrics>;
  
  // Generate health report
  generateHealthReport(): HealthReport;
}
```

### PerformanceOptimizer

Optimizes code generation performance.

```javascript
class PerformanceOptimizer extends EventEmitter {
  constructor(config: OptimizerConfig);
  
  // Optimize task
  async optimizeTask(task: Task, options?: OptimizeOptions): Promise<TaskResult>;
  
  // Batch process tasks
  async batchProcess(tasks: Task[], options?: BatchOptions): Promise<TaskResult[]>;
  
  // Generate performance report
  generatePerformanceReport(): PerformanceReport;
}
```

## Configuration Options

### CodeAgentConfig

```typescript
interface CodeAgentConfig {
  projectType?: 'frontend' | 'backend' | 'fullstack';
  workingDirectory?: string;
  enableConsoleOutput?: boolean;
  eslintRules?: ESLintRules;
  testCoverage?: {
    threshold: number;
  };
  qualityGates?: {
    eslintErrors: number;
    eslintWarnings: number;
    testCoverage: number;
    allTestsPass: boolean;
  };
}
```

### EnhancedCodeAgentConfig

```typescript
interface EnhancedCodeAgentConfig extends CodeAgentConfig {
  enhancedConfig?: {
    enableRuntimeTesting?: boolean;
    enableBrowserTesting?: boolean;
    enableLogAnalysis?: boolean;
    enablePerformanceMonitoring?: boolean;
    runtimeTimeout?: number;
    browserHeadless?: boolean;
    parallelExecution?: boolean;
  };
}
```

### Requirements

```typescript
interface Requirements {
  projectName: string;
  description: string;
  features?: string[];
  technologies?: string[];
  constraints?: string[];
}
```

### ProjectPlan

```typescript
interface ProjectPlan {
  name: string;
  description: string;
  architecture: {
    frontend?: FrontendArchitecture;
    backend?: BackendArchitecture;
    database?: DatabaseSchema;
  };
  dependencies: Dependencies;
  fileStructure: FileStructure;
  testingStrategy: TestingStrategy;
}
```

## Events

### CodeAgent Events

```javascript
// Progress updates
agent.on('progress', (event) => {
  console.log(event.message);
});

// Phase lifecycle
agent.on('phase-start', (event) => {
  console.log(`Starting ${event.phase}: ${event.message}`);
});

agent.on('phase-complete', (event) => {
  console.log(`Completed ${event.phase}`);
});

// File operations
agent.on('file-created', (event) => {
  console.log(`Created: ${event.filename}`);
});

// Errors and warnings
agent.on('error', (event) => {
  console.error(`Error: ${event.message}`);
});

agent.on('warning', (event) => {
  console.warn(`Warning: ${event.message}`);
});
```

### Enhanced Events

```javascript
// Runtime events
agent.on('runtime:log', (event) => {
  console.log(`Runtime: ${event.message}`);
});

agent.on('runtime:error', (event) => {
  console.error(`Runtime Error: ${event.message}`);
});

// Health monitoring
agent.healthMonitor.on('warning', (event) => {
  console.warn(`Health Warning: ${event.metric} at ${event.value}%`);
});

// Performance metrics
agent.performanceOptimizer.on('batch:progress', (event) => {
  console.log(`Batch Progress: ${event.percentage}%`);
});
```

## API Reference

### Methods

#### initialize(workingDirectory, options)

Initialize the CodeAgent in a specified directory.

**Parameters:**
- `workingDirectory` (string): Path to the working directory
- `options` (object): Optional configuration
  - `llmConfig`: LLM provider configuration
  - `fileOpsConfig`: File operations configuration
  - `runtimeConfig`: Runtime integration configuration (Enhanced only)

**Returns:** Promise<void>

**Example:**
```javascript
await agent.initialize('./my-project', {
  llmConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
  }
});
```

#### develop(requirements)

Generate a complete project from requirements.

**Parameters:**
- `requirements` (Requirements): Project requirements

**Returns:** Promise<ProjectSummary>

**Example:**
```javascript
const result = await agent.develop({
  projectName: 'Todo App',
  description: 'A simple todo list application',
  features: [
    'Add/remove tasks',
    'Mark tasks as complete',
    'Filter tasks by status'
  ],
  technologies: ['React', 'Node.js', 'MongoDB']
});
```

#### fix(fixRequirements)

Fix specific issues in the generated code.

**Parameters:**
- `fixRequirements` (FixRequirements): Description of issues to fix

**Returns:** Promise<FixSummary>

**Example:**
```javascript
const result = await agent.fix({
  issues: [
    'Tests are failing for user authentication',
    'ESLint errors in api.js'
  ],
  priority: 'high'
});
```

### EnhancedCodeAgent Methods

#### runEnhancedQualityChecks()

Run real quality validation with integrated tools.

**Returns:** Promise<EnhancedQualityResults>

**Example:**
```javascript
const qualityResults = await agent.runEnhancedQualityChecks();
console.log(`ESLint errors: ${qualityResults.eslint.errorCount}`);
console.log(`Test coverage: ${qualityResults.coverage.percentage}%`);
```

#### runComprehensiveTesting()

Execute comprehensive test suite across all layers.

**Returns:** Promise<ComprehensiveTestResults>

**Example:**
```javascript
const testResults = await agent.runComprehensiveTesting();
console.log(`Total tests: ${testResults.summary.total}`);
console.log(`Passed: ${testResults.summary.passed}`);
console.log(`Failed: ${testResults.summary.failed}`);
```

#### runEnhancedFixing()

Apply AI-powered fixes with log insights.

**Returns:** Promise<EnhancedFixResults>

**Example:**
```javascript
const fixResults = await agent.runEnhancedFixing();
console.log(`Iterations: ${fixResults.iterations}`);
console.log(`Fixes applied: ${fixResults.totalFixes}`);
```

### Helper Methods

#### getProjectSummary()

Get a summary of the generated project.

**Returns:** ProjectSummary

**Example:**
```javascript
const summary = agent.getProjectSummary();
console.log(`Files generated: ${summary.filesGenerated}`);
console.log(`Tests created: ${summary.testsCreated}`);
```

#### generateEnhancedSummary()

Get enhanced summary with runtime metrics (Enhanced only).

**Returns:** Promise<EnhancedSummary>

**Example:**
```javascript
const summary = await agent.generateEnhancedSummary();
console.log(`Runtime tests executed: ${summary.enhanced.runtimeTesting.testsExecuted}`);
console.log(`Browser scenarios: ${summary.enhanced.browserTesting.scenarios}`);
```

## Error Handling

All methods can throw errors. Use try-catch blocks:

```javascript
try {
  await agent.develop(requirements);
} catch (error) {
  console.error('Development failed:', error.message);
  // Access detailed error information
  if (error.phase) {
    console.error('Failed during phase:', error.phase);
  }
  if (error.details) {
    console.error('Error details:', error.details);
  }
}
```

## Best Practices

1. **Always initialize before use**
   ```javascript
   await agent.initialize(workingDir);
   ```

2. **Handle events for better visibility**
   ```javascript
   agent.on('progress', (e) => console.log(e.message));
   agent.on('error', (e) => console.error(e.message));
   ```

3. **Use appropriate configuration**
   ```javascript
   const agent = new EnhancedCodeAgent({
     projectType: 'fullstack',
     enhancedConfig: {
       parallelExecution: true,
       runtimeTimeout: 300000
     }
   });
   ```

4. **Clean up resources**
   ```javascript
   // Enhanced agent cleanup
   await agent.cleanup();
   ```

5. **Monitor system health**
   ```javascript
   agent.healthMonitor.on('warning', (data) => {
     if (data.metric === 'memory' && data.value > 90) {
       // Take action
     }
   });
   ```

## Advanced Usage

### Custom Fix Strategies

```javascript
const fixingPhase = new EnhancedFixingPhase({
  strategies: ['syntax', 'logic', 'performance', 'custom'],
  customStrategies: {
    custom: new MyCustomStrategy()
  }
});
```

### Parallel Test Execution

```javascript
const testingPhase = new ComprehensiveTestingPhase({
  parallel: true,
  maxWorkers: 8,
  timeout: 120000
});

const results = await testingPhase.runAllTests({
  includeUnit: true,
  includeIntegration: true,
  includeE2E: true
});
```

### Performance Optimization

```javascript
const optimizer = new PerformanceOptimizer({
  enableCaching: true,
  cacheSize: 200, // MB
  batchSize: 20
});

const tasks = generateTasks();
const results = await optimizer.batchProcess(tasks);
```

## Troubleshooting

### Common Issues

1. **Memory Issues**
   - Increase Node.js memory: `NODE_OPTIONS='--max-old-space-size=4096'`
   - Enable garbage collection: `node --expose-gc`

2. **Test Timeouts**
   - Increase timeout in config: `runtimeTimeout: 600000`
   - Use parallel execution: `parallelExecution: true`

3. **LLM Rate Limits**
   - Implement retry logic
   - Use caching for repeated operations

### Debug Mode

Enable debug logging:

```javascript
const agent = new EnhancedCodeAgent({
  debug: true,
  logLevel: 'verbose'
});
```

## Migration from Mocked to Real Testing

See [Migration Guide](./MIGRATION.md) for detailed instructions on migrating from mocked testing to real runtime testing.

## Examples

See the [examples](../examples) directory for complete working examples.

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/user/code-agent).