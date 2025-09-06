# @legion/prompting-manager

Complete LLM interaction orchestrator integrating object-query, prompt-builder, and output-schema with retry logic.

This package provides the top-level orchestration for the entire intelligent prompting pipeline, managing data extraction, prompt generation, LLM communication, and response validation with automatic retry on errors.

## Key Features

- **Complete Pipeline Orchestration**: Integrates object-query → prompt-builder → LLM → output-schema
- **Intelligent Retry Logic**: Automatic retry with error feedback and correction prompts
- **Single Configuration**: Configure once, execute multiple times with different source objects
- **LLM Client Integration**: Seamless integration with Legion ResourceManager LLM clients
- **Error Recovery**: Structured error feedback for improved retry success rates
- **Legion Framework**: Full integration with existing Legion infrastructure

## Quick Start

```javascript
import { PromptManager } from '@legion/prompting-manager';
import { ResourceManager } from '@legion/resource-manager';

// Get LLM client
const resourceManager = await ResourceManager.getInstance();
const llmClient = await resourceManager.get('llmClient');

// Configure complete pipeline once
const manager = new PromptManager({
  objectQuery: {
    bindings: {
      codeContent: { path: 'project.files[0].content' },
      chatHistory: { path: 'conversation.messages', transform: 'recent', count: 5 }
    },
    contextVariables: {
      techStack: { path: 'project.technologies' }
    }
  },
  promptBuilder: {
    template: `Analyze: {{codeContent}}
    
Discussion: {{chatHistory}}

Context: @techStack

{{outputInstructions}}`,
    maxTokens: 4000
  },
  outputSchema: {
    type: 'object',
    properties: {
      analysis: { type: 'string' },
      score: { type: 'number', minimum: 0, maximum: 10 },
      recommendations: { type: 'array', items: { type: 'string' } }
    },
    required: ['analysis', 'score']
  },
  llmClient: llmClient,
  retryConfig: {
    maxAttempts: 3,
    errorFeedback: true
  }
});

// Execute with different source objects
const result = await manager.execute(sourceObject);

if (result.success) {
  console.log('Analysis:', result.data.analysis);
  console.log('Score:', result.data.score);
} else {
  console.log('Failed after retries:', result.errors);
}
```

## Documentation

See the [Design Document](./docs/DESIGN.md) for comprehensive specifications and examples.