# LogManager Package Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Usage Guide](#usage-guide)
5. [Advanced Features](#advanced-features)
6. [Integration Patterns](#integration-patterns)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Overview

The `@jsenvoy/log-manager` package is a comprehensive log management solution designed for AI agents and Node.js applications. It provides real-time log capture, intelligent analysis, and flexible export capabilities, making it ideal for monitoring, debugging, and understanding application behavior.

### Key Capabilities

- **Multi-Source Log Capture**: Ingest logs from files, streams, and processes simultaneously
- **Real-Time Streaming**: Stream logs via WebSocket or Server-Sent Events (SSE)
- **Intelligent Analysis**: Detect patterns, errors, and performance metrics
- **Flexible Export**: Export logs in JSON, CSV, HTML, TXT, and JSONL formats
- **Error Monitoring**: Real-time error detection with configurable thresholds
- **Log Aggregation**: Correlate and group logs from multiple sources

## Architecture

The LogManager follows a modular architecture with specialized components:

```
┌─────────────────┐
│   LogManager    │ ← Main orchestrator
└────────┬────────┘
         │
    ┌────┴────────────────────────────────────┐
    │                                          │
┌───▼────────┐  ┌─────────────┐  ┌───────────▼───┐
│ LogCapture │  │LogAggregator│  │  LogAnalyzer  │
└────┬───────┘  └──────┬──────┘  └───────┬───────┘
     │                 │                   │
┌────▼────┐     ┌──────▼──────┐   ┌──────▼──────┐
│ Sources │     │ Correlation │   │  Patterns   │
│ • File  │     │   Groups    │   │   Errors    │
│ • Stream│     │  Buffering  │   │ Performance │
│ • Process     └─────────────┘   └─────────────┘
└─────────┘
     │
┌────▼────────────────────────────────────────┐
│         LogStreamer & LogExporter           │
│ • WebSocket  • SSE  • JSON  • CSV  • HTML   │
└─────────────────────────────────────────────┘
```

## Core Components

### 1. LogCapture

The LogCapture component handles ingestion from multiple sources with automatic log parsing and level detection.

#### Features:
- **Stream Capture**: Captures from Node.js readable streams (stdout, stderr)
- **File Capture**: Follows log files with tail-like functionality
- **Process Capture**: Captures both stdout and stderr from child processes
- **Buffer Management**: Configurable circular buffers for memory efficiency
- **Automatic Parsing**: Detects log levels and timestamps automatically

#### Key Methods:
```javascript
// Capture from a stream
captureStream(sourceId, stream, options)

// Capture from a file
captureFile(sourceId, filePath, options)

// Capture from a process
captureProcess(sourceId, processInfo, options)

// Stop capturing
stopCapture(sourceId)

// Get buffered logs
getBufferedLogs(sourceId, options)
```

### 2. LogAggregator

The LogAggregator combines logs from multiple sources with correlation capabilities.

#### Features:
- **Multi-Source Aggregation**: Combines logs from different sources
- **Correlation**: Groups related logs by custom keys (e.g., sessionId, requestId)
- **Time-Based Grouping**: Groups logs within time windows
- **Circular Buffer**: Memory-efficient storage with configurable size
- **Metadata Tracking**: Maintains statistics per aggregation

#### Key Methods:
```javascript
// Create an aggregation
createAggregation(aggregationId, options)

// Add log to aggregation
addLog(logEntry)

// Get aggregated logs
getAggregatedLogs(aggregationId, options)

// Get correlation groups
getCorrelationGroups(aggregationId)
```

### 3. LogAnalyzer

The LogAnalyzer provides intelligent analysis of log data.

#### Features:
- **Pattern Detection**: Identifies common patterns in log messages
- **Error Analysis**: Clusters similar errors and calculates error rates
- **Performance Metrics**: Extracts response times, memory usage, CPU stats
- **Time-Based Analysis**: Analyzes trends over time buckets
- **Severity Distribution**: Tracks log level distribution

#### Analysis Capabilities:

**Pattern Detection:**
- Component patterns: `[ComponentName]`, `(ModuleName)`
- Timestamp patterns: ISO 8601, Unix timestamps
- Common log formats: Apache, Nginx, custom formats

**Error Clustering:**
- Groups similar error messages
- Identifies error hotspots
- Tracks error frequency and trends

**Performance Extraction:**
- Response times: `completed in 123ms`
- Memory usage: `memory: 456MB`
- CPU usage: `cpu: 78%`
- Request rates and throughput

### 4. LogExporter

The LogExporter handles exporting logs to various formats.

#### Supported Formats:
- **JSON**: Pretty-printed or compact, with metadata
- **CSV**: Tabular format with customizable columns
- **TXT**: Plain text with configurable formatting
- **HTML**: Interactive HTML reports with styling
- **JSONL**: JSON Lines format for streaming

#### Features:
- **Streaming Export**: Memory-efficient for large datasets
- **Filtering**: Export only specific logs based on criteria
- **Metadata Inclusion**: Optionally include analysis metadata
- **Custom Formatting**: Configure output format per export type

### 5. LogStreamer

The LogStreamer enables real-time log streaming to clients.

#### Features:
- **WebSocket Streaming**: Real-time bidirectional streaming
- **Server-Sent Events**: Unidirectional streaming for web clients
- **Stream Management**: Create, pause, resume, and stop streams
- **Filtering**: Apply filters to streams dynamically
- **Backpressure Handling**: Manages slow consumers
- **Format Options**: Stream as JSON, text, or custom formats

## Usage Guide

### Basic Setup

```javascript
import LogManager from '@jsenvoy/log-manager';

const logManager = new LogManager({
  defaultBufferSize: 1000,
  realtimeStreaming: true
});
```

### Capturing Logs

#### From a File
```javascript
await logManager.captureLogs({
  source: {
    type: 'file',
    id: 'app-logs',
    path: '/var/log/application.log',
    fromBeginning: true  // Start from beginning of file
  },
  bufferSize: 2000,
  follow: true  // Continue following file changes
});
```

#### From a Process
```javascript
const childProcess = spawn('node', ['app.js']);

await logManager.captureLogs({
  source: {
    type: 'process',
    id: 'node-app',
    pid: childProcess.pid,
    stdout: childProcess.stdout,
    stderr: childProcess.stderr
  }
});
```

#### From a Stream
```javascript
await logManager.captureLogs({
  source: {
    type: 'stream',
    id: 'custom-stream',
    stream: myReadableStream,
    streamType: 'stdout'
  }
});
```

### Searching and Filtering

```javascript
// Search with regex pattern
const results = await logManager.searchLogs('error|exception|failed', {
  sources: ['app-logs'],
  limit: 100,
  caseSensitive: false
});

// Filter by criteria
const filtered = await logManager.filterLogs({
  criteria: {
    level: 'error',
    startTime: new Date('2024-01-01'),
    endTime: new Date('2024-01-02'),
    contains: 'database'
  },
  sources: ['app-logs', 'db-logs']
});
```

### Real-Time Streaming

#### WebSocket Streaming
```javascript
// Create a stream
const stream = await logManager.streamLogs({
  streamId: 'error-monitor',
  sources: ['app-logs'],
  levels: ['error', 'fatal'],
  realtime: true
});

// In your WebSocket handler
ws.on('connection', (socket) => {
  logManager.streamer.createWebSocketStream(stream.streamId, socket, {
    format: 'json'
  });
});
```

#### Server-Sent Events
```javascript
// In your Express route
app.get('/logs/stream', (req, res) => {
  const stream = await logManager.streamLogs({
    sources: ['app-logs'],
    levels: req.query.levels?.split(',')
  });

  logManager.streamer.createSSEStream(stream.streamId, res, {
    format: 'text'
  });
});
```

### Analysis

```javascript
// Comprehensive analysis
const analysis = await logManager.analyzeLogs({
  sources: ['app-logs', 'nginx-logs'],
  includePatterns: true,
  includeErrors: true,
  includePerformance: true
});

// Results include:
console.log('Total logs:', analysis.summary.totalLogs);
console.log('Error rate:', analysis.errors.rate);
console.log('Common patterns:', analysis.patterns);
console.log('Avg response time:', analysis.performance.statistics.responseTime.avg);
```

### Error Monitoring

```javascript
// Set up error monitoring
const monitoring = await logManager.monitorErrors({
  sources: ['production-logs'],
  threshold: 10,  // Alert if more than 10 errors
  windowMs: 300000,  // Within 5 minutes
  includePatterns: ['database', 'connection']
});

// Listen for alerts
logManager.on('error-alert', (alert) => {
  console.log('Error threshold exceeded!');
  console.log(`${alert.count} errors in ${alert.window}ms`);
  console.log('Recent errors:', alert.recentErrors);
  
  // Take action: send notification, scale resources, etc.
});
```

### Exporting Logs

```javascript
// Export to JSON with metadata
await logManager.exportLogs('./logs/analysis.json', {
  format: 'json',
  sources: ['app-logs'],
  pretty: true,
  includeMetadata: true
});

// Export errors to CSV
await logManager.exportLogs('./logs/errors.csv', {
  format: 'csv',
  filters: {
    level: 'error',
    startTime: new Date('2024-01-01')
  }
});

// Generate HTML report
await logManager.exportLogs('./logs/report.html', {
  format: 'html',
  includeMetadata: true,
  includeAnalysis: true
});
```

## Advanced Features

### Log Aggregation with Correlation

```javascript
// Create correlated aggregation
await logManager.aggregateLogs({
  aggregationId: 'user-session-analysis',
  sources: ['frontend-logs', 'backend-logs', 'db-logs'],
  name: 'User Session 12345',
  correlationKey: 'sessionId',  // Group by session ID
  bufferSize: 50000
});

// Get correlated groups
const groups = logManager.aggregator.getCorrelationGroups('user-session-analysis');
// Returns logs grouped by sessionId value
```

### Custom Log Parsing

```javascript
// Configure custom parsing
const capture = logManager.capture;
capture.captureFile('custom-logs', '/path/to/custom.log', {
  parser: (line) => {
    // Custom parsing logic
    const match = line.match(/\[(\w+)\] (\d{4}-\d{2}-\d{2}) (.+)/);
    if (match) {
      return {
        level: match[1].toLowerCase(),
        timestamp: new Date(match[2]),
        message: match[3]
      };
    }
    return null;
  }
});
```

### Performance Analysis

```javascript
// Analyze performance metrics
const perfAnalysis = await logManager.analyzeLogs({
  sources: ['app-logs'],
  includePerformance: true,
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-02')
  }
});

// Access detailed metrics
const stats = perfAnalysis.performance.statistics;
console.log('Response times:', {
  min: stats.responseTime.min,
  max: stats.responseTime.max,
  avg: stats.responseTime.avg,
  p95: stats.responseTime.percentiles['95']
});

// Time-bucketed analysis
const timeBuckets = perfAnalysis.performance.timeBuckets;
timeBuckets.forEach(bucket => {
  console.log(`${bucket.time}: ${bucket.avgResponseTime}ms`);
});
```

### Stream Management

```javascript
// Create multiple filtered streams
const errorStream = await logManager.streamLogs({
  streamId: 'errors-only',
  sources: ['app-logs'],
  levels: ['error', 'fatal']
});

const perfStream = await logManager.streamLogs({
  streamId: 'performance',
  sources: ['app-logs'],
  filters: {
    contains: 'completed in|response time'
  }
});

// Pause/resume streams
logManager.streamer.pauseStream('errors-only');
logManager.streamer.resumeStream('errors-only');

// Update stream filters dynamically
logManager.streamer.updateStreamFilters('performance', {
  contains: 'slow query|timeout'
});
```

## Integration Patterns

### With Node-Runner

```javascript
import NodeRunner from '@jsenvoy/node-runner';
import LogManager from '@jsenvoy/log-manager';

const runner = new NodeRunner();
const logManager = new LogManager();

// Start and monitor a Node.js application
async function monitorApplication() {
  // Start the process
  const proc = await runner.startNodeProcess('node server.js', {
    env: { NODE_ENV: 'production' }
  });

  // Capture its logs
  await logManager.captureLogs({
    source: {
      type: 'process',
      id: proc.id,
      pid: proc.pid,
      stdout: proc.stdout,
      stderr: proc.stderr
    }
  });

  // Set up error monitoring
  await logManager.monitorErrors({
    sources: [proc.id],
    threshold: 5,
    windowMs: 60000  // 1 minute
  });

  // Stream logs to dashboard
  const stream = await logManager.streamLogs({
    sources: [proc.id],
    realtime: true
  });

  return { process: proc, stream };
}
```

### With Express Server

```javascript
import express from 'express';
import LogManager from '@jsenvoy/log-manager';

const app = express();
const logManager = new LogManager();

// Capture Express logs
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date(),
      level: res.statusCode >= 400 ? 'error' : 'info',
      message: `${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      data: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip
      }
    };
    
    // Add to log manager
    logManager.aggregator.addLog({
      ...logEntry,
      sourceId: 'express-logs'
    });
  });
  
  next();
});

