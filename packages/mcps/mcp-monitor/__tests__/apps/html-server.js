/**
 * HTML-serving Node.js Express Server for testing browser visualization
 */

const express = require('express');
const { createServer } = require('http');

const app = express();
const PORT = parseInt(process.env.PORT || '3010');

// Middleware to add correlation IDs
app.use((req, res, next) => {
  req.correlationId = `correlation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[${req.correlationId}] ${req.method} ${req.path}`);
  next();
});

app.use(express.json());

// Root route - serves HTML
app.get('/', (req, res) => {
  console.log(`[${req.correlationId}] Serving HTML homepage`);
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Full-Stack Monitor Demo</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
        }
        .info-box {
          background: #f7f9fc;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 20px 0;
        }
        .correlation {
          font-family: monospace;
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 3px;
        }
        button {
          background: #667eea;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          margin: 10px 10px 10px 0;
          transition: all 0.3s;
        }
        button:hover {
          background: #5a67d8;
          transform: translateY(-2px);
        }
        #response {
          margin-top: 20px;
          padding: 15px;
          background: #f0f0f0;
          border-radius: 6px;
          font-family: monospace;
          display: none;
        }
        .endpoint {
          display: inline-block;
          background: #e2e8f0;
          padding: 8px 16px;
          border-radius: 6px;
          margin: 5px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Full-Stack Monitor Demo</h1>
        <p class="subtitle">Node.js server with Sidewinder monitoring</p>
        
        <div class="info-box">
          <strong>📊 Server Info:</strong><br>
          Port: ${PORT}<br>
          Node Version: ${process.version}<br>
          Correlation ID: <span class="correlation">${req.correlationId}</span><br>
          Timestamp: ${new Date().toISOString()}
        </div>

        <h2>🔍 Available Endpoints</h2>
        <div>
          <span class="endpoint">GET /</span>
          <span class="endpoint">GET /health</span>
          <span class="endpoint">GET /api/data</span>
          <span class="endpoint">POST /api/process</span>
        </div>

        <h2>🧪 Test Interactions</h2>
        <button onclick="fetchHealth()">Check Health</button>
        <button onclick="fetchData()">Fetch Data</button>
        <button onclick="processData()">Process Data</button>
        <button onclick="triggerError()">Trigger Error</button>
        
        <div id="response"></div>
      </div>

      <script>
        function showResponse(data) {
          const responseDiv = document.getElementById('response');
          responseDiv.style.display = 'block';
          responseDiv.innerHTML = '<strong>Response:</strong><pre>' + JSON.stringify(data, null, 2) + '</pre>';
        }

        async function fetchHealth() {
          const response = await fetch('/health');
          const data = await response.json();
          showResponse(data);
        }

        async function fetchData() {
          const response = await fetch('/api/data');
          const data = await response.json();
          showResponse(data);
        }

        async function processData() {
          const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'test',
              timestamp: new Date().toISOString(),
              message: 'Processing from browser'
            })
          });
          const data = await response.json();
          showResponse(data);
        }

        async function triggerError() {
          try {
            const response = await fetch('/error');
            const data = await response.json();
            showResponse(data);
          } catch (error) {
            showResponse({ error: error.message });
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  };
  
  console.log(`[${req.correlationId}] Health check requested`);
  res.json(healthData);
});

// Data endpoint
app.get('/api/data', (req, res) => {
  console.log(`[${req.correlationId}] Data requested`);
  res.json({
    data: [
      { id: 1, name: 'Item 1', value: Math.random() * 100 },
      { id: 2, name: 'Item 2', value: Math.random() * 100 },
      { id: 3, name: 'Item 3', value: Math.random() * 100 }
    ],
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
});

// Process endpoint
app.post('/api/process', (req, res) => {
  const { action, timestamp, message } = req.body;
  
  console.log(`[${req.correlationId}] Processing:`, { action, timestamp, message });
  
  // Simulate processing
  setTimeout(() => {
    res.json({
      processed: true,
      input: { action, timestamp, message },
      result: 'Processing completed successfully',
      correlationId: req.correlationId,
      processedAt: new Date().toISOString()
    });
  }, 100);
});

// Error endpoint for testing
app.get('/error', (req, res) => {
  console.error(`[${req.correlationId}] Intentional error triggered`);
  res.status(500).json({
    error: 'Intentional test error',
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
});

// Create and start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🌐 HTML server running on port ${PORT}`);
  console.log(`📊 Process ID: ${process.pid}`);
  console.log(`🔗 Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('💀 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('💀 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});