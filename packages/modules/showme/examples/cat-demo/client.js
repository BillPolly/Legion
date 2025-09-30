/**
 * ShowMe Client Actor for Cat Picture Demo
 * Receives RemoteHandle and displays the cat picture
 */

import { ActorSerializer } from '@legion/actors';
import { RemoteHandle } from '@legion/handle';

// Register RemoteHandle for deserialization
ActorSerializer.registerRemoteHandle(RemoteHandle);

export default class ShowMeClientActor {
  constructor() {
    this.remoteActor = null;
    this.assets = new Map();
    this.createUI();
    console.log('[CLIENT] ShowMeClientActor created');
  }

  // Framework interface: called when connection is established
  setRemoteActor(remoteActor) {
    console.log('[CLIENT] setRemoteActor called');
    this.remoteActor = remoteActor;
    this.updateStatus('Connected to ShowMe server');
  }

  // Actor protocol method: receives messages from server
  async receive(messageType, data) {
    console.log('[CLIENT] Received message:', messageType, data);

    switch (messageType) {
      case 'display-asset':
        await this.handleDisplayAsset(data);
        break;

      case 'server-status':
        this.updateStatus(`Server: ${data.running ? 'Running' : 'Stopped'}`);
        break;

      default:
        console.log('[CLIENT] Unknown message type:', messageType);
    }
  }

  // Handle display-asset message with RemoteHandle
  async handleDisplayAsset({ asset, title }) {
    console.log('[CLIENT] 📦 Received asset:', title);
    console.log('[CLIENT] Asset is RemoteHandle?', asset.isRemote);

    try {
      // Call methods on RemoteHandle (transparent remote calls!)
      const type = await asset.getType();
      const assetTitle = await asset.getTitle();
      const metadata = await asset.getMetadata();
      const data = await asset.getData();

      console.log('[CLIENT] ✅ Asset metadata:', metadata);

      // Store asset
      this.assets.set(metadata.id, { asset, metadata, data });

      // Display the asset
      this.displayAsset(metadata.id, data, metadata);

    } catch (error) {
      console.error('[CLIENT] ❌ Error handling asset:', error);
      this.showError('Failed to load asset: ' + error.message);
    }
  }

  // Display the asset in the UI
  displayAsset(assetId, data, metadata) {
    console.log('[CLIENT] 🖼️ Displaying asset:', assetId);

    const container = document.getElementById('asset-container');
    if (!container) {
      console.error('[CLIENT] Asset container not found');
      return;
    }

    const assetDiv = document.createElement('div');
    assetDiv.className = 'asset-card';
    assetDiv.id = `asset-${assetId}`;

    if (metadata.type === 'image') {
      assetDiv.innerHTML = `
        <div class="asset-header">
          <h2>${metadata.title}</h2>
          <span class="asset-type">Image</span>
        </div>
        <div class="asset-content">
          <img src="${data.asset}" alt="${metadata.title}" />
        </div>
        <div class="asset-metadata">
          <p><strong>ID:</strong> ${metadata.id}</p>
          <p><strong>Type:</strong> ${metadata.type}</p>
          <p><strong>Timestamp:</strong> ${new Date(metadata.timestamp).toLocaleString()}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
          ${data.width && data.height ? `<p><strong>Dimensions:</strong> ${data.width}x${data.height}</p>` : ''}
        </div>
      `;
    } else {
      assetDiv.innerHTML = `
        <div class="asset-header">
          <h2>${metadata.title}</h2>
          <span class="asset-type">${metadata.type}</span>
        </div>
        <div class="asset-content">
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
      `;
    }

    container.appendChild(assetDiv);
    console.log('[CLIENT] ✅ Asset displayed');
  }

  // Update status message
  updateStatus(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = 'status connected';
    }
  }

  // Show error message
  showError(message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = 'status error';
    }
  }

  // Create the UI
  createUI() {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="container">
          <header>
            <h1>🐱 ShowMe - RemoteHandle Demo</h1>
            <div class="status" id="status">Connecting...</div>
          </header>

          <main>
            <div class="info-box">
              <h3>How It Works:</h3>
              <ol>
                <li>Server creates <code>AssetHandle</code> with cat image</li>
                <li>Client receives <code>RemoteHandle</code> via Actor serialization</li>
                <li>Client calls methods like <code>getType()</code>, <code>getData()</code></li>
                <li>All calls work transparently through remote-call protocol!</li>
              </ol>
            </div>

            <div id="asset-container" class="asset-container">
              <!-- Assets will appear here -->
            </div>
          </main>
        </div>

        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }

          .container {
            max-width: 1200px;
            margin: 0 auto;
          }

          header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
          }

          header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 15px;
          }

          .status {
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 0.9em;
            display: inline-block;
          }

          .status.connected {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }

          .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }

          .info-box {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
          }

          .info-box h3 {
            color: #667eea;
            margin-bottom: 15px;
          }

          .info-box ol {
            margin-left: 20px;
            line-height: 1.8;
          }

          .info-box code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            color: #e83e8c;
          }

          .asset-container {
            display: grid;
            gap: 30px;
          }

          .asset-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            animation: slideIn 0.5s ease-out;
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .asset-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .asset-header h2 {
            font-size: 1.5em;
          }

          .asset-type {
            background: rgba(255,255,255,0.2);
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            text-transform: uppercase;
          }

          .asset-content {
            padding: 40px;
            text-align: center;
          }

          .asset-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            width: 200px;
          }

          .asset-metadata {
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e9ecef;
          }

          .asset-metadata p {
            margin: 8px 0;
            color: #495057;
          }

          .asset-metadata strong {
            color: #212529;
            font-weight: 600;
          }
        </style>
      `;
    }
  }
}

// Make actor available globally
window.ShowMeClientActor = ShowMeClientActor;