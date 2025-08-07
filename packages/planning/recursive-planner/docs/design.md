# 🧠 Recursive Planning Agent Framework - Complete Design

## Executive Summary

This document provides a comprehensive design for a modular, recursive agent framework where agents plan, reason, delegate to tools or sub-agents, and report results. The framework supports scalable, general-purpose intelligent systems based on LLM-driven reasoning and tool use, with production-ready considerations for error handling, resource management, observability, and testing.

## Core Architecture

### System Overview

The framework implements a recursive execution tree where each node is either an autonomous, stateful agent or a stateless tool. Agents can spawn sub-agents, delegate work, and coordinate complex multi-step operations.

```
[PlanningAgent: main]
└── Plan:
    ├── Step 1: Design CLI       → [SpecialistAgent: UX Planner]
    ├── Step 2: Implement parser → [PlanningAgent: CLI Coder]
    │     ├── Write function     → [Tool: writeFunction]
    │     ├── Generate tests     → [Tool: generateTests]
    │     └── Validate           → [Tool: runTests]
    └── Step 3: Write docs       → [Tool: generateDocs]
```

## Type Definitions

### Base Interfaces

```typescript
// Common interface for anything callable
interface Executable {
  name: string;
  description: string;
  run(input: any): Promise<any>;
}

// Agent state management
interface AgentState {
  goal: string;
  plan: PlanStep[];
  stepPointer: number;
  workingMemory: ArtifactStore;
  lastResult: any;
  resourceUsage: ResourceMetrics;
  executionTrace: TraceSpan[];
}

// Individual plan steps
interface PlanStep {
  id: string;
  description: string;
  tool: string;
  params: Record<string, any>;
  dependencies: string[]; // IDs of steps that must complete first
  status: "pending" | "in_progress" | "done" | "error" | "skipped";
  result?: any;
  error?: Error;
  retryCount: number;
  startTime?: number;
  endTime?: number;
}

// Artifact storage and management
interface ArtifactStore {
  artifacts: Map<string, Artifact>;
  store(key: string, value: any, metadata?: ArtifactMetadata): void;
  retrieve(key: string): any;
  summarize(key: string): string;
  listArtifacts(): ArtifactSummary[];
  getSize(): number;
  clear(): void;
}

interface Artifact {
  id: string;
  type: 'code' | 'document' | 'data' | 'model' | 'binary';
  content: any;
  encoding?: string;
  checksum?: string;
  size: number;
  created: number;
  modified: number;
  metadata: ArtifactMetadata;
}

interface ArtifactMetadata {
  source?: string;
  version?: string;
  dependencies?: string[];
  tags?: string[];
}
```

## Agent Types

### 1. PlanningAgent

The core recursive agent capable of planning, executing, reasoning, and delegating.

