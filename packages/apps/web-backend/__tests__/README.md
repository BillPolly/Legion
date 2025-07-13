# Web Backend Tests

This directory contains tests for the jsEnvoy web backend application.

## Test Files

### simple.test.js
Basic tests that verify:
- Module imports work correctly
- Package configuration is correct
- Basic utility functions
- Data structure validation
- Environment handling

### server.test.js
Tests for the Express server including:
- Health check endpoint
- Stats API endpoint
- CORS configuration
- Error handling
- Server lifecycle (start/stop)

### websocket-handler.test.js
Tests for WebSocket functionality:
- Connection handling
- Message processing
- Broadcasting
- Statistics tracking
- Error scenarios

### agent-connection.test.js
Tests for the AI agent integration:
- Message handling
- Conversation history
- Tool management
- Error handling

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- simple.test.js

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Notes

- Tests use Jest with ES modules support
- Some tests require mocking of external dependencies
- The `simple.test.js` file contains tests that work without complex mocking
- Full integration tests would require running actual services

## Test Coverage

To generate a coverage report:
```bash
npm run test:coverage
```

This will create a `coverage` directory with detailed reports.