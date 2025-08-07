# Behavior Tree System Design

## Introduction & Vision

### What This System Is

The Behavior Tree (BT) system is a **revolutionary coordination language** that extends the RecursivePlanner framework with hierarchical, reactive workflow execution. Unlike traditional behavior trees, this system combines:

- **JSON configuration language** for defining complex coordination patterns
- **Pluggable node architecture** allowing infinite extensibility  
- **Message-passing communication** enabling real-time adaptation
- **Tool composition framework** for building sophisticated workflows from simple components

### Key Capabilities

**For Users:**
- Define complex workflows in simple JSON configurations
- Use LLM-generated coordination patterns with retry logic, fallbacks, and parallel execution
- Build self-adapting systems that respond to real-time conditions
- Compose sophisticated tools from simpler building blocks

**For Developers:**
- Create custom coordination patterns as simple JavaScript classes
- Extend the system with domain-specific workflow types
- Build reactive systems with continuous inter-node communication
- Maintain full backward compatibility with existing plan execution

**For LLMs:**
- Generate sophisticated coordination patterns beyond linear sequences
- Access rich vocabulary of coordination primitives (retry, parallel, circuit-breaker)
- Create adaptive workflows that handle real-world complexity automatically
- Use same validation pipeline ensuring correctness

### Relationship to Existing System

**Seamless Integration Principle:** The BT system enhances rather than replaces existing components:

- **Planning System**: LLMPlanningStrategy continues generating plans, now with richer target language
- **Plan Validation**: Existing validators work recursively on tree structures  
- **Tool Registry**: No changes needed - BT nodes reference tools through existing registry
- **Agent System**: PlanningAgent continues working, but uses BT execution internally

**Evolutionary Path:** BT JSON is a **perfect superset** of the current plan language, providing smooth migration from linear plans to hierarchical coordination.

## Core Architecture

### Unified Node-Tool Interface

**Fundamental Insight: Behavior Tree nodes ARE tools** - they share the same interface but specialize in coordination patterns.

```javascript
// Both tools and BT nodes implement the same interface
interface Executable {
  async execute(input): Promise<output>
  getMetadata(): Metadata
}

// Action node - executes atomic tools
class ActionNode implements Executable {
  async execute(context) {
    const tool = await toolRegistry.getTool(this.toolName);
    
    // Get tool's input schema to validate parameters
    const toolMeta = tool.getMetadata();
    const resolvedParams = this.resolveParams(context, toolMeta.input);
    
    return await tool.execute(resolvedParams);
  }
  
  getMetadata() {
    return {
      name: this.config.name,
      input: { context: 'object', toolParams: 'object' },
      output: { status: 'string', data: 'object', toolResult: 'object' },
      toolDependency: this.toolName
    };
  }
}

// Coordination node - orchestrates other nodes/tools  
class SequenceNode implements Executable {
  async execute(context) {
    for (const child of this.children) {
      const result = await child.execute(context);
      if (result.status === FAILURE) return result;
    }
    return { status: SUCCESS, data: context };
  }
  
  getMetadata() {
    return {
      name: this.config.name,
      input: { context: 'object', artifacts: 'object?' },
      output: { status: 'string', data: 'object', stepResults: 'array' },
      childrenSchemas: this.children.map(c => c.getMetadata())
    };
  }
}
```

**This unification enables:**
- BT nodes can be registered in ToolRegistry alongside atomic tools
- Coordination patterns become reusable, discoverable components
- LLMs can use coordination nodes the same way they use atomic tools
- Complex workflows become composable hierarchies

### Input/Output Schema System

**Critical Design Requirement: BT nodes that will be registered as tools MUST declare clear input/output schemas** so LLMs can understand how to use them. This is required for BTs going in the tool directory, but optional for internal coordination nodes.

#### Schema Declaration for BT Tools (Tool Directory Only)

When BT trees are registered as tools in the tool directory, they must specify exactly what they expect and produce. Internal coordination nodes (sequence, selector, etc.) can use simpler schemas:

```javascript
// Example: ClassGenerator BT registered as a tool
{
  "name": "ClassGenerator",
  "description": "Generates classes with comprehensive testing",
  "input": {
    "className": { "type": "string", "required": true },
    "methods": { "type": "array", "items": { "type": "string" } },
    "testCoverage": { "type": "number", "default": 90 },
    "codeStyle": { "type": "string", "default": "standard" }
  },
  "output": {
    "status": { "type": "string", "enum": ["SUCCESS", "FAILURE"] },
    "generatedCode": { "type": "string" },
    "testCode": { "type": "string" }, 
    "coverage": { "type": "number" },
    "artifacts": {
      "type": "object",
      "properties": {
        "classFile": { "type": "string" },
        "testFile": { "type": "string" },
        "documentation": { "type": "string" }
      }
    }
  }
}
```

