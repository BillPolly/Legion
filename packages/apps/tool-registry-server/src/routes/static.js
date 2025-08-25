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

// Serve static files from tool-registry-ui public directory
const uiPublicPath = path.join(__dirname, '../../../tool-registry-ui/public');
staticRoutes.use(express.static(uiPublicPath, { 
  index: false,
  maxAge: '1d'
}));

// Serve UI source files for frontend imports
const uiSrcPath = path.join(__dirname, '../../../tool-registry-ui/src');
staticRoutes.use('/src', express.static(uiSrcPath, {
  maxAge: '1h'
}));

// Serve Legion packages for frontend imports
const sharedPath = path.join(__dirname, '../../../../shared');
const toolsPath = path.join(__dirname, '../../../../tools');
const frontendComponentsPath = path.join(__dirname, '../../../../frontend/components');
const actorsPath = path.join(__dirname, '../../../../shared/actors');

staticRoutes.use('/legion/shared', express.static(sharedPath));
staticRoutes.use('/legion/tools', express.static(toolsPath));
staticRoutes.use('/legion/frontend-components', express.static(frontendComponentsPath));
staticRoutes.use('/legion/actors', express.static(actorsPath));

// Serve UI HTML file as default page
staticRoutes.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../../../tool-registry-ui/public/index.html');
  res.sendFile(indexPath);
});

// API info endpoint
staticRoutes.get('/api-info', (req, res) => {
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