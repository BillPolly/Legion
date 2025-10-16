/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * PanelClientActor - Browser-side actor for panel display
 *
 * Uses ActorSpace and Channel for robust WebSocket communication
 */

import { ActorSpace } from '@legion/actors';

export class PanelClientActor {
  constructor(config) {
    this.config = config; // { processId, panelId, serverUrl }
    this.actorSpace = null;
    this.channel = null;
    this.messageCount = 0;

    // Actor definition
    this.actor = {
      isActor: true,
      id: 'panel-client',
      receive: async (messageType, data) => {
        await this.receive(messageType, data);
      }
    };
  }

  async initialize() {
    console.log('[Panel] Initializing with config:', this.config);

    // Create ActorSpace
    this.actorSpace = new ActorSpace('panel-client');
    this.actorSpace.register(this.actor, 'panel-client');

    // Create WebSocket
    const ws = new WebSocket(this.config.serverUrl);

    // CRITICAL: Add channel BEFORE WebSocket opens!
    this.channel = this.actorSpace.addChannel(ws, this.actor);

    // Wait for WebSocket to open
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);

      ws.addEventListener('open', () => {
        console.log('[Panel] WebSocket connected');
        clearTimeout(timeout);
        resolve();
      });

      ws.addEventListener('error', (error) => {
        console.error('[Panel] WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('[Panel] Actor framework initialized');
  }

  async receive(messageType, data) {
    console.log('[Panel] Received:', messageType, data);

    switch (messageType) {
      case 'connection-ready':
        this.onConnectionReady(data);
        break;

      case 'echo':
        this.onEcho(data);
        break;

      case 'data':
        this.onData(data);
        break;

      case 'show-image':
        this.onShowImage(data);
        break;

      default:
        this.addLogEntry('Unknown message: ' + messageType);
    }
  }

  onConnectionReady(data) {
    this.addLogEntry('Connected to panel server');
    this.updateStatus('Connected');
  }

  onEcho(data) {
    this.addLogEntry('Server: ' + data.message);
    this.messageCount++;
    this.updateCounter();
  }

  onData(data) {
    this.displayData(data.items || data);
  }

  async onShowImage(data) {
    if (data.handle && data.handle.__type === 'RemoteHandle') {
      await this.renderImageHandle(data.handle);
    } else if (data.imageData) {
      await this.renderImage(data.imageData);
    }
  }

  sendToServer(messageType, data = {}) {
    if (!this.channel) {
      console.error('[Panel] Channel not initialized');
      return;
    }

    console.log('[Panel] Sending:', messageType, data);

    // Get remote server actor
    const serverActor = this.channel.makeRemote(`panel-actor-${this.config.panelId}`);
    serverActor.receive(messageType, data);
  }

  handleSendClick() {
    this.sendToServer('ping', {
      message: `Message ${this.messageCount + 1} from panel ${this.config.panelId}`
    });
  }

  handleRequestData() {
    this.sendToServer('request-data', {});
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
      entry.textContent = `[${time}] ${message}`;
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

  async renderImageHandle(handle) {
    console.log('[Panel] Rendering image from RemoteHandle:', handle);
    this.addLogEntry('Received image Handle');

    const dataEl = document.getElementById('data');
    if (dataEl) {
      dataEl.style.display = 'block';
      dataEl.innerHTML = '<h4>Image Viewer:</h4>';

      const imageContainer = document.createElement('div');
      imageContainer.className = 'image-viewer-container';
      imageContainer.style.width = '100%';
      imageContainer.style.minHeight = '400px';
      imageContainer.style.marginTop = '10px';
      dataEl.appendChild(imageContainer);

      try {
        const { ImageViewer } = await import('@legion/components');
        const viewer = ImageViewer.create({
          dom: imageContainer,
          imageData: handle.imageData || handle.url || handle.data,
          showControls: true,
          showInfo: true,
          onImageLoaded: (info) => {
            this.addLogEntry(`Image loaded: ${info.width}x${info.height} ${info.type}`);
          },
          onZoomChanged: (zoom) => {
            console.log('[Panel] Zoom changed:', zoom);
          }
        });

        this.addLogEntry('ImageViewer created successfully');
      } catch (error) {
        console.error('[Panel] ImageViewer creation failed:', error);
        this.addLogEntry('Error creating ImageViewer: ' + error.message);
      }
    }
  }

  async renderImage(imageData) {
    console.log('[Panel] Rendering image from data');
    this.addLogEntry('Received image data');

    const dataEl = document.getElementById('data');
    if (dataEl) {
      dataEl.style.display = 'block';
      dataEl.innerHTML = '<h4>Image Viewer:</h4>';

      const imageContainer = document.createElement('div');
      imageContainer.className = 'image-viewer-container';
      imageContainer.style.width = '100%';
      imageContainer.style.minHeight = '400px';
      imageContainer.style.marginTop = '10px';
      dataEl.appendChild(imageContainer);

      try {
        const { ImageViewer } = await import('@legion/components');
        const viewer = ImageViewer.create({
          dom: imageContainer,
          imageData: imageData,
          showControls: true,
          showInfo: true,
          onImageLoaded: (info) => {
            this.addLogEntry(`Image loaded: ${info.width}x${info.height} ${info.type}`);
          }
        });

        this.addLogEntry('ImageViewer created successfully');
      } catch (error) {
        console.error('[Panel] ImageViewer creation failed:', error);
        this.addLogEntry('Error creating ImageViewer: ' + error.message);
      }
    }
  }
}