#### Schema-Aware Tool Resolution

BT nodes that use other tools must understand those tools' schemas:

```javascript
class ActionNode extends BehaviorTreeNode {
  async executeNode(context) {
    const tool = await this.toolRegistry.getTool(this.toolName);
    const toolMeta = tool.getMetadata();
    
    // Validate we have required inputs for the tool
    const missingInputs = this.validateToolInputs(toolMeta.input, context);
    if (missingInputs.length > 0) {
      return {
        status: NodeStatus.FAILURE,
        data: { 
          error: `Missing required tool inputs: ${missingInputs.join(', ')}`,
          requiredSchema: toolMeta.input
        }
      };
    }
    
    // Transform BT context to tool-specific parameters
    const toolParams = this.transformContextToToolParams(context, toolMeta.input);
    const result = await tool.execute(toolParams);
    
    // Transform tool output back to BT format
    return this.transformToolResultToBTResult(result, toolMeta.output);
  }
}
```

#### LLM-Friendly Schema Descriptions

LLMs need human-readable descriptions of what BT tools do:

```json
{
  "name": "ComprehensiveClassGenerator",
  "description": "Creates a complete class implementation with testing, documentation, and validation",
  "input": {
    "className": {
      "type": "string", 
      "required": true,
      "description": "Name of the class to generate (e.g., 'UserManager')"
    },
    "features": {
      "type": "array",
      "items": { "type": "string" },
      "description": "List of features/methods the class should have (e.g., ['authenticate', 'validateInput'])"
    },
    "requirements": {
      "type": "object",
      "description": "Specific requirements like test coverage, code style, documentation level",
      "properties": {
        "testCoverage": { "type": "number", "minimum": 0, "maximum": 100 },
        "includeDocumentation": { "type": "boolean", "default": true }
      }
    }
  },
  "output": {
    "status": { "type": "string", "enum": ["SUCCESS", "FAILURE"] },
    "artifacts": {
      "type": "object",
      "description": "Generated files and metadata",
      "properties": {
        "classCode": { "type": "string", "description": "Complete class implementation" },
        "testCode": { "type": "string", "description": "Comprehensive test suite" },
        "documentation": { "type": "string", "description": "API documentation" },
        "metrics": {
          "type": "object",
          "properties": {
            "testCoverage": { "type": "number" },
            "linesOfCode": { "type": "number" }
          }
        }
      }
    }
  }
}
```

### Pluggable Node Architecture

**Critical Design Principle: Node types are completely extensible.**

The system doesn't hardcode coordination patterns. Instead:

1. **JSON specifies node types by name**
2. **Runtime dynamically instantiates classes** that implement those types
3. **Anyone can add new coordination patterns** by creating node classes

```javascript
// JSON configuration
{
  "type": "circuit_breaker",     // Custom coordination pattern
  "maxFailures": 5,
  "timeout": "30s",
  "children": [...]
}

// Runtime factory
class BehaviorTreeExecutor {
  constructor() {
    this.nodeTypes = new Map();
    
    // Register built-in patterns
    this.registerNodeType('sequence', SequenceNode);
    this.registerNodeType('parallel', ParallelNode);
    
    // Auto-load custom patterns
    this.loadCustomNodeTypes('/BT/nodes/custom/');
  }
  
  createNode(config) {
    const NodeClass = this.nodeTypes.get(config.type);
    return new NodeClass(config, this.toolRegistry, this);
  }
}
```

**Result:** An **infinitely extensible coordination language** where any conceivable execution pattern can be implemented and used in JSON configurations.

### Message-Passing Evolution

**Revolutionary Communication Model:** This system evolves far beyond traditional behavior trees through **continuous, bidirectional message-passing** during execution.

Traditional behavior trees communicate only through return values when execution completes. This system enables **real-time communication** while nodes are running, creating a **reactive actor-like coordination system**.

```javascript
class BehaviorTreeNode {
  // Unified messaging - any node can message any other node
  send(to, message) {
    this.messageBus.sendMessage(this, to, message);
  }
  
  // Relationship-aware handling
  handleMessage(from, message) {
    if (from === this.parent) {
      this.handleParentMessage(message);
    } else if (this.children.includes(from)) {
      this.handleChildMessage(from, message);
    } else {
      this.handlePeerMessage(from, message);
    }
  }
}
```

