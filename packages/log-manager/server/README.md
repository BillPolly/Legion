# Log Monitoring Server

A comprehensive monitoring server that collects, correlates, and displays logs from multiple external Node.js applications in real-time.

## Features

- **Real-time Log Collection**: Captures stdout/stderr from spawned Node.js processes
- **Correlation Tracking**: Automatically detects and tracks request IDs across multiple applications
- **WebSocket Streaming**: Live log streaming to dashboard clients
- **Search Capabilities**: Multiple search modes (keyword, regex, semantic, hybrid)
- **Interactive Dashboard**: Web-based UI with filtering, search, and statistics
- **Process Management**: Monitor and control external applications

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Monitoring Dashboard                     │
│                   (http://localhost:3334)                │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (ws://localhost:8081)
┌────────────────────▼────────────────────────────────────┐
│                  Monitoring Server                       │
│                 (monitoring-server.js)                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │              LegionLogManager                     │  │
│  │  - Session Management                            │  │
│  │  - Log Storage                                   │  │
│  │  - Search (keyword/regex/semantic/hybrid)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬──────────────┬──────────────┬────────────┘
             │ spawn()      │ spawn()      │ spawn()
   ┌─────────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐
   │  Web Server    │ │  Worker   │ │   Client    │
   │  (port 4001)   │ │ (process) │ │  (requests) │
   └────────────────┘ └───────────┘ └─────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd packages/log-manager/server
npm install

cd sample-apps
npm install
```

### 2. Start Monitoring Server

#### Option A: Server Only
```bash
npm start
```

#### Option B: Server with Sample Applications
```bash
npm run start-with-samples
```

### 3. Access Dashboard

Open http://localhost:3334 in your browser

## Sample Applications

The `sample-apps/` directory contains three demo applications:

### web-server.js
- Express server on port 4001
- Generates request IDs for correlation
- Simulates various response scenarios (success, errors, 404s)
- Structured JSON logging

### worker.js
- Background task processor
- Generates trace IDs and correlation IDs
- Simulates processing stages with random failures
- Periodic metrics reporting

### client.js
- Makes HTTP requests to web-server
- Simulates user journeys with correlation tracking
- Generates client-side request IDs
- Performance monitoring

## API Endpoints

### Statistics
```bash
GET /api/stats
```

### Search Logs
```bash
GET /api/search?query=error&mode=keyword&limit=100
```

Search modes:
- `keyword` - Simple text search
- `regex` - Regular expression search
- `semantic` - AI-powered semantic search
- `hybrid` - Combined keyword and semantic

### Get Correlations
```bash
GET /api/correlations
GET /api/correlations/:id
```

### Recent Logs
```bash
GET /api/logs/recent?limit=100&process=sample-web-server
```

### Process Management
```bash
GET /api/processes

POST /api/monitor/start
{
  "script": "/path/to/script.js",
  "args": ["--flag"],
  "name": "my-app"
}

POST /api/monitor/stop
{
  "processId": "my-app"
}
```

### Export Logs
```bash
GET /api/export?format=json
GET /api/export?format=csv&process=sample-web-server
```

## Dashboard Features

### Live Log Viewer
- Real-time log streaming via WebSocket
- Color-coded log levels
- Clickable correlation IDs
- Automatic scrolling

### Process Sidebar
- List of monitored processes
- Process status indicators
- Click to filter logs by process

### Search Bar
- Multiple search modes
- Real-time search results
- Clear search functionality

### Statistics Panel
- Logs per minute
- Recent errors count
- Correlation tracking
- Log level distribution
- Per-process statistics

### Log Filters
- Filter by log level (All, Error, Warn, Info, Debug)
- Filter by process
- Combine filters for precise viewing

## Correlation Tracking

The system automatically detects and tracks correlation patterns:

- Request IDs: `[req-1234567890-1]`
- Trace IDs: `[trace-task-123]`
- Correlation IDs: `[correlation-456]`

When a correlation ID is detected, logs are automatically linked across different processes, allowing you to track a request's journey through the entire system.

## Development

### Running Tests

```bash
cd packages/log-manager
npm test
```

### Custom Applications

To monitor your own applications:

1. Ensure they output structured JSON logs to stdout:
```javascript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'Your log message'
}));
```

2. Start monitoring:
```javascript
POST /api/monitor/start
{
  "script": "/path/to/your/app.js",
  "name": "your-app"
}
```

## Environment Variables

- `PORT` - Monitoring server port (default: 3334)
- `WS_PORT` - WebSocket port (default: 8081)

## Troubleshooting

### Server won't start
- Check if ports 3334 and 8081 are available
- Ensure Node.js version >= 18.0.0

### No logs appearing
- Verify applications are outputting to stdout/stderr
- Check WebSocket connection in browser console
- Ensure correct session ID is being used

### Search not working
- Verify LegionLogManager is properly initialized
- Check that logs are being indexed
- Ensure storage provider has data

## License

Part of the Legion framework