```typescript
class PlanningAgent implements Executable {
  constructor(
    private config: AgentConfig,
    private planningStrategy: PlanningStrategy,
    private errorRecovery: ErrorRecoveryStrategy,
    private resourceConstraints: ResourceConstraints
  ) {}

  async run(goal: string, tools: Executable[], context: ExecutionContext): Promise<AgentResult> {
    const state = this.initializeState(goal, context);
    const span = this.tracer.startSpan('agent.run', {
      attributes: { agentName: this.config.name, goal }
    });

    try {
      // Generate initial plan
      span.addEvent('planning.start');
      state.plan = await this.planningStrategy.generatePlan(goal, tools, context);
      span.addEvent('planning.complete', { stepCount: state.plan.length });

      // Execute plan with reflection loop
      while (!this.isComplete(state)) {
        if (this.resourceConstraints.wouldExceedLimits(state)) {
          throw new ResourceExhaustedError('Resource limits exceeded');
        }

        const step = this.selectNextStep(state);
        const stepSpan = this.tracer.startSpan('agent.step', {
          parent: span,
          attributes: { stepId: step.id, tool: step.tool }
        });

        try {
          const result = await this.executeStep(step, tools, state);
          this.updateState(state, step, result);
          
          const decision = await this.reflect(state);
          await this.handleDecision(decision, state, tools);
          
          stepSpan.setStatus('success');
        } catch (error) {
          stepSpan.recordException(error);
          const recovery = await this.errorRecovery.handleError(error, step, state);
          await this.applyRecovery(recovery, state);
          stepSpan.setStatus('error');
        } finally {
          stepSpan.end();
        }
      }

      return this.prepareResult(state);
    } finally {
      span.end();
    }
  }

  private async reflect(state: AgentState): Promise<AgentDecision> {
    const prompt = this.buildReflectionPrompt(state);
    const response = await this.llm.complete(prompt);
    return this.parseDecision(response);
  }

  private buildReflectionPrompt(state: AgentState): string {
    return `
      ## Goal
      ${state.goal}

      ## Plan Progress
      ${this.summarizePlan(state.plan)}

      ## Last Step Executed
      ${this.summarizeStep(state.plan[state.stepPointer - 1])}

      ## Working Memory
      ${state.workingMemory.listArtifacts().map(a => `- ${a.key}: ${a.summary}`).join('\n')}

      ## Resource Usage
      Time elapsed: ${state.resourceUsage.timeElapsed}ms
      Memory used: ${state.resourceUsage.memoryMB}MB
      Tool calls: ${state.resourceUsage.toolCalls}

      ## Available Tools
      ${this.tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

      Respond with your decision in JSON format:
      {
        "type": "proceed" | "retry" | "insert_step" | "replan" | "terminate",
        "details": { ... },
        "reasoning": "explanation"
      }
    `;
  }
}
```

### 2. SpecialistAgent

Domain-focused agent with constrained toolset and specialized planning.

```typescript
class SpecialistAgent extends PlanningAgent {
  constructor(
    config: SpecialistConfig,
    private domain: DomainSpecification
  ) {
    super(
      config,
      new DomainConstrainedPlanningStrategy(domain),
      new DomainSpecificErrorRecovery(domain),
      domain.resourceConstraints
    );
  }

  async run(goal: string, tools: Executable[], context: ExecutionContext): Promise<AgentResult> {
    // Validate goal is within domain
    if (!this.domain.validateGoal(goal)) {
      throw new DomainMismatchError(`Goal outside domain: ${this.domain.name}`);
    }

    // Filter tools to domain-specific subset
    const domainTools = tools.filter(t => this.domain.allowedTools.includes(t.name));
    
    return super.run(goal, domainTools, {
      ...context,
      domainContext: this.domain.context
    });
  }
}
```

### 3. AtomicTool

Stateless, single-operation executable.

```typescript
class AtomicTool implements Executable {
  constructor(
    public name: string,
    public description: string,
    private implementation: ToolImplementation,
    private validator?: InputValidator
  ) {}

  async run(input: any): Promise<any> {
    if (this.validator) {
      const validation = this.validator.validate(input);
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }
    }

    const startTime = Date.now();
    try {
      const result = await this.implementation(input);
      this.metrics.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.recordFailure(Date.now() - startTime, error);
      throw error;
    }
  }
}
```

## Planning System

### Planning Strategy Interface

```typescript
interface PlanningStrategy {
  generatePlan(goal: string, tools: Executable[], context: any): Promise<PlanStep[]>;
  replan(currentPlan: PlanStep[], failedStep: PlanStep, context: any): Promise<PlanStep[]>;
  optimizePlan(plan: PlanStep[]): Promise<PlanStep[]>; // Identify parallelizable steps
}

// LLM-based planning implementation
class LLMPlanningStrategy implements PlanningStrategy {
  constructor(
    private llm: LLMProvider,
    private examples: PlanExample[]
  ) {}

  async generatePlan(goal: string, tools: Executable[], context: any): Promise<PlanStep[]> {
    const prompt = `
      Goal: ${goal}
      
      Available Tools:
      ${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}
      
      Context: ${JSON.stringify(context)}
      
      Examples of good plans:
      ${this.examples.map(e => this.formatExample(e)).join('\n\n')}
      
      Generate a step-by-step plan. Each step should specify:
      - Unique ID
      - Clear description
      - Which tool to use
      - Required parameters
      - Expected output
      - Dependencies on previous steps (by ID)
      
      Respond in JSON format:
      [
        {
          "id": "step_1",
          "description": "...",
          "tool": "...",
          "params": {},
          "dependencies": [],
          "expectedOutput": "..."
        }
      ]
    `;

    const response = await this.llm.complete(prompt);
    const plan = this.parsePlan(response);
    return this.validatePlan(plan, tools);
  }

  async optimizePlan(plan: PlanStep[]): Promise<PlanStep[]> {
    // Analyze dependencies to identify parallelizable steps
    const dependencyGraph = this.buildDependencyGraph(plan);
    const parallelGroups = this.findParallelGroups(dependencyGraph);
    
    return this.reorderForParallelism(plan, parallelGroups);
  }
}
```

## Error Handling & Recovery

### Error Classification and Recovery

```typescript
interface ErrorRecoveryStrategy {
  maxRetries: number;
  backoffMultiplier: number;
  fallbackTools: Map<string, string[]>;
  errorClassification: (error: Error) => ErrorType;
  handleError(error: Error, step: PlanStep, state: AgentState): Promise<RecoveryAction>;
}

enum ErrorType {
  TRANSIENT,      // Network issues, rate limits
  INVALID_INPUT,  // Bad parameters
  TOOL_FAILURE,   // Tool crashed
  PLANNING_ERROR, // Invalid plan
  RESOURCE_LIMIT, // Out of time/memory/budget
  UNRECOVERABLE   // Fatal error
}

interface RecoveryAction {
  type: 'retry' | 'substitute' | 'replan' | 'escalate' | 'terminate';
  details: any;
}

class AdaptiveErrorRecovery implements ErrorRecoveryStrategy {
  async handleError(error: Error, step: PlanStep, state: AgentState): Promise<RecoveryAction> {
    const errorType = this.errorClassification(error);
    const context = this.gatherErrorContext(error, step, state);
    
    switch(errorType) {
      case ErrorType.TRANSIENT:
        if (step.retryCount < this.maxRetries) {
          return {
            type: 'retry',
            details: {
              delay: this.calculateBackoff(step.retryCount),
              adjustedParams: await this.adjustParameters(step.params, error)
            }
          };
        }
        break;
        
      case ErrorType.INVALID_INPUT:
        return {
          type: 'replan',
          details: {
            scope: 'local',
            constraints: this.extractConstraintsFromError(error)
          }
        };
        
      case ErrorType.TOOL_FAILURE:
        const fallbacks = this.fallbackTools.get(step.tool);
        if (fallbacks?.length > 0) {
          return {
            type: 'substitute',
            details: {
              newTool: fallbacks[0],
              paramAdapter: this.getParamAdapter(step.tool, fallbacks[0])
            }
          };
        }
        break;
        
      case ErrorType.RESOURCE_LIMIT:
        return {
          type: 'escalate',
          details: {
            reason: 'Resource limits exceeded',
            partialResult: state.workingMemory.summarize('partial_progress')
          }
        };
    }
    
    return {
      type: 'terminate',
      details: { error: error.message, state: this.serializeState(state) }
    };
  }
}
```

## Inter-Agent Communication

### Message Protocol

```typescript
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'stream' | 'error' | 'cancel';
  payload: any;
  artifacts?: Artifact[];
  metadata: MessageMetadata;
}

interface MessageMetadata {
  timestamp: number;
  correlationId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  encoding?: string;
  compression?: string;
}

class AgentCommunicationBus {
  private queues = new Map<string, MessageQueue>();
  private handlers = new Map<string, MessageHandler>();
  
  async send(message: AgentMessage): Promise<void> {
    const queue = this.getQueue(message.to);
    await queue.enqueue(message);
    this.notifyHandler(message.to);
  }
  
  async sendAndWait(message: AgentMessage, timeout: number): Promise<AgentMessage> {
    const responsePromise = this.waitForResponse(message.id);
    await this.send(message);
    return Promise.race([
      responsePromise,
      this.timeout(timeout, message.id)
    ]);
  }
  
  subscribe(agentId: string, handler: MessageHandler): void {
    this.handlers.set(agentId, handler);
  }
}
```

## Resource Management

### Constraints and Monitoring

```typescript
interface ResourceConstraints {
  maxExecutionTime: number;
  maxMemoryMB: number;
  maxToolCalls: number;
  maxRecursionDepth: number;
  maxConcurrentSteps: number;
  costBudget?: CostBudget;
}

interface CostBudget {
  currency: string;
  totalAmount: number;
  costPerTool: Map<string, number>;
  costPerLLMToken: number;
  warningThreshold: number; // Percentage
}

interface ResourceMetrics {
  timeElapsed: number;
  memoryMB: number;
  toolCalls: number;
  llmTokens: number;
  recursionDepth: number;
  totalCost: number;
}

class ResourceManager {
  private metrics: ResourceMetrics = {
    timeElapsed: 0,
    memoryMB: 0,
    toolCalls: 0,
    llmTokens: 0,
    recursionDepth: 0,
    totalCost: 0
  };
  
  constructor(private constraints: ResourceConstraints) {}
  
  wouldExceedLimits(state: AgentState, projectedStep?: PlanStep): boolean {
    // Check time limit
    if (this.metrics.timeElapsed > this.constraints.maxExecutionTime) {
      return true;
    }
    
    // Check memory limit
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    if (currentMemory > this.constraints.maxMemoryMB) {
      return true;
    }
    
    // Check tool call limit
    if (this.metrics.toolCalls >= this.constraints.maxToolCalls) {
      return true;
    }
    
    // Check cost budget
    if (this.constraints.costBudget) {
      const projectedCost = this.projectCost(projectedStep);
      if (this.metrics.totalCost + projectedCost > this.constraints.costBudget.totalAmount) {
        return true;
      }
      
      // Warning threshold
      const percentUsed = (this.metrics.totalCost / this.constraints.costBudget.totalAmount) * 100;
      if (percentUsed > this.constraints.costBudget.warningThreshold) {
        this.emitWarning(`Cost budget ${percentUsed.toFixed(1)}% consumed`);
      }
    }
    
    return false;
  }
  
  recordUsage(step: PlanStep, result: any): void {
    this.metrics.toolCalls++;
    
    if (this.constraints.costBudget) {
      const toolCost = this.constraints.costBudget.costPerTool.get(step.tool) || 0;
      this.metrics.totalCost += toolCost;
    }
    
    // Record memory snapshot
    this.metrics.memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
  }
}
```

## Observability & Debugging

### Distributed Tracing

```typescript
interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, any>;
  events: TraceEvent[];
  links: SpanLink[];
  status: SpanStatus;
  error?: Error;
}

interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

interface SpanStatus {
  code: 'unset' | 'ok' | 'error';
  message?: string;
}

class DistributedTracer {
  private spans = new Map<string, TraceSpan>();
  private exporters: TraceExporter[] = [];
  
  startSpan(operation: string, options?: SpanOptions): TraceSpan {
    const span: TraceSpan = {
      spanId: this.generateSpanId(),
      traceId: options?.parent?.traceId || this.generateTraceId(),
      parentSpanId: options?.parent?.spanId,
      operation,
      startTime: Date.now(),
      attributes: options?.attributes || {},
      events: [],
      links: options?.links || [],
      status: { code: 'unset' }
    };
    
    this.spans.set(span.spanId, span);
    return span;
  }
  
  endSpan(span: TraceSpan): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    // Export to all configured exporters (Jaeger, Zipkin, etc.)
    this.exporters.forEach(exporter => {
      exporter.export([span]);
    });
  }
  
  addEvent(span: TraceSpan, name: string, attributes?: Record<string, any>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
  }
}
```

### Execution Visualization

```typescript
interface ExecutionVisualization {
  renderTree(trace: AgentTrace): string;
  renderTimeline(trace: AgentTrace): string;
  renderResourceGraph(metrics: ResourceMetrics[]): string;
}

class ConsoleVisualization implements ExecutionVisualization {
  renderTree(trace: AgentTrace): string {
    const root = this.buildTree(trace.spans);
    return this.formatTree(root, 0);
  }
  
  private formatTree(node: TreeNode, depth: number): string {
    const indent = '  '.repeat(depth);
    const status = node.span.status.code === 'ok' ? '✓' : '✗';
    const duration = node.span.duration ? `(${node.span.duration}ms)` : '';
    
    let result = `${indent}${status} ${node.span.operation} ${duration}\n`;
    
    for (const child of node.children) {
      result += this.formatTree(child, depth + 1);
    }
    
    return result;
  }
  
  renderTimeline(trace: AgentTrace): string {
    const sortedSpans = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
    const startTime = sortedSpans[0].startTime;
    
    return sortedSpans.map(span => {
      const relativeStart = span.startTime - startTime;
      const duration = span.duration || 0;
      const bar = '█'.repeat(Math.ceil(duration / 100));
      
      return `${relativeStart.toString().padStart(6)}ms | ${bar} ${span.operation}`;
    }).join('\n');
  }
}
```

## Testing Framework

### Mock Execution Environment

```typescript
class MockExecutionEnvironment {
  private mockTools = new Map<string, jest.Mock>();
  private executionLog: ExecutionEvent[] = [];
  private timeController = new MockTimeController();
  
  registerMockTool(name: string, implementation: Function | jest.Mock): void {
    const mock = typeof implementation === 'function' 
      ? jest.fn(implementation) 
      : implementation;
    this.mockTools.set(name, mock);
  }
  
  async runAgent(agent: PlanningAgent, goal: string, options?: TestOptions): Promise<TestResult> {
    // Intercept tool calls
    const wrappedTools = Array.from(this.mockTools.entries()).map(
      ([name, mock]) => new MockTool(name, mock, this.executionLog)
    );
    
    // Apply test constraints
    const testConstraints = {
      ...agent.resourceConstraints,
      maxExecutionTime: options?.timeout || 5000,
      maxToolCalls: options?.maxToolCalls || 100
    };
    
    const startTime = Date.now();
    try {
      const result = await agent.run(goal, wrappedTools, {
        testMode: true,
        mockTime: this.timeController
      });
      
      return {
        success: true,
        result,
        executionLog: this.executionLog,
        duration: Date.now() - startTime,
        toolCallCount: this.getToolCallCount()
      };
    } catch (error) {
      return {
        success: false,
        error,
        executionLog: this.executionLog,
        duration: Date.now() - startTime,
        toolCallCount: this.getToolCallCount()
      };
    }
  }
  
  getExecutionTrace(): ExecutionEvent[] {
    return [...this.executionLog];
  }
  
  assertToolCalledWith(toolName: string, expectedParams: any): void {
    const mock = this.mockTools.get(toolName);
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining(expectedParams)
    );
  }
  
  assertExecutionOrder(expectedOrder: string[]): void {
    const actualOrder = this.executionLog
      .filter(e => e.type === 'tool_call')
      .map(e => e.toolName);
    expect(actualOrder).toEqual(expectedOrder);
  }
}
```

### Test Cases

```typescript
describe('PlanningAgent', () => {
  let env: MockExecutionEnvironment;
  let agent: PlanningAgent;
  
  beforeEach(() => {
    env = new MockExecutionEnvironment();
    agent = new PlanningAgent({
      name: 'TestAgent',
      description: 'Agent for testing',
      maxRetries: 2
    });
  });
  
  describe('Error Recovery', () => {
    it('should retry transient failures', async () => {
      env.registerMockTool('dataFetcher', 
        jest.fn()
          .mockRejectedValueOnce(new Error('Network timeout'))
          .mockResolvedValueOnce({ data: 'success' })
      );
      
      const result = await env.runAgent(agent, 'Fetch important data');
      
      expect(result.success).toBe(true);
      expect(env.mockTools.get('dataFetcher')).toHaveBeenCalledTimes(2);
    });
    
    it('should use fallback tools when primary fails', async () => {
      env.registerMockTool('primaryAPI', 
        jest.fn().mockRejectedValue(new Error('Service unavailable'))
      );
      env.registerMockTool('backupAPI', 
        jest.fn().mockResolvedValue({ data: 'from backup' })
      );
      
      agent.errorRecovery.fallbackTools.set('primaryAPI', ['backupAPI']);
      
      const result = await env.runAgent(agent, 'Get data from API');
      
      expect(result.success).toBe(true);
      expect(result.result).toContain('from backup');
      env.assertToolCalledWith('backupAPI', {});
    });
    
    it('should respect resource limits', async () => {
      env.registerMockTool('expensiveTool', 
        jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { cost: 10 };
        })
      );
      
      agent.resourceConstraints.costBudget = {
        currency: 'USD',
        totalAmount: 25,
        costPerTool: new Map([['expensiveTool', 10]]),
        warningThreshold: 80
      };
      
      const result = await env.runAgent(agent, 'Run expensive operations');
      
      expect(env.mockTools.get('expensiveTool')).toHaveBeenCalledTimes(2);
      expect(result.error).toMatch(/Resource limits exceeded/);
    });
  });
  
  describe('Plan Execution', () => {
    it('should execute steps in dependency order', async () => {
      env.registerMockTool('stepA', jest.fn().mockResolvedValue({ a: 1 }));
      env.registerMockTool('stepB', jest.fn().mockResolvedValue({ b: 2 }));
      env.registerMockTool('stepC', jest.fn().mockResolvedValue({ c: 3 }));
      
      // Mock plan with dependencies: C depends on A and B
      agent.planningStrategy = {
        generatePlan: async () => [
          { id: '1', tool: 'stepA', dependencies: [] },
          { id: '2', tool: 'stepB', dependencies: [] },
          { id: '3', tool: 'stepC', dependencies: ['1', '2'] }
        ]
      };
      
      await env.runAgent(agent, 'Execute with dependencies');
      
      env.assertExecutionOrder(['stepA', 'stepB', 'stepC']);
    });
    
    it('should handle parallel execution', async () => {
      env.registerMockTool('parallel1', jest.fn().mockResolvedValue({ p1: 1 }));
      env.registerMockTool('parallel2', jest.fn().mockResolvedValue({ p2: 2 }));
      
      agent.planningStrategy = {
        generatePlan: async () => [
          { id: '1', tool: 'parallel1', dependencies: [] },
          { id: '2', tool: 'parallel2', dependencies: [] }
        ]
      };
      
      const result = await env.runAgent(agent, 'Execute in parallel');
      
      // Both should be called without waiting for each other
      const trace = env.getExecutionTrace();
      const parallel1Start = trace.find(e => e.toolName === 'parallel1')?.timestamp;
      const parallel2Start = trace.find(e => e.toolName === 'parallel2')?.timestamp;
      
      expect(Math.abs(parallel1Start - parallel2Start)).toBeLessThan(10);
    });
  });
});
```

## Complete Working Example

### Building a REST API

```typescript
// Define specialized agents
const schemaDesigner = new SpecialistAgent({
  name: "SchemaDesigner",
  domain: {
    name: "API Schema Design",
    allowedTools: ["generateOpenAPI", "validateSchema", "optimizeSchema"],
    context: { standards: ["OpenAPI 3.0", "JSON Schema"] }
  }
});

const endpointImplementer = new SpecialistAgent({
  name: "EndpointImplementer",
  domain: {
    name: "Endpoint Implementation",
    allowedTools: ["generateHandler", "generateValidation", "generateTests", "generateDocs"],
    context: { framework: "Express", language: "TypeScript" }
  }
});

// Define atomic tools
const tools = [
  new AtomicTool(
    "generateOpenAPI",
    "Generate OpenAPI specification from requirements",
    async (requirements: string) => {
      // LLM call to generate OpenAPI spec
      return { spec: "..." };
    }
  ),
  new AtomicTool(
    "generateHandler",
    "Generate endpoint handler code",
    async ({ endpoint, spec }) => {
      // Generate handler implementation
      return { code: "...", tests: "..." };
    }
  ),
  new AtomicTool(
    "assembleProject",
    "Combine all artifacts into project structure",
    async (artifacts: any[]) => {
      // Create project structure
      return { 
        projectPath: "./generated-api",
        files: ["src/index.ts", "src/routes/*.ts", "tests/*.test.ts"]
      };
    }
  )
];

// Main orchestrator agent
const apiBuilder = new PlanningAgent({
  name: "APIBuilder",
  description: "Builds complete REST APIs from specifications",
  planningStrategy: new LLMPlanningStrategy(llm, apiPlanExamples),
  errorRecovery: new AdaptiveErrorRecovery(),
  resourceConstraints: {
    maxExecutionTime: 300000, // 5 minutes
    maxMemoryMB: 512,
    maxToolCalls: 50,
    maxRecursionDepth: 5,
    maxConcurrentSteps: 3
  }
});

// Execution
async function buildAPI() {
  const goal = `
    Create a REST API for a todo application with:
    - CRUD operations for todos
    - User authentication
    - PostgreSQL database
    - Input validation
    - Comprehensive tests
  `;
  
  const allTools = [
    ...tools,
    makePlanningAgentTool(schemaDesigner),
    makePlanningAgentTool(endpointImplementer)
  ];
  
  try {
    const result = await apiBuilder.run(goal, allTools, {
      outputPath: "./generated-api",
      preferences: {
        framework: "Express",
        database: "PostgreSQL",
        testFramework: "Jest"
      }
    });
    
    console.log("API Generation Complete!");
    console.log("Generated files:", result.artifacts.files);
    console.log("Execution trace:", result.trace);
    
    // Visualize execution
    const viz = new ConsoleVisualization();
    console.log("\nExecution Tree:");
    console.log(viz.renderTree(result.trace));
    
    console.log("\nTimeline:");
    console.log(viz.renderTimeline(result.trace));
    
  } catch (error) {
    console.error("API generation failed:", error);
    console.log("Partial results:", error.partialResult);
  }
}

// Execute
buildAPI().then(() => process.exit(0));
```

## Production Deployment

### Configuration Management

```yaml
# agent-config.yaml
agents:
  - name: APIBuilder
    type: PlanningAgent
    strategy:
      type: LLM
      model: gpt-4
      temperature: 0.7
      examples:
        - file: ./examples/api-plans.json
    
    errorRecovery:
      maxRetries: 3
      backoffMultiplier: 2
      fallbacks:
        openai: [anthropic, local-llm]
        generateCode: [retrieveTemplate, scaffoldBasic]
    
    resources:
      maxExecutionTime: 300000
      maxMemoryMB: 512
      maxToolCalls: 50
      costBudget:
        totalAmount: 10.00
        currency: USD
        warningThreshold: 80

tools:
  - name: generateOpenAPI
    type: AtomicTool
    endpoint: http://tools-service/openapi
    timeout: 30000
    retries: 2

monitoring:
  tracing:
    enabled: true
    exporters:
      - type: jaeger
        endpoint: http://jaeger:14250
  
  metrics:
    enabled: true
    interval: 10000
    exporters:
      - type: prometheus
        port: 9090
  
  logging:
    level: info
    format: json
    outputs:
      - type: console
      - type: file
        path: /var/log/agents/
```

### Deployment Architecture

```typescript
// Kubernetes deployment
class AgentOrchestrator {
  private agents = new Map<string, PlanningAgent>();
  private scheduler: K8sScheduler;
  private monitoring: MonitoringStack;
  
  async deployAgent(config: AgentConfig): Promise<void> {
    // Create agent instance
    const agent = this.createAgent(config);
    
    // Deploy to Kubernetes
    await this.scheduler.deploy({
      name: config.name,
      replicas: config.replicas || 1,
      resources: {
        cpu: config.resources.cpu || "500m",
        memory: `${config.resources.maxMemoryMB}Mi`
      },
      env: {
        AGENT_CONFIG: JSON.stringify(config),
        TRACE_ENDPOINT: process.env.JAEGER_ENDPOINT,
        METRICS_PORT: "9090"
      }
    });
    
    // Register with service mesh
    await this.registerWithMesh(agent);
    
    // Start health checks
    this.monitoring.startHealthChecks(agent);
  }
  
  async scaleAgent(name: string, replicas: number): Promise<void> {
    await this.scheduler.scale(name, replicas);
  }
}
```

## Security Considerations

### Tool Sandboxing

```typescript
interface SecurityPolicy {
  allowedTools: string[];
  deniedTools: string[];
  resourceQuotas: ResourceConstraints;
  dataAccess: DataAccessPolicy;
  networkPolicy: NetworkPolicy;
}

class SecureToolExecutor {
  constructor(private policy: SecurityPolicy) {}
  
  async execute(tool: Executable, input: any): Promise<any> {
    // Validate tool is allowed
    if (!this.policy.allowedTools.includes(tool.name)) {
      throw new SecurityError(`Tool ${tool.name} not allowed by policy`);
    }
    
    // Create sandboxed environment
    const sandbox = await this.createSandbox({
      memory: this.policy.resourceQuotas.maxMemoryMB,
      timeout: this.policy.resourceQuotas.maxExecutionTime,
      network: this.policy.networkPolicy
    });
    
    try {
      // Execute in sandbox
      return await sandbox.run(tool, input);
    } finally {
      await sandbox.cleanup();
    }
  }
  
  private async createSandbox(config: SandboxConfig): Promise<Sandbox> {
    // Use Docker/gVisor/Firecracker for isolation
    return new DockerSandbox(config);
  }
}
```

## Performance Optimizations

### Plan Caching

```typescript
class PlanCache {
  private cache = new LRUCache<string, CachedPlan>({
    max: 1000,
    ttl: 1000 * 60 * 60 // 1 hour
  });
  
  async get(goal: string, context: any): Promise<PlanStep[] | null> {
    const key = this.generateKey(goal, context);
    const cached = this.cache.get(key);
    
    if (cached && this.isValid(cached)) {
      this.metrics.recordHit();
      return cached.plan;
    }
    
    this.metrics.recordMiss();
    return null;
  }
  
  async set(goal: string, context: any, plan: PlanStep[]): Promise<void> {
    const key = this.generateKey(goal, context);
    this.cache.set(key, {
      plan,
      created: Date.now(),
      hitCount: 0,
      successRate: 0
    });
  }
  
  updateMetrics(goal: string, context: any, success: boolean): void {
    const key = this.generateKey(goal, context);
    const cached = this.cache.get(key);
    if (cached) {
      cached.hitCount++;
      cached.successRate = (cached.successRate * (cached.hitCount - 1) + (success ? 1 : 0)) / cached.hitCount;
    }
  }
}
```

## Conclusion

This framework provides a robust foundation for building recursive, intelligent agent systems with:

- **Modularity**: Clear separation between planning, execution, and tools
- **Resilience**: Comprehensive error handling and recovery strategies
- **Observability**: Full tracing and monitoring capabilities
- **Scalability**: Resource management and deployment considerations
- **Security**: Sandboxing and policy enforcement
- **Testing**: Comprehensive testing framework for non-deterministic systems

The system can be extended with additional agent types, planning strategies, and tools while maintaining the core recursive execution model. Production deployment requires careful consideration of resource limits, monitoring, and security policies.