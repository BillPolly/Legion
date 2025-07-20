const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Conan Deployed App</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 40px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
        }
        h1 { font-size: 3em; margin-bottom: 20px; }
        p { font-size: 1.5em; margin: 10px 0; }
        .time { font-size: 1.2em; opacity: 0.8; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Hello from Railway!</h1>
        <p>This app was deployed by <strong>Conan The Deployer</strong></p>
        <p class="time">Current time: ${new Date().toLocaleString()}</p>
        <p>🎉 Your deployment is working perfectly!</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});