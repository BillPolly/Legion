# LLM Planner Design Document

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Plan Structure](#plan-structure)
5. [Implementation Strategy](#implementation-strategy)
6. [Integration Points](#integration-points)
7. [Extensibility](#extensibility)
8. [Example Workflows](#example-workflows)

## Overview

The LLM Planner is a sophisticated planning system that leverages Large Language Models to transform natural language requirements into structured, executable plans. While initially focused on code generation tasks, the architecture is designed to be domain-agnostic and extensible.

### Key Objectives

1. **Intelligent Understanding**: Use LLMs to understand complex, ambiguous requirements
2. **Structured Output**: Generate consistent, actionable plans with clear steps
3. **Domain Flexibility**: Support multiple planning domains through specialized planners
4. **Quality Assurance**: Validate and refine plans before execution
5. **Integration Ready**: Seamless integration with jsEnvoy ecosystem

### Design Principles

- **Separation of Concerns**: Clear boundaries between planning, validation, and execution
- **Extensibility First**: Easy to add new planner types and domains
- **Prompt Engineering**: Carefully crafted prompts for consistent LLM responses
- **Fail-Safe Design**: Comprehensive error handling and plan validation
- **Event-Driven**: Observable plan generation and execution process

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM Planner                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Planners  │  │     Core     │  │     Models      │  │
│  │             │  │              │  │                 │  │
│  │ CodePlanner │  │ BasePlanner  │  │      Plan       │  │
│  │ TestPlanner │  │ PlanExecutor │  │    PlanStep     │  │
│  │ ArchPlanner │  │ PlanValidator│  │  PlanContext    │  │
│  └─────────────┘  │ PlanRefiner  │  └─────────────────┘  │
│                   └──────────────┘                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Utilities                         │  │
│  │                                                      │  │
│  │  PromptBuilder   PlanFormatter   ResponseParser     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 LLM Integration                      │  │
│  │                                                      │  │
│  │              @jsenvoy/llm Client                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Layer Descriptions

1. **Planners Layer**: Domain-specific planning implementations
2. **Core Layer**: Base classes and core functionality
3. **Models Layer**: Data structures for plans and execution
4. **Utilities Layer**: Helper functions for prompt building and parsing
5. **Integration Layer**: Connection to jsEnvoy LLM client

## Core Components

### 1. BasePlanner

Abstract base class that provides the foundation for all planners.

```javascript
class BasePlanner {
  constructor(config) {
    this.llmClient = new LLMClientManager(config.llmConfig);
    this.validator = new PlanValidator();
    this.refiner = new PlanRefiner();
  }

  async createPlan(requirements) {
    // Template method pattern
    const context = await this.analyzeRequirements(requirements);
    const rawPlan = await this.generatePlan(context);
    const validatedPlan = await this.validator.validate(rawPlan);
    const refinedPlan = await this.refiner.refine(validatedPlan, context);
    return new Plan(refinedPlan);
  }

  // Abstract methods to be implemented by subclasses
  async analyzeRequirements(requirements) { }
  async generatePlan(context) { }
}
```

### 2. CodePlanner

Specialized planner for software development tasks.

```javascript
class CodePlanner extends BasePlanner {
  async analyzeRequirements(requirements) {
    // Use LLM to understand project requirements
    // Extract: project type, technologies, features, constraints
    return {
      projectType: 'fullstack',
      frontend: { framework: 'react', language: 'typescript' },
      backend: { framework: 'express', database: 'postgresql' },
      features: ['authentication', 'CRUD operations'],
      constraints: ['must be accessible', 'responsive design']
    };
  }

  async generatePlan(context) {
    // Generate detailed implementation plan
    // Including: file structure, dependencies, implementation order
    return {
      steps: [
        {
          id: 'setup-project',
          name: 'Initialize project structure',
          dependencies: [],
          tasks: [
            'Create directory structure',
            'Initialize package.json',
            'Set up Git repository'
          ]
        },
        // ... more steps
      ]
    };
  }
}
```

### 3. PlanValidator

Ensures plans meet quality, completeness, and correctness criteria before execution.

```javascript
class PlanValidator {
  constructor(config = {}) {
    this.validationPipeline = [
      new StructuralValidator(),
      new DependencyValidator(),
      new SemanticValidator(),
      new CompletenessValidator()
    ];
    this.domainValidators = new Map();
    this.config = config;
  }

  async validate(plan) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      score: 100
    };

    // Run through validation pipeline
    for (const validator of this.validationPipeline) {
      const result = await validator.validate(plan);
      this.mergeResults(validationResult, result);
    }

    // Apply domain-specific validation
    const domainValidator = this.domainValidators.get(plan.domain);
    if (domainValidator) {
      const result = await domainValidator.validate(plan);
      this.mergeResults(validationResult, result);
    }

    // Calculate quality score
    validationResult.score = this.calculateQualityScore(validationResult);

    if (validationResult.errors.length > 0) {
      validationResult.isValid = false;
    }

    return validationResult;
  }

  registerDomainValidator(domain, validator) {
    this.domainValidators.set(domain, validator);
  }
}
```

### 4. Validation Architecture

The validation system consists of multiple layers ensuring plan correctness:

#### 4.1 Structural Validator

```javascript
class StructuralValidator {
  validate(plan) {
    const result = { errors: [], warnings: [] };
    
    // Validate required fields
    if (!plan.id || !plan.name || !plan.steps) {
      result.errors.push('Missing required plan fields');
    }
    
    // Validate step structure
    for (const step of plan.steps) {
      if (!step.id || !step.name || !step.actions) {
        result.errors.push(`Invalid step structure: ${step.id}`);
      }
      
      // Validate action types
      for (const action of step.actions) {
        if (!this.isValidActionType(action.type)) {
          result.errors.push(`Unknown action type: ${action.type}`);
        }
      }
    }
    
    return result;
  }
}
```

#### 4.2 Dependency Validator

```javascript
class DependencyValidator {
  validate(plan) {
    const result = { errors: [], warnings: [] };
    const stepIds = new Set(plan.steps.map(s => s.id));
    
    // Check all dependencies exist
    for (const step of plan.steps) {
      for (const dep of step.dependencies || []) {
        if (!stepIds.has(dep)) {
          result.errors.push(`Step ${step.id} depends on non-existent step ${dep}`);
        }
      }
    }
    
    // Check for circular dependencies
    const cycles = this.detectCycles(plan.steps);
    if (cycles.length > 0) {
      result.errors.push(`Circular dependencies detected: ${cycles.join(', ')}`);
    }
    
    return result;
  }
}
```

#### 4.3 Semantic Validator

```javascript
class SemanticValidator {
  validate(plan) {
    const result = { errors: [], warnings: [] };
    
    // Validate logical flow
    if (!this.validateLogicalSequence(plan.steps)) {
      result.errors.push('Plan steps do not form a logical sequence');
    }
    
    // Check for conflicting actions
    const conflicts = this.detectActionConflicts(plan.steps);
    if (conflicts.length > 0) {
      result.errors.push(`Conflicting actions detected: ${conflicts.join(', ')}`);
    }
    
    // Validate resource requirements
    if (!this.validateResourceAvailability(plan)) {
      result.warnings.push('Some required resources may not be available');
    }
    
    return result;
  }
}
```

### 5. PlanRefiner

Iteratively improves plans based on validation feedback.

```javascript
class PlanRefiner {
  constructor(config = {}) {
    this.maxRefinements = config.maxRefinements || 3;
    this.llmClient = config.llmClient;
  }

  async refine(plan, context) {
    let refinedPlan = plan;
    let refinementCount = 0;

    while (refinementCount < this.maxRefinements) {
      const issues = await this.identifyIssues(refinedPlan);
      
      if (issues.length === 0) {
        break;
      }

      refinedPlan = await this.applyRefinements(refinedPlan, issues, context);
      refinementCount++;
    }

    return refinedPlan;
  }
}
```

## Plan Structure

Plans are hierarchical structures with the following components:

```javascript
{
  id: "plan-unique-id",
  name: "Create Todo Application",
  version: "1.0.0",
  metadata: {
    createdAt: "2024-01-15T10:00:00Z",
    createdBy: "CodePlanner",
    estimatedDuration: "2 hours",
    complexity: "medium"
  },
  context: {
    projectType: "fullstack",
    technologies: ["react", "nodejs", "postgresql"],
    constraints: ["accessibility", "responsive"]
  },
  steps: [
    {
      id: "step-1",
      name: "Set up project structure",
      description: "Initialize the project with proper directory structure",
      type: "setup",
      dependencies: [],
      inputs: {
        projectName: "todo-app",
        projectType: "fullstack"
      },
      outputs: {
        directories: ["src", "public", "server"],
        files: ["package.json", "README.md"]
      },
      actions: [
        {
          type: "create-directory",
          path: "todo-app",
          recursive: true
        },
        {
          type: "create-file",
          path: "todo-app/package.json",
          content: "{ ... }"
        }
      ],
      validation: {
        criteria: [
          "Directory structure exists",
          "Package.json is valid"
        ]
      },
      rollback: {
        actions: [
          {
            type: "delete-directory",
            path: "todo-app"
          }
        ]
      }
    },
    // ... more steps
  ],
  executionOrder: ["step-1", "step-2", "step-3"],
  successCriteria: [
    "All tests pass",
    "Application runs without errors",
    "Features implemented as specified"
  ]
}
```

### Step Types

1. **Setup Steps**: Project initialization, environment configuration
2. **Implementation Steps**: Code generation, file creation
3. **Integration Steps**: Connecting components, API integration
4. **Testing Steps**: Test generation and execution
5. **Validation Steps**: Quality checks, linting, type checking
6. **Deployment Steps**: Build processes, deployment configuration

## Implementation Strategy

### Phase 1: Core Infrastructure
- Implement BasePlanner abstract class
- Create basic Plan and PlanStep models
- Set up LLM integration with prompt templates
- Implement basic validation rules

### Phase 2: Code Planning
- Implement CodePlanner for software projects
- Create prompt templates for code generation planning
- Add project type detection (frontend, backend, fullstack)
- Implement file structure planning

### Phase 3: Advanced Plan Validation
- Implement comprehensive validation pipeline
- Create domain-specific validators
- Add plan quality scoring system
- Implement validation feedback mechanisms

### Phase 4: Refinement and Validation
- Implement comprehensive validation rules
- Create PlanRefiner with iterative improvement
- Add plan quality metrics
- Implement feedback loop for plan improvement

### Phase 5: Extended Planners
- Add TestPlanner for test generation
- Add ArchitecturePlanner for system design
- Create planner for API design
- Implement planner composition for complex tasks

## Integration Points

### 1. LLM Client Integration

```javascript
import { LLMClientManager } from '@jsenvoy/llm';

class BasePlanner {
  constructor(config) {
    this.llmClient = new LLMClientManager({
      provider: config.llmProvider || 'openai',
      apiKey: config.apiKey,
      model: config.model || 'gpt-4',
      maxRetries: 3
    });
  }

  async generateWithLLM(prompt, options = {}) {
    const response = await this.llmClient.generateStructuredResponse(
      prompt,
      options.schema,
      options
    );
    return response.data;
  }
}
```

### 2. Code Agent Integration

```javascript
import { CodePlanner, PlanValidator } from '@jsenvoy/llm-planner';

class CodeAgent {
  constructor(config) {
    this.planner = new CodePlanner(config.plannerConfig);
    this.validator = new PlanValidator(config.validatorConfig);
  }

  async develop(requirements) {
    // Generate plan using LLM planner
    const plan = await this.planner.createPlan(requirements);
    
    // Validate plan before execution
    const validationResult = await this.validator.validate(plan);
    
    if (!validationResult.isValid) {
      throw new Error(`Invalid plan: ${validationResult.errors.join(', ')}`);
    }
    
    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('Plan warnings:', validationResult.warnings);
    }
    
    // Execute validated plan steps
    for (const step of plan.steps) {
      await this.executeStep(step);
    }
  }
  
  async executeStep(step) {
    // Code agent handles actual execution
    // Implementation depends on step type and actions
  }
}
```

### 3. Event System

```javascript
// Planner events
planner.on('plan:created', (plan) => {
  console.log('Plan created:', plan.id);
});

planner.on('plan:refined', (plan, refinementCount) => {
  console.log(`Plan refined (iteration ${refinementCount}):`, plan.id);
});

// Validator events
validator.on('validation:start', (plan) => {
  console.log('Starting validation for plan:', plan.id);
});

validator.on('validation:complete', (result) => {
  console.log('Validation result:', {
    isValid: result.isValid,
    score: result.score,
    errorCount: result.errors.length,
    warningCount: result.warnings.length
  });
});

validator.on('validation:error', (error, validator) => {
  console.error(`Validation error in ${validator}:`, error);
});
```

## Extensibility

### 1. Custom Planners

```javascript
class CustomPlanner extends BasePlanner {
  async analyzeRequirements(requirements) {
    // Custom requirement analysis
  }

  async generatePlan(context) {
    // Custom plan generation
  }
}

// Register custom planner
PlannerRegistry.register('custom', CustomPlanner);
```

### 2. Validation Rules

```javascript
class CustomValidator extends BaseValidator {
  async validate(plan) {
    // Custom validation logic
    return {
      errors: [],
      warnings: []
    };
  }
}

// Add to validation pipeline
planValidator.addRule(new CustomValidator());
```

### 3. Domain Validators

```javascript
class CodePlanValidator {
  async validate(plan) {
    const result = { errors: [], warnings: [], suggestions: [] };
    
    // Validate file paths
    for (const step of plan.steps) {
      for (const action of step.actions) {
        if (action.type === 'create-file') {
          if (!this.isValidFilePath(action.path)) {
            result.errors.push(`Invalid file path: ${action.path}`);
          }
        }
      }
    }
    
    // Validate imports and dependencies
    const importErrors = this.validateImports(plan);
    result.errors.push(...importErrors);
    
    // Suggest optimizations
    const suggestions = this.suggestOptimizations(plan);
    result.suggestions.push(...suggestions);
    
    return result;
  }
}

// Register domain validator
validator.registerDomainValidator('code', new CodePlanValidator());
```

## Example Workflows

### 1. Simple Frontend Application

```javascript
const planner = new CodePlanner({ llmConfig });

const plan = await planner.createPlan({
  task: 'Create a weather dashboard',
  requirements: {
    type: 'frontend',
    features: ['current weather', 'forecast', 'location search'],
    style: 'modern, responsive',
    api: 'OpenWeatherMap'
  }
});

// Generated plan includes:
// - HTML structure setup
// - CSS styling implementation
// - JavaScript for API integration
// - Error handling
// - Responsive design implementation
```

### 2. Full-Stack Application

```javascript
const plan = await planner.createPlan({
  task: 'Create a blog platform',
  requirements: {
    frontend: 'React with TypeScript',
    backend: 'Node.js with Express',
    database: 'PostgreSQL',
    features: [
      'User authentication',
      'Create/edit/delete posts',
      'Comments system',
      'Categories and tags',
      'Search functionality'
    ]
  }
});

// Generated plan includes:
// - Database schema design
// - API endpoint planning
// - Frontend component structure
// - Authentication flow
// - Data validation rules
// - Test scenarios
```

### 3. Microservices Architecture

```javascript
const archPlanner = new ArchitecturePlanner({ llmConfig });

const plan = await archPlanner.createPlan({
  task: 'Design microservices for e-commerce',
  requirements: {
    services: ['user', 'product', 'order', 'payment', 'notification'],
    communication: 'REST with message queue',
    deployment: 'Kubernetes',
    scalability: 'High traffic expected'
  }
});

// Generated plan includes:
// - Service boundaries and responsibilities
// - API contracts between services
// - Database per service design
// - Message queue integration points
// - Deployment configurations
// - Monitoring and logging strategy
```

## Error Handling

### 1. Plan Generation Errors

```javascript
try {
  const plan = await planner.createPlan(requirements);
} catch (error) {
  if (error instanceof PlanGenerationError) {
    // Handle LLM failures, invalid requirements
  } else if (error instanceof ValidationError) {
    // Handle plan validation failures
  }
}
```

### 2. Execution Errors

```javascript
executor.on('step:error', (step, error) => {
  console.error(`Step ${step.name} failed:`, error);
  // Decide whether to continue, retry, or rollback
});
```

## Performance Considerations

1. **LLM Call Optimization**
   - Cache similar planning requests
   - Batch related planning operations
   - Use streaming for large plans

2. **Plan Size Management**
   - Break large plans into phases
   - Implement lazy loading for plan details
   - Compress plan storage

3. **Execution Efficiency**
   - Parallel execution of independent steps
   - Resource pooling for common operations
   - Progress persistence for resumability

## Security Considerations

1. **Input Validation**
   - Sanitize all user inputs
   - Validate against injection attacks
   - Limit plan complexity to prevent DoS

2. **LLM Security**
   - Filter sensitive information from prompts
   - Validate LLM responses for malicious content
   - Implement rate limiting

3. **Execution Security**
   - Sandbox plan execution environment
   - Validate all file system operations
   - Implement permission checks

## Future Enhancements

1. **Machine Learning Integration**
   - Learn from successful plans
   - Improve prompt templates based on outcomes
   - Predict plan complexity and duration

2. **Collaborative Planning**
   - Multi-user plan creation
   - Plan review and approval workflows
   - Version control for plans

3. **Visual Planning Tools**
   - Graphical plan editor
   - Drag-and-drop plan modification
   - Real-time plan visualization

4. **Domain Expansion**
   - DevOps planning (CI/CD, infrastructure)
   - Data pipeline planning
   - Business process planning
   - Educational curriculum planning

## Conclusion

The LLM Planner represents a significant advancement in automated planning systems. By leveraging the power of Large Language Models while maintaining structured, validated outputs, it bridges the gap between natural language requirements and executable plans. The extensible architecture ensures that new domains and use cases can be easily added, making it a versatile tool for various planning needs.

The focus on code generation as the initial domain provides immediate value while establishing patterns that can be applied to other domains. With careful prompt engineering, comprehensive validation, and a robust execution framework, the LLM Planner aims to be a reliable and intelligent planning solution for the jsEnvoy ecosystem and beyond.