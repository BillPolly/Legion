/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */

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

export class WebviewManager {
  private panels: Map<string, PanelInfo> = new Map();
  private extensionServer: ExtensionServer;
  private context: vscode.ExtensionContext;
  private log: (message: string) => void;

  constructor(
    extensionServer: ExtensionServer,
    context: vscode.ExtensionContext,
    log?: (message: string) => void
  ) {
    this.extensionServer = extensionServer;
    this.context = context;
    this.log = log || console.log;
  }

  /**
   * Create a new panel for a process
   */
  async createPanel(
    processId: string,
    panelId: string,
    title: string = 'Legion Panel'
  ): Promise<vscode.WebviewPanel> {
    // Check if panel already exists
    if (this.panels.has(panelId)) {
      const existing = this.panels.get(panelId)!;
      existing.panel.reveal();
      return existing.panel;
    }

    this.log(`[WebviewManager] Creating panel: ${panelId} for process ${processId}`);

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'legionPanel',
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri],
      }
    );

    // Set HTML content
    panel.webview.html = this.getWebviewHtml(processId, panelId);

    // Store panel info
    const panelInfo: PanelInfo = {
      panel,
      processId,
      panelId,
      title,
    };
    this.panels.set(panelId, panelInfo);

    // Handle panel disposal
    panel.onDidDispose(() => {
      this.log(`[WebviewManager] Panel disposed: ${panelId}`);
      this.panels.delete(panelId);
    });

    return panel;
  }

  /**
   * Generate HTML for webview with ActorSpace integration
   */
  private getWebviewHtml(processId: string, panelId: string): string {
    // Get server port from ExtensionServer
    const serverPort = 5500; // TODO: Get from ExtensionServer

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' http://localhost:${serverPort}; connect-src ws://localhost:${serverPort}; style-src 'unsafe-inline';">
  <title>Legion Panel</title>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    // Configuration injected by extension
    const CONFIG = {
      processId: '${processId}',
      panelId: '${panelId}',
      serverUrl: 'ws://localhost:${serverPort}/ws/panel?processId=${processId}&panelId=${panelId}'
    };

    console.log('[Panel] Config:', CONFIG);

    // Import ActorSpace from extension server
    // NOTE: In production, this would be served by ExtensionServer via /legion/ routes
    // For now, we'll inline the minimal client actor code

    class PanelClientActor {
      constructor() {
        this.remoteActor = null;
        this.messageCount = 0;
        this.createUI();
        this.connectToServer();
      }

      async connectToServer() {
        try {
          console.log('[Panel] Connecting to:', CONFIG.serverUrl);

          // Create WebSocket connection
          this.ws = new WebSocket(CONFIG.serverUrl);

          this.ws.onopen = () => {
            console.log('[Panel] WebSocket connected');
            this.updateStatus('Connected');
          };

          this.ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log('[Panel] Received message:', message);

              // Simple actor protocol handling
              if (message.type === 'receive') {
                this.receive(message.messageType, message.data);
              }
            } catch (error) {
              console.error('[Panel] Message parse error:', error);
            }
          };

          this.ws.onerror = (error) => {
            console.error('[Panel] WebSocket error:', error);
            this.updateStatus('Error');
          };

          this.ws.onclose = () => {
            console.log('[Panel] WebSocket closed');
            this.updateStatus('Disconnected');
          };

        } catch (error) {
          console.error('[Panel] Connection error:', error);
          this.updateStatus('Failed');
        }
      }

      async receive(messageType, data) {
        console.log('[Panel] Received:', messageType, data);

        switch (messageType) {
          case 'connection-ready':
            this.addLogEntry('Connected to extension server');
            break;

          case 'echo':
            this.addLogEntry('Server: ' + data.message);
            this.messageCount++;
            this.updateCounter();
            break;

          case 'data':
            this.displayData(data.items || data);
            break;

          default:
            this.addLogEntry('Unknown message: ' + messageType);
        }
      }

      sendToServer(messageType, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('[Panel] Sending:', messageType, data);
          // Simple actor protocol message format
          this.ws.send(JSON.stringify({
            type: 'receive',
            messageType: messageType,
            data: data
          }));
        } else {
          console.error('[Panel] WebSocket not ready');
        }
      }

      handleSendClick() {
        this.sendToServer('ping', {
          message: \`Message \${this.messageCount + 1} from panel \${CONFIG.panelId}\`
        });
      }

      handleRequestData() {
        this.sendToServer('request-data', {});
      }

      createUI() {
        const app = document.getElementById('app');
        if (app) {
          app.innerHTML = \`
            <style>
              :root {
                --bg-primary: #1e1e1e;
                --bg-secondary: #252526;
                --text-primary: #cccccc;
                --accent: #007acc;
                --success: #4ec9b0;
                --border: #3e3e42;
              }

              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: var(--bg-primary);
                color: var(--text-primary);
                padding: 20px;
              }

              .panel-container {
                max-width: 800px;
                margin: 0 auto;
              }

              .panel-header {
                background: var(--accent);
                color: white;
                padding: 20px;
                border-radius: 6px 6px 0 0;
              }

              .panel-header h1 {
                font-size: 24px;
                margin-bottom: 8px;
              }

              .panel-header .subtitle {
                font-size: 14px;
                opacity: 0.9;
              }

              .panel-body {
                background: var(--bg-secondary);
                padding: 20px;
                border-radius: 0 0 6px 6px;
              }

              .status-bar {
                background: #3e3e42;
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 20px;
              }

              .counter {
                font-size: 48px;
                font-weight: bold;
                text-align: center;
                margin: 20px 0;
                color: var(--success);
              }

              .button {
                background: var(--accent);
                color: white;
                border: none;
                padding: 10px 20px;
                margin: 5px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
              }

              .button:hover {
                opacity: 0.9;
              }

              .button:active {
                opacity: 0.8;
              }

              .log {
                background: #1e1e1e;
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 12px;
                max-height: 300px;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                margin-top: 20px;
              }

              .log-entry {
                padding: 4px 0;
                border-bottom: 1px solid var(--border);
              }

              .log-entry:last-child {
                border-bottom: none;
              }

              .data-display {
                background: #1e1e1e;
                border: 1px solid var(--border);
                border-radius: 4px;
                padding: 12px;
                margin-top: 20px;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                display: none;
              }
            </style>

            <div class="panel-container">
              <div class="panel-header">
                <h1>Legion IDE Companion</h1>
                <div class="subtitle">Panel: ${panelId} | Process: ${processId}</div>
              </div>
              <div class="panel-body">
                <div class="status-bar">
                  Status: <span id="status">Connecting...</span>
                </div>

                <div class="counter" id="counter">0</div>

                <div style="text-align: center;">
                  <button class="button" id="send-btn">Send Message</button>
                  <button class="button" id="data-btn">Request Data</button>
                </div>

                <h3 style="margin-top: 30px;">Message Log:</h3>
                <div class="log" id="log">
                  <div class="log-entry">Initializing...</div>
                </div>

                <div class="data-display" id="data"></div>
              </div>
            </div>
          \`;

          // Add event listeners
          document.getElementById('send-btn').addEventListener('click', () => this.handleSendClick());
          document.getElementById('data-btn').addEventListener('click', () => this.handleRequestData());
        }
      }

      updateStatus(status) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
          statusEl.textContent = status;
        }
      }

      updateCounter() {
        const counterEl = document.getElementById('counter');
        if (counterEl) {
          counterEl.textContent = this.messageCount;
        }
      }

      addLogEntry(message) {
        const log = document.getElementById('log');
        if (log) {
          const entry = document.createElement('div');
          entry.className = 'log-entry';
          const time = new Date().toLocaleTimeString();
          entry.textContent = \`[\${time}] \${message}\`;
          log.appendChild(entry);
          log.scrollTop = log.scrollHeight;
        }
      }

      displayData(items) {
        const dataEl = document.getElementById('data');
        if (dataEl) {
          dataEl.style.display = 'block';
          dataEl.innerHTML = '<h4>Data from Server:</h4><pre>' +
            JSON.stringify(items, null, 2) + '</pre>';
        }
      }
    }

    // Initialize panel
    console.log('[Panel] Initializing...');
    const panelActor = new PanelClientActor();
  </script>
</body>
</html>`;
  }

  /**
   * Get panel by ID
   */
  getPanel(panelId: string): PanelInfo | undefined {
    return this.panels.get(panelId);
  }

  /**
   * Get all panels for a process
   */
  getPanelsForProcess(processId: string): PanelInfo[] {
    return Array.from(this.panels.values()).filter(
      (p) => p.processId === processId
    );
  }

  /**
   * Close panel
   */
  closePanel(panelId: string): void {
    const panelInfo = this.panels.get(panelId);
    if (panelInfo) {
      panelInfo.panel.dispose();
      this.panels.delete(panelId);
    }
  }

  /**
   * Close all panels for a process
   */
  closePanelsForProcess(processId: string): void {
    const panels = this.getPanelsForProcess(processId);
    panels.forEach((p) => this.closePanel(p.panelId));
  }

  /**
   * Dispose all panels
   */
  dispose(): void {
    this.panels.forEach((p) => p.panel.dispose());
    this.panels.clear();
  }
}
