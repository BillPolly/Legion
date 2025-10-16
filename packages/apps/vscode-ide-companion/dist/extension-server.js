/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/**
 * ExtensionServer - HTTP + WebSocket server for VSCode extension
 *
 * Provides two endpoints:
 * - /ws/process - For Legion processes to connect and request panels
 * - /ws/panel - For webview panels to connect and receive messages
 *
 * Architecture:
 * Process → WS(/ws/process) → Extension → WS(/ws/panel) → Webview
 */
import * as http from 'http';
import { WebSocketServer } from 'ws';
import { ActorSpace } from '@legion/actors';
export class ExtensionServer {
    server = null;
    processWss = null;
    panelWss = null;
    actorSpace = null;
    processConnections = new Map();
    panelConnections = new Map();
    port;
    host;
    log;
    constructor(port = 5500, host = 'localhost', log) {
        this.port = port;
        this.host = host;
        this.log = log || console.log;
    }
    /**
     * Start the extension server
     */
    async start() {
        if (this.server) {
            this.log('ExtensionServer already running');
            return;
        }
        // Create HTTP server
        this.server = http.createServer((req, res) => {
            // Health check endpoint
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    service: 'legion-extension-server',
                    port: this.port,
                    timestamp: new Date().toISOString(),
                    processes: this.processConnections.size,
                    panels: this.panelConnections.size,
                }));
                return;
            }
            // Not found
            res.writeHead(404);
            res.end('Not Found');
        });
        // Create ActorSpace for managing connections
        this.actorSpace = new ActorSpace('extension-server');
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
            this.server.listen(this.port, this.host, () => {
                this.log(`ExtensionServer running on http://${this.host}:${this.port}`);
                resolve();
            });
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use`));
                }
                else {
                    reject(error);
                }
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
                }
                else if (messageType === 'panel-message') {
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
        // The extension will handle actually creating the VSCode webview
        // We just store the request and wait for the webview to connect
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
        // Close WebSocket servers
        if (this.processWss) {
            this.processWss.close();
            this.processWss = null;
        }
        if (this.panelWss) {
            this.panelWss.close();
            this.panelWss = null;
        }
        // Destroy ActorSpace
        if (this.actorSpace) {
            await this.actorSpace.destroy();
            this.actorSpace = null;
        }
        // Close HTTP server
        await new Promise((resolve) => {
            this.server.close(() => {
                this.log('ExtensionServer stopped');
                resolve();
            });
        });
        this.server = null;
    }
}
//# sourceMappingURL=extension-server.js.map