/**
 * Express server for the debug UI
 */

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createWebSocketServer } from './websocket.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create and configure the Express server
 * @param {Object} config - Configuration object
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} HTTP server instance with close method
 */
export async function createServer(config, logger) {
  const app = express();
  const httpServer = createHttpServer(app);
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // CORS configuration
  if (config.cors?.enabled) {
    app.use(cors({
      origin: config.cors.origin,
      credentials: true
    }));
  }
  
  // Security headers
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws: wss:",
        "img-src 'self' data:",
        "font-src 'self'"
      ].join('; ')
    });
    next();
  });
  
  // Request logging
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    });
    next();
  });
  
  // Static file serving with caching
  const clientPath = join(__dirname, '../client');
  const cacheControl = process.env.NODE_ENV === 'production' 
    ? 'public, max-age=3600' 
    : 'no-cache';
    
  app.use(express.static(clientPath, {
    setHeaders: (res) => {
      res.set('Cache-Control', cacheControl);
    }
  }));
  
  // API Routes
  
  // Configuration endpoint (filtered for client)
  app.get('/api/config', (req, res) => {
    const clientConfig = {
      mcp: {
        defaultUrl: config.mcp.defaultUrl,
        reconnectInterval: config.mcp.reconnectInterval,
        maxReconnectAttempts: config.mcp.maxReconnectAttempts
      },
      ui: {
        theme: config.ui.theme,
        autoConnect: config.ui.autoConnect
      }
    };
    
    res.json(clientConfig);
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });
  
  // Serve index.html for all other routes (SPA support)
  app.get('*', (req, res) => {
    res.sendFile(join(clientPath, 'index.html'));
  });
  
  // Error handling middleware
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path
    });
  });
  
  app.use((error, req, res, next) => {
    logger.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  });
  
  // Create WebSocket server
  const wss = createWebSocketServer(httpServer, config, logger);
  
  // Start server
  await new Promise((resolve, reject) => {
    httpServer.listen(config.server.port, config.server.host, (error) => {
      if (error) {
        reject(error);
      } else {
        const address = httpServer.address();
        logger.info(`Debug UI server listening on ${address.address}:${address.port}`);
        resolve();
      }
    });
  });
  
  // Return server with enhanced close method
  return {
    ...httpServer,
    async close() {
      return new Promise((resolve) => {
        // Close WebSocket server
        if (wss) {
          wss.close();
        }
        
        // Close HTTP server
        httpServer.close(() => {
          logger.info('Server closed');
          resolve();
        });
      });
    }
  };
}