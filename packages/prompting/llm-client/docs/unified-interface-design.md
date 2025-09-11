# LLMClient Unified Interface Design

## Overview

This document describes the design for enhancing LLMClient with a unified JSON interface that automatically adapts to different provider capabilities. The core principle is that consumers provide a rich request object containing everything they need (tools, chat history, files, system prompts, etc.), and LLMClient transparently handles all provider-specific adaptations and fallbacks.

## Design Principles

### Transparent Adaptation
The consumer never needs to know what features a provider supports. LLMClient automatically detects provider capabilities and adapts the request accordingly.

### Maximum Utilization
Each provider should be used to its fullest potential - if OpenAI supports tools natively, use them natively. If a basic provider only supports text, gracefully degrade.

### Unified Experience
The same consumer code works identically across all providers, with automatic optimization for each provider's strengths.

## Consumer Interface

### Request Object Schema

The consumer passes a single rich object containing all desired capabilities:

```javascript
{
  // Core content
  systemPrompt?: string,
  messages?: Array<{role: 'user'|'assistant'|'system', content: string}>,
  prompt?: string,
  
  // Advanced features
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
  
  // Model parameters
  maxTokens?: number,
  temperature?: number,
  topP?: number,
  frequencyPenalty?: number,
  presencePenalty?: number,
  
  // Response configuration
  responseFormat?: 'text' | 'json_object' | {
    type: string,
    schema?: object
  },
  
  // Tool behavior
  toolChoice?: 'auto' | 'none' | 'required' | {
    type: 'function',
    function: {name: string}
  }
}
```

### Simple Usage Example

```javascript
// Consumer provides everything they want
const response = await llmClient.request({
  systemPrompt: "You are a helpful coding assistant",
  chatHistory: [
    {role: 'user', content: 'Help me debug this code'},
    {role: 'assistant', content: 'I can help with that. What seems to be the issue?'}
  ],
  tools: [
    {
      name: 'execute_code',
      description: 'Execute JavaScript code and return the result',
      parameters: {
        type: 'object',
        properties: {
          code: {type: 'string', description: 'The JavaScript code to execute'}
        },
        required: ['code']
      }
    }
  ],
  files: [
    {name: 'app.js', content: 'function broken() {...}', type: 'text'}
  ],
  prompt: 'The function is throwing an error',
  temperature: 0.3
});
```

## Provider Adaptation Strategy

### Provider Capability Detection

Each provider internally declares its capabilities:

```javascript
// Internal provider capability structure (not exposed to consumer)
{
  tools: boolean,
  chatHistory: boolean,
  systemPrompts: boolean,
  files: {
    text: boolean,
    images: boolean,
    documents: boolean
  },
  responseFormats: ['text', 'json_object'],
  parameters: ['temperature', 'topP', 'maxTokens', 'frequencyPenalty'],
  streaming: boolean
}
```

### Automatic Adaptation Examples

#### OpenAI Provider (Full Feature Support)
- **Tools**: Used natively with OpenAI's function calling API
- **Chat History**: Passed directly as messages array
- **System Prompts**: Used as system role message
- **Files**: Images passed as vision input, text files as content
- **Parameters**: All parameters supported natively

#### Anthropic Provider (Partial Native Support)
- **Tools**: Converted to XML tool descriptions in system prompt
- **Chat History**: Used natively as messages
- **System Prompts**: Used natively
- **Files**: Text content injected into messages, images as base64
- **Parameters**: Temperature and maxTokens supported, others ignored

#### Basic Provider (Text-Only Fallback)
- **Tools**: Converted to text descriptions in prompt
- **Chat History**: Flattened into conversational text format
- **System Prompts**: Prepended to the final prompt
- **Files**: Content injected as text in prompt
- **Parameters**: Only maxTokens supported

### Adaptation Algorithm

1. **Analyze Request**: Parse the incoming rich request object
2. **Detect Provider**: Determine current provider's capabilities
3. **Optimize Mapping**: Map each feature to best available provider mechanism
4. **Graceful Degradation**: Convert unsupported features to text equivalents
5. **Execute Request**: Send adapted request to provider
6. **Normalize Response**: Return consistent response format

## Response Format

### Unified Response Structure

```javascript
{
  content: string,              // The main response text
  toolCalls?: Array<{           // If tools were called
    name: string,
    args: object,
    id: string
  }>,
  usage?: {                     // Token usage information
    promptTokens: number,
    completionTokens: number,
    totalTokens: number
  },
  metadata: {                   // Provider-specific metadata
    model: string,
    provider: string,
    adaptations: string[]       // List of adaptations applied
  }
}
```

### Tool Call Handling

When tools are called:
1. Provider returns tool calls (natively or parsed from text)
2. LLMClient executes tool functions if provided
3. Results are fed back to continue the conversation
4. Final response includes both content and tool call history

## Provider-Specific Adaptations

### OpenAI Adaptation
```javascript
// Rich request automatically becomes:
{
  model: 'gpt-4',
  messages: [...chatHistory, {role: 'system', content: systemPrompt}, ...],
  tools: [...tools],
  temperature: 0.3,
  max_tokens: maxTokens
}
```

### Anthropic Adaptation
```javascript
// Rich request automatically becomes:
{
  model: 'claude-3-sonnet',
  system: `${systemPrompt}\n\nAvailable tools: ${toolsAsXML}`,
  messages: [...chatHistory, {role: 'user', content: `${fileContents}\n\n${prompt}`}],
  max_tokens: maxTokens
}
```

### Basic Provider Adaptation
```javascript
// Rich request automatically becomes:
{
  prompt: `${systemPrompt}\n\nConversation:\n${flattenedHistory}\n\nFiles:\n${fileContents}\n\nTools available: ${toolDescriptions}\n\nUser: ${prompt}\nAssistant:`,
  max_tokens: maxTokens
}
```

## Error Handling

### Graceful Degradation
- If a feature isn't supported, it's automatically converted to the best available alternative
- No errors are thrown for unsupported features
- Adaptations are logged in response metadata for debugging

### Feature Validation
- Invalid tool schemas are automatically corrected or simplified
- Unsupported file types are converted to text representation
- Malformed chat history is sanitized and reformatted

## Backward Compatibility

### Legacy Method Support
The existing `complete(prompt, maxTokens)` method remains available:

```javascript
// Still works
await llmClient.complete("Hello", 1000);

// Equivalent to:
await llmClient.request({prompt: "Hello", maxTokens: 1000});
```

### Migration Path
Existing code continues to work unchanged while new code can take advantage of the rich interface.

## Integration Examples

### Simple Chat Bot
```javascript
await llmClient.request({
  systemPrompt: "You are a friendly chatbot",
  chatHistory: conversation,
  prompt: userMessage
});
```

### Tool-Using Agent
```javascript
await llmClient.request({
  systemPrompt: "You are a code assistant with access to tools",
  tools: [calculateTool, executeTool, searchTool],
  chatHistory: previousTurns,
  prompt: "Help me solve this math problem and write code for it"
});
```

### Document Analysis
```javascript
await llmClient.request({
  systemPrompt: "Analyze the provided documents",
  files: documents.map(doc => ({name: doc.name, content: doc.content, type: 'text'})),
  prompt: "Summarize the key findings",
  responseFormat: 'json_object'
});
```

This design ensures that consumers can write rich, feature-complete code once and have it work optimally across all providers, with LLMClient handling all the complexity of provider differences automatically.