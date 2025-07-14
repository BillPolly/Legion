# LLM Planner Design Document

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Plan Structure](#plan-structure)
5. [Flow Validation](#flow-validation)
6. [Integration Points](#integration-points)
7. [Usage Patterns](#usage-patterns)
8. [Example Workflows](#example-workflows)

## Overview

The LLM Planner is a general-purpose planning framework that leverages Large Language Models to decompose complex tasks into structured, executable plans. It provides a flexible system for defining allowable actions and their input/output contracts, enabling automated planning for any domain.

### Key Objectives

1. **General-Purpose Planning**: Transform any task description into actionable plans
2. **Action-Based Architecture**: Define custom actions with input/output specifications
3. **Flow Validation**: Ensure data flow integrity throughout plan execution
4. **Structured Output**: Generate consistent JSON plans with clear dependencies
5. **LLM Integration**: Support multiple LLM providers through @jsenvoy/llm

### Design Principles

- **Domain Agnostic**: No hardcoded assumptions about specific use cases
- **Action Flexibility**: Users define their own action types and contracts
- **Input/Output Flow**: Track data flow through plan steps for validation
- **Retry Resilience**: Handle LLM failures with automatic retries
- **Modular Integration**: Works standalone or as jsEnvoy module

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM Planner                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  GenericPlanner  │  │    Models   │  │  Validation  │  │
│  │                  │  │             │  │              │  │
│  │ • createPlan()   │  │ • Plan      │  │ FlowValidator│  │
│  │ • buildPrompt()  │  │ • PlanStep  │  │              │  │
│  │ • parseResponse()│  │ • PlanAction│  │ • validate() │  │
│  └──────────────────┘  └─────────────┘  └──────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 LLM Integration                      │  │
│  │                                                      │  │
│  │              @jsenvoy/llm Client                    │  │
│  │         (Multiple Provider Support)                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              jsEnvoy Module Integration              │  │
│  │                                                      │  │
│  │                 LLMPlannerModule                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

1. **GenericPlanner**: Main orchestrator that accepts task descriptions and action definitions
2. **Models**: Data structures representing plans, steps, and actions
3. **FlowValidator**: Validates input/output flow and dependency chains
4. **LLM Integration**: Flexible client supporting multiple providers
5. **Module Integration**: jsEnvoy module wrapper for tool ecosystem

## Core Components

### 1. GenericPlanner

The main planning orchestrator that transforms task descriptions into structured plans.

```javascript
class GenericPlanner {
  constructor(config = {}) {
    this.llmClient = config.llmClient;
    this.maxRetries = config.maxRetries || 3;
    this.maxSteps = config.maxSteps || 20;
  }

  async createPlan({ description, inputs, requiredOutputs, allowableActions }) {
    // Build structured prompt with task details and action specifications
    const prompt = this.buildPrompt({
      description,
      inputs,
      requiredOutputs,
      allowableActions
    });

    // Request plan from LLM with retry logic
    let attempts = 0;
    while (attempts < this.maxRetries) {
      const response = await this.llmClient.generateStructuredResponse(
        prompt,
        this.getPlanSchema(),
        { temperature: 0.7 }
      );

      const plan = new Plan(response.data);
      const validation = plan.validate();
      
      if (validation.isValid) {
        return plan;
      }
      
      attempts++;
    }
    
    throw new Error('Failed to generate valid plan after retries');
  }

  buildPrompt({ description, inputs, requiredOutputs, allowableActions }) {
    // Constructs detailed prompt explaining the task and available actions
    // Includes JSON schema requirements and examples
    return `Create a plan for: ${description}...`;
  }
}
```

### 2. Plan Model

Central data structure representing a complete plan.

```javascript
class Plan {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description;
    this.version = data.version || '1.0.0';
    this.metadata = {
      createdAt: new Date().toISOString(),
      complexity: data.complexity || 'medium',
      estimatedDuration: data.estimatedDuration,
      ...data.metadata
    };
    this.inputs = data.inputs || [];
    this.requiredOutputs = data.requiredOutputs || [];
    this.steps = (data.steps || []).map(s => new PlanStep(s));
    this.executionOrder = data.executionOrder || [];
  }

  validate() {
    const errors = [];
    
    // Validate required fields
    if (!this.name) errors.push('Plan name is required');
    if (!this.steps || this.steps.length === 0) {
      errors.push('Plan must have at least one step');
    }
    
    // Validate each step
    this.steps.forEach((step, index) => {
      const stepValidation = step.validate();
      if (!stepValidation.isValid) {
        errors.push(`Step ${index}: ${stepValidation.errors.join(', ')}`);
      }
    });
    
    // Check for circular dependencies
    if (this.hasCircularDependencies()) {
      errors.push('Plan contains circular dependencies');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateExecutionOrder() {
    // Topological sort to determine execution order
    const visited = new Set();
    const order = [];
    
    const visit = (stepId) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      
      const step = this.getStepById(stepId);
      if (step && step.dependencies) {
        step.dependencies.forEach(dep => visit(dep));
      }
      
      order.push(stepId);
    };
    
    this.steps.forEach(step => visit(step.id));
    this.executionOrder = order;
    return order;
  }

  getParallelExecutionGroups() {
    // Groups steps that can be executed in parallel
    const groups = [];
    const completed = new Set();
    
    while (completed.size < this.steps.length) {
      const group = this.steps.filter(step => {
        if (completed.has(step.id)) return false;
        
        // Check if all dependencies are completed
        return !step.dependencies || 
          step.dependencies.every(dep => completed.has(dep));
      });
      
      if (group.length === 0) break;
      
      groups.push(group.map(s => s.id));
      group.forEach(s => completed.add(s.id));
    }
    
    return groups;
  }
}
```

### 3. FlowValidator

Validates the input/output flow through plan steps.

```javascript
class FlowValidator {
  validate(plan) {
    const errors = [];
    const warnings = [];
    
    // Track available outputs through execution
    const availableOutputs = new Set(plan.inputs || []);
    
    // Validate each step in execution order
    const executionOrder = plan.executionOrder || plan.generateExecutionOrder();
    
    for (const stepId of executionOrder) {
      const step = plan.getStepById(stepId);
      if (!step) {
        errors.push(`Step ${stepId} not found in plan`);
        continue;
      }
      
      // Check if all required inputs are available
      if (step.inputs) {
        for (const input of step.inputs) {
          if (!availableOutputs.has(input)) {
            errors.push(
              `Step '${step.name}' requires input '${input}' ` +
              `which is not available`
            );
          }
        }
      }
      
      // Add step outputs to available outputs
      if (step.outputs) {
        step.outputs.forEach(output => availableOutputs.add(output));
      }
    }
    
    // Check if all required outputs are produced
    if (plan.requiredOutputs) {
      for (const output of plan.requiredOutputs) {
        if (!availableOutputs.has(output)) {
          errors.push(
            `Required output '${output}' is not produced by any step`
          );
        }
      }
    }
    
    // Identify unused outputs
    const usedInputs = new Set();
    plan.steps.forEach(step => {
      if (step.inputs) {
        step.inputs.forEach(input => usedInputs.add(input));
      }
    });
    
    availableOutputs.forEach(output => {
      if (!usedInputs.has(output) && 
          !plan.requiredOutputs?.includes(output) &&
          !plan.inputs?.includes(output)) {
        warnings.push(`Output '${output}' is produced but never used`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
```

### 4. PlanStep Model

Represents an individual step in the plan.

```javascript
class PlanStep {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.type = data.type; // setup|implementation|integration|testing|validation|deployment
    this.dependencies = data.dependencies || [];
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.actions = (data.actions || []).map(a => new PlanAction(a));
    this.estimatedTime = data.estimatedTime;
  }

  validate() {
    const errors = [];
    
    if (!this.id) errors.push('Step id is required');
    if (!this.name) errors.push('Step name is required');
    if (!this.type) errors.push('Step type is required');
    
    const validTypes = ['setup', 'implementation', 'integration', 
                       'testing', 'validation', 'deployment'];
    if (!validTypes.includes(this.type)) {
      errors.push(`Invalid step type: ${this.type}`);
    }
    
    // Validate actions
    this.actions.forEach((action, index) => {
      const actionValidation = action.validate();
      if (!actionValidation.isValid) {
        errors.push(`Action ${index}: ${actionValidation.errors.join(', ')}`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

### 5. PlanAction Model

Represents an atomic action within a step.

```javascript
class PlanAction {
  constructor(data) {
    this.type = data.type;
    this.description = data.description;
    this.inputs = data.inputs || {};
    this.outputs = data.outputs || {};
    
    // Store all additional properties
    Object.keys(data).forEach(key => {
      if (!['type', 'description', 'inputs', 'outputs'].includes(key)) {
        this[key] = data[key];
      }
    });
  }

  validate() {
    const errors = [];
    
    if (!this.type) {
      errors.push('Action type is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

## Plan Structure

Plans follow a consistent JSON structure that can be adapted to any domain:

```javascript
{
  id: "plan-unique-id",
  name: "React Todo Application",
  description: "A simple React-based todo application with localStorage persistence",
  version: "1.0.0",
  metadata: {
    createdAt: "2024-01-15T10:00:00Z",
    complexity: "medium",
    estimatedDuration: "3 hours"
  },
  inputs: ["project-requirements"],
  requiredOutputs: ["deployed-app", "test-results"],
  steps: [
    {
      id: "step-1",
      name: "Project Setup",
      description: "Set up the React development environment",
      type: "setup",
      dependencies: [],
      inputs: ["project-requirements"],
      outputs: ["project-structure", "config-files"],
      estimatedTime: "30 minutes",
      actions: [
        {
          type: "create-file",
          path: "package.json",
          description: "Create package.json with dependencies",
          inputs: { template: "react-app" },
          outputs: { file: "package.json" }
        },
        {
          type: "create-file",
          path: "src/App.js",
          description: "Create main App component",
          inputs: { content: "component-template" },
          outputs: { file: "src/App.js" }
        }
      ]
    },
    {
      id: "step-2",
      name: "Implement Todo Functionality",
      description: "Develop core todo features",
      type: "implementation",
      dependencies: ["step-1"],
      inputs: ["project-structure"],
      outputs: ["todo-components", "todo-logic"],
      estimatedTime: "1 hour",
      actions: [
        {
          type: "update-file",
          path: "src/components/TodoApp.js",
          description: "Implement state management and CRUD operations"
        },
        {
          type: "create-file",
          path: "src/styles/TodoApp.css",
          description: "Add styling for the application"
        }
      ]
    }
    // ... more steps
  ],
  executionOrder: ["step-1", "step-2", "step-3", "step-4", "step-5"]
}
```

### Key Structural Elements

1. **Plan Metadata**
   - `id`: Unique identifier for the plan
   - `name`: Human-readable plan name
   - `description`: What the plan accomplishes
   - `version`: Version tracking for plan iterations
   - `metadata`: Additional information (creation time, complexity, duration)

2. **Input/Output Specification**
   - `inputs`: Initial available inputs for the plan
   - `requiredOutputs`: Expected final outputs after execution

3. **Steps Array**
   - Each step contains its own inputs/outputs
   - Dependencies define execution constraints
   - Actions are atomic operations within steps

4. **Step Types**
   - `setup`: Initial configuration and environment setup
   - `implementation`: Core functionality development
   - `integration`: Connecting components and services
   - `testing`: Test creation and execution
   - `validation`: Quality checks and verification
   - `deployment`: Build and deployment processes

5. **Action Properties**
   - `type`: The action identifier (user-defined)
   - `description`: Human-readable explanation
   - `inputs`: Required inputs for the action
   - `outputs`: Outputs produced by the action
   - Additional custom properties as needed

## Flow Validation

The FlowValidator ensures data integrity throughout plan execution:

### Validation Process

1. **Input Availability Check**
   - Tracks available outputs as steps are processed
   - Ensures each step's inputs are satisfied by previous outputs
   - Reports missing inputs as errors

2. **Output Production Verification**
   - Confirms all required outputs are eventually produced
   - Identifies which steps produce which outputs

3. **Dependency Validation**
   - Checks all referenced dependencies exist
   - Detects circular dependencies
   - Generates valid execution order

4. **Unused Output Detection**
   - Identifies outputs that are produced but never consumed
   - Reports as warnings for optimization opportunities

### Example Validation Flow

```javascript
// Given a plan with steps A → B → C
const plan = {
  inputs: ["initial-data"],
  requiredOutputs: ["final-result"],
  steps: [
    {
      id: "A",
      inputs: ["initial-data"],
      outputs: ["processed-data"]
    },
    {
      id: "B",
      dependencies: ["A"],
      inputs: ["processed-data"],
      outputs: ["intermediate-result"]
    },
    {
      id: "C",
      dependencies: ["B"],
      inputs: ["intermediate-result"],
      outputs: ["final-result"]
    }
  ]
};

// FlowValidator tracks:
// After A: available = ["initial-data", "processed-data"]
// After B: available = [..., "intermediate-result"]
// After C: available = [..., "final-result"]
// ✓ All inputs satisfied
// ✓ Required output "final-result" produced
```


## Integration Points

### 1. LLM Client Integration

The planner integrates with @jsenvoy/llm for flexible provider support:

```javascript
import { LLMClient } from '@jsenvoy/llm';

// Create LLM client with any supported provider
const llmClient = new LLMClient({
  provider: 'anthropic',  // or 'openai', 'deepseek', 'openrouter'
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229',
  maxRetries: 3
});

// Use with GenericPlanner
const planner = new GenericPlanner({ 
  llmClient,
  maxRetries: 2,
  maxSteps: 20
});
```

### 2. jsEnvoy Module Integration

The planner can be used as a jsEnvoy module:

```javascript
import { LLMPlannerModule } from '@jsenvoy/llm-planner';
import { ResourceManager } from '@jsenvoy/module-loader';

// Initialize with ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register LLM client
const llmClient = new LLMClient({ /* config */ });
resourceManager.register('llmClient', llmClient);

// Create module
const plannerModule = new LLMPlannerModule({ llmClient });

// Available tools
const tools = plannerModule.getTools();
// Returns: ['create-plan', 'validate-plan', 'get-execution-order']
```

### 3. Code Agent Integration

Example integration with a code generation agent:

```javascript
import { GenericPlanner, FlowValidator } from '@jsenvoy/llm-planner';

class CodeAgent {
  constructor({ llmClient }) {
    this.planner = new GenericPlanner({ llmClient });
    this.validator = new FlowValidator();
  }

  async generateProject(requirements) {
    // Define allowable actions for code generation
    const codeActions = [
      {
        type: 'create-file',
        inputs: ['content', 'path'],
        outputs: ['file-created']
      },
      {
        type: 'install-dependencies',
        inputs: ['packages'],
        outputs: ['dependencies-installed']
      },
      {
        type: 'run-tests',
        inputs: ['test-suite'],
        outputs: ['test-results']
      }
    ];

    // Generate plan
    const plan = await this.planner.createPlan({
      description: requirements.description,
      inputs: ['project-spec'],
      requiredOutputs: ['working-app', 'test-results'],
      allowableActions: codeActions
    });

    // Validate flow
    const validation = this.validator.validate(plan);
    if (!validation.isValid) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }

    // Execute plan
    return await this.executePlan(plan);
  }
}
```

## Usage Patterns

### 1. Basic Planning

```javascript
const planner = new GenericPlanner({ llmClient });

const plan = await planner.createPlan({
  description: "Create a REST API for user management",
  inputs: ["api-spec"],
  requiredOutputs: ["api-server", "api-docs"],
  allowableActions: [
    {
      type: "create-endpoint",
      inputs: ["route", "handler"],
      outputs: ["endpoint"]
    },
    {
      type: "setup-database",
      inputs: ["schema"],
      outputs: ["database"]
    },
    {
      type: "add-middleware",
      inputs: ["middleware-config"],
      outputs: ["configured-middleware"]
    }
  ]
});
```

### 2. Custom Action Definitions

Actions can be tailored to any domain:

```javascript
// DevOps actions
const devOpsActions = [
  {
    type: "create-dockerfile",
    inputs: ["base-image", "dependencies"],
    outputs: ["dockerfile"]
  },
  {
    type: "setup-ci-pipeline",
    inputs: ["pipeline-config"],
    outputs: ["ci-pipeline"]
  },
  {
    type: "configure-monitoring",
    inputs: ["metrics-config"],
    outputs: ["monitoring-setup"]
  }
];

// Data pipeline actions
const dataPipelineActions = [
  {
    type: "create-etl-job",
    inputs: ["source-config", "transform-rules"],
    outputs: ["etl-job"]
  },
  {
    type: "setup-data-warehouse",
    inputs: ["schema-definition"],
    outputs: ["data-warehouse"]
  },
  {
    type: "configure-scheduling",
    inputs: ["schedule-config"],
    outputs: ["scheduled-jobs"]
  }
];
```

### 3. Plan Execution Pattern

```javascript
class PlanExecutor {
  constructor(actionHandlers) {
    this.handlers = actionHandlers;
  }

  async execute(plan) {
    const results = {};
    const outputs = new Map(plan.inputs.map(i => [i, true]));

    for (const stepId of plan.executionOrder) {
      const step = plan.getStepById(stepId);
      
      // Verify inputs are available
      for (const input of step.inputs) {
        if (!outputs.has(input)) {
          throw new Error(`Missing input: ${input}`);
        }
      }

      // Execute actions
      for (const action of step.actions) {
        const handler = this.handlers[action.type];
        if (!handler) {
          throw new Error(`No handler for action: ${action.type}`);
        }
        
        await handler(action);
      }

      // Mark outputs as available
      step.outputs.forEach(output => outputs.set(output, true));
      results[stepId] = { success: true };
    }

    return results;
  }
}
```

## Example Workflows

### 1. Web Application Development

```javascript
const plan = await planner.createPlan({
  description: "Create a React todo application with TypeScript",
  inputs: ["project-requirements"],
  requiredOutputs: ["deployed-app", "test-results"],
  allowableActions: [
    { type: "create-file", inputs: ["content"], outputs: ["file-path"] },
    { type: "install-dependencies", inputs: ["packages"], outputs: ["installed"] },
    { type: "run-tests", inputs: ["test-command"], outputs: ["test-results"] },
    { type: "build-project", inputs: ["build-config"], outputs: ["build-output"] },
    { type: "deploy", inputs: ["deploy-config"], outputs: ["deployed-app"] }
  ]
});

// Resulting plan structure:
// Step 1: Setup (create project structure, config files)
// Step 2: Implementation (create components, add logic)
// Step 3: Testing (write and run tests)
// Step 4: Deployment (build and deploy)
```

### 2. Microservices Architecture

```javascript
const plan = await planner.createPlan({
  description: "Design microservices for an e-commerce platform",
  inputs: ["system-requirements", "architecture-specs"],
  requiredOutputs: ["microservices-system", "api-gateway", "monitoring"],
  allowableActions: [
    { type: "create-service", inputs: ["service-spec"], outputs: ["service"] },
    { type: "setup-database", inputs: ["db-config"], outputs: ["database"] },
    { type: "configure-api-gateway", inputs: ["gateway-config"], outputs: ["api-gateway"] },
    { type: "setup-messaging", inputs: ["queue-config"], outputs: ["message-queue"] },
    { type: "configure-monitoring", inputs: ["metrics"], outputs: ["monitoring"] }
  ]
});
```

### 3. Data Pipeline

```javascript
const plan = await planner.createPlan({
  description: "Build ETL pipeline for customer analytics",
  inputs: ["data-sources", "transformation-rules"],
  requiredOutputs: ["data-warehouse", "analytics-dashboard"],
  allowableActions: [
    { type: "connect-source", inputs: ["connection-config"], outputs: ["data-stream"] },
    { type: "transform-data", inputs: ["transform-rules"], outputs: ["cleaned-data"] },
    { type: "load-warehouse", inputs: ["warehouse-schema"], outputs: ["data-warehouse"] },
    { type: "create-dashboard", inputs: ["metrics-config"], outputs: ["analytics-dashboard"] }
  ]
});
```

## Advanced Features

### 1. Parallel Execution Groups

Plans automatically identify steps that can run in parallel:

```javascript
const parallelGroups = plan.getParallelExecutionGroups();
// Returns: [["step-1", "step-2"], ["step-3"], ["step-4", "step-5"]]
// Meaning step-1 and step-2 can run in parallel, then step-3, etc.
```

### 2. Dependency Management

```javascript
// Check for circular dependencies
if (plan.hasCircularDependencies()) {
  const cycles = plan.findCircularDependencies();
  console.error("Circular dependencies found:", cycles);
}

// Generate topological order
const executionOrder = plan.generateExecutionOrder();
```

### 3. Plan Optimization

```javascript
// Analyze plan efficiency
const analysis = {
  totalSteps: plan.steps.length,
  parallelizableSteps: plan.getParallelExecutionGroups().flat().length,
  criticalPath: plan.getCriticalPath(),
  estimatedDuration: plan.getEstimatedDuration()
};
```

## Best Practices

### 1. Action Design

- **Clear Input/Output Contracts**: Define specific, meaningful input and output names
- **Atomic Actions**: Each action should do one thing well
- **Idempotent Operations**: Actions should be safe to retry

### 2. Plan Validation

- **Always Validate**: Run both structural and flow validation
- **Handle Warnings**: Review warnings for optimization opportunities
- **Test Edge Cases**: Verify plans handle missing inputs gracefully

### 3. Error Handling

```javascript
try {
  const plan = await planner.createPlan(config);
  const validation = validator.validate(plan);
  
  if (!validation.isValid) {
    // Log errors and optionally retry with refined input
    console.error("Validation errors:", validation.errors);
    
    // Could retry with more specific constraints
    config.maxSteps = 10;
    plan = await planner.createPlan(config);
  }
} catch (error) {
  if (error.message.includes("Failed to generate valid plan")) {
    // LLM couldn't create a valid plan after retries
    // Consider simplifying the task or providing more guidance
  }
}
```

## Performance Optimization

1. **Plan Caching**: Cache generated plans for similar inputs
2. **Streaming Generation**: For large plans, use streaming LLM responses
3. **Parallel Validation**: Run independent validators concurrently
4. **Incremental Planning**: Break large tasks into smaller sub-plans

## Conclusion

The LLM Planner provides a powerful, general-purpose framework for decomposing complex tasks into structured, executable plans. By allowing users to define their own action types and input/output contracts, it can be adapted to virtually any domain while maintaining consistency and validation guarantees.

Key advantages:
- **Domain Agnostic**: Works for any task that can be broken into steps
- **Flow Validation**: Ensures data dependencies are satisfied
- **LLM Flexibility**: Supports multiple providers through @jsenvoy/llm
- **Modular Design**: Integrates seamlessly with jsEnvoy ecosystem

The framework bridges the gap between natural language task descriptions and structured execution plans, making it an essential tool for AI-driven automation.