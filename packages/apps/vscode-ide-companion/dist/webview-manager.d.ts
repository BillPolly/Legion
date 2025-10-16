/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */
/**
 * WebviewManager - Manages VSCode webview panels for Legion processes
 *
 * Responsibilities:
 * - Create and track webview panels
 * - Generate HTML with ActorSpace integration
 * - Monitor panel requests from ExtensionServer
 * - Clean up panels when closed
 */
import * as vscode from 'vscode';
import type { ExtensionServer } from './extension-server.js';
export interface PanelInfo {
    panel: vscode.WebviewPanel;
    processId: string;
    panelId: string;
    title: string;
}
export declare class WebviewManager {
    private panels;
    private extensionServer;
    private context;
    private log;
    constructor(extensionServer: ExtensionServer, context: vscode.ExtensionContext, log?: (message: string) => void);
    /**
     * Create a new panel for a process
     */
    createPanel(processId: string, panelId: string, title?: string): Promise<vscode.WebviewPanel>;
    /**
     * Generate HTML for webview with ActorSpace integration
     */
    private getWebviewHtml;
    /**
     * Get panel by ID
     */
    getPanel(panelId: string): PanelInfo | undefined;
    /**
     * Get all panels for a process
     */
    getPanelsForProcess(processId: string): PanelInfo[];
    /**
     * Close panel
     */
    closePanel(panelId: string): void;
    /**
     * Close all panels for a process
     */
    closePanelsForProcess(processId: string): void;
    /**
     * Dispose all panels
     */
    dispose(): void;
}
