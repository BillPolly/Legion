/**
 * Static Routes
 * Serve static files and default route
 */

import { Router } from 'express';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const staticRoutes = Router();

// Serve static files from public directory if it exists
const publicPath = path.join(__dirname, '../../../public');
staticRoutes.use(express.static(publicPath, { 
  index: false,
  maxAge: '1d'
}));

// Welcome page
staticRoutes.get('/', (req, res) => {
  res.json({
    service: 'Tool Registry Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: {
        stats: '/api/stats',
        tools: '/api/tools',
        search: '/api/search',
        modules: '/api/modules'
      },
      websocket: 'ws://localhost:8090/ws'
    },
    documentation: 'https://github.com/your-org/legion/tree/main/packages/apps/tool-registry-server'
  });
});