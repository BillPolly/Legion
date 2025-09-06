# Prompt-Manager Design Document

## Overview

The `@legion/prompt-manager` package serves as the top-level orchestrator for the complete intelligent prompting pipeline. It integrates object-query, prompt-builder, and output-schema packages with LLM communication and retry logic to provide a complete, production-ready LLM interaction system.

### Problem Statement

Complex LLM interactions require coordinating multiple sophisticated systems:
- **Data Extraction**: Complex source objects need intelligent querying and transformation
- **Prompt Generation**: Templates need smart formatting with size optimization  
- **LLM Communication**: API calls need error handling and retry logic
- **Response Validation**: LLM outputs need parsing, validation, and error recovery
- **Error Management**: Failed attempts need intelligent retry with error feedback

Managing this complete workflow manually is complex, error-prone, and not reusable across different interaction scenarios.

### Solution Approach

A single `PromptManager` that:
1. **Configures the entire pipeline** once with all component specifications
2. **Coordinates object-query → prompt-builder → LLM → output-schema** workflow
3. **Manages LLM client integration** with Legion ResourceManager patterns
4. **Handles intelligent retry logic** with error feedback and correction prompts
5. **Provides simple execute() interface** for multiple source objects
6. **Returns standardized results** with comprehensive error information

## Core Architecture

### Single Configuration, Multiple Executions

The `PromptManager` follows the same successful pattern as the other packages:

```javascript
// Configure once with complete pipeline specification
const manager = new PromptManager({
  objectQuery: querySpecification,      // How to extract data
  promptBuilder: promptConfiguration,   // How to build prompts
  outputSchema: schemaSpecification,    // How to validate responses
  llmClient: llmClientInstance,         // How to call LLM
  retryConfig: retryOptions            // How to handle errors
});

// Execute many times with different source objects
const result1 = await manager.execute(sourceObject1);
const result2 = await manager.execute(sourceObject2);
const result3 = await manager.execute(sourceObject3);
```

### Complete Pipeline Integration

**Data Flow:**
```
Source Object → Object-Query → Labeled Inputs → Prompt-Builder → Optimized Prompt → LLM API → Raw Response → Output-Schema → Validated Data
                                                                      ↓ (on validation errors)
                                                                Error Feedback → Retry Prompt → LLM API → Response → Validation
```

**Component Responsibilities:**
- **Object-Query**: Extract and transform data from complex source objects
- **Prompt-Builder**: Generate optimized prompts with size management and content formatting
- **LLM Client**: Handle API communication with error handling and timeouts
- **Output-Schema**: Parse and validate responses with enhanced cleaning
- **Prompt-Manager**: Orchestrate entire workflow with retry logic (THIS PACKAGE)

## API Design

### Core Class

#### PromptManager

Main orchestration interface:

```javascript
class PromptManager {
  constructor(configuration)
  
  // MAIN FUNCTION: Execute complete pipeline on source object
  async execute(sourceObject, options = {})
  
  // UTILITIES
  validateConfiguration()          // Validate all pipeline configurations
  getExecutionHistory()           // Get history of attempts and results
  clearHistory()                  // Reset execution history
  updateConfiguration(updates)    // Update specific component configurations
  getComponentStatus()           // Check status of all pipeline components
}
```

### Constructor Configuration

**Complete Pipeline Specification:**

```javascript
{
  objectQuery: {                  // Object-query specification
    bindings: {
      bindingName: {
        path: "object.path.to.data",
        transform: "transformationType",
        options: { /* transformation options */ }
      }
    },
    contextVariables: {
      varName: { path: "path.to.context" }
    }
  },
  
  promptBuilder: {               // Prompt-builder configuration
    template: `Your prompt template with {{placeholders}}`,
    maxTokens: 4000,
    contentHandlers: {
      placeholderName: { /* handler options */ }
    }
  },
  
  outputSchema: {               // Output-schema specification  
    type: 'object',
    properties: { /* JSON Schema properties */ },
    required: ['requiredFields'],
    'x-format': { /* format specifications */ }
  },
  
  llmClient: llmClientInstance, // LLM client (from ResourceManager)
  
  retryConfig: {               // Retry configuration
    maxAttempts: 3,
    errorFeedback: {
      enabled: true,
      template: "custom template" // Optional custom template
    },
    backoffMs: 1000,           // Delay between retries
    timeoutMs: 30000          // Per-attempt timeout
  }
}
```

