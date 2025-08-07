# BT-Based Testing System Usage Guide

This testing system uses Behavior Trees to test BT agents through their Actor interface, providing realistic message flow testing instead of traditional Jest unit tests.

## Quick Start

### 1. Basic Agent Testing

```javascript
import { quickTestAllAgents } from './testing/index.js';
import { ChatBTAgent, TerminalBTAgent, ArtifactBTAgent } from '../index.js';

// Create your agents
const chatAgent = new ChatBTAgent({ /* config */ });
const terminalAgent = new TerminalBTAgent({ /* config */ });
const artifactAgent = new ArtifactBTAgent({ /* config */ });

await chatAgent.initialize();
await terminalAgent.initialize();
await artifactAgent.initialize();

// Run comprehensive tests
const testResults = await quickTestAllAgents({
  chatAgent,
  terminalAgent,
  artifactAgent
}, {
  debugMode: true,
  reportFormat: 'console'
});

console.log('Test Results:', testResults.report);
```

### 2. Individual Agent Testing

```javascript
import { testChatAgent } from './testing/index.js';

const results = await testChatAgent(chatAgent, {
  debugMode: true,
  timeout: 30000
});

console.log('Chat Agent Test Results:');
console.log(results.report);
```

### 3. Custom Test Scenarios

```javascript
import { setupTestingEnvironment, loadScenario } from './testing/index.js';

// Set up testing environment
const testEnv = await setupTestingEnvironment({
  myAgent: myCustomAgent
});

// Load and run custom scenario
const scenario = await loadScenario('./my-custom-test.json');
const results = await testEnv.runScenario(scenario);

// Generate report
const report = testEnv.generateReport('markdown');
await fs.writeFile('./test-report.md', report);

// Cleanup
await testEnv.cleanup();
```

## Creating Custom Test Scenarios

### JSON Test Scenario Structure

```json
{
  "type": "test_scenario",
  "name": "My Custom Agent Test",
  "description": "Test custom agent functionality",
  
  "configuration": {
    "timeout": 15000,
    "debugMode": true
  },

  "setup": {
    "type": "sequence",
    "name": "test_setup",
    "children": [
      {
        "type": "mock_environment",
        "action": "setup",
        "environmentId": "my_test_env",
        "mockData": {
          "sessionId": "test-session-123"
        }
      }
    ]
  },

  "tests": {
    "type": "sequence",
    "name": "my_tests",
    "children": [
      {
        "type": "send_message",
        "name": "send_test_message",
        "targetAgent": "myAgent",
        "messageType": "test_message",
        "messageContent": "Hello agent!",
        "waitForResponse": true,
        "responseTimeout": 5000
      },
      {
        "type": "assert_response",
        "name": "validate_response",
        "dataSource": "lastResponse",
        "assertions": [
          {
            "field": "type",
            "type": "equals",
            "expected": "test_response",
            "description": "Should respond with test_response type"
          }
        ]
      }
    ]
  },

  "teardown": {
    "type": "mock_environment",
    "action": "teardown",
    "environmentId": "my_test_env"
  }
}
```

## Available Testing Nodes

### SendMessageNode
Send messages to agents under test.

```json
{
  "type": "send_message",
  "name": "send_chat_message",
  "targetAgent": "chatAgent",
  "messageType": "chat_message", 
  "messageContent": "Hello!",
  "messageData": {
    "sessionId": "{{sessionId}}"
  },
  "waitForResponse": true,
  "responseTimeout": 10000
}
```

### WaitForResponseNode
Wait for and capture specific responses.

```json
{
  "type": "wait_for_response",
  "name": "wait_for_tool_result",
  "sourceAgent": "terminalAgent",
  "responseType": "tool_response",
  "timeout": 15000,
  "storeResponse": true,
  "responseKey": "toolResult"
}
```

### AssertResponseNode
Validate responses and data.

```json
{
  "type": "assert_response",
  "name": "validate_tool_execution",
  "dataSource": "toolResult",
  "assertions": [
    {
      "field": "success",
      "type": "equals",
      "expected": true,
      "description": "Tool execution should succeed"
    },
    {
      "field": "result.content",
      "type": "exists",
      "description": "Should have result content"
    }
  ]
}
```

### MockEnvironmentNode
Create isolated test environments.

```json
{
  "type": "mock_environment",
  "name": "setup_test_env",
  "action": "setup",
  "environmentId": "isolated_test",
  "mockServices": [
    {
      "name": "mockLLM",
      "type": "custom",
      "responses": {
        "completion": "Mock LLM response"
      }
    }
  ]
}
```

## Assertion Types

The assertion system supports comprehensive validation:

