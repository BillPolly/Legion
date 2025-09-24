# ROMA Agent Architecture Guide

## Core Philosophy: Right Tool for the Right Job

This document explains the architectural principles and patterns used in ROMA agent strategies, particularly the proper use of LLMs versus JavaScript code.

## 1. When to Use LLMs vs JavaScript

### Use LLMs for:
- **Natural language understanding** - Extracting meaning from user descriptions
- **Context interpretation** - Understanding implications and relationships
- **Creative generation** - Writing code, documentation, test cases
- **Complex decision making** - Architecture choices, design patterns
- **Requirement analysis** - Understanding what the user actually needs (not just what they said)
- **Pattern recognition** - Identifying similar problems and solutions
- **Quality assessment** - Code review, best practices evaluation

### Use JavaScript for:
- **Simple computations** - Math, counting, array manipulation
- **Deterministic logic** - If/then conditions with clear rules
- **Data formatting** - JSON manipulation, string formatting
- **Flow control** - Orchestrating execution order
- **File system operations** - Reading/writing files
- **Tool invocation** - Calling external tools with specific parameters
- **Result aggregation** - Combining outputs from multiple sources

### Bad Patterns to Avoid:
```javascript
// ❌ BAD: JavaScript trying to understand natural language
function extractTaskDetails(description) {
  const desc = description.toLowerCase();
  if (desc.includes('api') || desc.includes('rest')) {
    projectType = 'api';  // Will miss "service for external systems"
  }
}

// ❌ BAD: Keyword matching for requirement analysis  
function needsDatabase(requirements) {
  return requirements.some(req => 
    req.includes('data') || req.includes('store')  // Will miss "save user preferences"
  );
}
```

### Good Patterns:
```javascript
// ✅ GOOD: LLM understands the requirement
const analysisResult = await comprehensiveAnalysisPrompt.execute({
  taskDescription: description  // LLM understands "user management system" → needs auth, DB, API
});

// ✅ GOOD: JavaScript handles simple formatting
function formatSummary(analysis) {
  return `Found ${analysis.requirements.length} requirements, ${analysis.components.length} components`;
}
```

## 2. Message Passing Architecture

### Fire-and-Forget Pattern
All message passing uses asynchronous, fire-and-forget semantics:

```javascript
// Tasks communicate via send() - no return values
task.send(targetTask, { type: 'work', data: payload });

// Messages are queued and processed asynchronously
onMessage(senderTask, message) {
  // Process message without returning a value
  // Use send() to communicate results back if needed
}
```

### Why Fire-and-Forget?
- **No blocking** - Tasks don't wait for responses
- **Scalable** - Can handle many concurrent tasks
- **Resilient** - Failures don't cascade
- **Actor model** - True actor-based concurrency

## 3. Subtask Architecture

### When to Create Subtasks
Create subtasks when you need:
- **LLM analysis** that's independent of the main flow
- **Parallel processing** of multiple items
- **Specialized strategies** for specific work
- **Isolation** of complex operations

### How Subtasks Work
```javascript
// Parent creates child with specific strategy
const analysisTask = createTask(
  'Analyze requirements',
  parentTask,
  AnalysisStrategy,  // Child uses specialized strategy
  context
);

// Parent sends work to child
parentTask.send(analysisTask, { type: 'start' });

// Child completes and notifies parent
analysisTask.complete(result);
// Parent's onChildCompleted() is called automatically
```

### Subtask Communication
- **Parent → Child**: Via `send()` with work messages
- **Child → Parent**: Via completion notifications
- **Artifacts**: Passed through context, not return values

## 4. Prompt Templating System

### Declarative Prompts
All prompts are defined declaratively in markdown files with YAML frontmatter:

