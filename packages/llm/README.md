# @jsenvoy/llm

LLM client package with retry logic and error handling for jsEnvoy.

## Features

- Multiple LLM provider support (OpenAI, Anthropic)
- Automatic retry logic with exponential backoff
- Robust JSON parsing
- TypeScript support
- Comprehensive test coverage

## Installation

```bash
npm install @jsenvoy/llm
```

## Usage

```typescript
import { LLMClient } from '@jsenvoy/llm';

const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY
});

const response = await client.complete({
  prompt: 'Hello, world!',
  maxTokens: 100
});
```

## Documentation

See the [design documentation](./docs/design.md) for architecture details.