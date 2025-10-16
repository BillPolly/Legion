/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * PanelServer - HTTP + WebSocket server for Legion panel management
 *
 * Provides endpoints:
 * - GET /panel?processId=xxx&panelId=yyy - Serves panel HTML
 * - WS /ws/process - For Legion processes to connect and request panels
 * - WS /ws/panel - For browser panels to connect and receive messages
 *
 * Architecture:
 * Process → WS(/ws/process) → PanelServer → WS(/ws/panel) → Chrome Browser
 */

import * as http from 'http';
import { WebSocketServer } from 'ws';
import { ActorSpace } from '@legion/actors';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { PanelManager } from './panel-manager.js';
import { ResourceManager } from '@legion/resource-manager';
import { ImportRewriter } from '@legion/server-framework/src/utils/ImportRewriter.js';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class PanelServer {
  constructor(port = 5500, host = 'localhost', log = console.log) {
    this.server = null;
    this.processWss = null;
    this.panelWss = null;
    this.actorSpace = null;
    this.panelManager = null;
    this.processConnections = new Map();
    this.panelConnections = new Map();
    this.port = port;
    this.host = host;
    this.log = log;

    // Legion package serving infrastructure
    this.packageCache = new Map();
    this.fileCache = new Map();
    this.monorepoRoot = null;
    this.importRewriter = new ImportRewriter();
  }

  /**
   * Start the panel server
   */
  async start() {
    if (this.server) {
      this.log('PanelServer already running');
      return;
    }

    // Get monorepo root from ResourceManager
    const resourceManager = await ResourceManager.getInstance();
    this.monorepoRoot = resourceManager.get('env.MONOREPO_ROOT');
    if (!this.monorepoRoot) {
      throw new Error('MONOREPO_ROOT not found in ResourceManager');
    }

    // Create PanelManager
    this.panelManager = new PanelManager(this.port, this.host, this.log);

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          service: 'legion-panel-server',
          port: this.port,
          timestamp: new Date().toISOString(),
          processes: this.processConnections.size,
          panels: this.panelConnections.size,
        }));
        return;
      }

      // Legion package serving
      if (req.url?.startsWith('/legion/')) {
        this.serveLegionPackage(req, res);
        return;
      }

      // Panel HTML endpoint
      if (req.url?.startsWith('/panel')) {
        const url = new URL(req.url, `http://${this.host}:${this.port}`);
        const processId = url.searchParams.get('processId');
        const panelId = url.searchParams.get('panelId');

        if (!processId || !panelId) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing processId or panelId query parameters');
          return;
        }

        // Register panel and serve HTML
        this.panelManager.registerPanel(processId, panelId);
        const html = this.panelManager.getPanelHtml(processId, panelId);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      // Not found
      res.writeHead(404);
      res.end('Not Found');
    });

    // Create ActorSpace for managing connections
    this.actorSpace = new ActorSpace('panel-server');

    // Create WebSocket server for processes
    this.processWss = new WebSocketServer({
      server: this.server,
      path: '/ws/process',
    });

    this.processWss.on('connection', (ws) => {
      this.handleProcessConnection(ws);
    });

    // Create WebSocket server for panels
    this.panelWss = new WebSocketServer({
      server: this.server,
      path: '/ws/panel',
    });

    this.panelWss.on('connection', (ws, req) => {
      this.handlePanelConnection(ws, req);
    });

    // Start HTTP server
    await new Promise((resolve, reject) => {
      // Attach error handler BEFORE calling listen
      this.server.once('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(error);
        }
      });

      this.server.listen(this.port, this.host, () => {
        this.log(`PanelServer running on http://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle process WebSocket connection
   */
  handleProcessConnection(ws) {
    const processId = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.log(`[Process] Connected: ${processId}`);

    // Create process actor that handles messages from the process
    const processActor = {
      isActor: true,
      id: `process-actor-${processId}`,

      receive: async (messageType, data) => {
        this.log(`[Process ${processId}] Received: ${messageType}`);

        if (messageType === 'request-panel') {
          // Process is requesting a panel to be created
          await this.handlePanelRequest(processId, data);
          return { success: true, panelId: data.panelId };
        } else if (messageType === 'panel-message') {
          // Process sending message to a specific panel
          this.routeToPanel(data.panelId, data.messageType, data.data);
          return { success: true };
        }

        return { success: false, error: 'Unknown message type' };
      },
    };

    // Register process actor in ActorSpace
    this.actorSpace.register(processActor, processActor.id);

    // Add WebSocket channel for this process
    const channel = this.actorSpace.addChannel(ws, processActor);

    // Create remote actor for sending messages to process
    const remoteActor = channel.makeRemote('process-client');

    // Store connection
    const connection = {
      id: processId,
      ws,
      remoteActor,
      requestedPanels: new Set(),
    };
    this.processConnections.set(processId, connection);

    // Handle disconnection
    ws.on('close', () => {
      this.log(`[Process] Disconnected: ${processId}`);
      this.processConnections.delete(processId);

      // Close all panels associated with this process
      for (const [panelId, panel] of this.panelConnections) {
        if (panel.processId === processId) {
          panel.ws.close();
          this.panelConnections.delete(panelId);
        }
      }
    });

    // Notify process that connection is ready
    remoteActor.receive('connection-ready', { processId });
  }

  /**
   * Handle panel WebSocket connection
   */
  handlePanelConnection(ws, req) {
    // Extract panelId and processId from query parameters
    const url = new URL(req.url, `http://${this.host}:${this.port}`);
    const panelId = url.searchParams.get('panelId');
    const processId = url.searchParams.get('processId');

    if (!panelId || !processId) {
      this.log('[Panel] Missing panelId or processId in connection');
      ws.close();
      return;
    }

    this.log(`[Panel] Connected: ${panelId} for process ${processId}`);

    // Create panel actor that handles messages from the panel
    const panelActor = {
      isActor: true,
      id: `panel-actor-${panelId}`,

      receive: async (messageType, data) => {
        this.log(`[Panel ${panelId}] Received: ${messageType}`);

        // Route panel messages back to the process
        this.routeToProcess(processId, messageType, { ...data, panelId });

        return { success: true };
      },
    };

    // Register panel actor in ActorSpace
    this.actorSpace.register(panelActor, panelActor.id);

    // Add WebSocket channel for this panel
    const channel = this.actorSpace.addChannel(ws, panelActor);

    // Create remote actor for sending messages to panel
    const remoteActor = channel.makeRemote('panel-client');

    // Store connection
    const connection = {
      id: panelId,
      processId,
      ws,
      remoteActor,
    };
    this.panelConnections.set(panelId, connection);

    // Handle disconnection
    ws.on('close', () => {
      this.log(`[Panel] Disconnected: ${panelId}`);
      this.panelConnections.delete(panelId);

      // Notify process that panel closed
      this.routeToProcess(processId, 'panel-closed', { panelId });
    });

    // Notify panel that connection is ready
    remoteActor.receive('connection-ready', { panelId, processId });
  }

  /**
   * Handle panel creation request from process
   */
  async handlePanelRequest(processId, data) {
    const connection = this.processConnections.get(processId);
    if (!connection) {
      this.log(`[Process] Connection not found: ${processId}`);
      return;
    }

    const panelId = data.panelId || `panel-${Date.now()}`;
    connection.requestedPanels.add(panelId);

    this.log(`[Process ${processId}] Requested panel: ${panelId}`);

    // Launch Chrome with panel URL
    const panelUrl = `http://${this.host}:${this.port}/panel?processId=${processId}&panelId=${panelId}`;
    try {
      this.log(`[Panel] Launching Chrome: ${panelUrl}`);
      await execAsync(`open "${panelUrl}"`);  // macOS
      // Alternative for Linux: xdg-open
      // Alternative for Windows: start
    } catch (error) {
      this.log(`[Panel] Failed to launch Chrome: ${error}`);
    }
  }

  /**
   * Route message from process to specific panel
   */
  routeToPanel(panelId, messageType, data) {
    const panel = this.panelConnections.get(panelId);
    if (!panel) {
      this.log(`[Router] Panel not found: ${panelId}`);
      return;
    }

    this.log(`[Router] Process → Panel ${panelId}: ${messageType}`);
    panel.remoteActor.receive(messageType, data);
  }

  /**
   * Route message from panel to process
   */
  routeToProcess(processId, messageType, data) {
    const process = this.processConnections.get(processId);
    if (!process) {
      this.log(`[Router] Process not found: ${processId}`);
      return;
    }

    this.log(`[Router] Panel → Process ${processId}: ${messageType}`);
    process.remoteActor.receive(messageType, data);
  }

  /**
   * Get all panel requests for a process
   */
  getPanelRequests(processId) {
    const connection = this.processConnections.get(processId);
    return connection ? connection.requestedPanels : new Set();
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      processes: this.processConnections.size,
      panels: this.panelConnections.size,
      processIds: Array.from(this.processConnections.keys()),
      panelIds: Array.from(this.panelConnections.keys()),
    };
  }

  /**
   * Serve Legion packages from /legion/* URLs
   * Based on BaseServer.setupLegionPackageRoutes() pattern
   */
  async serveLegionPackage(req, res) {
    try {
      // Parse request path: /legion/package-name/file.js
      const pathParts = req.url.substring('/legion/'.length).split('/');
      const packageName = pathParts[0];
      const filePath = pathParts.slice(1).join('/') || 'index.js';

      // Check package cache
      let packagePath = this.packageCache.get(packageName);

      if (!packagePath) {
        // Try to locate the package in monorepo
        // Check all possible package locations in order of likelihood
        const possiblePaths = [
          // Direct packages (e.g., @legion/actors)
          path.join(this.monorepoRoot, 'packages', 'shared', packageName),
          path.join(this.monorepoRoot, 'packages', 'frontend', packageName),
          path.join(this.monorepoRoot, 'packages', 'apps', packageName),
          // Nested data packages (e.g., @legion/data-store -> packages/shared/data/data-store)
          path.join(this.monorepoRoot, 'packages', 'shared', 'data', packageName),
          // Nested LLM packages
          path.join(this.monorepoRoot, 'packages', 'shared', 'llm', packageName),
          // Root packages
          path.join(this.monorepoRoot, 'packages', packageName),
        ];

        // Find the first path that exists
        for (const tryPath of possiblePaths) {
          try {
            await fs.access(tryPath);
            packagePath = tryPath;
            this.packageCache.set(packageName, packagePath);
            break;
          } catch {
            // Path doesn't exist, try next
          }
        }

        if (!packagePath) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`Legion package not found: ${packageName}`);
          return;
        }
      }

      // Build actual file path
      const actualFilePath = path.join(packagePath, filePath);

      // Security check - ensure path is within package directory
      const normalizedFilePath = path.normalize(actualFilePath);
      if (!normalizedFilePath.startsWith(packagePath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access denied');
        return;
      }

      // Check file cache
      const cacheKey = `${packageName}/${filePath}`;
      let content = this.fileCache.get(cacheKey);

      if (!content) {
        // Read file
        try {
          content = await fs.readFile(actualFilePath, 'utf8');
          this.fileCache.set(cacheKey, content);
        } catch (error) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`File not found: ${filePath}`);
          return;
        }
      }

      // Determine content type and rewrite imports for JS files
      let contentType = 'text/plain';
      let finalContent = content;

      if (filePath.endsWith('.js')) {
        finalContent = this.importRewriter.rewrite(content, {
          legionPackage: packageName,
          requestPath: req.url,
          baseUrl: `/legion/${packageName}`,
        });
        contentType = 'application/javascript; charset=utf-8';
      } else if (filePath.endsWith('.css')) {
        contentType = 'text/css; charset=utf-8';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json; charset=utf-8';
      } else if (filePath.endsWith('.html')) {
        contentType = 'text/html; charset=utf-8';
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(finalContent);
    } catch (error) {
      this.log(`[Legion Package] Error serving ${req.url}:`, error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (!this.server) {
      return;
    }

    // Close all WebSocket connections
    this.processConnections.forEach((conn) => conn.ws.close());
    this.panelConnections.forEach((conn) => conn.ws.close());
    this.processConnections.clear();
    this.panelConnections.clear();

    // Close WebSocket servers with proper Promise handling
    const wsClosures = [];
    if (this.processWss) {
      wsClosures.push(new Promise((resolve) => {
        this.processWss.close(() => resolve());
      }));
    }
    if (this.panelWss) {
      wsClosures.push(new Promise((resolve) => {
        this.panelWss.close(() => resolve());
      }));
    }
    await Promise.all(wsClosures);

    this.processWss = null;
    this.panelWss = null;

    // Destroy ActorSpace
    if (this.actorSpace) {
      await this.actorSpace.destroy();
      this.actorSpace = null;
    }

    // Close HTTP server
    await new Promise((resolve) => {
      this.server.close(() => {
        this.log('PanelServer stopped');
        resolve();
      });
    });

    this.server = null;
  }
}