### Execute Method Options

```javascript
{
  skipRetry: false,             // Skip retry logic, return first result
  customRetryTemplate: "...",   // Override default retry template
  debugMode: false,            // Enable detailed logging
  includeAttemptHistory: true, // Include attempt details in result
  strictValidation: false,     // Require perfect validation or fail
  maxExecutionTime: 120000    // Total execution timeout
}
```

### Result Format

**Standardized Response:**

```javascript
// Success result
{
  success: true,
  data: { /* validated response data */ },
  metadata: {
    attempts: 1,
    executionTimeMs: 2350,
    pipeline: {
      objectQuery: { bindingsExtracted: 5, contextVariables: 2 },
      promptBuilder: { finalPromptTokens: 1847, optimizationsApplied: ['size'] },
      outputSchema: { format: 'json', confidence: 0.97, cleaningApplied: true }
    }
  }
}

// Error result (after all retries exhausted)
{
  success: false,
  errors: [
    { 
      stage: 'validation',
      attempt: 3,
      message: 'Score must be between 0 and 10',
      suggestion: 'Use decimal values like 8.5 instead of 15'
    }
  ],
  attemptHistory: [
    { attempt: 1, stage: 'completed', result: 'validation_failed' },
    { attempt: 2, stage: 'completed', result: 'validation_failed' },
    { attempt: 3, stage: 'completed', result: 'validation_failed' }
  ],
  lastResponse: { /* final LLM response for debugging */ }
}
```

## Retry System Design

### Simple Error Feedback Template

**Basic Retry Prompt Structure:**
```
{errorPrefix}

{errorDetails}

{originalPrompt}

{correctionSuffix}
```

**Default Error Feedback Template:**
```
PREVIOUS RESPONSE HAD VALIDATION ERRORS:

{errorList}

ORIGINAL REQUEST:
{originalPrompt}

PLEASE PROVIDE CORRECTED RESPONSE THAT ADDRESSES THESE ISSUES:
```

### Error Processing

**Structured Error Feedback Generation:**

```javascript
// From output-schema validation errors
const errors = [
  {
    type: 'validation',
    field: 'score', 
    message: 'Number must be less than or equal to 10',
    received: 15,
    expected: 'number between 0 and 10',
    suggestion: 'Use values like 8.5 instead of 15'
  }
];

// Converted to retry feedback
const errorFeedback = `
VALIDATION ERRORS DETECTED:

1. FIELD 'score': Number must be less than or equal to 10
   - You provided: 15
   - Expected: number between 0 and 10  
   - Suggestion: Use values like 8.5 instead of 15

PLEASE CORRECT THESE ISSUES IN YOUR RESPONSE.
`;
```

### Retry Configuration

**Flexible Retry Strategies:**

```javascript
{
  maxAttempts: 3,              // Maximum retry attempts
  errorFeedback: {
    enabled: true,             // Enable error feedback in retries
    prefix: "ERRORS DETECTED:\n", // Prefix for error section
    suffix: "\nPROVIDE CORRECTED RESPONSE:", // Suffix for correction request
    includeOriginal: true,     // Include original prompt
    includeSpecificSuggestions: true, // Include detailed error suggestions
    customTemplate: null      // Override with custom template
  },
  backoffStrategy: 'linear',   // 'linear', 'exponential', or 'fixed'
  baseDelayMs: 1000,          // Base delay between retries
  timeoutMs: 30000,           // Per-attempt timeout
  abortOnFatalErrors: ['auth', 'quota'], // Error types that should not retry
  logAttempts: true          // Log retry attempts for debugging
}
```

