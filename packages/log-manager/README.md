# @jsenvoy/log-manager

Comprehensive log capture, aggregation, and analysis for jsEnvoy AI agents.

## Overview

This package provides powerful log management capabilities for AI agents, including real-time capture from multiple sources, intelligent aggregation, pattern analysis, and flexible export options. It's designed to help AI agents understand and analyze application behavior through logs.

## Features

- **Multi-Source Capture**: Capture logs from streams, files, and processes
- **Real-Time Streaming**: Stream logs with WebSocket and SSE support
- **Intelligent Aggregation**: Combine logs from multiple sources with correlation
- **Pattern Analysis**: Detect patterns, errors, and performance issues
- **Flexible Export**: Export logs in JSON, CSV, TXT, HTML, and JSONL formats
- **Error Monitoring**: Real-time error detection with threshold alerts
- **Search & Filter**: Powerful search with regex support and multi-criteria filtering
- **Performance Metrics**: Extract and analyze performance data from logs

## Installation

```bash
npm install @jsenvoy/log-manager
```

## Usage

### As a JSON Module (Recommended)

The package can be loaded as a JSON module using the jsEnvoy module loader:

```javascript
import { ModuleFactory } from '@jsenvoy/module-loader';

const moduleFactory = new ModuleFactory();
const logModule = await moduleFactory.createJsonModule('./node_modules/@jsenvoy/log-manager/module.json');
const tools = await logModule.getTools();
```

### Direct Usage

```javascript
import LogManager from '@jsenvoy/log-manager';

const logManager = new LogManager({
  defaultBufferSize: 1000,
  realtimeStreaming: true
});

// Capture logs from a file
await logManager.captureLogs({
  source: {
    type: 'file',
    id: 'app-logs',
    path: '/var/log/app.log',
    fromBeginning: true
  }
});

// Search for errors
const errors = await logManager.searchLogs('error|exception', {
  sources: ['app-logs'],
  limit: 100
});

// Export logs
await logManager.exportLogs('./logs-export.json', {
  format: 'json',
  sources: ['app-logs']
});
```

## Available Tools

When loaded as a JSON module, the following 8 tools are available:

### capture_logs
Capture logs from various sources (streams, files, processes).

```javascript
{
  "source": {
    "type": "file",
    "id": "nginx-logs",
    "path": "/var/log/nginx/access.log",
    "fromBeginning": false
  },
  "bufferSize": 2000,
  "follow": true
}
```

### stream_logs
Create a real-time log stream with filtering.

```javascript
{
  "streamId": "error-stream",
  "sources": ["app-logs", "nginx-logs"],
  "levels": ["error", "warn"],
  "realtime": true
}
```

### search_logs
Search logs using patterns or regular expressions.

```javascript
{
  "pattern": "connection.*refused|timeout",
  "sources": ["app-logs"],
  "timeRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-02T00:00:00Z"
  },
  "limit": 50
}
```

### filter_logs
Filter logs by level, time, content, or other criteria.

```javascript
{
  "criteria": {
    "level": "error",
    "startTime": "2024-01-01T00:00:00Z",
    "contains": "database"
  },
  "sources": ["app-logs"],
  "limit": 100
}
```

### analyze_logs
Analyze logs for patterns, errors, and performance insights.

```javascript
{
  "sources": ["app-logs", "nginx-logs"],
  "includePatterns": true,
  "includeErrors": true,
  "includePerformance": true
}
```

### export_logs
Export logs to various file formats.

```javascript
{
  "outputPath": "./logs/export.csv",
  "format": "csv",
  "sources": ["app-logs"],
  "filters": {
    "level": "error",
    "startTime": "2024-01-01T00:00:00Z"
  }
}
```

### aggregate_logs
Combine logs from multiple sources with correlation.

```javascript
{
  "aggregationId": "user-session-123",
  "sources": ["frontend-logs", "backend-logs"],
  "name": "User Session Analysis",
  "correlationKey": "sessionId",
  "bufferSize": 10000
}
```

### monitor_errors
Monitor error logs in real-time with threshold alerts.

