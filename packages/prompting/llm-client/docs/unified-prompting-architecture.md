# Legion Unified Prompting Architecture

## Overview

Legion now provides a unified, powerful interface for all LLM interactions through the integration of PromptManager and LLMClient. This architecture combines sophisticated prompt orchestration with automatic provider adaptation, giving consumers a single interface that works optimally across all providers.

## Architecture

### Two-Layer Design

#### PromptManager (High-Level Orchestration)
- **Rich request interface** for consumers
- **Response validation and parsing** using output-schema
- **Intelligent retry** with specialized error feedback prompts
- **Integration** with prompt-builder, object-query, and output-schema
- **Execution history** and performance metrics

#### LLMClient (Provider Adaptation Layer)  
- **Automatic provider capability detection**
- **Request adaptation** to provider-specific formats
- **Graceful degradation** for unsupported features
- **Provider abstraction** and error handling
- **SimpleEmitter event system** for monitoring

### Data Flow

```
Consumer Request → PromptManager → LLMClient → Provider APIs
                     ↓              ↓
           (Orchestration)    (Adaptation)
                     ↓              ↓
           Response Validation ← Unified Response
```

## Consumer Interface

### Unified Request Method

Consumers use `PromptManager.request()` for all LLM interactions:

```javascript
const promptManager = new PromptManager({
  llmClient: myLLMClient,
  // ... other configuration
});

const response = await promptManager.request({
  // Core content
  systemPrompt: "You are a helpful coding assistant",
  prompt: "Help me debug this function",
  
  // Advanced features (automatically adapted)
  tools: [
    {
      name: 'execute_code',
      description: 'Execute JavaScript code and return the result',
      parameters: {
        type: 'object',
        properties: {
          code: {type: 'string', description: 'JavaScript code to execute'}
        },
        required: ['code']
      }
    }
  ],
  
  chatHistory: [
    {role: 'user', content: 'I have a bug in my code'},
    {role: 'assistant', content: 'I can help you debug that. What seems to be the issue?'}
  ],
  
  files: [
    {name: 'buggy-function.js', content: 'function broken() {...}', type: 'text'}
  ],
  
  // Model parameters
  temperature: 0.3,
  maxTokens: 1000,
  
  // PromptManager enhancements (optional)
  outputSchema: myResponseSchema,  // Automatic validation
  strictValidation: true,
  retryOnValidationFailure: true
});
```

### Request Object Schema

```javascript
{
  // === Core Content ===
  systemPrompt?: string,
  messages?: Array<{role: 'user'|'assistant'|'system', content: string}>,
  prompt?: string,
  
  // === Advanced Features (Auto-Adapted) ===
  tools?: Array<{
    name: string,
    description: string,
    parameters: {
      type: 'object',
      properties: {...},
      required?: string[]
    }
  }>,
  
  files?: Array<{
    name: string,
    content: string | Buffer,
    type: 'text' | 'image' | 'document',
    encoding?: 'base64' | 'utf8'
  }>,
  
  chatHistory?: Array<{
    role: 'user' | 'assistant' | 'system',
    content: string,
    timestamp?: string,
    toolCalls?: Array<{name: string, args: object, result?: any}>
  }>,
  
  // === Model Parameters ===
  maxTokens?: number,
  temperature?: number,
  topP?: number,
  frequencyPenalty?: number,
  presencePenalty?: number,
  
  // === Tool Behavior ===
  toolChoice?: 'auto' | 'none' | 'required' | {
    type: 'function',
    function: {name: string}
  },
  
  // === PromptManager Enhancement Options ===
  outputSchema?: false | object,        // Disable/configure response validation
  strictValidation?: boolean,           // Enable strict validation mode
  retryOnValidationFailure?: boolean    // Retry with error feedback on validation failure
}
```

## Automatic Provider Adaptation

### OpenAI Provider (Full Feature Support)
- **Tools**: Used natively with OpenAI's function calling API
- **Chat History**: Passed directly as messages array
- **System Prompts**: Used as system role message
- **Files**: Images as vision input, text injected into messages
- **Parameters**: All parameters supported natively
- **Streaming**: Native streaming support (when implemented)

### Anthropic Provider (Partial Native Support + Adaptation)
- **Tools**: Converted to XML tool descriptions in system prompt with usage instructions
- **Chat History**: Used natively as messages
- **System Prompts**: Used natively
- **Files**: Text content injected into messages, images as base64
- **Parameters**: Temperature and maxTokens supported, others ignored gracefully

