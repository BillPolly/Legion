# Three-Tier Prompting Architecture

The Legion framework now provides three distinct interfaces for LLM interactions, each optimized for different use cases:

## Tier 1: Basic String Prompting (LLMClient)
**When to use**: Simple text completion tasks, legacy integration, or when you need maximum control.

```javascript
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

const response = await llmClient.complete("What is 2+2?");
console.log(response); // "2+2 equals 4"
```

**Features:**
- Direct string-based prompting
- Manual retry logic
- Provider abstraction
- Event emission for monitoring

## Tier 2: Rich JSON Interface (SimplePromptClient) ⭐ **RECOMMENDED**
**When to use**: Most common scenarios - chat, tools, file analysis, system prompts.

```javascript
const resourceManager = await ResourceManager.getInstance();
const simpleClient = await resourceManager.get('simplePromptClient');

// Simple chat
const response = await simpleClient.chat("Hello! How can you help me?");

// Chat with system prompt and tools
const result = await simpleClient.request({
  prompt: "Calculate the square root of 144 and explain the process",
  systemPrompt: "You are a helpful math tutor",
  tools: [{
    name: 'calculator',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression' }
      }
    }
  }],
  chatHistory: [
    { role: 'user', content: 'I need help with math' },
    { role: 'assistant', content: 'I\'d be happy to help with math problems!' }
  ],
  temperature: 0.3
});

console.log(result.content); // Response text
console.log(result.toolCalls); // Any tool calls made
```

**Features:**
- Clean, intuitive API
- Automatic provider adaptation
- Built-in tool support
- File handling
- Chat history management
- Provider-agnostic interface

## Tier 3: Full Pipeline Processing (PromptManager)
**When to use**: Complex workflows requiring data extraction from source objects, structured templates, and validation.

```javascript
const resourceManager = await ResourceManager.getInstance();
const promptManager = new PromptManager({
  objectQuery: {
    bindingRules: [
      { placeholder: 'projectContext', path: 'project.description' },
      { placeholder: 'codeFiles', path: 'files', transform: 'summary' }
    ]
  },
  promptBuilder: {
    template: `
System: {{systemPrompt}}

Project Context: {{projectContext}}
Code Files: {{codeFiles}}

User Request: {{userPrompt}}
    `
  },
  outputSchema: {
    type: 'object',
    properties: {
      analysis: { type: 'string' },
      suggestions: { type: 'array', items: { type: 'string' }}
    }
  }
});

const result = await promptManager.execute(sourceDataObject);
```

**Features:**
- Complex data extraction from source objects
- Template-based prompt building
- Response validation and retry
- Error recovery with feedback
- Pipeline orchestration

## Usage Guidelines

### Choose Tier 1 (LLMClient) when:
- Migrating legacy code
- Need direct provider control
- Building custom orchestration
- Performance-critical simple tasks

### Choose Tier 2 (SimplePromptClient) when: ⭐
- Chat-based interactions
- Using tools/functions
- File analysis
- System prompts
- Most common use cases
- Want clean, modern API

### Choose Tier 3 (PromptManager) when:
- Complex data extraction workflows
- Need structured validation
- Building AI applications with data processing
- Require retry/recovery logic
- Template-based prompt generation

## Migration Path

### From basic strings to SimplePromptClient:
```javascript
// Before (Tier 1)
const response = await llmClient.complete("You are helpful.\n\nUser: Hello\nAssistant:");

// After (Tier 2) 
const response = await simpleClient.chat("Hello", { 
  systemPrompt: "You are helpful" 
});
```

### From SimplePromptClient to PromptManager:
```javascript
// When you need structured data processing
const sourceData = {
  user: { name: "John", preferences: ["coding", "math"] },
  context: { task: "help with homework" }
};

const result = await promptManager.execute(sourceData);
```

## Provider Adaptation

All tiers automatically adapt to provider capabilities:

- **OpenAI**: Native tools, chat format, full parameter support
- **Anthropic**: XML tool descriptions, system prompts, temperature
- **Mock/Basic**: Text fallbacks with graceful degradation

The SimplePromptClient handles this transparently, making provider switching seamless.