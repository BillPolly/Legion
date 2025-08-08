/**
 * SD Observability UI Server
 * 
 * Serves the frontend and provides WebSocket connection for real-time updates
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/src', express.static(path.join(__dirname, '..')));
app.use('/shared', express.static(path.join(__dirname, '../../../../shared')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'sd-observability-ui',
    timestamp: new Date().toISOString()
  });
});

// Start server (HTTP only - no WebSocket)
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║      SD Observability UI Server Started       ║
╠════════════════════════════════════════════════╣
║  HTTP Server:   http://localhost:${PORT}         ║
║  Backend:       ws://localhost:3007             ║
║  Health Check:  http://localhost:${PORT}/health  ║
╚════════════════════════════════════════════════╝
  `);
});