## Pipeline Orchestration

### Execution Workflow

**Step-by-Step Process:**

1. **Input Validation**
   ```javascript
   // Validate source object and configuration
   validateSourceObject(sourceObject);
   validatePipelineConfiguration();
   ```

2. **Data Extraction** 
   ```javascript
   // Extract labeled inputs using object-query
   const labeledInputs = await objectQuery.execute(sourceObject);
   ```

3. **Response Format Setup**
   ```javascript
   // Generate output instructions using output-schema
   const outputInstructions = responseValidator.generateInstructions(exampleData);
   labeledInputs.outputInstructions = outputInstructions;
   ```

4. **Prompt Generation**
   ```javascript
   // Build optimized prompt using prompt-builder
   const prompt = promptBuilder.build(labeledInputs);
   ```

5. **LLM Interaction**
   ```javascript
   // Call LLM with generated prompt
   const response = await llmClient.complete(prompt);
   ```

6. **Response Validation**
   ```javascript
   // Validate and parse response using output-schema
   const result = responseValidator.process(response);
   ```

7. **Retry Logic (if validation fails)**
   ```javascript
   // Generate error feedback and retry
   const retryPrompt = generateErrorFeedbackPrompt(originalPrompt, errors);
   const retryResponse = await llmClient.complete(retryPrompt);
   const retryResult = responseValidator.process(retryResponse);
   ```

### Error Handling Strategy

**Multi-Stage Error Recovery:**

```javascript
// Stage 1: Component Errors
try {
  const labeledInputs = await objectQuery.execute(sourceObject);
} catch (error) {
  return { success: false, stage: 'object-query', error: error.message };
}

// Stage 2: LLM Communication Errors  
try {
  const response = await llmClient.complete(prompt);
} catch (error) {
  if (isRetriableError(error)) {
    // Retry with same prompt
  } else {
    return { success: false, stage: 'llm-call', error: error.message };
  }
}

// Stage 3: Validation Errors
if (!result.success) {
  if (attempt < maxAttempts) {
    // Retry with error feedback
  } else {
    return { success: false, stage: 'validation', errors: result.errors };
  }
}
```

## Component Integration Patterns

### Object-Query Integration

**Data Extraction Coordination:**

```javascript
// PromptManager creates and manages ObjectQuery instance
this.objectQuery = new ObjectQuery(config.objectQuery);

// Execute data extraction
const extractionResult = await this.objectQuery.execute(sourceObject, {
  strict: options.strictValidation,
  includeMetadata: options.debugMode
});

// Handle extraction errors
if (!extractionResult || Object.keys(extractionResult).length === 0) {
  throw new Error('No data extracted from source object');
}
```

### Prompt-Builder Integration

**Prompt Generation Coordination:**

```javascript
// PromptManager creates and manages PromptBuilder instance
this.promptBuilder = new PromptBuilder(config.promptBuilder);

// Add output instructions to labeled inputs
const responseValidator = new ResponseValidator(config.outputSchema);
const exampleData = this._generateExampleFromSchema(config.outputSchema);
const outputInstructions = responseValidator.generateInstructions(exampleData);

labeledInputs.outputInstructions = outputInstructions;

// Generate final prompt
const finalPrompt = this.promptBuilder.build(labeledInputs, {
  priority: options.optimizationPriority || 'balanced'
});
```

### Output-Schema Integration

**Response Validation Coordination:**

```javascript
// PromptManager creates and manages ResponseValidator instance
this.responseValidator = new ResponseValidator(config.outputSchema);

// Process LLM response
const validationResult = this.responseValidator.process(llmResponse);

// Handle validation errors for retry
if (!validationResult.success) {
  const errorFeedback = this._generateErrorFeedback(
    validationResult.errors, 
    originalPrompt,
    attempt
  );
  
  return { needsRetry: true, errorFeedback };
}
```