// Endpoint for log streaming
app.get('/api/logs/stream', (req, res) => {
  const stream = await logManager.streamLogs({
    sources: ['express-logs'],
    levels: req.query.levels?.split(',')
  });

  logManager.streamer.createSSEStream(stream.streamId, res);
});

// Endpoint for log analysis
app.get('/api/logs/analysis', async (req, res) => {
  const analysis = await logManager.analyzeLogs({
    sources: ['express-logs'],
    includePerformance: true,
    includeErrors: true
  });
  
  res.json(analysis);
});
```

### With PM2 Processes

```javascript
import pm2 from 'pm2';
import LogManager from '@jsenvoy/log-manager';

const logManager = new LogManager();

// Monitor PM2 processes
pm2.connect(async (err) => {
  if (err) throw err;

  pm2.list(async (err, list) => {
    for (const proc of list) {
      // Capture logs from PM2 log files
      await logManager.captureLogs({
        source: {
          type: 'file',
          id: `pm2-${proc.name}`,
          path: proc.pm2_env.pm_out_log_path,
          fromBeginning: false
        }
      });

      // Also capture error logs
      await logManager.captureLogs({
        source: {
          type: 'file',
          id: `pm2-${proc.name}-error`,
          path: proc.pm2_env.pm_err_log_path,
          fromBeginning: false
        }
      });
    }

    // Monitor all PM2 processes for errors
    await logManager.monitorErrors({
      sources: list.map(p => `pm2-${p.name}-error`),
      threshold: 10,
      windowMs: 300000
    });
  });
});
```

## API Reference

### LogManager Constructor

```javascript
new LogManager(config)
```

**Config Options:**
- `defaultBufferSize` (number): Default buffer size for log sources (default: 1000)
- `realtimeStreaming` (boolean): Enable real-time streaming (default: true)

### Main Methods

#### captureLogs(options)
Capture logs from various sources.

**Options:**
- `source` (object): Source configuration
  - `type` (string): 'file', 'stream', or 'process'
  - `id` (string): Unique identifier for the source
  - Additional fields based on type
- `bufferSize` (number): Buffer size for this source
- `follow` (boolean): Continue following file changes (file sources)

**Returns:** Promise<{ success, sourceId, ... }>

#### searchLogs(pattern, options)
Search logs using patterns or regular expressions.

**Parameters:**
- `pattern` (string): Search pattern or regex
- `options` (object):
  - `sources` (string[]): Source IDs to search
  - `limit` (number): Maximum results
  - `caseSensitive` (boolean): Case-sensitive search
  - `timeRange` (object): { start, end } dates

**Returns:** Promise<{ logs, count, matches }>

#### filterLogs(options)
Filter logs by various criteria.

**Options:**
- `criteria` (object):
  - `level` (string): Log level to filter
  - `startTime` (Date): Start time
  - `endTime` (Date): End time
  - `contains` (string): Text to search for
  - `excludes` (string): Text to exclude
- `sources` (string[]): Source IDs
- `limit` (number): Maximum results

**Returns:** Promise<{ logs, count }>

#### analyzeLogs(options)
Analyze logs for patterns, errors, and performance metrics.

**Options:**
- `sources` (string[]): Source IDs to analyze
- `includePatterns` (boolean): Include pattern detection
- `includeErrors` (boolean): Include error analysis
- `includePerformance` (boolean): Include performance metrics
- `timeRange` (object): { start, end } dates

**Returns:** Promise<AnalysisResult>

#### streamLogs(options)
Create a real-time log stream.

**Options:**
- `streamId` (string): Unique stream identifier
- `sources` (string[]): Source IDs to stream
- `levels` (string[]): Log levels to include
- `filters` (object): Additional filters
- `realtime` (boolean): Enable real-time streaming

**Returns:** Promise<{ streamId, status }>

#### exportLogs(outputPath, options)
Export logs to various file formats.

**Parameters:**
- `outputPath` (string): Output file path
- `options` (object):
  - `format` (string): 'json', 'csv', 'txt', 'html', 'jsonl'
  - `sources` (string[]): Source IDs to export
  - `filters` (object): Filter criteria
  - `pretty` (boolean): Pretty print JSON
  - `includeMetadata` (boolean): Include metadata

**Returns:** Promise<{ success, path, count }>

#### aggregateLogs(options)
Create a log aggregation with correlation.

**Options:**
- `aggregationId` (string): Unique aggregation ID
- `sources` (string[]): Source IDs to aggregate
- `name` (string): Aggregation name
- `correlationKey` (string): Field to correlate by
- `bufferSize` (number): Buffer size

**Returns:** Promise<{ success, aggregationId }>

#### monitorErrors(options)
Monitor error logs with threshold alerts.

**Options:**
- `sources` (string[]): Source IDs to monitor
- `threshold` (number): Error count threshold
- `windowMs` (number): Time window in milliseconds
- `includePatterns` (string[]): Error patterns to include
- `excludePatterns` (string[]): Error patterns to exclude

**Returns:** Promise<{ success, monitoring }>

### Events

#### 'log'
Emitted for each captured log entry.

```javascript
logManager.on('log', (logEntry) => {
  // logEntry: { timestamp, level, message, sourceId, ... }
});
```

#### 'error'
Emitted on capture or processing errors.

```javascript
logManager.on('error', (error) => {
  // error: Error object
});
```

#### 'error-alert'
Emitted when error threshold is exceeded.

```javascript
logManager.on('error-alert', (alert) => {
  // alert: { count, window, threshold, recentErrors, sources }
});
```

## Best Practices

### 1. Resource Management

- **Set appropriate buffer sizes**: Balance between memory usage and log retention
- **Stop captures when done**: Call `stopCapture()` to free resources
- **Use streaming for large exports**: Prevents memory issues with large datasets

```javascript
// Good: Appropriate buffer for high-volume logs
await logManager.captureLogs({
  source: { type: 'file', id: 'high-volume', path: '/var/log/access.log' },
  bufferSize: 5000  // Larger buffer for high-volume source
});

