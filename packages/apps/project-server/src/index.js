#!/usr/bin/env node

/**
 * Project Management Server
 *
 * Persistent HTTP server exposing project management operations as REST endpoints.
 * Replaces the MCP stdio-based approach with a standard HTTP API.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { router } from './routes.js';
import { ResourceManager } from '@legion/resource-manager';

const DEFAULT_PORT = 8347;

class ProjectServer {
  constructor(port = DEFAULT_PORT) {
    this.port = port;
    this.app = express();
    this.httpServer = null;
    this.wss = null;
  }

  /**
   * Initialize server
   */
  async initialize() {
    // Initialize ResourceManager (starts Neo4j if needed)
    console.log('Initializing ResourceManager...');
    await ResourceManager.getInstance();
    console.log('ResourceManager initialized ✓');

    // Configure Express
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'project-server', version: '1.0.0' });
    });

    // Mount API routes
    this.app.use('/api', router);

    // Error handling
    this.app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });

    // Create HTTP server
    this.httpServer = createServer(this.app);

    // Setup WebSocket server for real-time updates
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.setupWebSocket();
  }

  /**
   * Setup WebSocket for real-time notifications
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message:', data);
          // Handle WebSocket messages if needed
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  /**
   * Start server
   */
  async start() {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`\n🚀 Project Server running on http://localhost:${this.port}`);
        console.log(`   Health: http://localhost:${this.port}/health`);
        console.log(`   API:    http://localhost:${this.port}/api`);
        console.log(`   WebSocket: ws://localhost:${this.port}\n`);
        resolve();
      });
    });
  }

  /**
   * Stop server
   */
  async stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log('Project Server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || DEFAULT_PORT;
  const server = new ProjectServer(port);

  server.initialize()
    .then(() => server.start())
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

export { ProjectServer };