**Asynchronous Message Bus** prevents call stack overflow:

```javascript
class MessageBus {
  sendMessage(from, to, message) {
    this.messageQueue.push({ from, to, message });
    this.processMessages(); // Process async with setTimeout(0)
  }
}
```

**This enables:**
- **Streaming data pipelines** with continuous data flow
- **Dynamic load balancing** based on real-time metrics
- **Self-organizing systems** that adapt without central control
- **Fault-tolerant workflows** with immediate error reporting

### BT JSON as Plan Language Superset

**Perfect Evolutionary Path:** BT JSON extends the current plan language while maintaining 100% backward compatibility.

**Current Plan JSON:**
```json
[
  {"id": "step1", "tool": "codeGenerator", "params": {...}},
  {"id": "step2", "tool": "testRunner", "params": {...}}
]
```

**BT JSON (superset):**
```json
{
  "type": "sequence", 
  "children": [
    {"type": "action", "tool": "codeGenerator", "params": {...}},
    {
      "type": "selector",  // New: fallback logic
      "children": [
        {"type": "action", "tool": "testRunner"},
        {"type": "action", "tool": "skipTesting"}
      ]
    }
  ]
}
```

**Migration Strategy:**
- **Phase 1**: Linear plans automatically convert to sequence trees
- **Phase 2**: Plans can include BT constructs mixed with linear steps  
- **Phase 3**: Full BT JSON with sophisticated coordination patterns

## Node Types & Coordination Patterns

### Built-in Coordination Patterns

The system ships with essential coordination patterns:

**Control Flow Patterns:**

```json
// Sequence - execute children in order (fail-fast)
{
  "type": "sequence",
  "children": [
    {"type": "action", "tool": "codeGenerator"},
    {"type": "action", "tool": "testRunner"}
  ]
}

// Selector - try children until one succeeds  
{
  "type": "selector",
  "children": [
    {"type": "action", "tool": "quickFix"},
    {"type": "action", "tool": "fullRegenerate"},
    {"type": "action", "tool": "manualFallback"}
  ]
}

// Parallel - execute children concurrently
{
  "type": "parallel",
  "successPolicy": "all", // or "any"
  "children": [
    {"type": "action", "tool": "lintCode"},
    {"type": "action", "tool": "typeCheck"},
    {"type": "action", "tool": "runTests"}
  ]
}
```

**Error Handling Patterns:**

```json
// Retry - retry child with exponential backoff
{
  "type": "retry",
  "maxAttempts": 3,
  "backoff": "exponential",
  "child": {"type": "action", "tool": "unstableService"}
}

// Condition - test conditions without side effects
{
  "type": "condition", 
  "check": "{{testResults.coverage}} >= 90"
}
```

**Decision Patterns:**

```json
// LLM Decision - use LLM to choose execution branch
{
  "type": "llm-decision",
  "prompt": "Based on test results {{testResults}}, should I fix code or fix tests?",
  "tool": "decisionMakerLLM",
  "branches": {
    "fix_code": {"type": "action", "tool": "codeRepairer"},
    "fix_tests": {"type": "action", "tool": "testRewriter"}
  }
}
```

### Custom Coordination Patterns

**Anyone can create new coordination patterns:**

```javascript
// Circuit Breaker Pattern
export class CircuitBreakerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'circuit_breaker';
  }
  
  async execute(context) {
    if (this.isOpen && !this.shouldRetry()) {
      return { status: FAILURE, reason: 'Circuit open' };
    }
    
    const result = await this.executeChild(0, context);
    this.updateCircuitState(result);
    return result;
  }
}

// Load Balancer Pattern  
export class LoadBalancerNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'load_balancer';
  }
  
  async execute(context) {
    const childIndex = this.selectChild(); // round_robin, random, least_used
    return await this.executeChild(childIndex, context);
  }
}
```

### Domain-Specific Coordinators

**Create specialized coordinators for specific domains:**

```javascript
// Machine Learning Pipeline Coordinator
export class MLPipelineNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'ml_pipeline';
  }
  
  async execute(context) {
    const stages = ['data_prep', 'feature_engineering', 'training', 'validation'];
    
    for (const stage of stages) {
      const stageNode = this.findChildByStage(stage);
      const result = await stageNode.execute(context);
      
      if (result.status === FAILURE) {
        await this.handleMLFailure(stage, result, context);
        return result;
      }
      
      context.artifacts[stage] = result.data;
    }
    
    return { status: SUCCESS, pipeline: context.artifacts };
  }
}
```

