/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * PanelManager - Generates HTML for Chrome browser panels
 *
 * Responsibilities:
 * - Generate HTML with ActorSpace integration
 * - Track active panels
 * - Provide panel HTML via HTTP
 */

export class PanelManager {
  constructor(serverPort = 5500, serverHost = 'localhost', log = console.log) {
    this.panels = new Map();
    this.serverPort = serverPort;
    this.serverHost = serverHost;
    this.log = log;
  }

  /**
   * Register a new panel
   */
  registerPanel(processId, panelId, title = 'Legion Panel') {
    if (this.panels.has(panelId)) {
      this.log(`[PanelManager] Panel already registered: ${panelId}`);
      return;
    }

    this.log(`[PanelManager] Registering panel: ${panelId} for process ${processId}`);

    const panelInfo = {
      processId,
      panelId,
      title,
      createdAt: new Date(),
    };
    this.panels.set(panelId, panelInfo);
  }

  /**
   * Generate HTML for a panel
   */
  getPanelHtml(processId, panelId) {
    const panelInfo = this.panels.get(panelId);
    const title = panelInfo?.title || 'Legion Panel';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    // Import Legion packages
    import { ActorSpace } from '/legion/actors/src/ActorSpace.js';
    import { DynamicDataStore } from '/legion/data-store/src/DynamicDataStore.js';
    import { ComponentLifecycle } from '/legion/declarative-components/src/lifecycle/ComponentLifecycle.js';
    import { RemoteHandle } from '/legion/handle/src/remote/RemoteHandle.js';

    // Configuration injected by server
    const CONFIG = {
      processId: '${processId}',
      panelId: '${panelId}',
      serverUrl: 'ws://${this.serverHost}:${this.serverPort}/ws/panel?processId=${processId}&panelId=${panelId}'
    };

    console.log('[Panel] Config:', CONFIG);
    console.log('[Panel] Legion modules loaded successfully');

    // Panel client actor for communicating with server
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
            this.addLogEntry('Connected to panel server');
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
                <h1>Legion Panel Server</h1>
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
   * Get panel info by ID
   */
  getPanel(panelId) {
    return this.panels.get(panelId);
  }

  /**
   * Get all panels for a process
   */
  getPanelsForProcess(processId) {
    return Array.from(this.panels.values()).filter(
      (p) => p.processId === processId
    );
  }

  /**
   * Remove panel registration
   */
  unregisterPanel(panelId) {
    if (this.panels.has(panelId)) {
      this.log(`[PanelManager] Unregistering panel: ${panelId}`);
      this.panels.delete(panelId);
    }
  }

  /**
   * Remove all panels for a process
   */
  unregisterPanelsForProcess(processId) {
    const panels = this.getPanelsForProcess(processId);
    panels.forEach((p) => this.unregisterPanel(p.panelId));
  }

  /**
   * Clear all panel registrations
   */
  clear() {
    this.panels.clear();
  }
}
