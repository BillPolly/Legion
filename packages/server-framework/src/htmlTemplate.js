/**
 * HTML template generation for Legion applications
 * Generates HTML with embedded WebSocket and actor initialization
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
 * @returns {string} Generated HTML
 */
export function generateHTML(options) {
  const vars = getTemplateVariables(options);
  
  // Escape title for HTML but not paths in JavaScript
  const safeTitle = escapeHtml(vars.title);
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
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
    import { ActorSpace } from '/legion/actors/ActorSpace.js';
    
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
    document.addEventListener('DOMContentLoaded', () => {
      updateConnectionStatus('connecting');
      
      // Establish WebSocket connection
      const ws = new WebSocket('${vars.wsEndpoint}');
      
      // Create client actor instance
      const clientActor = new ClientActor();
      const actorSpace = new ActorSpace('client');
      actorSpace.register(clientActor, 'client-root');
      
      let channel = null;
      
      // Set up channel when connected
      ws.onopen = () => {
        console.log('[CLIENT] WebSocket connected to ${vars.wsEndpoint}');
        updateConnectionStatus('connected');
        
        channel = actorSpace.addChannel(ws);
        console.log('[CLIENT] ActorSpace channel created, waiting for server actor...');
      };
      
      // Handle errors
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('disconnected');
      };
      
      // Handle connection close
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        updateConnectionStatus('disconnected');
        
        // Could implement reconnection logic here
      };
      
      // Make actor available globally for debugging
      window.__legionActor = clientActor;
      window.__legionActorSpace = actorSpace;
    });
  </script>
</head>
<body>
  <div id="app"></div>
</body>
</html>`;
}