# Agent Package Tests

This directory contains comprehensive tests for the jsEnvoy Agent package.

## Test Structure

```
__tests__/
├── unit/                    # Unit tests (no external dependencies)
│   ├── Agent.test.js       # Core Agent class tests
│   ├── RetryManager.test.js # RetryManager tests
│   ├── cli.test.js         # CLI functionality tests
│   └── master-prompt.test.js # Existing prompt generation tests
├── integration/            # Integration tests (requires API key)
│   └── agent-llm.test.js  # Tests with actual LLM
├── utils/                  # Test utilities
│   └── test-helpers.js    # Common test helpers
├── jest.config.js         # Jest configuration
├── setup.js              # Test setup
└── README.md            # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- unit/
```

### Integration Tests Only (requires OPENAI_API_KEY)
```bash
npm test -- integration/
```

### With Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Environment Variables

For integration tests, you need to set:
- `OPENAI_API_KEY` - Your OpenAI API key
- `TEST_MODEL` (optional) - Alternative model to test (default: gpt-3.5-turbo)
- `TEST_ALTERNATIVE_MODEL` (optional) - Additional model for compatibility tests

Example:
```bash
OPENAI_API_KEY=your-key npm test -- integration/
```

## Test Categories

### Unit Tests
- Mock all external dependencies
- Test individual methods and error handling
- Fast execution
- No API calls

### Integration Tests
- Use actual OpenAI API
- Test end-to-end functionality
- Test tool execution with LLM
- Slower execution
- Costs API credits

## Writing New Tests

### Unit Test Example
```javascript
import { Agent } from '../../src/Agent.js';
import { createMockAgentConfig, createMockTool } from '../utils/test-helpers.js';

describe('Agent', () => {
  it('should handle tool execution', () => {
    const mockTool = createMockTool('calculator', 'calc');
    const config = createMockAgentConfig({ tools: [mockTool] });
    const agent = new Agent(config);
    
    // Test implementation
  });
});
```

### Integration Test Example
```javascript
import { Agent } from '../../src/Agent.js';

const describeIfApiKey = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeIfApiKey('Agent with LLM', () => {
  it('should process natural language', async () => {
    const agent = new Agent({
      name: 'TestAgent',
      modelConfig: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY
      }
    });
    
    const response = await agent.run('Hello');
    expect(response).toBeDefined();
  });
});
```

## Debugging

### Enable Debug Output
```bash
DEBUG=* npm test
```

### Run Specific Test
```bash
npm test -- --testNamePattern="should handle tool execution"
```

### Verbose Output
```bash
npm test -- --verbose
```

## CI/CD Notes

- Unit tests run on every commit
- Integration tests run only when OPENAI_API_KEY is available
- Tests are skipped gracefully when API key is missing
- Coverage reports are generated in `coverage/` directory