### LLM Client Integration

**Legion ResourceManager Pattern:**

```javascript
// Use Legion ResourceManager for LLM client
constructor(configuration) {
  // Accept LLM client directly or get from ResourceManager
  if (configuration.llmClient) {
    this.llmClient = configuration.llmClient;
  } else {
    // Auto-retrieve from ResourceManager
    this.llmClient = null; // Will be lazy-loaded
  }
}

async _ensureLLMClient() {
  if (!this.llmClient) {
    const resourceManager = await ResourceManager.getInstance();
    this.llmClient = await resourceManager.get('llmClient');
  }
  
  if (!this.llmClient) {
    throw new Error('LLM client not available - check ResourceManager configuration');
  }
}

// Standard LLM client interface
async _callLLM(prompt, attempt = 1) {
  await this._ensureLLMClient();
  
  const options = {
    maxTokens: this.config.promptBuilder.maxTokens - this.promptBuilder.getEstimatedPromptTokens(),
    temperature: attempt > 1 ? 0.3 : 0.1, // Higher temperature on retries
    timeout: this.retryConfig.timeoutMs
  };
  
  return await this.llmClient.complete(prompt, options);
}
```

## Retry Logic Implementation

### Error Feedback Generation

**Intelligent Error Processing:**

```javascript
generateErrorFeedback(errors, originalPrompt, attemptNumber) {
  const errorPrefix = this.retryConfig.errorFeedback.prefix || 
    "PREVIOUS RESPONSE HAD VALIDATION ERRORS:\n";
  
  const errorList = errors.map((error, index) => {
    let errorText = `${index + 1}. `;
    
    if (error.field) {
      errorText += `FIELD '${error.field}': ${error.message}`;
    } else {
      errorText += `${error.type.toUpperCase()}: ${error.message}`;
    }
    
    if (error.received !== undefined) {
      errorText += `\n   - You provided: ${error.received}`;
    }
    
    if (error.expected) {
      errorText += `\n   - Expected: ${error.expected}`;
    }
    
    if (error.suggestion) {
      errorText += `\n   - Suggestion: ${error.suggestion}`;
    }
    
    return errorText;
  }).join('\n\n');
  
  const suffix = this.retryConfig.errorFeedback.suffix || 
    "\nPLEASE PROVIDE CORRECTED RESPONSE:";
  
  return `${errorPrefix}\n${errorList}\n\nORIGINAL REQUEST:\n${originalPrompt}\n${suffix}`;
}
```

### Retry Strategy Configuration

**Adaptive Retry Behavior:**

```javascript
// Retry configuration options
const retryStrategies = {
  // Conservative: Minimal retries, preserve original intent
  conservative: {
    maxAttempts: 2,
    backoffStrategy: 'linear',
    errorFeedback: { includeSpecificSuggestions: false }
  },
  
  // Balanced: Standard retry with good error feedback  
  balanced: {
    maxAttempts: 3,
    backoffStrategy: 'linear',
    errorFeedback: { includeSpecificSuggestions: true }
  },
  
  // Aggressive: Maximum retries with detailed feedback
  aggressive: {
    maxAttempts: 5,
    backoffStrategy: 'exponential',
    errorFeedback: { 
      includeSpecificSuggestions: true,
      includeExamples: true,
      aggressiveCleaning: true
    }
  }
}
```

### Attempt Management

**Retry Loop Implementation:**