// Good: Clean up when done
process.on('SIGTERM', async () => {
  await logManager.cleanup();
  process.exit(0);
});
```

### 2. Performance Optimization

- **Use specific sources in queries**: Don't search all sources unnecessarily
- **Apply time ranges**: Limit analysis to relevant time periods
- **Stream instead of batch**: Use streaming for real-time monitoring

```javascript
// Good: Specific sources and time range
const results = await logManager.searchLogs('error', {
  sources: ['app-logs'],  // Specific source
  timeRange: {
    start: new Date(Date.now() - 3600000),  // Last hour
    end: new Date()
  },
  limit: 100
});
```

### 3. Error Monitoring

- **Set realistic thresholds**: Avoid alert fatigue
- **Use error patterns**: Filter relevant errors
- **Implement gradual response**: Different actions for different thresholds

```javascript
// Good: Graduated error monitoring
await logManager.monitorErrors({
  sources: ['production'],
  threshold: 5,
  windowMs: 60000,  // 1 minute
  includePatterns: ['database', 'connection']  // Focus on critical errors
});

logManager.on('error-alert', (alert) => {
  if (alert.count < 10) {
    // Log and notify
    console.warn('Error threshold warning:', alert);
  } else if (alert.count < 20) {
    // Scale up resources
    scaleUpServers();
  } else {
    // Emergency response
    activateFailover();
  }
});
```

### 4. Log Aggregation

- **Choose meaningful correlation keys**: sessionId, requestId, userId
- **Set appropriate buffer sizes**: Based on expected correlation group sizes
- **Clean up old aggregations**: Prevent memory leaks

```javascript
// Good: Meaningful correlation
await logManager.aggregateLogs({
  aggregationId: 'user-journey',
  sources: ['frontend', 'api', 'database'],
  correlationKey: 'sessionId',  // Correlate by user session
  bufferSize: 10000
});