```markdown
---
name: analyze-requirements
description: Analyze and extract requirements from task description
variables:
  - taskDescription
  - context
responseSchema:
  type: object
  properties:
    projectType:
      type: string
      enum: [api, webapp, cli, library, service]
    requirements:
      type: array
      # ... detailed schema
---

Analyze this task and extract detailed requirements:

Task: {{taskDescription}}

Context: {{context}}

Identify:
1. The type of project being requested
2. All functional requirements...
```

### Response Handling
```javascript
// Prompts are loaded at strategy construction time
await strategy.loadPrompt('analyzeRequirements');

// During execution, prompts are executed with variables
const result = await this.getPrompt('analyzeRequirements').execute({
  taskDescription: task.description,
  context: task.getContext()
});

// Result structure matches responseSchema
if (result.success) {
  const { projectType, requirements } = result.data;
  // Process structured response
}
```

### Why Declarative Prompts?
- **Separation of concerns** - Prompts separate from logic
- **Reusability** - Same prompt across different strategies
- **Validation** - Response schema ensures structure
- **Versioning** - Prompts can evolve independently
- **Testing** - Prompts can be tested in isolation

## 5. StandardTaskStrategy Base Class

All strategies inherit from StandardTaskStrategy which provides:

### Automatic Boilerplate Handling
- Message routing and error handling
- Tool loading and management  
- Prompt loading and caching
- Artifact management
- Parent/child communication

### Strategy Implementation
Strategies only need to implement `doWork()`:

```javascript
createAnalysisStrategy.doWork = async function() {
  // 1. Use LLM to understand requirements
  const analysis = await this.getPrompt('comprehensiveAnalysis').execute({
    taskDescription: this.description
  });
  
  // 2. Use JavaScript for simple logic
  if (analysis.data.needsDetailedDesign) {
    // Create subtask for detailed design
    const designTask = createTask('Design system', this, DesignStrategy);
    this.send(designTask, { type: 'start', requirements: analysis.data });
  }
  
  // 3. Complete with results
  this.completeWithArtifacts({
    'requirements': { value: analysis.data, type: 'json' }
  });
};
```

## 6. Best Practices

### 1. Let LLMs Understand, Let JavaScript Orchestrate
```javascript
// ✅ GOOD: LLM understands, JS orchestrates
const understanding = await llmPrompt.execute({ description });
if (understanding.needsDatabase) {
  await this.setupDatabase();
}

// ❌ BAD: JS tries to understand
if (description.includes('database')) {
  await this.setupDatabase();
}
```

### 2. Use Subtasks for Independent LLM Work
```javascript
// ✅ GOOD: Subtask for complex LLM analysis
const analysisTask = createTask('Analyze', this, AnalysisStrategy);
this.send(analysisTask, { type: 'start' });

// ❌ BAD: Sequential LLM calls in main task
const req1 = await prompt1.execute();
const req2 = await prompt2.execute();
const req3 = await prompt3.execute();
```

### 3. Consolidate Related LLM Operations
```javascript
// ✅ GOOD: One comprehensive prompt
const analysis = await comprehensiveAnalysisPrompt.execute({
  task: description
});
// Returns: projectType, components, requirements, architecture, etc.

// ❌ BAD: Many small prompts for related things
const projectType = await detectProjectTypePrompt.execute();
const components = await identifyComponentsPrompt.execute();
const requirements = await extractRequirementsPrompt.execute();
```

### 4. Keep Response Schemas Strict
```yaml
# ✅ GOOD: Detailed schema with enums and required fields
responseSchema:
  type: object
  required: [projectType, requirements]
  properties:
    projectType:
      type: string
      enum: [api, webapp, cli, service]
      
# ❌ BAD: Loose schema
responseSchema:
  type: object  # No structure enforced
```

### 5. Use Fire-and-Forget Messaging
```javascript
// ✅ GOOD: Fire and forget
this.send(childTask, { type: 'analyze', data });

// ❌ BAD: Waiting for responses
const result = await childTask.analyze(data);  // Don't do this!
```

## 7. Common Patterns

### Pattern: Comprehensive Analysis
When analyzing requirements, use ONE comprehensive LLM call:

```javascript
async function doWork() {
  // One LLM call understands everything
  const analysis = await this.getPrompt('comprehensiveAnalysis').execute({
    taskDescription: this.description,
    context: this.getContext()
  });
  
  // JavaScript orchestrates based on understanding
  const { projectType, components, requirements } = analysis.data;
  
  if (components.includes('database')) {
    this.storeArtifact('dbSchema', generateSchema(requirements));
  }
  
  this.completeWithArtifacts({
    'analysis': { value: analysis.data, type: 'json' }
  });
}
```

### Pattern: Parallel Subtask Processing
For independent work items, use parallel subtasks:

```javascript
async function doWork() {
  const components = ['auth', 'api', 'database'];
  
  // Create subtasks for parallel processing
  for (const component of components) {
    const task = createTask(`Design ${component}`, this, ComponentStrategy);
    this.send(task, { type: 'start', component });
  }
  
  // Results come back via onChildCompleted
}

onChildCompleted(childTask, result) {
  this.componentsCompleted++;
  if (this.componentsCompleted === this.totalComponents) {
    this.complete({ success: true });
  }
}
```

### Pattern: Progressive Enhancement
Start simple, enhance with details:

```javascript
async function doWork() {
  // Quick analysis first
  const quickAnalysis = await this.getPrompt('quickAnalysis').execute({
    task: this.description
  });
  
  // Detailed analysis only if needed
  if (quickAnalysis.data.complexity === 'high') {
    const detailed = await this.getPrompt('detailedAnalysis').execute({
      task: this.description,
      initial: quickAnalysis.data
    });
    this.storeArtifact('detailed-analysis', detailed.data);
  }
  
  this.complete(quickAnalysis.data);
}
```

## 8. Anti-Patterns to Avoid

### Anti-Pattern: JavaScript Natural Language Processing
```javascript
// ❌ NEVER DO THIS
function detectTechnology(description) {
  if (description.includes('react')) return 'react';
  if (description.includes('vue')) return 'vue';
  // Missing: "front-end framework", "SPA", "component-based UI", etc.
}
```

### Anti-Pattern: Synchronous Task Communication
```javascript
// ❌ NEVER DO THIS
const result = await childTask.process(data);  // Blocks parent
return result;  // Returns value from message handler
```

### Anti-Pattern: Multiple Sequential LLM Calls
```javascript
// ❌ AVOID THIS
const type = await detectTypePrompt.execute();
const requirements = await extractRequirementsPrompt.execute();
const components = await identifyComponentsPrompt.execute();
const architecture = await designArchitecturePrompt.execute();

// ✅ DO THIS INSTEAD
const analysis = await comprehensiveAnalysisPrompt.execute({
  task: description
});
// Gets everything in one intelligent pass
```

### Anti-Pattern: Mixing Concerns
```javascript
// ❌ BAD: Prompt logic mixed with orchestration
async function doWork() {
  const prompt = `Analyze this: ${this.description}
    Return JSON with fields...`;  // Don't embed prompts!
  const result = await this.llm.complete(prompt);
}

// ✅ GOOD: Declarative prompt, clean orchestration
async function doWork() {
  const result = await this.getPrompt('analysis').execute({
    task: this.description
  });
}
```

## Summary

The ROMA agent architecture is designed to leverage the strengths of both LLMs and JavaScript:

1. **LLMs** understand natural language and make intelligent decisions
2. **JavaScript** orchestrates execution and handles simple logic
3. **Messages** flow asynchronously between tasks
4. **Subtasks** provide isolation and specialization
5. **Prompts** are declarative and validated
6. **Strategies** only implement core logic, not boilerplate

This separation of concerns creates a system that is:
- **Intelligent** - LLMs understand context and meaning
- **Efficient** - JavaScript handles simple operations
- **Maintainable** - Clear separation of concerns
- **Testable** - Each component can be tested independently
- **Scalable** - Asynchronous message passing enables concurrency