```javascript
async execute(sourceObject, options = {}) {
  const maxAttempts = options.maxAttempts || this.retryConfig.maxAttempts;
  let lastError = null;
  let attemptHistory = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await this._executeAttempt(sourceObject, attempt, lastError);
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
          metadata: {
            attempts: attempt,
            attemptHistory: attemptHistory,
            ...result.metadata
          }
        };
      }
      
      // Validation failed - prepare for retry
      lastError = result;
      attemptHistory.push({
        attempt: attempt,
        errors: result.errors,
        stage: result.stage || 'validation'
      });
      
      if (attempt < maxAttempts) {
        await this._delayBeforeRetry(attempt);
      }
      
    } catch (error) {
      // Fatal error - don't retry
      if (this._isFatalError(error)) {
        return {
          success: false,
          stage: 'fatal',
          error: error.message,
          attemptHistory: attemptHistory
        };
      }
      
      // Non-fatal error - continue retrying
      lastError = { success: false, errors: [{ message: error.message }] };
    }
  }
  
  // All attempts exhausted
  return {
    success: false,
    stage: 'retry_exhausted',
    errors: lastError.errors,
    attemptHistory: attemptHistory,
    totalAttempts: maxAttempts
  };
}
```

## Usage Examples

### Web Development Assistant

```javascript
import { PromptManager } from '@legion/prompt-manager';
import { ResourceManager } from '@legion/resource-manager';

// Get LLM client
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

// Configure web development assistant
const webDevManager = new PromptManager({
  objectQuery: {
    bindings: {
      projectContext: {
        aggregate: [
          { path: 'project.description', weight: 0.4 },
          { path: 'project.requirements', weight: 0.6 }
        ],
        transform: 'summary',
        maxLength: 300
      },
      codeFiles: {
        path: 'project.files',
        filter: { extension: 'js' },
        transform: 'concatenate',
        options: { maxFiles: 3, includeHeaders: true }
      },
      chatHistory: {
        path: 'conversation.messages',
        transform: 'recent',
        options: { count: 8, summarizeOlder: true }
      },
      userRequest: {
        path: 'currentRequest.description',
        transform: 'passthrough'
      }
    },
    contextVariables: {
      techStack: { path: 'project.technologies' },
      userRole: { path: 'user.profile.role' },
      timeline: { path: 'project.deadline' }
    }
  },
  
  promptBuilder: {
    template: `Development Task: {{userRequest}}

Project Context:
{{projectContext}}

Current Code:
{{codeFiles}}

Recent Discussion:
{{chatHistory}}

Context Variables:
@techStack: {{techStack}}
@userRole: {{userRole}}
@timeline: {{timeline}}

Consider @techStack and @timeline when creating implementation plan for @userRole.

{{outputInstructions}}`,

    maxTokens: 4000,
    contentHandlers: {
      codeFiles: { maxLines: 100, preserveFormatting: true },
      chatHistory: { maxMessages: 8 }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      implementation_plan: {
        type: 'object',
        properties: {
          overview: { type: 'string', description: 'High-level implementation overview' },
          steps: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 8,
            description: 'Implementation steps'
          },
          timeline: { type: 'string', description: 'Estimated timeline' },
          risks: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 5,
            description: 'Potential risks and mitigation'
          }
        },
        required: ['overview', 'steps']
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in the implementation plan'
      }
    },
    required: ['implementation_plan', 'confidence']
  },
  
  llmClient: llmClient,
  
  retryConfig: {
    maxAttempts: 3,
    errorFeedback: {
      enabled: true,
      includeSpecificSuggestions: true
    }
  }
});

// Execute with development project data
const projectSourceObject = {
  user: {
    profile: { role: 'Senior Full Stack Developer' }
  },
  project: {
    name: 'E-commerce Platform',
    description: 'Modern e-commerce platform with real-time features',
    requirements: 'Add shopping cart persistence and user session management',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
    deadline: '3 weeks',
    files: [
      {
        name: 'CartService.js',
        extension: 'js',
        content: 'class CartService {\n  constructor() {\n    this.items = [];\n  }\n}'
      }
    ]
  },
  conversation: {
    messages: [
      { role: 'user', content: 'I need to add cart persistence', timestamp: '2024-01-15T10:00:00Z' },
      { role: 'assistant', content: 'I can help design a robust cart system', timestamp: '2024-01-15T10:01:00Z' }
    ]
  },
  currentRequest: {
    description: 'Implement shopping cart persistence with Redis caching and PostgreSQL backup'
  }
};

const result = await webDevManager.execute(projectSourceObject);

if (result.success) {
  console.log('Implementation Overview:', result.data.implementation_plan.overview);
  console.log('Steps:', result.data.implementation_plan.steps);
  console.log('Confidence:', result.data.confidence);
  console.log('Execution took:', result.metadata.attempts, 'attempts');
} else {
  console.log('Failed after', result.totalAttempts, 'attempts');
  console.log('Errors:', result.errors);
}
```