### Node Interface Contract

**All coordination patterns implement the same interface:**

```javascript
class BehaviorTreeNode {
  constructor(config, toolRegistry, executor) {
    this.config = config;
    this.toolRegistry = toolRegistry;
    this.executor = executor;
    this.messageBus = executor.messageBus;
    this.parent = null;
    this.children = this.initializeChildren(config.children);
  }
  
  // Core execution interface
  async execute(context) {
    throw new Error('Must implement execute() method');
  }
  
  // Messaging interface
  send(to, message) {
    this.messageBus.sendMessage(this, to, message);
  }
  
  handleMessage(from, message) {
    // Override in subclasses for custom message handling
  }
  
  // Child management
  createChild(config) {
    return this.executor.createNode(config);
  }
  
  destroyChild(child) {
    // Cleanup and remove child
  }
  
  // Metadata for discovery
  static getTypeName() {
    throw new Error('Must implement getTypeName() static method');
  }
  
  getMetadata() {
    return {
      type: this.constructor.getTypeName(),
      description: this.config.description,
      children: this.children.length
    };
  }
}
```

## Configuration & Tool Definition

### JSON Tool Definition Language

**Core Innovation: BT JSON configurations define new tools composed of existing tools.**

Instead of hardcoding complex tools in JavaScript, define them declaratively. **BTs intended for the tool directory require explicit input/output contracts**, while internal BTs can use simpler schemas:

```json
{
  "name": "ClassGenerator",
  "description": "Generates classes with comprehensive testing and validation",
  "domains": ["code", "testing"],
  "input": {
    "className": {
      "type": "string", 
      "required": true,
      "description": "Name of the class to create"
    },
    "methods": {
      "type": "array", 
      "items": {"type": "string"},
      "description": "List of method names to include"
    },
    "testCoverage": {
      "type": "number", 
      "default": 90,
      "minimum": 0,
      "maximum": 100,
      "description": "Required test coverage percentage"
    }
  },
  "output": {
    "status": {"type": "string", "enum": ["SUCCESS", "FAILURE"]},
    "classCode": {"type": "string", "description": "Generated class source code"},
    "testCode": {"type": "string", "description": "Generated test suite"},
    "coverage": {"type": "number", "description": "Actual test coverage achieved"},
    "artifacts": {
      "type": "object",
      "description": "Created files and metadata"
    }
  },
  "implementation": {
    "type": "sequence",
    "children": [
      {
        "type": "llm-decision",
        "prompt": "Plan class structure for {{className}} with methods {{methods}}",
        "tool": "requirementAnalyzer"
      },
      {
        "type": "retry",
        "maxAttempts": 3,
        "child": {
          "type": "action",
          "tool": "codeGenerator",
          "params": {
            "className": "{{className}}",
            "structure": "{{requirementAnalyzer.result}}"
          }
        }
      },
      {
        "type": "parallel",
        "successPolicy": "all",
        "children": [
          {
            "type": "sequence",
            "children": [
              {"type": "action", "tool": "testGenerator"},
              {"type": "action", "tool": "testRunner"},
              {"type": "condition", "check": "{{testRunner.result.coverage}} >= {{testCoverage}}"}
            ]
          },
          {"type": "action", "tool": "documentationGenerator"}
        ]
      }
    ]
  }
}
```

**This JSON file creates a tool that:**
- Registers in ToolRegistry like any atomic tool
- **Has clear input/output contract that LLMs can understand** (required for tool directory)
- **Validates inputs and guarantees output format** (required for tool directory)
- Contains sophisticated logic (retry, parallel, conditions)
- Can be called by other tools or higher-level agents
- Composes existing tools into complex workflows
- Provides schema-based validation for reliable integration

#### Internal BT Nodes vs Tool Directory BTs

**Two Categories of BT Definitions:**

1. **Internal Coordination Nodes**: Basic sequence, selector, action nodes
   - Simple schemas for framework use
   - No strict input/output requirements
   - Used for coordination within larger BTs

2. **Tool Directory BTs**: Complex compositions registered as tools
   - **MUST** have detailed input/output schemas
   - **MUST** be LLM-understandable with descriptions
   - **MUST** validate inputs and guarantee output format
   - Examples: ClassGenerator, APIGenerator, SystemBuilder

