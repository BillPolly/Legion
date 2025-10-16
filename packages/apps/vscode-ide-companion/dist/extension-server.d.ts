/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */
import { WebSocket } from 'ws';
export interface ProcessConnection {
    id: string;
    ws: WebSocket;
    remoteActor: any;
    requestedPanels: Set<string>;
}
export interface PanelConnection {
    id: string;
    processId: string;
    ws: WebSocket;
    remoteActor: any;
}
export declare class ExtensionServer {
    private server;
    private processWss;
    private panelWss;
    private actorSpace;
    private processConnections;
    private panelConnections;
    private readonly port;
    private readonly host;
    private log;
    constructor(port?: number, host?: string, log?: (message: string) => void);
    /**
     * Start the extension server
     */
    start(): Promise<void>;
    /**
     * Handle process WebSocket connection
     */
    private handleProcessConnection;
    /**
     * Handle panel WebSocket connection
     */
    private handlePanelConnection;
    /**
     * Handle panel creation request from process
     */
    private handlePanelRequest;
    /**
     * Route message from process to specific panel
     */
    private routeToPanel;
    /**
     * Route message from panel to process
     */
    private routeToProcess;
    /**
     * Get all panel requests for a process
     */
    getPanelRequests(processId: string): Set<string>;
    /**
     * Get connection info
     */
    getConnectionInfo(): {
        processes: number;
        panels: number;
        processIds: string[];
        panelIds: string[];
    };
    /**
     * Stop the server
     */
    stop(): Promise<void>;
}
