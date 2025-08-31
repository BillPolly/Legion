/**
 * Minimal server for testing - bypass the complex initialization
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 8083;

// Serve static files
app.use('/src', express.static(path.join(__dirname, 'src')));

// Simple HTML page for testing
app.get('/planner', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Decent Planner - Test Mode</title>
    </head>
    <body>
        <h1>🧠 Decent Planner - Test Mode</h1>
        <p>Server is running! The full actor-based system is being debugged.</p>
        <p>This confirms the basic server infrastructure works.</p>
        <script>
            console.log('Basic server is working!');
        </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`✅ Minimal server running on http://localhost:${port}`);
  console.log(`📱 Open http://localhost:${port}/planner to test`);
});