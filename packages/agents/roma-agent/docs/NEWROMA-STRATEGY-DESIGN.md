# NewROMA Strategy Design - Data-Driven SOP Architecture

## Overview

NewROMA is an AI agent framework that uses Standard Operating Procedures (SOPs) to generate task execution strategies. SOPs are stored as data files (YAML/JSON) that define how an LLM should approach different types of work. A SOPStrategy class reads these definitions and implements the TaskStrategy interface.

The core concept: instead of writing code for each type of task, you create SOP files that define the prompts and tools needed. The SOPStrategy class reads the SOP file and becomes a fully functional strategy instance that can be tested and used like any other strategy.

## Core Principles

1. **SOPs as Data, Not Code**: All strategy behaviors are defined in configuration files (JSON/YAML) rather than hardcoded classes
2. **LLM-Driven Decisions**: All strategic decisions are made by the LLM using prompts defined in SOP files  
3. **Strategy Instantiation**: SOP files are used to create SOPStrategy instances that implement TaskStrategy interface
4. **Testable**: Each SOPStrategy instance can be unit tested like any other strategy class
5. **Fail Fast**: Required tools must be available or strategy creation fails immediately

## Architecture Components

### 1. SOP File Format

SOPs are defined as JSON/YAML files with the following structure:

```yaml
# sop/javascript-development.yaml
metadata:
  id: "javascript-development"
  name: "JavaScript Development"
  version: "1.0.0"
  description: "Standard operating procedure for JavaScript development tasks"
  category: "development"
  tags: ["javascript", "coding", "development", "programming"]
  keywords: ["js", "node", "npm", "javascript", "code", "function", "class"]
  author: "Legion Framework"
  created: "2024-01-15"
  updated: "2024-01-15"

# LLM Decision Points - 5 core decisions from ROMA pattern
llm_decisions:
  # 1. Task Classification
  classification:
    prompt: |
      Analyze this JavaScript development task: "{{taskDescription}}"
      
      Consider:
      - Complexity of the requirement
      - Number of files/components needed
      - Dependencies and integrations required
      - Available artifacts: {{artifacts}}
      
      Classify as SIMPLE (single file, straightforward) or COMPLEX (multiple components, architecture decisions).
    schema:
      type: object
      properties:
        complexity: 
          type: string
          enum: ["SIMPLE", "COMPLEX"]
        reasoning: 
          type: string
      required: ["complexity", "reasoning"]

  # 2. Decomposition (for COMPLEX tasks)
  decomposition:
    prompt: |
      Decompose this JavaScript development task: "{{taskDescription}}"
      
      Current context:
      - Artifacts: {{artifacts}}
      - Conversation: {{conversation}}
      
      Break into logical subtasks with clear inputs/outputs.
      Each subtask should have specific deliverables.
    schema:
      type: object
      properties:
        decompose:
          type: boolean
        subtasks:
          type: array
          items:
            type: object
            properties:
              description: 
                type: string
              inputs: 
                type: string
                description: "Comma-separated artifact names this subtask needs"
              outputs: 
                type: string
                description: "Comma-separated artifact names this subtask will produce"
            required: ["description"]
      required: ["decompose", "subtasks"]

  # 3. Tool Discovery and Execution (for SIMPLE tasks)
  execution:
    prompt: |
      Execute this JavaScript development task: "{{taskDescription}}"
      
      Available tools: {{tools}}
      Context: 
      - Artifacts: {{artifacts}}
      - Conversation: {{conversation}}
      
      Either provide tool calls to complete the task or a direct response for analysis tasks.
    schema:
      type: object
      anyOf:
        - type: object
          properties:
            useTools:
              type: boolean
              const: true
            toolCalls:
              type: array
              items:
                type: object
                properties:
                  tool: 
                    type: string
                  inputs: 
                    type: object
                  outputs: 
                    type: object
                required: ["tool", "inputs"]
          required: ["useTools", "toolCalls"]
        - type: object
          properties:
            response: 
              type: string
          required: ["response"]

  # 4. Parent Evaluation (after child completion)
  parent_evaluation:
    prompt: |
      A subtask has completed for parent task: "{{parentTaskDescription}}"
      
      Completed subtask: "{{childTaskDescription}}"
      
      Context:
      - Parent artifacts: {{artifacts}}
      - Completed subtasks: {{completedSubtasks}}
      - Conversation: {{conversation}}
      
      Decide what to do next: CONTINUE (next subtask), COMPLETE (task done), RETRY (redo subtask), or REPLAN (new decomposition).
    schema:
      type: object
      properties:
        decision:
          type: string
          enum: ["CONTINUE", "COMPLETE", "RETRY", "REPLAN"]
        reasoning:
          type: string
      required: ["decision", "reasoning"]

  # 5. Completion Evaluation
  completion_evaluation:
    prompt: |
      Evaluate if this JavaScript development task is complete: "{{taskDescription}}"
      
      Context:
      - Artifacts created: {{artifacts}}
      - Completed subtasks: {{completedSubtasks}}
      - Conversation: {{conversation}}
      
      Check if all requirements are met and deliverables are complete.
    schema:
      type: object
      properties:
        isComplete:
          type: boolean
        reasoning:
          type: string
        summary:
          type: string
      required: ["isComplete", "reasoning"]

# Tool configuration for this SOP
tools:
  # Exact tools this SOP requires - FAIL if not available
  required_tools:
    - "file_write"
    - "file_read" 
    - "directory_create"
    - "npm_install"
    - "eslint_check"
    - "jest_run"
    - "package_json_update"

# Artifact patterns this SOP commonly works with
artifact_patterns:
  inputs:
    - name: "requirements"
      type: "text"
      description: "Development requirements and specifications"
    - name: "existing_code"
      type: "code"
      description: "Existing JavaScript codebase to extend"
  outputs:
    - name: "source_files"
      type: "code"
      description: "Generated JavaScript source files"
    - name: "test_files"
      type: "code"
      description: "Unit test files"
    - name: "package_json"
      type: "config"
      description: "Package configuration with dependencies"

# Quality criteria for this SOP
quality_criteria:
  - "Code follows JavaScript best practices"
  - "All functions have proper error handling"
  - "Tests achieve >80% coverage"
  - "ESLint passes with no errors"
  - "Documentation includes usage examples"
```

