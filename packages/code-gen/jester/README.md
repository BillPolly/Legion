# Jest Agent Wrapper (Jester)

A sophisticated Jest testing framework wrapper that transforms console output into structured, queryable data for AI coding agents to excel at Test-Driven Development (TDD).

## Overview

Jester makes Jest output agent-friendly by:
- Converting unstructured console output into structured, timestamped data
- Persisting test results in a queryable SQLite database
- Providing real-time event streaming for test execution monitoring
- Offering intelligent error pattern analysis and suggestions
- Enabling historical test data analysis for pattern recognition

## Features

### 🎯 Core Capabilities
- **Structured Test Data**: Transforms Jest's console output into typed, queryable objects
- **Persistent Storage**: SQLite database for complete test history and analysis
- **Real-time Events**: Stream test events as they happen for immediate feedback
- **Error Intelligence**: Categorizes errors with automated fix suggestions
- **Performance Tracking**: Monitor test duration trends and identify bottlenecks
- **TDD Support**: Agent-specific helpers for red-green-refactor workflows

### 📊 Data Collection
- Test suite and case results with timing information
- Console logs (log, warn, error, debug) with timestamps
- Assertion details with actual vs expected values
- Stack traces with file/line references
- Coverage data integration
- Performance metrics

### 🔍 Query Capabilities
- Find failing tests by error type
- Search test history for specific patterns
- Analyze error trends over time
- Identify slowest tests
- Track test success rates
- Generate comprehensive test reports

## Installation

```bash
npm install @legion/jester
```

## Usage

### Basic Integration

```javascript
import { JestAgentWrapper } from '@legion/jester';

// Create wrapper instance
const jaw = new JestAgentWrapper({
  dbPath: './test-results.db',
  storage: 'sqlite',
  collectConsole: true,
  collectCoverage: true,
  realTimeEvents: true
});

// Run tests with structured output
const session = await jaw.runTests('src/**/*.test.js');

// Query results
const failedTests = await jaw.getFailedTests(session.id);
const errors = await jaw.getErrorsByType('assertion');
```

### Jest Reporter Integration

Configure Jest to use the Jester reporter:

```javascript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['@legion/jester/reporter', {
      dbPath: './test-results.db',
      realTimeEvents: true
    }]
  ]
};
```

### CLI Usage

```bash
# Run tests with Jester wrapper
jester run src/**/*.test.js --storage sqlite --output test-results.db

# Query previous results
jester query --failed --since "1 hour ago"
jester query --errors --type assertion
jester query --slow --limit 10
```

### TDD Helper for AI Agents

```javascript
import { AgentTDDHelper } from '@legion/jester';

const helper = new AgentTDDHelper(jaw);

// Run TDD cycle with intelligent analysis
const result = await helper.runTDDCycle('src/feature.test.js');

if (result.status === 'red') {
  console.log('Failures:', result.failures);
  console.log('Suggestions:', result.suggestions);
  console.log('Next actions:', result.nextActions);
}

// Analyze test history for patterns
const history = await helper.analyzeTestHistory('test name');
console.log('Success rate:', history.successRate);
console.log('Common errors:', history.commonErrors);
```

## API Reference

### JestAgentWrapper

Main wrapper class for orchestrating test execution and data collection.

```typescript
class JestAgentWrapper {
  constructor(config?: JestAgentWrapperConfig);
  
  // Session Management
  async startSession(config?: JestConfig): Promise<TestSession>;
  async runTests(pattern?: string): Promise<TestSession>;
  async stopSession(): Promise<void>;
  
  // Real-time Monitoring
  onTestStart(callback: (test: TestCase) => void): void;
  onTestComplete(callback: (test: TestCase) => void): void;
  onAssertion(callback: (assertion: Assertion) => void): void;
  onLog(callback: (log: LogEntry) => void): void;
  
  // Query Interface
  async getSession(id: string): Promise<TestSession>;
  async getFailedTests(sessionId?: string): Promise<TestCase[]>;
  async searchLogs(query: LogQuery): Promise<LogEntry[]>;
  async getTestHistory(testName: string): Promise<TestCase[]>;
}
```

### Configuration

```typescript
interface JestAgentWrapperConfig {
  // Storage Configuration
  storage: 'sqlite' | 'json' | 'memory';
  dbPath?: string;
  
  // Event Collection
  collectConsole: boolean;
  collectCoverage: boolean;
  collectPerformance: boolean;
  collectStackTraces: boolean;
  
  // Real-time Features
  realTimeEvents: boolean;
  eventBufferSize: number;
  
  // Agent Features
  enableSuggestions: boolean;
  enablePatternRecognition: boolean;
  enableTrendAnalysis: boolean;
}
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent Code    │───▶│  JAW Wrapper    │───▶│  Storage Layer  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Jest Runtime   │    │  Query Engine   │
                       └─────────────────┘    └─────────────────┘
```

## Components

- **EventCollector**: Captures all Jest events and transforms them
- **StorageEngine**: SQLite-based persistence layer
- **QueryEngine**: Powerful query interface for test data
- **JestAgentReporter**: Jest reporter integration
- **AgentTDDHelper**: TDD workflow assistance for AI agents
- **ErrorPatternAnalyzer**: Intelligent error analysis and suggestions
- **PerformanceAnalyzer**: Test performance tracking and analysis

## Development

### Running Tests

```bash
npm test
```

### Project Structure

```
jester/
├── src/
│   ├── core/           # Core wrapper and event collection
│   ├── storage/        # Database and query engines
│   ├── reporter/       # Jest reporter integration
│   ├── agents/         # AI agent helpers
│   ├── analytics/      # Analysis and pattern recognition
│   ├── cli/           # Command-line interface
│   └── utils/         # Utility functions
├── test/              # Comprehensive test suite
└── docs/              # Documentation
```

## Benefits for AI Agents

1. **Structured Data**: All test information in queryable, typed objects
2. **Historical Context**: Complete test history for pattern recognition
3. **Real-time Feedback**: Immediate structured feedback during test runs
4. **Error Intelligence**: Categorized errors with suggested fixes
5. **Performance Insights**: Test duration trends and bottlenecks
6. **Coverage Awareness**: Detailed coverage data for informed development
7. **Debugging Support**: Rich context for failure analysis

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass and maintain the existing code style.

## Support

For issues and questions, please open an issue in the repository.