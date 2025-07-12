# @jsenvoy/model-providers

LLM model provider implementations for jsEnvoy, supporting multiple AI providers with a unified interface.

## Installation

```bash
npm install @jsenvoy/model-providers
```

## Usage

```javascript
const { Model } = require('@jsenvoy/model-providers');

// Create a model instance
const model = new Model({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY
});

// Generate a response
const response = await model.generateResponse(
  "What is the capital of France?",
  { temperature: 0.7 }
);
console.log(response); // "The capital of France is Paris."
```

## Supported Providers

### OpenAI
- Models: gpt-4, gpt-4-turbo, gpt-3.5-turbo, etc.
- Requires: OPENAI_API_KEY

```javascript
const model = new Model({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY
});
```

### DeepSeek
- Models: deepseek-chat, deepseek-coder
- Requires: DEEPSEEK_API_KEY

```javascript
const model = new Model({
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY
});
```

### OpenRouter
- Models: Various models from multiple providers
- Requires: OPENROUTER_API_KEY

```javascript
const model = new Model({
  provider: 'openrouter',
  model: 'anthropic/claude-3-opus',
  apiKey: process.env.OPENROUTER_API_KEY
});
```

## Advanced Usage

### Function Calling (OpenAI)
```javascript
const tools = [{
  type: "function",
  function: {
    name: "get_weather",
    description: "Get weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string" }
      },
      required: ["location"]
    }
  }
}];

const response = await model.generateResponse(
  "What's the weather in Paris?",
  { tools }
);
```

### Streaming Responses
```javascript
const stream = await model.generateStreamingResponse(
  "Tell me a story",
  { temperature: 0.8 }
);

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - OpenAI API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `OPENROUTER_API_KEY` - OpenRouter API key

### Model Options
- `temperature` - Controls randomness (0-2)
- `maxTokens` - Maximum tokens to generate
- `topP` - Nucleus sampling
- `frequencyPenalty` - Reduce repetition
- `presencePenalty` - Encourage new topics
- `systemPrompt` - System message for context

## API Reference

### Model Class

#### Constructor
```javascript
new Model(config)
```

Parameters:
- `config.provider` - Provider name ('openai', 'deepseek', 'openrouter')
- `config.model` - Model identifier
- `config.apiKey` - API key for the provider
- `config.baseURL` - Optional custom base URL
- `config.headers` - Optional custom headers

#### Methods

##### generateResponse(prompt, options)
Generate a text response.

##### generateStreamingResponse(prompt, options)
Generate a streaming response.

##### generateResponseWithTools(prompt, tools, options)
Generate a response with function calling (OpenAI only).

## License

MIT