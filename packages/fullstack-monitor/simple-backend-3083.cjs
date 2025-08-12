// Simple test backend server for FullStackMonitor testing
const http = require('http');

const PORT = 3083;

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  
  // Extract correlation ID if present
  const correlationId = req.headers['x-correlation-id'];
  if (correlationId) {
    console.log(`[${correlationId}] Processing request`);
  }
  
  // Simulate different responses
  if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Hello from backend',
      timestamp: Date.now(),
      correlationId 
    }));
  } else if (req.url === '/error') {
    console.error('Simulated error endpoint hit');
    throw new Error('Intentional error for testing');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Test Backend</title></head>
        <body>
          <h1>Test Backend Server</h1>
          <p>Running on port ${PORT}</p>
          <button onclick="fetch('/api/data').then(r => r.json()).then(console.log)">
            Test API Call
          </button>
          <script>
            console.log('Page loaded from backend');
            
            // Test various console methods
            console.info('Info message from frontend');
            console.warn('Warning from frontend');
            
            // Test error
            setTimeout(() => {
              console.error('Delayed error test');
            }, 2000);
          </script>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`Test backend server listening on port ${PORT}`);
  console.log('Server ready to receive requests');
});

// Simulate periodic activity
setInterval(() => {
  console.log('Heartbeat:', new Date().toISOString());
}, 10000);

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});