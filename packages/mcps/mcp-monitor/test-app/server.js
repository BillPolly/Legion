
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  
  if (req.url === '/api/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Demo API response', 
      timestamp: new Date().toISOString(),
      success: true
    }));
  } else if (req.url === '/api/error') {
    console.error('Demo error occurred for testing');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Demo error for analysis testing' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const port = process.env.PORT || 3007;
server.listen(port, () => {
  console.log(`Demo server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Demo server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
