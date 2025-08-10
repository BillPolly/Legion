/**
 * Test application to demonstrate Sidewinder instrumentation
 */

const http = require('http');

// Some console output
console.log('Starting test application...');
console.info('Sidewinder instrumentation should capture this');

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  // Simulate some async work
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from instrumented app!\n');
    console.log(`Response sent for ${req.url}`);
  }, 100);
});

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Start server
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Try: curl http://localhost:3333/test');
});

// Simulate some periodic work
setInterval(() => {
  console.log(`Heartbeat: ${new Date().toISOString()}`);
}, 5000);

// Test error handling
setTimeout(() => {
  console.warn('This is a warning after 2 seconds');
}, 2000);

// Test uncaught exception handling (commented out to not crash)
// setTimeout(() => {
//   throw new Error('Test uncaught error');
// }, 10000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});