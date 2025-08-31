/**
 * DefaultResourceProvider - Lightweight default resource provider
 * Provides minimal HTML, favicon, and client JavaScript
 */

import { ResourceProvider, ResourceResponse } from './ResourceProvider.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DefaultResourceProvider extends ResourceProvider {
  constructor(config = {}) {
    super();
    this.config = {
      title: config.title || 'Legion App',
      clientContainer: config.clientContainer || null, // e.g., 'app'
      clientActorPath: config.clientActorPath || '/client.js',
      wsEndpoint: config.wsEndpoint || 'ws://localhost:8080/ws',
      route: config.route || '/',
      ...config
    };
  }

  async getResource(path, req) {
    switch (path) {
      case '/':
        return new ResourceResponse({
          type: 'text/html',
          content: this.generateHTML(),
          cache: false
        });

      case '/favicon.ico':
        return new ResourceResponse({
          type: 'image/x-icon',
          file: this.getDefaultFaviconPath(),
          cache: '1 year'
        });

      case '/client.js':
        console.log('[DEBUG] /client.js requested, clientActorFile:', this.config.clientActorFile);
        if (this.config.clientActorFile) {
          return new ResourceResponse({
            type: 'application/javascript',
            file: this.config.clientActorFile,
            cache: false
          });
        } else {
          console.log('[DEBUG] No clientActorFile configured');
        }
        break;

      default:
        return null; // Not found
    }

    return null;
  }

  generateHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.config.title}</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <style>
    body { 
      margin: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
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
    // Import client actor from the route-specific path
    import ClientActor from '${this.config.clientActorPath}';
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
      const ws = new WebSocket('${this.config.wsEndpoint}');
      
      // Create client actor instance
      const clientActor = new ClientActor();
      const actorSpace = new ActorSpace('client');
      actorSpace.register(clientActor, 'client-root');
      
      // Store references for actor to use
      clientActor.__actorSpace = actorSpace;
      clientActor.__channel = null;
      
      let channel = null;
      let handshakeCompleted = false;

      // Set up channel when connected
      ws.onopen = () => {
        console.log('[CLIENT] WebSocket connected to ${this.config.wsEndpoint}');
        updateConnectionStatus('connected');
        
        // Send handshake BEFORE creating channel
        const handshake = {
          type: 'actor_handshake',
          clientRootActor: 'client-root',
          route: '${this.config.route}'
        };
        console.log('[CLIENT] Sending handshake:', handshake);
        ws.send(JSON.stringify(handshake));
      };
      
      // Handle incoming messages - ONLY for handshake protocol
      ws.onmessage = (event) => {
        // Only process messages until handshake is complete
        if (!handshakeCompleted) {
          try {
            const message = JSON.parse(event.data);
            
            // Handle handshake acknowledgment
            if (message.type === 'actor_handshake_ack') {
              console.log('[CLIENT] Received handshake ack:', message);
              handshakeCompleted = true;
              
              // NOW create the channel after handshake is complete
              channel = actorSpace.addChannel(ws);
              clientActor.__channel = channel;
              console.log('[CLIENT] ActorSpace channel created after handshake');
              
              if (message.serverRootActor && channel) {
                // Create remote reference to server actor
                const remoteServerActor = channel.makeRemote(message.serverRootActor);
                
                // Set the remote actor on the client actor
                if (typeof clientActor.setRemoteActor === 'function') {
                  console.log('[CLIENT] Setting remote server actor...');
                  clientActor.setRemoteActor(remoteServerActor);
                  console.log('[CLIENT] Remote server actor set successfully');
                }
              }
              
              // Channel now owns the WebSocket - it will handle all further messages
            }
          } catch (error) {
            console.error('[CLIENT] Error processing handshake message:', error);
          }
        }
        // After handshake, the Channel's handler processes all messages
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
  ${this.config.clientContainer ? `<div id="${this.config.clientContainer}"></div>` : '<div id="app"></div>'}
</body>
</html>`;
  }

  getDefaultFaviconPath() {
    // Return path to default favicon in framework assets
    return path.join(__dirname, '../assets/favicon.ico');
  }

  async listResources() {
    const resources = ['/', '/favicon.ico'];
    if (this.config.clientActorFile) {
      resources.push('/client.js');
    }
    return resources;
  }
}