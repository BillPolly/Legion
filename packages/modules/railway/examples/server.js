const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Main route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Railway Express App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f0f0f0;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #5433FF; }
        .info { 
          background: #f8f8f8; 
          padding: 15px; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .success { color: #28a745; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚂 Hello from Railway!</h1>
        <p class="success">✅ Your Express app is running successfully on Railway</p>
        
        <div class="info">
          <h3>Deployment Info:</h3>
          <p><strong>Port:</strong> ${PORT}</p>
          <p><strong>Node Version:</strong> ${process.version}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
          <p><strong>Deployed via:</strong> Railway API + GitHub</p>
        </div>
        
        <h3>Available Routes:</h3>
        <ul>
          <li><a href="/">/</a> - This page</li>
          <li><a href="/api/status">/api/status</a> - JSON status endpoint</li>
          <li><a href="/api/health">/api/health</a> - Health check</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Railway Express app is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      port: PORT,
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});