```javascript
// Internal node - simple schema
class SequenceNode {
  getMetadata() {
    return {
      name: 'sequence',
      type: 'coordination',
      // Basic metadata - no detailed I/O contract needed
    };
  }
}

// Tool directory BT - detailed schema required
{
  "name": "ClassGenerator",
  "input": { /* detailed schema with descriptions */ },
  "output": { /* guaranteed output format */ },
  "implementation": { /* BT definition */ }
}
```

### Template System

**Markdown templates for LLM prompts with placeholder substitution:**

```markdown
<!-- templates/class-planner.md -->
# Class Structure Planning

## Goal
Generate {{className}} class with the following methods:
{{#each methods}}
- {{this}}
{{/each}}

## Requirements
- Follow {{codeStyle}} conventions
- Include input validation
- Add comprehensive error handling
- Target {{testCoverage}}% test coverage

## Available Tools
{{#each tools}}
- **{{name}}**: {{description}}
{{/each}}

Return a detailed class structure specification.
```

### Tool Registration & Discovery

**ToolRegistry automatically loads BT-defined tools:**

```javascript
class ToolRegistry {
  async loadBehaviorTreeTools(directory) {
    const configFiles = await glob(`${directory}/**/*.json`);
    
    for (const file of configFiles) {
      const toolDef = JSON.parse(await fs.readFile(file));
      const btTool = new BehaviorTreeTool(toolDef);
      
      // Register as module provider
      await this.registerProvider(btTool.asModuleProvider());
    }
  }
}
```

**Tool Ecosystem Example:**

```
/BT/configs/tools/
├── atomic/
│   ├── CodeReviewer.json          # Simple LLM reviewer
│   ├── DocumentationGenerator.json # Doc generation  
│   └── ErrorExplainer.json        # Error explanation
├── composite/
│   ├── ClassGenerator.json        # Class + tests + docs
│   ├── APIGenerator.json          # API + validation + tests
│   └── RefactoringTool.json       # Analysis + refactor + validation
└── workflows/
    ├── FullStackFeature.json      # Backend + Frontend + Tests + Deploy
    ├── SecurityAudit.json         # Multi-step security analysis
    └── PerformanceOptimizer.json  # Profile + optimize + benchmark
```

## LLM Integration

### Enhanced Prompting for Coordination

**LLMs can now generate sophisticated coordination patterns:**

**Traditional prompting (limited):**
```
"Generate a plan to create a User class with authentication methods"
```

**Coordination-aware prompting (powerful):**
```
Generate a behavior tree that:
- Tries automated class generation first, with fallback to template-based generation
- Retries failed code generation up to 3 times with different approaches  
- Runs validation and testing in parallel after successful generation
- Uses LLM to decide between comprehensive vs quick testing based on complexity
- Includes error recovery strategies for each major step
- Returns to parent with detailed results and artifacts

Available coordination patterns: sequence, selector, parallel, retry, llm-decision, condition
Available tools: {{toolList}}
```

**LLM Response (sophisticated coordination):**
```json
{
  "type": "sequence",
  "children": [
    {
      "type": "selector",
      "description": "Try different generation approaches",
      "children": [
        {
          "type": "retry",
          "maxAttempts": 3,
          "child": {
            "type": "action",
            "tool": "aiCodeGenerator",
            "params": {"className": "User", "features": ["auth", "validation"]}
          }
        },
        {
          "type": "action",
          "tool": "templateCodeGenerator",
          "params": {"template": "authentication-class"}
        }
      ]
    },
    {
      "type": "parallel",
      "successPolicy": "all",
      "children": [
        {
          "type": "sequence",
          "children": [
            {"type": "action", "tool": "codeValidator"},
            {"type": "action", "tool": "securityAnalyzer"}
          ]
        },
        {
          "type": "llm-decision",
          "prompt": "Based on class complexity {{complexity}}, choose testing approach",
          "branches": {
            "comprehensive": {
              "type": "sequence",
              "children": [
                {"type": "action", "tool": "unitTestGenerator"},
                {"type": "action", "tool": "integrationTestGenerator"},
                {"type": "action", "tool": "testRunner"}
              ]
            },
            "quick": {"type": "action", "tool": "basicTestGenerator"}
          }
        }
      ]
    }
  ]
}
```

### Validation Pipeline Compatibility

**Existing plan validation works recursively on tree structures:**

```javascript
async validateBehaviorTree(tree, tools) {
  // Validate root node
  await this.validateNode(tree, tools);
  
  // Recursively validate children
  if (tree.children) {
    for (const child of tree.children) {
      await this.validateBehaviorTree(child, tools);
    }
  }
  
  // Validate cross-node dependencies and context flow
  await this.validateContextFlow(tree);
}
```