### 2. SOPStrategy Class

A strategy class that reads SOP definitions and implements TaskStrategy:

```javascript
// src/strategies/SOPStrategy.js
import { TaskStrategy } from '@legion/tasks';
import { TemplatedPrompt } from '@legion/prompting-manager';
import fs from 'fs/promises';
import yaml from 'js-yaml';

export default class SOPStrategy extends TaskStrategy {
  constructor(sopFilePath, llmClient, toolRegistry) {
    super();
    this.sopFilePath = sopFilePath;
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.sopDefinition = null;
    this.tools = [];
    this.prompts = new Map(); // Compiled prompts
  }

  /**
   * Load and validate SOP definition, prepare tools and prompts
   */
  async initialize() {
    // Load SOP file
    const sopContent = await fs.readFile(this.sopFilePath, 'utf8');
    this.sopDefinition = yaml.load(sopContent);
    
    // Validate required tools exist - FAIL FAST
    await this._loadRequiredTools();
    
    // Compile all prompts
    await this._compilePrompts();
    
    console.log(`✅ SOPStrategy initialized: ${this.sopDefinition.metadata.name}`);
  }

  getName() {
    return this.sopDefinition ? this.sopDefinition.metadata.name : 'SOPStrategy';
  }

  /**
   * Load required tools - FAIL if any missing
   */
  async _loadRequiredTools() {
    const toolConfig = this.sopDefinition.tools;
    const missing = [];
    
    for (const toolName of toolConfig.required_tools) {
      const tool = await this.toolRegistry.getToolByName(toolName);
      if (tool) {
        this.tools.push(tool);
      } else {
        missing.push(toolName);
      }
    }

    // FAIL FAST if any required tools are missing
    if (missing.length > 0) {
      throw new Error(`Required tools not available for SOP ${this.sopDefinition.metadata.id}: ${missing.join(', ')}`);
    }
  }

  /**
   * Handle messages from parent task
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleWorkMessage(message.task || parentTask);
      case 'abort':
        return { acknowledged: true, aborted: true };
      default:
        return { acknowledged: true };
    }
  }

  /**
   * Handle messages from child tasks  
   */
  async onChildMessage(childTask, message) {
    const task = childTask.parent;
    if (!task) {
      throw new Error('Child task has no parent');
    }

    switch (message.type) {
      case 'completed':
        return await this._onChildComplete(task, childTask, message.result);
      case 'failed':
        return await this._onChildFailure(task, childTask, message.error);
      default:
        return { acknowledged: true };
    }
  }

  /**
   * Main work handler using SOP definition
   */
  async _handleWorkMessage(task) {
    // 1. Classification Decision using SOP-defined prompt
    const classification = await this._executeLLMDecision('classification', {
      taskDescription: task.description,
      artifacts: JSON.stringify(task.getArtifactsContext()),
      conversation: JSON.stringify(task.getConversationContext())
    });

    task.metadata.classification = classification.complexity;
    task.addConversationEntry('system', 
      `Task classified as ${classification.complexity}: ${classification.reasoning}`);

    // Execute based on classification
    if (classification.complexity === 'SIMPLE') {
      return await this._executeSimple(task);
    } else {
      return await this._executeComplex(task);
    }
  }

  /**
   * Execute simple task using SOP
   */
  async _executeSimple(task) {
    // Get the predefined tools for this SOP
    const tools = await this._getTools(task);
    
    if (tools.length === 0) {
      return {
        success: false,
        result: 'Required tools not available for this SOP'
      };
    }

    // 3. Execution Decision
    const execution = await this._executeLLMDecision('execution', {
      taskDescription: task.description,
      tools: JSON.stringify(this._formatToolsForPrompt(tools)),
      artifacts: JSON.stringify(task.getArtifactsContext()),
      conversation: JSON.stringify(task.getConversationContext())
    });

    if (execution.toolCalls && execution.toolCalls.length > 0) {
      return await this._executeToolCalls(task, execution.toolCalls);
    } else {
      return {
        success: true,
        result: execution.response || 'Task completed',
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }

  /**
   * Execute complex task using SOP decomposition
   */
  async _executeComplex(task) {
    // 2. Decomposition Decision (if not already decomposed)
    if (!task.metadata.isDecomposed) {
      const decomposition = await this._executeLLMDecision('decomposition', {
        taskDescription: task.description,
        artifacts: JSON.stringify(task.getArtifactsContext()),
        conversation: JSON.stringify(task.getConversationContext())
      });

      if (!decomposition.subtasks || decomposition.subtasks.length === 0) {
        return {
          success: false,
          result: 'Unable to decompose this complex task'
        };
      }

      task.setDecomposition(decomposition.subtasks);
      console.log(`📋 Task decomposed into ${decomposition.subtasks.length} subtasks`);
    }

    // Execute next subtask
    return await this._executeNextSubtask(task);
  }

  /**
   * Execute the next subtask in the plan
   */
  async _executeNextSubtask(task) {
    // Create and execute the next subtask
    const taskManager = task.lookup ? task.lookup('taskManager') : null;
    const subtask = await task.createNextSubtask(taskManager);
    
    if (!subtask) {
      // No more subtasks - evaluate completion
      return await this._evaluateCompletion(task);
    }
    
    console.log(`📍 Executing subtask ${task.currentSubtaskIndex + 1}/${task.plannedSubtasks.length}: ${subtask.description}`);
    
    // Send start message to subtask
    const subtaskResult = await subtask.receiveMessage({type: 'start'});
    
    // Handle child completion or failure through messages
    if (subtaskResult.success) {
      return await this.onChildMessage(subtask, { type: 'completed', result: subtaskResult });
    } else {
      return await this.onChildMessage(subtask, { type: 'failed', error: new Error(subtaskResult.result) });
    }
  }

  /**
   * Execute tool calls from LLM decision
   */
  async _executeToolCalls(task, toolCalls) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      // Find tool by name from our loaded tools
      const tool = this.tools.find(t => 
        t.name.toLowerCase() === toolCall.tool.toLowerCase()
      );
      
      if (!tool) {
        console.log(`⚠️ Tool not found: ${toolCall.tool}`);
        results.push({
          tool: toolCall.tool,
          inputs: toolCall.inputs,
          success: false,
          error: `Tool not found: ${toolCall.tool}`
        });
        continue;
      }
      
      try {
        console.log(`🔧 Executing tool: ${tool.name}`);
        const result = await tool.execute(toolCall.inputs);
        
        results.push({
          tool: tool.name,
          inputs: toolCall.inputs,
          success: true,
          output: result
        });
        
        // Handle file artifacts
        if (tool.name === 'file_write' && toolCall.inputs.filepath) {
          task.storeArtifact(
            toolCall.inputs.filepath,
            toolCall.inputs.content,
            `File created at ${toolCall.inputs.filepath}`,
            'file'
          );
        }
      } catch (error) {
        console.log(`❌ Tool execution failed: ${error.message}`);
        results.push({
          tool: tool.name,
          inputs: toolCall.inputs,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: results.some(r => r.success),
      results: results,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }

  /**
   * Handle child task completion
   */
  async _onChildComplete(task, childTask, result) {
    // Receive goal outputs from the child
    const delivered = childTask.deliverGoalOutputs(task);
    if (delivered.length > 0) {
      console.log(`📦 Parent received ${delivered.length} artifacts from child: ${delivered.join(', ')}`);
      // Add delivered artifacts to parent's artifact set
      for (const name of delivered) {
        task.addArtifact(name);
      }
    }
    
    // Get parent's evaluation of what to do next
    const evaluation = await this._executeLLMDecision('parent_evaluation', {
      parentTaskDescription: task.description,
      childTaskDescription: childTask.description,
      artifacts: JSON.stringify(task.getArtifactsContext()),
      completedSubtasks: JSON.stringify(task.getCompletedSubtasks()),
      conversation: JSON.stringify(task.getConversationContext())
    });
    
    console.log(`🤔 Parent evaluation: ${evaluation.decision} - ${evaluation.reasoning}`);
    task.addConversationEntry('system', 
      `Evaluated subtask completion. Decision: ${evaluation.decision}. Reasoning: ${evaluation.reasoning}`);
    
    // Act on the decision
    switch (evaluation.decision) {
      case 'CONTINUE':
        return await this._executeNextSubtask(task);
        
      case 'COMPLETE':
        return await this._evaluateCompletion(task);
        
      case 'RETRY':
        console.log(`🔄 Retrying subtask: ${childTask.description}`);
        const retryResult = await childTask.receiveMessage({type: 'start'});
        
        if (retryResult.success) {
          return await this.onChildMessage(childTask, { type: 'completed', result: retryResult });
        } else {
          return await this.onChildMessage(childTask, { type: 'failed', error: new Error(retryResult.result) });
        }
        
      case 'REPLAN':
        console.log(`🔄 Replanning task...`);
        task.metadata.isDecomposed = false;
        task.plannedSubtasks = [];
        task.currentSubtaskIndex = -1;
        
        return await this._executeComplex(task);
        
      default:
        console.log(`⚠️ Unknown evaluation decision: ${evaluation.decision}`);
        return await this._evaluateCompletion(task);
    }
  }

  /**
   * Handle child task failure
   */
  async _onChildFailure(task, childTask, error) {
    console.log(`❌ Subtask failed: ${childTask.description}`);
    console.log(`   Error: ${error.message}`);
    
    task.addConversationEntry('system', 
      `Subtask "${childTask.description}" failed: ${error.message}`);
    
    // For now, fail the parent task too
    task.fail(error);
    
    return {
      success: false,
      result: `Subtask failed: ${error.message}`,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }

  /**
   * Evaluate task completion using SOP definition
   */
  async _evaluateCompletion(task) {
    console.log(`🎯 Evaluating if task "${task.description}" is complete...`);
    
    const evaluation = await this._executeLLMDecision('completion_evaluation', {
      taskDescription: task.description,
      artifacts: JSON.stringify(task.getArtifactsContext()),
      completedSubtasks: JSON.stringify(task.getCompletedSubtasks()),
      conversation: JSON.stringify(task.getConversationContext())
    });
    
    console.log(`🎯 Task completion evaluation: ${evaluation.isComplete ? 'COMPLETE' : 'INCOMPLETE'} - ${evaluation.reasoning}`);
    
    if (evaluation.isComplete) {
      const result = {
        success: true,
        result: {
          success: true,
          message: 'Task completed',
          summary: evaluation.summary || `Task "${task.description}" completed successfully`
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
      
      task.complete(result);
      return result;
    } else {
      console.log(`⚠️ Task incomplete but no more subtasks to execute`);
      task.fail(new Error('Task incomplete but no more subtasks to execute'));
      
      return {
        success: false,
        result: evaluation.reasoning || 'Task could not be completed',
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }

  /**
   * Execute an LLM decision using the current SOP
   */
  async _executeLLMDecision(decisionType, variables) {
    if (!this.sopDefinition.llm_decisions[decisionType]) {
      throw new Error(`SOP does not define ${decisionType} decision`);
    }

    const prompt = this.prompts.get(decisionType);
    if (!prompt) {
      throw new Error(`Prompt not compiled for ${decisionType}`);
    }

    const result = await prompt.execute(variables);
    
    if (!result.success) {
      throw new Error(`LLM decision failed for ${decisionType}: ${result.errors?.join(', ')}`);
    }

    return result.data;
  }

  /**
   * Compile all prompts for the current SOP
   */
  async _compilePrompts() {
    this.prompts.clear();

    for (const [decisionType, config] of Object.entries(this.sopDefinition.llm_decisions)) {
      const prompt = new TemplatedPrompt({
        prompt: config.prompt,
        responseSchema: config.schema,
        llmClient: this.llmClient,
        maxRetries: 3
      });

      this.prompts.set(decisionType, prompt);
    }
  }

  /**
   * Format tools for LLM prompt
   */
  _formatToolsForPrompt(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || {}
    }));
  }
}
```

