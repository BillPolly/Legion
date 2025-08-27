# Jest Agent Wrapper - Comprehensive Design

## Overview

The Jest Agent Wrapper (JAW) is a sophisticated testing framework wrapper designed to make Jest output agent-friendly by transforming raw console output into structured, timestamped, queryable data. This system enables AI coding agents to effectively practice Test-Driven Development (TDD) with clear visibility into test states, failures, and execution history.

## Core Problems Solved

- **Unstructured Output**: Jest's console output is human-readable but difficult for agents to parse
- **Poor Failure Analysis**: Error messages and stack traces are scattered across console logs
- **No Historical Context**: Previous test runs are lost, making it hard to track progress
- **Limited Queryability**: No way to search or filter test results programmatically
- **Timestamp Confusion**: Events aren't properly ordered or timestamped for analysis

## Architecture Overview

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

## Core Components

### 1. Test Session Manager
**Responsibility**: Orchestrates test execution and maintains session state

**Key Features**:
- Creates unique session IDs for each test run
- Manages test lifecycle (setup, execution, teardown)
- Coordinates between Jest and storage systems
- Handles parallel test execution tracking

### 2. Event Collector
**Responsibility**: Captures all Jest events and transforms them into structured data

**Event Types Captured**:
- Test suite discovery
- Individual test starts/completions
- Assertion results (pass/fail)
- Console outputs (logs, warnings, errors)
- Coverage data
- Performance metrics
- Setup/teardown events

### 3. Data Transformer
**Responsibility**: Converts Jest's raw output into agent-friendly objects

**Transformations**:
- Stack traces → structured error objects with file/line references
- Console logs → categorized and timestamped log entries
- Test results → normalized result objects
- Coverage reports → queryable coverage data

### 4. Storage Engine
**Responsibility**: Persists all test data with efficient querying capabilities

**Storage Options**:
- **SQLite Database**: For complex queries and relational data
- **JSON Log Files**: For simple implementations and portability
- **Time-series Database**: For performance-focused implementations

### 5. Query Interface
**Responsibility**: Provides agent-friendly APIs to access test data

**Query Capabilities**:
- Find failing tests by error type
- Get test history for specific files
- Search console logs by content/level
- Filter tests by duration, status, or tags
- Generate test reports and summaries

## Data Models

### TestSession
```typescript
interface TestSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  jestConfig: JestConfig;
  environment: EnvironmentInfo;
  summary: TestSummary;
}
```

### TestSuite
```typescript
interface TestSuite {
  sessionId: string;
  path: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  tests: TestCase[];
  setupDuration: number;
  teardownDuration: number;
}
```

### TestCase
```typescript
interface TestCase {
  sessionId: string;
  suiteId: string;
  name: string;
  fullName: string;
  startTime: Date;
  endTime?: Date;
  status: 'passed' | 'failed' | 'skipped' | 'todo';
  duration: number;
  assertions: Assertion[];
  errors: TestError[];
  logs: LogEntry[];
}
```

### Assertion
```typescript
interface Assertion {
  testId: string;
  timestamp: Date;
  type: 'expect' | 'custom';
  matcher: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  message?: string;
  stackTrace?: StackFrame[];
}
```

### LogEntry
```typescript
interface LogEntry {
  sessionId: string;
  testId?: string;
  timestamp: Date;
  level: 'log' | 'warn' | 'error' | 'debug' | 'info';
  message: string;
  source: 'test' | 'system' | 'jest';
  metadata?: Record<string, any>;
}
```

### TestError
```typescript
interface TestError {
  testId: string;
  timestamp: Date;
  type: 'assertion' | 'runtime' | 'timeout' | 'setup' | 'teardown';
  message: string;
  stackTrace: StackFrame[];
  location: FileLocation;
  suggestion?: string;
}
```

## API Design

### Core Wrapper API

```typescript
class JestAgentWrapper {
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

### Query API

```typescript
interface QueryEngine {
  // Test Queries
  findTests(criteria: TestCriteria): Promise<TestCase[]>;
  getTestsByFile(filePath: string): Promise<TestCase[]>;
  getTestsByStatus(status: TestStatus): Promise<TestCase[]>;
  
  // Error Analysis
  getErrorsByType(errorType: string): Promise<TestError[]>;
  getMostCommonErrors(): Promise<ErrorSummary[]>;
  getErrorTrends(timeRange: TimeRange): Promise<ErrorTrend[]>;
  
  // Performance Analysis
  getSlowestTests(limit: number): Promise<TestCase[]>;
  getTestDurationTrends(testName: string): Promise<DurationTrend[]>;
  
  // Coverage Analysis
  getCoverageByFile(filePath: string): Promise<CoverageData>;
  getUncoveredLines(): Promise<UncoveredLine[]>;
}
```

## Storage Schema

### SQLite Implementation

```sql
-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  start_time DATETIME,
  end_time DATETIME,
  status TEXT,
  config JSON,
  summary JSON
);

-- Test Suites
CREATE TABLE test_suites (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  path TEXT,
  name TEXT,
  start_time DATETIME,
  end_time DATETIME,
  status TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Test Cases
CREATE TABLE test_cases (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  suite_id TEXT,
  name TEXT,
  full_name TEXT,
  start_time DATETIME,
  end_time DATETIME,
  status TEXT,
  duration INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (suite_id) REFERENCES test_suites(id)
);

-- Assertions
CREATE TABLE assertions (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  timestamp DATETIME,
  type TEXT,
  matcher TEXT,
  passed BOOLEAN,
  actual TEXT,
  expected TEXT,
  message TEXT,
  FOREIGN KEY (test_id) REFERENCES test_cases(id)
);

-- Logs
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  test_id TEXT,
  timestamp DATETIME,
  level TEXT,
  message TEXT,
  source TEXT,
  metadata JSON,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (test_id) REFERENCES test_cases(id)
);

