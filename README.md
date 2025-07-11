# @envoyjs/jscore

JavaScript implementation of EnvoyJS - A simple JavaScript framework for building AI Agents.

This is a pure JavaScript (CommonJS) version of the @envoyjs/core package, converted from TypeScript.

## Installation

```bash
npm install
```

## Usage

```javascript
const { Agent, Model, calculatorTool } = require('@envoyjs/jscore');

// Create an agent
const agent = new Agent({
    name: 'MyAgent',
    bio: 'I am a helpful assistant',
    modelConfig: {
        provider: 'OPEN_AI',
        model: 'gpt-4',
        apiKey: 'your-api-key'
    },
    tools: [calculatorTool],
    showToolUsage: true
});

// Run the agent
const response = await agent.run('What is 100 * 50?');
console.log(response);
```

## Available Tools

- Calculator Tool
- File Reader Tool
- File Writer Tool
- Command Executor Tool
- Web Crawler Tool
- Page Screenshoter Tool
- Serper (Google Search) Tool
- Server Starter Tool
- Webpage to Markdown Tool
- YouTube Transcript Tool

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Differences from TypeScript Version

- Uses CommonJS modules instead of ES modules
- No TypeScript type annotations
- Runtime validation for Tool base class implementation
- API keys passed directly in modelConfig instead of environment variables

## License

MIT