- **Value Comparisons**: `equals`, `not_equals`, `greater_than`, `less_than`
- **String Operations**: `contains`, `starts_with`, `ends_with`, `matches` (regex)
- **Type Checking**: `type`, `instanceof`
- **Existence**: `exists`, `not_exists`, `truthy`, `falsy`
- **Collections**: `array_contains`, `object_contains`, `length`
- **Deep Comparison**: `deep_equals`

## Template Variables

Use template variables for dynamic content:

```json
{
  "messageContent": "Session ID is {{sessionId}}",
  "messageData": {
    "timestamp": "{{Date.now()}}",
    "userId": "{{mockData.userId}}"
  }
}
```

## Running Test Suites

### Directory-Based Testing

```javascript
import { TestScenarioRunner } from './testing/index.js';

const runner = new TestScenarioRunner();
await runner.initialize();

// Register agents
runner.registerTestAgents({ chatAgent, terminalAgent });

// Run all tests in directory
const results = await runner.runFromDirectory('./test-scenarios/', {
  stopOnFailure: false,
  reportFormat: 'json'
});

console.log(`Ran ${results.filesProcessed} test files`);
console.log('Summary:', results.summary);
```

### Programmatic Test Creation

```javascript
import { createTestingAgent } from './testing/index.js';

const testingAgent = await createTestingAgent();

// Register agents to test
testingAgent.registerTestAgent('myAgent', myAgent);

// Define test scenario programmatically
const scenario = {
  type: 'sequence',
  name: 'programmatic_test',
  children: [
    {
      type: 'send_message',
      targetAgent: 'myAgent',
      messageType: 'ping',
      waitForResponse: true
    },
    {
      type: 'assert_response',
      dataSource: 'lastResponse',
      assertions: [{ 
        field: 'type', 
        type: 'equals', 
        expected: 'pong' 
      }]
    }
  ]
};

const result = await testingAgent.runTestScenario(scenario);
console.log('Test passed:', result.status === 'PASSED');
```

## Best Practices

### 1. Agent Interface Validation
Always validate agents implement the Actor interface:

```javascript
import { validateActorInterface } from './testing/index.js';

const validation = validateActorInterface(myAgent, 'MyAgent');
if (!validation.valid) {
  throw new Error(`Agent validation failed: ${validation.errors.join(', ')}`);
}
```

### 2. Mock Environment Isolation
Use mock environments for consistent, isolated testing:

```javascript
// Good: Isolated with mocks
{
  "type": "mock_environment",
  "action": "setup",
  "mockServices": ["llm", "database"],
  "isolateAgents": true
}

// Avoid: Testing against real services
```

### 3. Comprehensive Assertions
Test multiple aspects of responses:

```json
{
  "assertions": [
    { "field": "type", "type": "equals", "expected": "success" },
    { "field": "data", "type": "exists" },
    { "field": "data.items.length", "type": "greater_than", "expected": 0 },
    { "field": "timestamp", "type": "type", "expected": "string" }
  ]
}
```

### 4. Error Case Testing
Always test error conditions:

```json
{
  "name": "test_error_handling",
  "children": [
    {
      "type": "send_message",
      "messageType": "invalid_message_type"
    },
    {
      "type": "assert_response", 
      "assertions": [
        { "field": "type", "type": "equals", "expected": "error" }
      ]
    }
  ]
}
```

### 5. Cleanup
Always clean up test resources:

```javascript
try {
  const results = await testEnvironment.runSuite(suite);
  return results;
} finally {
  await testEnvironment.cleanup();
}
```

## Reporting

### Available Report Formats

1. **Console**: Human-readable terminal output
2. **JSON**: Machine-readable detailed results
3. **Markdown**: Documentation-friendly format

```javascript
const report = testRunner.generateReport('markdown');
await fs.writeFile('./test-report.md', report);
```

### Custom Report Processing

```javascript
const results = testRunner.getTestResults();
const summary = testRunner.generateSummary();

// Custom processing
const failedTests = results.filter(r => r.status === 'FAILED');
console.log(`${failedTests.length} tests failed:`);
failedTests.forEach(test => console.log(`- ${test.scenarioName}: ${test.error}`));
```

## Integration with CI/CD

```bash
# Add to package.json
{
  "scripts": {
    "test:bt-agents": "node scripts/run-bt-tests.js"
  }
}

# scripts/run-bt-tests.js
import { quickTestAllAgents } from '../src/agents-bt/testing/index.js';

const results = await quickTestAllAgents(agents, {
  reportFormat: 'json'
});

process.exit(results.summary.failed > 0 ? 1 : 0);
```

## Debugging Tests

Enable debug mode for detailed logging:

```javascript
const results = await quickTestAllAgents(agents, {
  debugMode: true,
  reportingLevel: 'detailed'
});
```

This will show:
- Message sending/receiving logs
- Response validation steps
- Assertion evaluation details
- Mock environment interactions
- Performance timing information