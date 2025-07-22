# Jester Design Document

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Architecture](#architecture)
5. [Core Components](#core-components)
6. [Database Schema](#database-schema)
7. [API Design](#api-design)
8. [Event Flow](#event-flow)
9. [Console Correlation Strategy](#console-correlation-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Error Handling](#error-handling)
12. [Future Enhancements](#future-enhancements)

## Executive Summary

Jester is a Jest execution management utility that provides complete visibility into test execution, including temporal correlation of console logs, structured error reporting, and a powerful query interface for analysis. It solves the fundamental problem of understanding what happens during test execution by capturing all events, console output, and test results in a queryable format.

## Problem Statement

Current Jest test execution has several critical limitations:

1. **Console Output Ambiguity**: Console logs appear in a jumbled stream, making it impossible to determine which test generated which output
2. **Temporal Blindness**: No clear timeline of when events occurred during test execution
3. **Limited Queryability**: Cannot easily query test results, find patterns, or analyze failures
4. **Resource Leak Detection**: Difficult to identify which tests leave open handles
5. **Performance Analysis**: No easy way to identify slow tests or performance bottlenecks
6. **Error Context Loss**: Stack traces and error contexts are difficult to correlate with specific test failures

## Solution Overview

Jester provides a comprehensive solution through:

1. **Custom Jest Reporter**: Captures all Jest events with precise timestamps
2. **Console Interception**: Correlates console output with specific tests using AsyncLocalStorage
3. **SQLite Storage**: Structured storage for all execution data
4. **Query API**: Powerful interface for analyzing test results
5. **Execution Management**: Programmatic Jest execution with full configuration control

## Architecture

### High-Level Architecture

```
┌─────────────────────┐
│   Client Code       │
│  (Test Runner)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   JesterRunner      │ ◄─── Main API Interface
├─────────────────────┤
│ - runTests()        │
│ - query.*           │
│ - getRunSummary()   │
└──────────┬──────────┘
           │
           ├────────────────────┬────────────────────┐
           ▼                    ▼                    ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  JestExecutor       │ │ ConsoleCapture   │ │ DatabaseManager  │
├─────────────────────┤ ├─────────────────┤ ├─────────────────┤
│ - spawn Jest        │ │ - intercept()    │ │ - SQLite ops     │
│ - config mgmt       │ │ - correlate()    │ │ - migrations     │
│ - process control   │ │ - restore()      │ │ - queries        │
└─────────────────────┘ └─────────────────┘ └─────────────────┘
           │                    │                    │
           └────────────────────┴────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  JesterReporter     │
                    ├─────────────────────┤
                    │ - onRunStart        │
                    │ - onTestStart       │
                    │ - onTestResult      │
                    │ - onRunComplete     │
                    └─────────────────────┘
```

### Component Interactions

```
Test Execution Flow:
1. Client → JesterRunner.runTests()
2. JesterRunner → DatabaseManager.createRun()
3. JesterRunner → ConsoleCapture.setup()
4. JesterRunner → JestExecutor.execute()
5. Jest Process → JesterReporter (via IPC)
6. JesterReporter → DatabaseManager.recordEvent()
7. Console Output → ConsoleCapture → DatabaseManager
8. Jest Process Complete → JesterRunner.finalize()
```

## Core Components

### 1. JesterRunner (src/JesterRunner.js)

The main entry point providing the public API:

```javascript
class JesterRunner {
  constructor(options) {
    this.projectPath = options.projectPath;
    this.databasePath = options.databasePath;
    this.db = new DatabaseManager(this.databasePath);
    this.executor = new JestExecutor();
    this.consoleCapture = new ConsoleCapture();
    this.query = new QueryAPI(this.db);
  }

  async runTests(options) {
    // Create run record
    const runId = await this.db.createRun(options);
    
    // Setup console capture
    await this.consoleCapture.setup(runId);
    
    // Execute Jest with custom reporter
    const result = await this.executor.execute({
      ...options,
      reporters: [[path.join(__dirname, 'JesterReporter.js'), { runId, db: this.databasePath }]]
    });
    
    // Finalize and return
    await this.consoleCapture.teardown();
    return runId;
  }
}
```

### 2. JesterReporter (src/JesterReporter.js)

Custom Jest reporter that captures all test events:

```javascript
class JesterReporter {
  constructor(globalConfig, options) {
    this.runId = options.runId;
    this.db = new DatabaseManager(options.db);
  }

  onRunStart(results, options) {
    this.db.recordEvent({
      runId: this.runId,
      type: 'run_start',
      timestamp: Date.now(),
      data: { numTotalTestSuites: results.numTotalTestSuites }
    });
  }

  onTestStart(test) {
    // Set AsyncLocalStorage context for console correlation
    testContext.run({ testPath: test.path }, () => {
      this.db.recordEvent({
        runId: this.runId,
        type: 'test_start',
        timestamp: Date.now(),
        testPath: test.path
      });
    });
  }

  onTestResult(test, testResult, aggregatedResult) {
    this.db.recordTestResult({
      runId: this.runId,
      testPath: test.path,
      duration: testResult.perfStats.runtime,
      status: testResult.numFailingTests > 0 ? 'failed' : 'passed',
      failures: testResult.testResults.filter(t => t.status === 'failed'),
      console: testResult.console
    });
  }
}
```

### 3. ConsoleCapture (src/ConsoleCapture.js)

Intercepts and correlates console output:

```javascript
class ConsoleCapture {
  constructor() {
    this.originalConsole = {};
    this.asyncLocalStorage = new AsyncLocalStorage();
  }

  setup(runId) {
    const methods = ['log', 'error', 'warn', 'info', 'debug'];
    
    methods.forEach(method => {
      this.originalConsole[method] = console[method];
      
      console[method] = (...args) => {
        const timestamp = Date.now();
        const context = this.asyncLocalStorage.getStore();
        
        // Record to database with context
        this.db.recordConsole({
          runId,
          method,
          timestamp,
          message: util.format(...args),
          testPath: context?.testPath,
          testName: context?.testName,
          stackTrace: new Error().stack
        });
        
        // Call original
        this.originalConsole[method](...args);
      };
    });
  }
}
```

### 4. DatabaseManager (src/DatabaseManager.js)

Manages SQLite database operations:

```javascript
class DatabaseManager {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  async createRun(options) {
    const runId = uuidv4();
    await this.db.run(`
      INSERT INTO runs (id, created_at, options)
      VALUES (?, ?, ?)
    `, [runId, Date.now(), JSON.stringify(options)]);
    return runId;
  }

  async recordEvent(event) {
    await this.db.run(`
      INSERT INTO events (run_id, type, timestamp, data)
      VALUES (?, ?, ?, ?)
    `, [event.runId, event.type, event.timestamp, JSON.stringify(event.data)]);
  }
}
```

### 5. QueryAPI (src/QueryAPI.js)

Provides high-level query interface:

```javascript
class QueryAPI {
  constructor(db) {
    this.db = db;
  }

  async getRunSummary(runId) {
    const summary = await this.db.get(`
      SELECT 
        r.*,
        COUNT(DISTINCT t.test_path) as total_test_files,
        COUNT(t.id) as total_tests,
        SUM(CASE WHEN t.status = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(t.duration) as avg_duration
      FROM runs r
      LEFT JOIN tests t ON r.id = t.run_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [runId]);
    
    return summary;
  }

  async getFailingTests(runId) {
    return this.db.all(`
      SELECT t.*, f.error_message, f.stack_trace
      FROM tests t
      JOIN failures f ON t.id = f.test_id
      WHERE t.run_id = ? AND t.status = 'failed'
      ORDER BY t.test_path, t.test_name
    `, [runId]);
  }

  async getTestConsoleOutput(runId, testPath) {
    return this.db.all(`
      SELECT * FROM console_logs
      WHERE run_id = ? AND test_path = ?
      ORDER BY timestamp
    `, [runId, testPath]);
  }
}
```

## Database Schema

### Tables

#### runs
- `id` (TEXT PRIMARY KEY) - UUID
- `created_at` (INTEGER) - Unix timestamp
- `completed_at` (INTEGER) - Unix timestamp
- `options` (TEXT) - JSON configuration
- `status` (TEXT) - 'running', 'completed', 'failed'
- `summary` (TEXT) - JSON summary stats

#### events
- `id` (INTEGER PRIMARY KEY)
- `run_id` (TEXT FOREIGN KEY)
- `type` (TEXT) - Event type
- `timestamp` (INTEGER) - Unix timestamp
- `data` (TEXT) - JSON event data

#### tests
- `id` (INTEGER PRIMARY KEY)
- `run_id` (TEXT FOREIGN KEY)
- `test_path` (TEXT) - File path
- `test_name` (TEXT) - Test description
- `suite_name` (TEXT) - Describe block
- `started_at` (INTEGER) - Unix timestamp
- `completed_at` (INTEGER) - Unix timestamp
- `duration` (INTEGER) - Milliseconds
- `status` (TEXT) - 'passed', 'failed', 'skipped'
- `retry_count` (INTEGER)

#### failures
- `id` (INTEGER PRIMARY KEY)
- `test_id` (INTEGER FOREIGN KEY)
- `error_message` (TEXT)
- `stack_trace` (TEXT)
- `diff` (TEXT) - Expected vs actual

#### console_logs
- `id` (INTEGER PRIMARY KEY)
- `run_id` (TEXT FOREIGN KEY)
- `test_path` (TEXT)
- `test_name` (TEXT)
- `timestamp` (INTEGER)
- `level` (TEXT) - 'log', 'error', 'warn', etc.
- `message` (TEXT)
- `stack_trace` (TEXT)

#### open_handles
- `id` (INTEGER PRIMARY KEY)
- `run_id` (TEXT FOREIGN KEY)
- `test_path` (TEXT)
- `type` (TEXT) - Handle type
- `stack_trace` (TEXT)
- `details` (TEXT) - JSON details

### Indexes
- `idx_runs_created` ON runs(created_at)
- `idx_events_run_timestamp` ON events(run_id, timestamp)
- `idx_tests_run_status` ON tests(run_id, status)
- `idx_console_run_test` ON console_logs(run_id, test_path)

## API Design

### Primary API

```javascript
// Create runner
const runner = new JesterRunner({
  projectPath: './my-project',
  databasePath: './test-results.db'
});

// Run tests
const runId = await runner.runTests({
  testPattern: '**/*.test.js',
  coverage: true,
  maxWorkers: 4,
  timeout: 30000
});

// Query results
const summary = await runner.query.getRunSummary(runId);
const failures = await runner.query.getFailingTests(runId);
const slowTests = await runner.query.getSlowTests(runId, { threshold: 1000 });
const console = await runner.query.getTestConsoleOutput(runId, 'src/foo.test.js');
```

### Query Methods

```javascript
// Run queries
query.getRunSummary(runId)
query.getRuns({ limit: 10, status: 'completed' })
query.getRunComparison(runId1, runId2)

// Test queries
query.getTests(runId, { status: 'failed' })
query.getTestHistory(testPath, { limit: 10 })
query.getFlakeyTests({ threshold: 0.8, minRuns: 5 })

// Console queries
query.getConsoleOutput(runId, { level: 'error' })
query.getTestConsoleOutput(runId, testPath)
query.searchConsole(runId, 'search term')

// Performance queries
query.getSlowTests(runId, { threshold: 1000 })
query.getTestDurations(runId)
query.getPerformanceTrends(testPath)

// Error queries
query.getFailures(runId)
query.getErrorPatterns(runId)
query.getStackTraces(runId, errorMessage)
```

## Event Flow

### Test Execution Timeline

```
Timeline                    Event                          Context
--------                    -----                          -------
T+0ms      ──────►  runTests() called                    Client
T+10ms     ──────►  Run record created                   Database
T+20ms     ──────►  Console capture setup                ConsoleCapture
T+30ms     ──────►  Jest process spawned                 JestExecutor
T+40ms     ──────►  onRunStart                          JesterReporter
T+50ms     ──────►  Test file 1 loaded                  Jest
T+60ms     ──────►  onTestStart(test1)                  JesterReporter
T+61ms     ──────►  AsyncLocal context set              ConsoleCapture
T+70ms     ──────►  console.log('test')                 Test Code
T+71ms     ──────►  Console captured w/ context         Database
T+100ms    ──────►  onTestResult(test1, passed)         JesterReporter
T+110ms    ──────►  onTestStart(test2)                  JesterReporter
T+150ms    ──────►  onTestResult(test2, failed)         JesterReporter
T+200ms    ──────►  onRunComplete                       JesterReporter
T+210ms    ──────►  Console capture teardown            ConsoleCapture
T+220ms    ──────►  Run marked complete                 Database
T+230ms    ──────►  runId returned                      Client
```

## Console Correlation Strategy

### The Challenge

Jest runs tests in parallel workers, making console correlation complex:
- Multiple tests run simultaneously
- Console output from different tests interleaves
- Worker processes complicate context tracking

### The Solution

1. **AsyncLocalStorage Context**
   ```javascript
   // In JesterReporter.onTestStart
   testContext.run({ 
     testPath: test.path,
     testName: currentTest.name,
     workerId: process.env.JEST_WORKER_ID
   }, () => {
     // Test execution happens in this context
   });
   ```

2. **Console Interception**
   ```javascript
   console.log = (...args) => {
     const context = asyncLocalStorage.getStore();
     db.recordConsole({
       testPath: context?.testPath,
       testName: context?.testName,
       workerId: context?.workerId,
       message: util.format(...args),
       timestamp: Date.now()
     });
   };
   ```

3. **Worker Communication**
   - Each worker maintains its own AsyncLocalStorage
   - Context passed via Jest's worker communication
   - Correlation happens at storage layer

## Performance Considerations

### 1. Database Performance
- Use WAL mode for better concurrency
- Batch inserts where possible
- Prepared statements for frequent queries
- Indexes on commonly queried fields

### 2. Console Capture Overhead
- Minimal overhead (< 1ms per console call)
- Async writes to not block test execution
- Configurable capture levels

### 3. Memory Management
- Stream large result sets
- Configurable retention policies
- Automatic cleanup of old runs

### 4. Process Management
- Proper cleanup of Jest processes
- Handle SIGINT/SIGTERM gracefully
- Timeout handling for hung tests

## Error Handling

### 1. Database Errors
- Automatic retry with exponential backoff
- Graceful degradation (tests still run)
- Error logging to separate file

### 2. Jest Process Errors
- Capture stderr output
- Handle process crashes
- Timeout management

### 3. Console Capture Errors
- Fallback to original console
- Error boundary around interception
- Restore on any failure

## Future Enhancements

### Phase 1 (Current)
- ✓ Basic test execution and recording
- ✓ Console correlation
- ✓ SQLite storage
- ✓ Core query API

### Phase 2
- [ ] Web UI for result visualization
- [ ] Real-time test monitoring
- [ ] Diff visualization for failures
- [ ] Coverage integration

### Phase 3
- [ ] Distributed test execution
- [ ] Cloud storage backends
- [ ] AI-powered failure analysis
- [ ] Flake detection algorithms

### Phase 4
- [ ] IDE integrations
- [ ] CI/CD platform plugins
- [ ] Performance regression detection
- [ ] Test impact analysis

## Security Considerations

1. **Database Security**
   - File permissions on SQLite database
   - No sensitive data in console capture
   - Configurable log sanitization

2. **Process Security**
   - Run Jest in sandboxed environment
   - Limit resource consumption
   - Validate all inputs

3. **API Security**
   - Input validation on all queries
   - SQL injection prevention
   - Rate limiting for API calls

## Conclusion

Jester provides a comprehensive solution for Jest test execution management by:
1. Capturing complete test execution timeline
2. Correlating console output with specific tests
3. Storing all data in queryable format
4. Providing powerful analysis capabilities

This design enables developers to gain deep insights into test execution, debug failures more effectively, and maintain high-quality test suites.