### 3. SOP File Management

SOPs are stored as simple files in the filesystem and loaded by path:

```javascript
// Basic SOP file loading - no complex storage needed initially
import fs from 'fs/promises';
import yaml from 'js-yaml';

export class SOPFileLoader {
  constructor(sopDirectory = './sop') {
    this.sopDirectory = sopDirectory;
  }

  /**
   * Load SOP by filename
   */
  async loadSOP(sopFileName) {
    const sopPath = path.join(this.sopDirectory, sopFileName);
    
    try {
      const sopContent = await fs.readFile(sopPath, 'utf8');
      return yaml.load(sopContent);
    } catch (error) {
      throw new Error(`Failed to load SOP file ${sopFileName}: ${error.message}`);
    }
  }

  /**
   * List available SOP files
   */
  async listSOPs() {
    try {
      const files = await fs.readdir(this.sopDirectory);
      return files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    } catch (error) {
      throw new Error(`Failed to list SOP files: ${error.message}`);
    }
  }

  /**
   * Validate SOP definition
   */
  validateSOP(sopData) {
    const required = ['metadata', 'llm_decisions', 'tools'];
    const missing = required.filter(field => !sopData[field]);
    
    if (missing.length > 0) {
      throw new Error(`SOP missing required fields: ${missing.join(', ')}`);
    }

    // Validate required LLM decisions
    const requiredDecisions = ['classification', 'execution', 'completion_evaluation'];
    const missingDecisions = requiredDecisions.filter(
      decision => !sopData.llm_decisions[decision]
    );
    
    if (missingDecisions.length > 0) {
      throw new Error(`SOP missing required LLM decisions: ${missingDecisions.join(', ')}`);
    }

    return true;
  }
}
```

