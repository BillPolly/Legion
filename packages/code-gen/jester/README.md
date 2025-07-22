# @jsenvoy/jester

> Jest execution management utility with comprehensive logging and querying capabilities

## Overview

Jester is a specialized utility designed to solve the complexities of programmatic Jest test execution. It provides complete visibility into test execution, including temporal correlation of console logs, structured error reporting, and a powerful query interface for analysis.

## Key Features

- **Complete Test Lifecycle Tracking**: Captures all Jest events with precise timestamps
- **Console Log Correlation**: Links console output to specific tests and test phases
- **Structured Storage**: SQLite database for all execution data
- **Powerful Query API**: Analyze test results, patterns, and trends
- **Open Handle Detection**: Track and debug resource leaks
- **Performance Metrics**: Identify slow tests and bottlenecks

## Installation

```bash
npm install @jsenvoy/jester
```

## Usage

```javascript
import { JesterRunner } from '@jsenvoy/jester';

// Create runner instance
const runner = new JesterRunner({
  projectPath: './my-project',
  databasePath: './test-results.db'
});

// Run tests
const runId = await runner.runTests({
  testPattern: '**/*.test.js',
  coverage: true
});

// Query results
const results = await runner.query.getRunSummary(runId);
const failingTests = await runner.query.getFailingTests(runId);
```

## Documentation

- [Design Document](./docs/design.md) - Comprehensive architecture and design details
- [Development Plan](./docs/development-plan.md) - TDD development roadmap

## License

MIT