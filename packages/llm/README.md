# @jsenvoy/llm

LLM client package with retry logic and error handling for jsEnvoy.

## Features

- Multiple LLM provider support (OpenAI, Anthropic, DeepSeek, OpenRouter)
- Automatic retry logic with exponential backoff
- Robust JSON parsing
- Event emission for interaction tracking
- Support for both prompt-based and message-based APIs
- Embedding support (OpenAI)
- Comprehensive test coverage

## Installation

```bash
npm install @jsenvoy/llm
```

## Usage

### Basic Usage (Prompt-based)

```javascript
import { LLMClient } from '@jsenvoy/llm';

const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-3.5-turbo'
});

// Simple prompt completion
const response = await client.complete('Hello, world!', 100);
```

### Message-based API (ChatGPT-style)

```javascript
// Send messages in ChatGPT format
const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello, how are you?' }
];

const response = await client.sendAndReceiveResponse(messages, {
  temperature: 0.7,
  maxTokens: 1000
});
```

### Provider Examples

```javascript
// DeepSeek
const deepseek = new LLMClient({
  provider: 'deepseek',
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat'
});

// OpenRouter (access multiple models)
const openrouter = new LLMClient({
  provider: 'openrouter',
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'anthropic/claude-3-sonnet'
});

// Anthropic
const anthropic = new LLMClient({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229'
});
```

## Documentation

See the [design documentation](./docs/design.md) for architecture details.