## Example SOP Definitions

### Bug Fixing SOP

```yaml
# sop/bug-fixing.yaml
metadata:
  id: "bug-fixing"
  name: "Bug Fixing"
  description: "Standard procedure for identifying and fixing bugs in code"
  category: "maintenance"
  tags: ["debugging", "fixing", "maintenance", "troubleshooting"]
  keywords: ["bug", "error", "fix", "debug", "issue", "problem"]

llm_decisions:
  classification:
    prompt: |
      Analyze this bug fixing task: "{{taskDescription}}"
      
      Consider:
      - Scope of the bug (single function vs system-wide)
      - Complexity of diagnosis required
      - Available error information: {{artifacts}}
      
      Classify as SIMPLE (obvious fix) or COMPLEX (requires investigation).
    schema:
      type: object
      properties:
        complexity: {type: string, enum: ["SIMPLE", "COMPLEX"]}
        reasoning: {type: string}
      required: ["complexity", "reasoning"]

  decomposition:
    prompt: |
      Break down this bug fixing task: "{{taskDescription}}"
      
      Context: {{conversation}}
      Available info: {{artifacts}}
      
      Create subtasks for: reproduction, root cause analysis, fix implementation, testing.
    schema:
      type: object
      properties:
        decompose: {type: boolean}
        subtasks:
          type: array
          items:
            type: object
            properties:
              description: {type: string}
              inputs: {type: string}
              outputs: {type: string}
      required: ["decompose", "subtasks"]

tools:
  required_tools:
    - "file_read"
    - "grep_search"
    - "test_runner"
    - "log_analyzer"
    - "file_write"
```