-- Errors
CREATE TABLE errors (
  id TEXT PRIMARY KEY,
  test_id TEXT,
  timestamp DATETIME,
  type TEXT,
  message TEXT,
  stack_trace JSON,
  location JSON,
  suggestion TEXT,
  FOREIGN KEY (test_id) REFERENCES test_cases(id)
);
```

## Integration Patterns

### 1. Jest Plugin Integration
```typescript
// jest.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-agent-wrapper', {
      storage: 'sqlite',
      dbPath: './test-results.db',
      realTimeEvents: true
    }]
  ]
};
```

### 2. Programmatic Integration
```typescript
import { JestAgentWrapper } from 'jest-agent-wrapper';

const jaw = new JestAgentWrapper({
  storage: 'sqlite',
  dbPath: './test-results.db'
});

// Run tests with structured output
const session = await jaw.runTests('src/**/*.test.js');

// Query results
const failedTests = await jaw.getFailedTests(session.id);
const errors = await jaw.getErrorsByType('assertion');
```

### 3. CLI Wrapper
```bash
# Replace jest with jaw
jaw run src/**/*.test.js --storage sqlite --output test-results.db

# Query previous results
jaw query --failed --since "1 hour ago"
jaw query --errors --type assertion
jaw query --slow --limit 10
```

## Agent Integration Examples

### TDD Workflow Enhancement

```typescript
class AgentTDDHelper {
  constructor(private jaw: JestAgentWrapper) {}
  
  async runTDDCycle(testFile: string) {
    // 1. Run tests and analyze failures
    const session = await this.jaw.runTests(testFile);
    const failures = await this.jaw.getFailedTests(session.id);
    
    if (failures.length === 0) {
      return { status: 'green', message: 'All tests passing' };
    }
    
    // 2. Analyze failure patterns
    const errorSummary = await this.analyzeFailures(failures);
    
    // 3. Generate implementation suggestions
    const suggestions = await this.generateImplementationHints(errorSummary);
    
    return {
      status: 'red',
      failures: failures.length,
      suggestions,
      nextActions: this.prioritizeActions(failures)
    };
  }
  
  async analyzeTestHistory(testName: string) {
    const history = await this.jaw.getTestHistory(testName);
    return {
      totalRuns: history.length,
      successRate: history.filter(t => t.status === 'passed').length / history.length,
      averageDuration: history.reduce((sum, t) => sum + t.duration, 0) / history.length,
      commonErrors: await this.findCommonErrorPatterns(history)
    };
  }
}
```

### Intelligent Test Debugging

```typescript
class TestDebugger {
  async diagnoseFailure(testId: string) {
    const test = await this.jaw.getTestCase(testId);
    const errors = test.errors;
    const logs = test.logs;
    
    const diagnosis = {
      primaryError: errors[0],
      errorCategory: this.categorizeError(errors[0]),
      relevantLogs: logs.filter(log => this.isRelevantToError(log, errors[0])),
      suggestedFixes: await this.generateFixes(errors[0]),
      relatedFailures: await this.findSimilarFailures(errors[0])
    };
    
    return diagnosis;
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Basic event collection from Jest
- SQLite storage implementation
- Simple query interface
- CLI wrapper for basic usage

### Phase 2: Advanced Analytics
- Error pattern recognition
- Performance trend analysis
- Test history tracking
- Coverage integration

### Phase 3: Agent Intelligence
- Failure diagnosis system
- Automated suggestion engine
- TDD workflow optimization
- Integration with popular AI coding tools

### Phase 4: Ecosystem Integration
- IDE plugins
- CI/CD integration
- Dashboard and reporting UI
- Team collaboration features

## Configuration Options

```typescript
interface JestAgentWrapperConfig {
  // Storage Configuration
  storage: 'sqlite' | 'json' | 'memory';
  dbPath?: string;
  jsonPath?: string;
  
  // Event Collection
  collectConsole: boolean;
  collectCoverage: boolean;
  collectPerformance: boolean;
  collectStackTraces: boolean;
  
  // Real-time Features
  realTimeEvents: boolean;
  eventBufferSize: number;
  
  // Query Optimization
  indexFields: string[];
  retentionDays?: number;
  
  // Agent Features
  enableSuggestions: boolean;
  enablePatternRecognition: boolean;
  enableTrendAnalysis: boolean;
}
```

## Benefits for AI Agents

1. **Structured Data**: All test information in queryable, typed objects
2. **Historical Context**: Complete test history for pattern recognition
3. **Real-time Feedback**: Immediate structured feedback during test runs
4. **Error Intelligence**: Categorized errors with suggested fixes
5. **Performance Insights**: Test duration trends and performance bottlenecks
6. **Coverage Awareness**: Detailed coverage data for informed development
7. **Debugging Support**: Rich context for failure analysis

## Success Metrics

- **Reduced Debug Time**: Faster identification of test failures
- **Improved TDD Adoption**: Better agent understanding of test-first development
- **Higher Test Quality**: More comprehensive test coverage and better test design
- **Faster Development Cycles**: Quicker iteration between red-green-refactor cycles
- **Better Error Resolution**: More accurate diagnosis and fixing of test failures

This design provides a comprehensive foundation for building an agent-friendly Jest wrapper that transforms the testing experience from console-based to data-driven, enabling AI agents to excel at test-driven development.