// Clean up after analysis
setTimeout(() => {
  logManager.aggregator.removeAggregation('user-journey');
}, 3600000);  // Clean up after 1 hour
```

## Troubleshooting

### Common Issues

#### 1. High Memory Usage

**Symptom**: Process memory grows continuously

**Solutions**:
- Reduce buffer sizes
- Stop following files when not needed
- Use streaming exports instead of loading all logs
- Clean up old aggregations

```javascript
// Reduce memory usage
const logManager = new LogManager({
  defaultBufferSize: 500  // Smaller default buffer
});

// Stream large exports
await logManager.exportLogs('./large-export.jsonl', {
  format: 'jsonl',  // Streaming-friendly format
  stream: true
});
```

#### 2. Missing Logs

**Symptom**: Some logs don't appear in captures

**Solutions**:
- Check buffer overflow (increase buffer size)
- Verify source configuration
- Check file permissions (for file sources)
- Ensure streams are not paused

```javascript
// Check capture status
const status = logManager.capture.getCaptureStatus('source-id');
console.log('Capture status:', status);

// Check for dropped logs
if (status.droppedLogs > 0) {
  console.warn(`Dropped ${status.droppedLogs} logs due to buffer overflow`);
}
```

#### 3. WebSocket Connection Issues

**Symptom**: Real-time streaming disconnects or fails

**Solutions**:
- Implement reconnection logic
- Check for backpressure
- Monitor connection health

```javascript
// Implement reconnection
ws.on('close', () => {
  setTimeout(() => {
    reconnectWebSocket();
  }, 5000);
});