```javascript
{
  "sources": ["app-logs"],
  "threshold": 10,
  "windowMs": 300000
}
```

## Log Sources

### File Sources

```javascript
await logManager.captureLogs({
  source: {
    type: 'file',
    id: 'app-log',
    path: '/path/to/app.log',
    fromBeginning: true
  }
});
```

### Stream Sources

```javascript
await logManager.captureLogs({
  source: {
    type: 'stream',
    id: 'process-stdout',
    stream: process.stdout,
    streamType: 'stdout'
  }
});
```

### Process Sources

```javascript
await logManager.captureLogs({
  source: {
    type: 'process',
    id: 'node-app',
    pid: 12345,
    stdout: childProcess.stdout,
    stderr: childProcess.stderr
  }
});
```

## Real-Time Streaming

### WebSocket Streaming

```javascript
// Create a stream
const stream = await logManager.streamLogs({
  sources: ['app-logs'],
  levels: ['error', 'warn']
});

// Use with WebSocket
logManager.streamer.createWebSocketStream(stream.streamId, ws, {
  format: 'json'
});
```

### Server-Sent Events (SSE)

```javascript
// Use with Express response
logManager.streamer.createSSEStream(stream.streamId, res, {
  format: 'text'
});
```

## Analysis Capabilities

### Error Analysis

```javascript
const analysis = await logManager.analyzeLogs({
  sources: ['app-logs'],
  includeErrors: true
});

console.log('Error rate:', analysis.errors.rate);
console.log('Error types:', analysis.errors.types);
console.log('Error clusters:', analysis.errors.clusters);
```

### Pattern Detection

```javascript
const analysis = await logManager.analyzeLogs({
  includePatterns: true
});

// Common patterns like [Component] or (module)
console.log('Patterns found:', analysis.patterns);
```

### Performance Metrics

```javascript
const analysis = await logManager.analyzeLogs({
  includePerformance: true
});

console.log('Response times:', analysis.performance.statistics.responseTime);
console.log('Memory usage:', analysis.performance.statistics.memoryUsage);
```

## Export Formats

### JSON Export

```javascript
await logManager.exportLogs('./logs.json', {
  format: 'json',
  pretty: true,
  includeMetadata: true
});
```

### CSV Export

```javascript
await logManager.exportLogs('./logs.csv', {
  format: 'csv',
  sources: ['app-logs'],
  filters: { level: 'error' }
});
```

### HTML Export

```javascript
await logManager.exportLogs('./logs.html', {
  format: 'html',
  includeMetadata: true
});
```

## Integration Examples

### With Node Runner

```javascript
import NodeRunner from '@jsenvoy/node-runner';
import LogManager from '@jsenvoy/log-manager';

const runner = new NodeRunner();
const logManager = new LogManager();

// Start a process
const process = await runner.startNodeProcess('node app.js');

// Capture its logs
await logManager.captureLogs({
  source: {
    type: 'process',
    id: process.id,
    pid: process.pid,
    stdout: process.stdout,
    stderr: process.stderr
  }
});

// Monitor for errors
await logManager.monitorErrors({
  sources: [process.id],
  threshold: 5,
  windowMs: 60000
});
```

### Error Monitoring Dashboard

```javascript
// Set up error monitoring
const monitor = await logManager.monitorErrors({
  sources: ['production-logs'],
  threshold: 10,
  windowMs: 300000 // 5 minutes
});

// Listen for alerts
logManager.on('error-alert', (alert) => {
  console.log(`Error threshold exceeded: ${alert.count} errors in ${alert.window}ms`);
  // Send notification, trigger automation, etc.
});
```

## Configuration

```javascript
const logManager = new LogManager({
  defaultBufferSize: 1000,    // Default buffer size for sources
  realtimeStreaming: true     // Enable real-time streaming
});
```

## Events

The LogManager emits several events:

- `log`: Emitted for each captured log entry
- `error`: Emitted on capture or processing errors
- `error-alert`: Emitted when error threshold is exceeded

```javascript
logManager.on('log', (logEntry) => {
  // Process each log entry
});

logManager.on('error-alert', (alert) => {
  // Handle error threshold alerts
});
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests to the main repository.