### Testing SOP

```yaml
# sop/testing.yaml
metadata:
  id: "testing"
  name: "Testing"
  description: "Standard procedure for creating and running tests"
  category: "quality"
  tags: ["testing", "quality", "validation", "verification"]
  keywords: ["test", "spec", "unit", "integration", "coverage"]

llm_decisions:
  classification:
    prompt: |
      Analyze this testing task: "{{taskDescription}}"
      
      Consider:
      - Type of testing needed (unit, integration, e2e)
      - Existing test coverage: {{artifacts}}
      - Complexity of code under test
      
      Classify as SIMPLE (single component) or COMPLEX (multiple components).

tools:
  required_tools:
    - "jest_run"
    - "coverage_report"
    - "test_generator"
    - "file_write"
    - "file_read"

artifact_patterns:
  inputs:
    - name: "source_code"
      type: "code"
      description: "Source code to be tested"
  outputs:
    - name: "test_files"
      type: "code"
      description: "Generated test files"
    - name: "coverage_report"
      type: "report"
      description: "Test coverage analysis"
```

## Usage Example

Here's how to use the SOPStrategy with an actual SOP file:

```javascript
// Create a task with SOPStrategy
import { Task } from '@legion/tasks';
import SOPStrategy from './SOPStrategy.js';

async function createJavaScriptTask() {
  // Initialize dependencies
  const llmClient = await resourceManager.get('llmClient');
  const toolRegistry = await resourceManager.get('toolRegistry');
  
  // Create strategy with SOP file
  const sopStrategy = new SOPStrategy(
    './sop/javascript-development.yaml',
    llmClient, 
    toolRegistry
  );
  
  // Initialize strategy (loads SOP file and validates tools)
  await sopStrategy.initialize();
  
  // Create task with strategy
  const task = new Task("Create a calculator function with tests", null, {
    strategy: sopStrategy,
    workspaceDir: '/tmp/my-project'
  });
  
  // Start execution - SOP will automatically guide the process
  const result = await task.receiveMessage({ type: 'start' });
  
  console.log('Task completed:', result.success);
  console.log('Artifacts created:', result.artifacts?.length || 0);
  
  return result;
}

// Usage
const result = await createJavaScriptTask();
```

