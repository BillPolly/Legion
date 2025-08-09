# Log Correlation Live Demo

This demo shows real-time log correlation between a frontend web application and a backend Node.js server using the enhanced LegionLogManager.

## Features Demonstrated

- **Real-Time Log Streaming**: WebSocket connection streams logs from backend to frontend
- **Request Correlation**: Frontend and backend logs are correlated by request ID
- **Multiple Log Sources**: Frontend client logs, backend server logs, and background worker logs
- **Search Capabilities**: Keyword, regex, and hybrid search across all logs
- **Log Filtering**: Filter by log level (info, error, warn, debug)
- **Statistics Dashboard**: Real-time statistics of logs, errors, and correlations

## How to Run

1. **Install dependencies**:
```bash
cd packages/log-manager/demo
npm install
```

2. **Start the backend server**:
```bash
npm start
```

3. **Open the frontend**:
Open http://localhost:3333/index.html in your browser

## What You'll See

### Frontend Panel (Left)
- Frontend application logs
- WebSocket connection status
- Action buttons to trigger API calls
- Log level filters

### Backend Panel (Right)
- Real-time backend server logs
- Search functionality with multiple modes
- Logs from multiple processes (server, worker)

### Correlation Panel (Bottom)
- Request/response pairs matched by request ID
- Shows the complete flow of each API call
- Frontend action → Backend processing → Response

### Statistics Panel
- Total logs count
- Frontend vs Backend log counts
- Error count
- API request count
- Correlated pairs count

## Demo Actions

1. **Connect WebSocket**: Establishes real-time log streaming
2. **Health Check**: Simple API call to test connectivity
3. **Test Action**: Simulates data processing
4. **Process Data**: Another data processing simulation
5. **Trigger Error**: Intentionally causes an error to show error handling
6. **Search Logs**: Search through all logs with different modes

## Architecture

```
Frontend (Browser)
    ↓ HTTP Requests (with Request ID)
Backend Server (Express)
    ↓ Logs all requests/responses
LegionLogManager
    ↓ Stores and indexes logs
WebSocket Server
    ↓ Streams logs in real-time
Frontend (WebSocket Client)
    ↓ Displays and correlates logs
```

## Key Technologies

- **LegionLogManager**: Enhanced log management with search and streaming
- **WebSocket**: Real-time bidirectional communication
- **Express**: Backend HTTP server
- **Request IDs**: Correlation between frontend and backend logs
- **Event-Driven**: Real-time updates and statistics

## Log Correlation Flow

1. Frontend generates unique request ID
2. Frontend logs the outgoing request with ID
3. Backend receives request and logs it with same ID
4. Backend processes and logs all steps with ID
5. Backend sends response and logs it with ID
6. Frontend receives response and logs it with ID
7. Correlation system matches all logs with same ID
8. Correlated logs displayed together in UI