// Monitor stream health
const streamStatus = logManager.streamer.getStreamStatus('stream-id');
if (streamStatus.backpressure) {
  console.warn('Stream experiencing backpressure');
}
```

#### 4. Slow Analysis Performance

**Symptom**: Analysis takes too long on large datasets

**Solutions**:
- Use time ranges to limit data
- Analyze specific sources
- Use sampling for pattern detection
- Enable caching for repeated analyses

```javascript
// Optimize analysis
const analysis = await logManager.analyzeLogs({
  sources: ['specific-source'],  // Limit sources
  timeRange: {
    start: new Date(Date.now() - 3600000),  // Last hour only
    end: new Date()
  },
  sampling: 0.1  // Analyze 10% sample for patterns
});
```

### Debug Mode

Enable debug logging for troubleshooting:

```javascript
// Enable debug mode
process.env.DEBUG = 'logmanager:*';

// Or specific components
process.env.DEBUG = 'logmanager:capture,logmanager:analyzer';
```

### Health Checks

Implement health checks for production:

```javascript
// Health check endpoint
app.get('/health/logs', (req, res) => {
  const health = {
    captures: logManager.capture.getActiveCaptures(),
    streams: logManager.streamer.getActiveStreams(),
    aggregations: logManager.aggregator.getActiveAggregations(),
    memory: process.memoryUsage()
  };
  
  res.json(health);
});
```

## Conclusion

The LogManager package provides a comprehensive solution for log management in Node.js applications. Its modular architecture, real-time capabilities, and intelligent analysis features make it ideal for monitoring complex applications, debugging issues, and gaining insights from log data.

Key takeaways:
- Use appropriate buffer sizes and clean up resources
- Leverage real-time streaming for live monitoring
- Apply filters and time ranges for efficient analysis
- Monitor errors with sensible thresholds
- Export in the format that best suits your needs

For additional support, refer to the package repository or submit issues for bugs and feature requests.