### Basic/Mock Provider (Text-Only Fallback)
- **Tools**: Converted to text descriptions in prompt
- **Chat History**: Flattened into conversational text format
- **System Prompts**: Prepended to final prompt
- **Files**: Content injected as text in prompt
- **Parameters**: Only maxTokens supported

### Adaptation Examples

#### OpenAI Transformation
```javascript
// Rich request automatically becomes:
{
  model: 'gpt-4',
  messages: [
    {role: 'system', content: 'You are a helpful assistant'},
    ...chatHistory,
    {role: 'user', content: 'Help me debug\n\nFile buggy.js:\nfunction broken() {...}'}
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'execute_code',
        description: 'Execute JavaScript code',
        parameters: {...}
      }
    }
  ],
  tool_choice: 'auto',
  temperature: 0.3,
  max_tokens: 1000
}
```

#### Basic Provider Transformation
```javascript
// Rich request becomes a single prompt:
`You are a helpful assistant

Previous conversation:
User: I have a bug in my code
Assistant: I can help you debug that. What seems to be the issue?

Files:
File buggy-function.js:
function broken() {...}

Available tools:
- execute_code: Execute JavaScript code and return the result

User: Help me debug this function
Assistant:`
```

## Response Format

### Unified Response Structure

```javascript
{
  success: boolean,
  stage: 'completed' | 'validation' | 'fatal',
  
  // Response content (one of these will be present)
  content?: string,           // Raw response content
  data?: object,             // Parsed/validated data (when outputSchema used)
  
  // Advanced features
  toolCalls?: Array<{        // Extracted tool calls
    name: string,
    args: object,
    id: string
  }>,
  
  // Metadata and diagnostics
  metadata: {
    executionId: string,
    executionTimeMs: number,
    attempts: number,
    interface: 'unified_request',
    
    // LLM information
    model: string,
    provider: string,
    adaptations: string[],     // List of adaptations applied
    
    // PromptManager enhancements
    addedSchemaInstructions?: boolean,
    appliedErrorFeedback?: boolean,
    
    // Performance breakdown
    llmCall: {
      durationMs: number,
      model: string,
      provider: string,
      adaptations: string[]
    },
    outputSchema?: {
      durationMs: number,
      format: string,
      confidence: number,
      validationPassed: boolean
    }
  }
}
```

## Key Benefits

### For Consumers
- **Single Interface**: One method works with any provider
- **Maximum Features**: Automatically get best possible experience from each provider
- **Intelligent Retry**: Sophisticated error recovery with specialized retry prompts
- **Response Validation**: Automatic parsing and validation of structured responses
- **Zero Provider Knowledge**: Never need to know what provider supports what

### For the System
- **Clean Architecture**: Clear separation between orchestration and adaptation
- **Leverages Existing Infrastructure**: Built on proven PromptManager capabilities
- **Extensible**: Easy to add new providers and features
- **Observable**: Comprehensive metadata for debugging and optimization

## Usage Examples

### Simple Chat Bot
```javascript
await promptManager.request({
  systemPrompt: "You are a friendly chatbot",
  chatHistory: conversation,
  prompt: userMessage
});
```

### Tool-Using Agent with Validation
```javascript
await promptManager.request({
  systemPrompt: "You are a code assistant with access to tools",
  tools: [calculateTool, executeTool, searchTool],
  chatHistory: previousTurns,
  prompt: "Help me solve this math problem and write code for it",
  outputSchema: {
    type: 'object',
    properties: {
      solution: {type: 'string'},
      code: {type: 'string'},
      explanation: {type: 'string'}
    }
  },
  retryOnValidationFailure: true
});
```

### Document Analysis
```javascript
await promptManager.request({
  systemPrompt: "Analyze the provided documents and extract key insights",
  files: documents.map(doc => ({name: doc.name, content: doc.content, type: 'text'})),
  prompt: "Summarize the key findings and provide recommendations",
  outputSchema: {
    type: 'object',
    properties: {
      keyFindings: {type: 'array', items: {type: 'string'}},
      recommendations: {type: 'array', items: {type: 'string'}},
      confidence: {type: 'number', minimum: 0, maximum: 1}
    }
  },
  temperature: 0.1,  // Low temperature for analytical tasks
  maxTokens: 2000
});
```

This unified architecture provides the best of both worlds: the power and sophistication of Legion's prompting system with the simplicity and automatic adaptation that makes it work seamlessly across all providers.