**Validation ensures:**
- All referenced tools exist in ToolRegistry
- Parameter types match tool specifications  
- Context variables are properly scoped
- Execution constraints are respected
- Node types are registered and valid

### Dynamic Tree Generation

**LLMs can create trees that modify themselves during execution:**

```json
{
  "type": "adaptive-workflow",
  "children": [
    {
      "type": "llm-planner",
      "prompt": "Analyze requirements: {{requirements}}",
      "onSuccess": "createChildrenFromPlan"
    }
  ]
}
```

**Dynamic child creation based on LLM analysis:**
```javascript
class AdaptiveWorkflowNode extends BehaviorTreeNode {
  async onSuccess(result) {
    const plan = result.data.plan;
    
    for (const step of plan) {
      const childConfig = this.convertStepToNodeConfig(step);
      const child = this.createChild(childConfig);
      this.children.push(child);
    }
  }
}
```

## Advanced Features

### Streaming Data Processing

**Message-passing enables continuous data flow:**

```javascript
class StreamProcessorNode extends BehaviorTreeNode {
  async execute(context) {
    // Start processing data stream
    this.processStream(async (dataChunk) => {
      // Transform chunk
      const transformed = this.transform(dataChunk);
      
      // Send to next processor in pipeline
      this.send(this.getNextProcessor(), {
        type: 'DATA_CHUNK',
        data: transformed,
        sequence: this.sequenceNumber++
      });
    });
    
    return { status: RUNNING }; // Keep processing
  }
  
  handleParentMessage(message) {
    if (message.type === 'ADJUST_RATE') {
      this.setProcessingRate(message.newRate);
    }
  }
}
```

### Self-Organizing Systems

**Nodes coordinate automatically to optimize performance:**

```javascript
class LoadBalancerNode extends BehaviorTreeNode {
  handleChildMessage(child, message) {
    switch (message.type) {
      case 'OVERLOADED':
        // Create additional worker
        const workerConfig = this.getWorkerConfig();
        const newWorker = this.createChild(workerConfig);
        this.children.push(newWorker);
        break;
        
      case 'UNDERUTILIZED':
        // Remove excess workers
        if (this.children.length > this.minWorkers) {
          this.destroyChild(child);
        }
        break;
        
      case 'PERFORMANCE_METRICS':
        // Adjust routing based on performance
        this.updateRoutingWeights(child, message.metrics);
        break;
    }
  }
}
```

### Cross-Tree Communication

**Nodes can communicate across different execution trees:**

```javascript
class CoordinatorNode extends BehaviorTreeNode {
  async execute(context) {
    // Register globally for cross-tree communication
    this.messageBus.registerGlobalNode(this.id, this);
    return { status: RUNNING };
  }
  
  handlePeerMessage(peer, message) {
    switch (message.type) {
      case 'RESOURCE_REQUEST':
        if (this.hasAvailableResource(message.resourceType)) {
          this.send(peer, {
            type: 'RESOURCE_GRANTED',
            resource: this.allocateResource(message.resourceType)
          });
        }
        break;
        
      case 'COORDINATE_ACTION':
        // Synchronize with peer for coordinated execution
        this.scheduleCoordinatedAction(message.action, message.timestamp, peer);
        break;
    }
  }
}
```

## Implementation

### Core Classes

**BehaviorTreeExecutor** replaces PlanExecutor:

```javascript
class BehaviorTreeExecutor {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
    this.messageBus = new MessageBus();
    this.nodeTypes = new Map();
    
    // Register built-in node types
    this.registerBuiltinNodes();
    
    // Auto-load custom node types
    this.loadCustomNodeTypes();
  }
  
  async executeTree(treeConfig, context) {
    const rootNode = this.createNode(treeConfig);
    return await rootNode.execute(context);
  }
  
  createNode(config) {
    const NodeClass = this.nodeTypes.get(config.type);
    if (!NodeClass) {
      throw new Error(`Unknown node type: ${config.type}`);
    }
    return new NodeClass(config, this.toolRegistry, this);
  }
  
  registerNodeType(typeName, NodeClass) {
    this.nodeTypes.set(typeName, NodeClass);
  }
}
```

**MessageBus** handles async communication:

```javascript
class MessageBus {
  constructor() {
    this.messageQueue = [];
    this.globalNodes = new Map();
    this.isProcessing = false;
  }
  
  sendMessage(from, to, message) {
    this.messageQueue.push({ from, to, message, timestamp: Date.now() });
    this.processMessages();
  }
  
  async processMessages() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    while (this.messageQueue.length > 0) {
      const { from, to, message } = this.messageQueue.shift();
      
      try {
        await new Promise(resolve => {
          setTimeout(() => {
            to.handleMessage(from, message);
            resolve();
          }, 0);
        });
      } catch (error) {
        console.error('Message handling error:', error);
      }
    }
    
    this.isProcessing = false;
  }
}
```

### Integration with Existing System

**PlanningAgent uses BT execution:**

```javascript
class PlanningAgent {
  constructor(config, planner, validator = null) {
    this.config = config;
    this.planner = planner;
    this.validator = validator;
    this.btExecutor = new BehaviorTreeExecutor(this.toolRegistry);
  }
  
  async run(goal, tools, context) {
    // Generate plan (unchanged)
    const plan = await this.planner.generatePlan(goal, tools, context);
    
    // Validate plan (unchanged)
    if (this.validator) {
      await this.validator.validatePlan(plan, tools);
    }
    
    // Convert plan to tree and execute
    const tree = this.convertPlanToTree(plan);
    return await this.btExecutor.executeTree(tree, context);
  }
  
  convertPlanToTree(plan) {
    if (Array.isArray(plan)) {
      // Linear plan -> sequence tree
      return {
        type: 'sequence',
        children: plan.map(step => ({
          type: 'action',
          tool: step.tool,
          params: step.params || {}
        }))
      };
    }
    
    // Plan is already a tree
    return plan;
  }
}
```

### Migration Strategy

**Phase 1: Parallel Implementation**
- Implement BT system alongside existing plan execution
- Add BT execution as option in PlanningAgent configuration
- Ensure backward compatibility with all existing plans

**Phase 2: Enhanced Features**
- Convert specialist agents to use BT definitions  
- Add coordination patterns (retry, parallel, fallbacks)
- Enable message-passing communication

**Phase 3: Full Integration**
- Make BT execution the default
- Migrate complex workflows to BT configurations
- Deprecate old PlanExecutor (maintain compatibility)

## Examples & Use Cases

### Complete Class Generation Workflow

**Realistic end-to-end example:**

```json
{
  "name": "ComprehensiveClassGenerator",
  "description": "Generates production-ready classes with full testing and documentation",
  "domains": ["code", "testing", "documentation"],
  "parameters": {
    "className": {"type": "string", "required": true},
    "features": {"type": "array", "items": {"type": "string"}},
    "testCoverage": {"type": "number", "default": 95}
  },
  "implementation": {
    "type": "sequence",
    "children": [
      {
        "type": "llm-decision",
        "description": "Analyze requirements and choose approach",
        "prompt": "Analyze class requirements for {{className}} with features {{features}}",
        "tool": "requirementAnalyzer",
        "branches": {
          "simple": {
            "type": "action",
            "tool": "simpleClassGenerator"
          },
          "complex": {
            "type": "sequence",
            "children": [
              {"type": "action", "tool": "architecturalPlanner"},
              {"type": "action", "tool": "advancedClassGenerator"}
            ]
          }
        }
      },
      {
        "type": "retry",
        "maxAttempts": 3,
        "description": "Generate and validate code with retries",
        "child": {
          "type": "sequence",
          "children": [
            {"type": "action", "tool": "codeGenerator"},
            {"type": "action", "tool": "syntaxValidator"},
            {"type": "condition", "check": "{{syntaxValidator.result.valid}} === true"}
          ]
        }
      },
      {
        "type": "parallel",
        "successPolicy": "all",
        "description": "Generate tests and documentation simultaneously",
        "children": [
          {
            "type": "sequence",
            "description": "Comprehensive testing workflow",
            "children": [
              {"type": "action", "tool": "testGenerator"},
              {"type": "action", "tool": "testRunner"},
              {
                "type": "selector",
                "description": "Ensure coverage target met",
                "children": [
                  {"type": "condition", "check": "{{testRunner.result.coverage}} >= {{testCoverage}}"},
                  {
                    "type": "sequence",
                    "children": [
                      {"type": "action", "tool": "additionalTestGenerator"},
                      {"type": "action", "tool": "testRunner"}
                    ]
                  }
                ]
              }
            ]
          },
          {
            "type": "sequence",
            "description": "Documentation generation",
            "children": [
              {"type": "action", "tool": "docGenerator"},
              {"type": "action", "tool": "docValidator"}
            ]
          },
          {
            "type": "action",
            "description": "Static analysis",
            "tool": "staticAnalyzer"
          }
        ]
      },
      {
        "type": "selector",
        "description": "Final validation with error recovery",
        "children": [
          {
            "type": "sequence",
            "children": [
              {"type": "action", "tool": "integrationTester"},
              {"type": "condition", "check": "{{integrationTester.result.passed}} === true"}
            ]
          },
          {
            "type": "llm-decision",
            "prompt": "Integration tests failed: {{integrationTester.result.errors}}. How should I fix this?",
            "branches": {
              "fix_code": {"type": "action", "tool": "codeRepairer"},
              "fix_tests": {"type": "action", "tool": "testRepairer"},  
              "escalate": {"type": "action", "tool": "humanEscalation"}
            }
          }
        ]
      }
    ]
  }
}
```