### Code Review Assistant

```javascript
const codeReviewManager = new PromptManager({
  objectQuery: {
    bindings: {
      sourceCode: {
        path: 'review.targetFile.content',
        transform: 'passthrough'
      },
      fileContext: {
        path: 'review.relatedFiles',
        transform: 'concatenate',
        options: { maxFiles: 2, maxLinesPerFile: 30 }
      },
      reviewHistory: {
        path: 'review.previousComments',
        transform: 'recent',
        options: { count: 5 }
      },
      staticAnalysis: {
        path: 'review.analysis.issues',
        filter: { severity: ['high', 'medium'] },
        transform: 'prioritize'
      }
    },
    contextVariables: {
      reviewFocus: { path: 'review.focusAreas' },
      codeStandards: { path: 'project.standards' }
    }
  },
  
  promptBuilder: {
    template: `Code Review Request:

Target Code:
{{sourceCode}}

Related Context:
{{fileContext}}

Previous Review Comments:
{{reviewHistory}}

Static Analysis Issues:
{{staticAnalysis}}

Review Focus: @reviewFocus
Code Standards: @codeStandards

Provide comprehensive code review considering @reviewFocus and @codeStandards.

{{outputInstructions}}`,

    maxTokens: 4000,
    contentHandlers: {
      sourceCode: { preserveFormatting: true },
      staticAnalysis: { maxItems: 10 }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      summary: { 
        type: 'string',
        description: 'Overall code quality summary'
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            description: { type: 'string' },
            line_number: { type: 'number' },
            suggestion: { type: 'string' }
          },
          required: ['severity', 'description', 'suggestion']
        },
        maxItems: 10
      },
      overall_score: {
        type: 'number',
        minimum: 0,
        maximum: 10,
        description: 'Overall code quality score'
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 5,
        description: 'Top improvement recommendations'
      }
    },
    required: ['summary', 'overall_score']
  },
  
  llmClient: llmClient,
  
  retryConfig: {
    maxAttempts: 3,
    errorFeedback: {
      enabled: true,
      includeSpecificSuggestions: true
    }
  }
});

// Execute code review
const reviewResult = await codeReviewManager.execute(codeReviewSourceObject);
```

### User Support Assistant

```javascript
const supportManager = new PromptManager({
  objectQuery: {
    bindings: {
      userIssue: {
        path: 'ticket.description',
        transform: 'passthrough'
      },
      userContext: {
        path: 'user',
        transform: 'summary',
        options: { 
          includeFields: ['subscription', 'usage', 'preferences'],
          maxLength: 150
        }
      },
      conversationHistory: {
        path: 'conversation.messages',
        transform: 'recent',
        options: { count: 12, excludeSystem: false }
      },
      relatedTickets: {
        path: 'user.recentTickets',
        filter: { status: 'resolved', similarity: { gte: 0.7 } },
        transform: 'summarize',
        options: { maxTickets: 3 }
      },
      systemStatus: {
        path: 'system.currentStatus',
        transform: 'passthrough'
      }
    },
    contextVariables: {
      userTier: { path: 'user.subscription.tier' },
      accountAge: { path: 'user.account.createdAt' },
      systemHealth: { path: 'system.health.overall' }
    }
  },
  
  promptBuilder: {
    template: `Customer Support Request:

Issue: {{userIssue}}

User Context: {{userContext}}

Conversation History:
{{conversationHistory}}

Related Resolved Issues:
{{relatedTickets}}

System Status: {{systemStatus}}

Context Variables:
@userTier: {{userTier}}
@accountAge: {{accountAge}} 
@systemHealth: {{systemHealth}}

Provide support response considering @userTier and @systemHealth status.

{{outputInstructions}}`,

    maxTokens: 4000,
    contentHandlers: {
      conversationHistory: { maxMessages: 12, summarizeOlder: true },
      relatedTickets: { maxLength: 200 }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      response: {
        type: 'string',
        description: 'Support response to the user'
      },
      solution_type: {
        type: 'string',
        enum: ['immediate', 'escalation', 'documentation', 'bug_report'],
        description: 'Type of solution provided'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in the solution'
      },
      follow_up_needed: {
        type: 'boolean',
        description: 'Whether follow-up is required'
      },
      internal_notes: {
        type: 'string',
        description: 'Internal notes for support team'
      }
    },
    required: ['response', 'solution_type', 'confidence']
  },
  
  llmClient: llmClient,
  
  retryConfig: {
    maxAttempts: 2, // Support responses should be quick
    errorFeedback: {
      enabled: true,
      includeSpecificSuggestions: true
    }
  }
});
```

## Advanced Features

### Configuration Inheritance

**Hierarchical Configuration Management:**

```javascript
// Global defaults from Legion configuration
const globalDefaults = {
  retryConfig: {
    maxAttempts: 3,
    timeoutMs: 30000
  },
  promptBuilder: {
    maxTokens: 4000,
    reserveTokens: 500
  }
};

// Component-specific defaults
const componentDefaults = {
  objectQuery: { errorHandling: 'skip' },
  outputSchema: { strictMode: false }
};

// Instance configuration overrides
const instanceConfig = {
  retryConfig: { maxAttempts: 5 } // Override global default
};

// Final merged configuration
const finalConfig = mergeConfigurations(globalDefaults, componentDefaults, instanceConfig);
```

### Execution Monitoring

**Comprehensive Execution Tracking:**

```javascript
// Execution metadata and monitoring
{
  executionId: 'uuid-v4',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T10:00:03.500Z', 
  totalDurationMs: 3500,
  
  pipeline: {
    objectQuery: {
      durationMs: 45,
      bindingsExtracted: 6,
      contextVariables: 3,
      extractionSize: 2048
    },
    promptBuilder: {
      durationMs: 23,
      finalPromptSize: 1847,
      tokensEstimated: 462,
      optimizationsApplied: ['content_summarization', 'size_optimization']
    },
    llmCall: {
      durationMs: 2100,
      model: 'claude-3-5-sonnet-20241022',
      promptTokens: 462,
      completionTokens: 156,
      totalTokens: 618
    },
    outputSchema: {
      durationMs: 12,
      format: 'json',
      confidence: 0.97,
      cleaningApplied: true,
      validationPassed: true
    }
  },
  
  attempts: [
    {
      attempt: 1,
      result: 'success',
      durationMs: 3500,
      tokensUsed: 618
    }
  ]
}
```

### Error Recovery Examples

**Typical Error Recovery Flow:**

```javascript
// Attempt 1: Initial response with validation error
const attempt1Response = '{"analysis": "Good code", "score": 15}'; // Score > 10
const attempt1Result = outputSchema.process(attempt1Response);
// Result: { success: false, errors: [{ field: 'score', message: 'Number must be ≤ 10' }] }

// Retry prompt generation
const retryPrompt = `PREVIOUS RESPONSE HAD VALIDATION ERRORS:

1. FIELD 'score': Number must be less than or equal to 10
   - You provided: 15
   - Expected: number between 0 and 10
   - Suggestion: Use values like 8.5 instead of 15

ORIGINAL REQUEST:
Analyze this code and provide structured feedback...

