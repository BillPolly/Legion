# @legion/prompt-builder

Intelligent template processing with labeled inputs for optimal LLM prompt generation.

This package provides smart prompt formatting capabilities, taking prepared labeled inputs and templates to generate optimally formatted prompts with size constraints and content-aware processing.

## Key Features

- **Intelligent Formatting**: Content-aware processing for different data types
- **Size Management**: Automatic prompt size optimization within token limits
- **Content Handlers**: Smart processing for chat history, images, code, large text
- **Context Variables**: Named value management for LLM reference
- **Template Processing**: Advanced placeholder substitution with intelligence
- **Legion Integration**: Seamless work with Legion framework infrastructure

## Quick Start

```javascript
import { PromptBuilder } from '@legion/prompt-builder';

// Create prompt builder with intelligent defaults
const builder = new PromptBuilder({
  maxTokens: 4000,
  contentHandlers: {
    chatHistory: { maxMessages: 10, summarizeOlder: true },
    image: { summarize: true, maxLength: 100 },
    code: { preserveFormatting: true, maxLines: 50 }
  }
});

// Build prompt from template and labeled inputs
const template = `Analyze this conversation: {{chatHistory}}

User query: {{userQuery}}

Please provide: {{outputInstructions}}`;

const labeledInputs = {
  chatHistory: [...], // Prepared chat messages
  userQuery: "How can I optimize this code?",
  outputInstructions: "structured analysis with recommendations"
};

const prompt = builder.build(template, labeledInputs);
```

## Documentation

See the [Design Document](./docs/DESIGN.md) for comprehensive specifications and examples.