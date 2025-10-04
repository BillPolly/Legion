/**
 * HTML template generation for Legion applications
 * Generates HTML with embedded WebSocket and actor initialization
 *
 * NEW PROTOCOL (Server sends first):
 * 1. Client creates ActorSpace with 'client-root' actor
 * 2. Client creates Channel with WebSocket
 * 3. Server sends 'session-ready' message first (via channel_connected event)
 * 4. Client receives session-ready and can start communicating
 */

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str) {
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Extract and validate template variables
 */
export function getTemplateVariables(options) {
  if (!options.clientActorPath) {
    throw new Error('clientActorPath is required');
  }
  if (!options.wsEndpoint) {
    throw new Error('wsEndpoint is required');
  }
  if (!options.route) {
    throw new Error('route is required');
  }

  return {
    title: options.title || 'Legion App',
    clientActorPath: options.clientActorPath,
    wsEndpoint: options.wsEndpoint,
    route: options.route
  };
}

/**
 * Generate HTML page with embedded WebSocket and actor setup
 * @param {Object} options - Template options
 * @param {string} options.title - Page title
 * @param {string} options.clientActorPath - Path to client actor JavaScript file
 * @param {string} options.wsEndpoint - WebSocket endpoint URL
 * @param {string} options.route - Route path for this application
 * @param {Object} options.importMap - Custom import map entries to merge with defaults
 * @returns {string} Generated HTML
 */
export function generateHTML(options) {
  const vars = getTemplateVariables(options);

  // Escape title for HTML but not paths in JavaScript
  const safeTitle = escapeHtml(vars.title);

  // Build import map with defaults and custom entries
  const importMapEntries = {
    "@legion/actors": "/legion/actors/src/index.js",
    "@legion/actors/": "/legion/actors/src/",
    "@legion/components": "/legion/components/src/index.js",
    "@legion/components/": "/legion/components/src/",
    "@legion/declarative-components": "/legion/declarative-components/index.js",
    "@legion/declarative-components/": "/legion/declarative-components/",
    "@legion/data-store": "/legion/data-store/index.js",
    "@legion/data-store/": "/legion/data-store/",
    "@legion/data-proxies": "/legion/data-proxies/src/index.js",
    "@legion/data-proxies/": "/legion/data-proxies/src/",
    "@legion/datascript": "/legion/datascript/index.js",
    "@legion/datascript/": "/legion/datascript/",
    "@legion/handle": "/legion/handle/src/index.js",
    "@legion/handle/remote": "/legion/handle/src/remote/RemoteHandle.js",
    "@legion/handle/": "/legion/handle/src/",
    // Browser-only libraries - not currently used in CLI UI
    // "@lib/codemirror/*": Removed to avoid loading unused dependencies
    "@lib/markdown-it": "markdown-it",
    "@lib/highlight.js": "highlight.js",
    "@lib/yaml": "yaml",
    "@lib/fast-diff": "fast-diff",
    ...(options.importMap || {})
  };

  const importMapJson = JSON.stringify({ imports: importMapEntries }, null, 4);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <script type="importmap">
  ${importMapJson}
  </script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    #app {
      width: 100%;
      min-height: 100vh;
    }
    .connection-status {
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.3s ease;
    }
    .connection-status.connecting {
      background: #ffc107;
      color: #000;
    }
    .connection-status.connected {
      background: #4caf50;
      color: #fff;
    }
    .connection-status.disconnected {
      background: #f44336;
      color: #fff;
    }
  </style>
  <script type="module">
    // Import the client actor (must export as default)
    import ClientActor from '${vars.clientActorPath}';
    import { ActorSpace, ActorSerializer } from '@legion/actors';
    import { RemoteHandle } from '@legion/handle/remote';

    // Register RemoteHandle class globally for ActorSerializer
    ActorSerializer.registerRemoteHandle(RemoteHandle);

    // Connection status indicator
    function updateConnectionStatus(status) {
      let statusEl = document.getElementById('connection-status');
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'connection-status';
        statusEl.className = 'connection-status';
        document.body.appendChild(statusEl);
      }

      statusEl.className = 'connection-status ' + status;
      statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('[CLIENT] HTML Template Version: 3.0 - New Protocol (Server sends first)');
      updateConnectionStatus('connecting');

      // Create client actor instance
      const clientActor = new ClientActor();

      // Add session-ready handler to receive server's first message
      const originalReceive = clientActor.receive?.bind(clientActor);
      clientActor.receive = function(messageType, data) {
        if (messageType === 'session-ready') {
          console.log('[CLIENT] Received session-ready from server:', data);
          updateConnectionStatus('connected');

          // Server sent us the session ID and server actor ID
          const { sessionId, serverActor } = data;

          // Create remote reference to server actor
          if (this.__channel) {
            const remoteServerActor = this.__channel.makeRemote(serverActor);

            // Set the remote actor on the client actor
            if (typeof this.setRemoteActor === 'function') {
              console.log('[CLIENT] Setting remote server actor:', serverActor);
              this.setRemoteActor(remoteServerActor);
              console.log('[CLIENT] Connection established, session:', sessionId);
            }
          }
        }

        // Call original receive if it exists
        if (originalReceive) {
          return originalReceive(messageType, data);
        }
      };

      // Create ActorSpace and register client actor
      const actorSpace = new ActorSpace('client');
      actorSpace.register(clientActor, 'client-root');

      // Create WebSocket connection
      const ws = new WebSocket('${vars.wsEndpoint}');

      // CRITICAL: Create Channel BEFORE WebSocket opens so messages can be received!
      // Server will send session-ready immediately when connection opens
      const channel = actorSpace.addChannel(ws);
      clientActor.__channel = channel;
      clientActor.__actorSpace = actorSpace;

      console.log('[CLIENT] Channel created, waiting for WebSocket to connect...');

      // Handle connection errors
      ws.onerror = (error) => {
        console.error('[CLIENT] WebSocket error:', error);
        updateConnectionStatus('disconnected');
      };

      // Handle connection close
      ws.onclose = () => {
        console.log('[CLIENT] WebSocket connection closed');
        updateConnectionStatus('disconnected');
      };

      // Wait for WebSocket to open
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          console.log('[CLIENT] WebSocket connected to ${vars.wsEndpoint}');
          console.log('[CLIENT] Waiting for session-ready from server...');
          resolve();
        };
        ws.onerror = reject;
      });

      // Make actor available globally for debugging
      window.__legionActor = clientActor;
      window.__legionActorSpace = actorSpace;
      window.__legionChannel = channel;
    });
  </script>
</head>
<body>
  <div id="app"></div>
</body>
</html>`;
}