PLEASE PROVIDE CORRECTED RESPONSE:`;

// Attempt 2: Corrected response
const attempt2Response = '{"analysis": "Good code with room for improvement", "score": 8}';
const attempt2Result = outputSchema.process(attempt2Response);
// Result: { success: true, data: {...} }
```

## Integration Architecture

### Package Dependencies

**Clean Dependency Management:**
- **Prompt-Manager**: Depends on object-query, prompt-builder, output-schema, resource-manager
- **Object-Query**: No dependencies (pure data processing)
- **Prompt-Builder**: No dependencies (pure template processing)  
- **Output-Schema**: Depends on @legion/schema (validation)
- **Resource-Manager**: Provides LLM client and configuration

### Configuration Validation

**Cross-Component Validation:**

```javascript
validateConfiguration() {
  // Validate object-query specification
  new ObjectQuery(this.config.objectQuery); // Throws if invalid
  
  // Validate prompt-builder configuration  
  new PromptBuilder(this.config.promptBuilder); // Throws if invalid
  
  // Validate output-schema specification
  new ResponseValidator(this.config.outputSchema); // Throws if invalid
  
  // Validate LLM client availability
  if (!this.llmClient) {
    throw new Error('LLM client is required');
  }
  
  // Cross-component compatibility checks
  this._validateCrossComponentCompatibility();
}
```

### Error Boundary Management

**Comprehensive Error Handling:**

```javascript
// Different error types require different handling
const errorTypes = {
  CONFIGURATION: 'Invalid component configuration',
  OBJECT_QUERY: 'Data extraction failed', 
  PROMPT_BUILDER: 'Prompt generation failed',
  LLM_API: 'LLM API call failed',
  VALIDATION: 'Response validation failed',
  TIMEOUT: 'Operation exceeded time limit',
  QUOTA: 'API quota exceeded',
  AUTH: 'Authentication failed'
};

// Error recovery strategies
const recoveryStrategies = {
  VALIDATION: 'retry_with_feedback',  // Use error feedback
  LLM_API: 'retry_with_backoff',     // Retry with delay
  TIMEOUT: 'retry_with_longer_timeout', // Increase timeout
  QUOTA: 'abort',                    // Don't retry quota errors
  AUTH: 'abort'                     // Don't retry auth errors
};
```

## Performance Considerations

### Efficient Pipeline Execution

**Optimized Workflow:**
- Lazy initialization of components until first use
- Caching of frequently used configurations
- Parallel processing where possible (validation + next prompt prep)
- Memory management for large source objects

### Retry Optimization

**Smart Retry Strategy:**
- Exponential backoff for API errors
- Linear delay for validation errors
- Immediate retry for transient failures
- Abort on fatal errors (auth, quota)

## Real-World Usage Patterns

### Complete Development Workflow

```javascript
// Development assistant for code optimization
const devAssistant = new PromptManager(developmentConfig);

// Process user request for performance optimization
const optimizationResult = await devAssistant.execute({
  user: { profile: { role: 'Frontend Developer', experience: 'intermediate' } },
  project: { 
    name: 'React Dashboard',
    files: [{ name: 'Dashboard.jsx', content: 'export default function Dashboard() {...}' }],
    performance: { issues: ['slow rendering', 'memory leaks'] }
  },
  conversation: { messages: [...recentChat] },
  currentRequest: { description: 'Optimize Dashboard component performance' }
});

// Result includes complete implementation plan with validated structure
```

### Multi-Round Conversation

```javascript
// Same manager handles multiple rounds in conversation
const round1 = await supportManager.execute(initialRequest);
const round2 = await supportManager.execute(followUpRequest); 
const round3 = await supportManager.execute(clarificationRequest);

// Each round benefits from same configuration but different source objects
```

This design creates a powerful, complete LLM interaction system that handles the entire pipeline from complex data extraction through validated responses, with robust error recovery and retry logic.