## Required ToolRegistry Extensions

The SOP system requires one new method on the ToolRegistry interface:

```javascript
// Required addition to ToolRegistry
class ToolRegistry {
  // Existing methods
  async getTool(toolId) { /* get by ID */ }
  async semanticSearch(query) { /* semantic discovery */ }
  
  // NEW: Required for SOP tool loading
  async getToolByName(toolName) {
    // Look up tool by exact name match
    // Should return the tool object or null if not found
  }
}
```

This allows SOPs to load their required tools by name without needing IDs or discovery.

## Integration with Existing System

### TaskStrategy Interface Compliance

The SOPStrategy implements the standard TaskStrategy interface:

```javascript
// Existing interface from TaskStrategy.js
class TaskStrategy {
  getName() { /* implemented */ }
  async onChildMessage(childTask, message) { /* implemented */ }
  async onParentMessage(parentTask, message) { /* implemented */ }
}
```

### Task Integration

Tasks can use SOPStrategy just like any other strategy:

```javascript
// Create task with SOP strategy
const task = new Task("Create a JavaScript calculator", parentTask, context);
const sopStrategy = new SOPStrategy('./sop/javascript-development.yaml', llmClient, toolRegistry);
await sopStrategy.initialize();
task.setStrategy(sopStrategy);

// Start execution - SOP will guide all LLM decisions
await task.receiveMessage({ type: 'start' });
```

## Benefits of This Design

1. **Unlimited Scalability**: Adding new SOPs requires no code changes
2. **LLM-Driven**: All decisions made by LLM using SOP-defined prompts
3. **Semantic Discovery**: Automatically finds best SOP for any task
4. **Reusable Components**: SOPs can be shared across different agents
5. **Version Control**: SOPs can be versioned and evolved independently
6. **Quality Consistency**: Each SOP defines its own quality criteria
7. **Tool Integration**: SOPs specify preferred tools for consistent behavior

## Migration Strategy

1. **Phase 1**: Implement SOPExecutor and basic SOP storage
2. **Phase 2**: Convert existing strategies to SOP definitions  
3. **Phase 3**: Add semantic search and discovery
4. **Phase 4**: Build SOP management and versioning tools
5. **Phase 5**: Create comprehensive SOP library

This design transforms NewROMA from a collection of deterministic strategies into a flexible, LLM-driven system that can adapt to any domain through SOP definitions.