### Self-Adapting API Development

**Workflow that adapts based on runtime conditions:**

```json
{
  "name": "AdaptiveAPIGenerator", 
  "description": "Generates APIs with automatic optimization based on requirements",
  "implementation": {
    "type": "sequence",
    "children": [
      {
        "type": "action",
        "tool": "requirementAnalyzer",
        "description": "Analyze API requirements and complexity"
      },
      {
        "type": "llm-decision",
        "prompt": "Based on complexity {{complexity}} and load requirements {{loadRequirements}}, choose architecture",
        "branches": {
          "microservice": {
            "type": "parallel",
            "children": [
              {"type": "action", "tool": "microserviceGenerator"},
              {"type": "action", "tool": "containerGenerator"},
              {"type": "action", "tool": "orchestrationGenerator"}
            ]
          },
          "monolith": {
            "type": "action", 
            "tool": "monolithAPIGenerator"
          },
          "serverless": {
            "type": "parallel",
            "children": [
              {"type": "action", "tool": "lambdaGenerator"},
              {"type": "action", "tool": "apiGatewayGenerator"}
            ]
          }
        }
      },
      {
        "type": "adaptive-testing",
        "description": "Adaptive testing based on architecture chosen",
        "children": [
          {"type": "action", "tool": "unitTestGenerator"},
          {"type": "action", "tool": "integrationTestGenerator"},
          {
            "type": "condition",
            "check": "{{architecture}} === 'microservice'",
            "then": {"type": "action", "tool": "serviceTestGenerator"},
            "else": {"type": "action", "tool": "endToEndTestGenerator"}
          }
        ]
      }
    ]
  }
}
```

### Streaming Data Processing Pipeline

**Message-passing workflow for continuous data processing:**

```json
{
  "name": "DataProcessingPipeline",
  "description": "Real-time data processing with dynamic scaling",
  "implementation": {
    "type": "parallel",
    "children": [
      {
        "type": "data-source",
        "description": "Continuously produce data chunks",
        "tool": "dataStreamReader",
        "onData": "sendToProcessors"
      },
      {
        "type": "load-balancer", 
        "description": "Distribute processing load dynamically",
        "strategy": "least_used",
        "children": [
          {"type": "stream-processor", "tool": "dataTransformer"},
          {"type": "stream-processor", "tool": "dataTransformer"},
          {"type": "stream-processor", "tool": "dataTransformer"}
        ]
      },
      {
        "type": "data-aggregator",
        "description": "Collect and aggregate processed results",
        "tool": "resultAggregator",
        "onComplete": "sendToSink"
      }
    ]
  }
}
```

## Conclusion

The Behavior Tree system represents a **fundamental evolution in workflow orchestration**, transforming simple linear plans into a **sophisticated, reactive coordination language**. 

**Key Achievements:**

1. **Unified Architecture**: Nodes and tools share the same interface, enabling seamless composition
2. **Infinite Extensibility**: Pluggable node system allows any coordination pattern to be implemented  
3. **Revolutionary Communication**: Message-passing enables real-time adaptation and self-organization
4. **Perfect Evolution**: Complete backward compatibility while adding powerful new capabilities
5. **LLM Integration**: Rich coordination vocabulary allows LLMs to generate sophisticated workflows
6. **JSON Configuration**: Complex workflows defined declaratively without programming

**The Result:** A **reactive coordination language** where:
- **Simple JSON configurations** define complex, adaptive workflows
- **LLMs generate sophisticated coordination patterns** with retry logic, fallbacks, and parallel execution
- **Systems self-organize and adapt** based on real-time conditions and communication
- **Developers extend functionality** by creating new coordination patterns as simple classes
- **Existing infrastructure remains unchanged** while gaining powerful new capabilities

This system enables the creation of truly intelligent, adaptive workflows that can handle the complexity and unpredictability of real-world software development tasks.