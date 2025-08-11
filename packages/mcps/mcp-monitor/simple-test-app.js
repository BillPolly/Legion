import http from 'http';

console.log('[INFO] Starting simple test server...');

const server = http.createServer((req, res) => {
  console.log(`[INFO] Request: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from test server');
});

const port = process.env.PORT || 3010;
server.listen(port, () => {
  console.log(`[INFO] Test server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[INFO] Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

export default server;