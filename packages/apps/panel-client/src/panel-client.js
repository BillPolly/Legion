/**
 * @license
 * Copyright 2025 Legion Framework
 * SPDX-License-Identifier: MIT
 */

/**
 * Panel Client Initialization
 * Reads config from URL parameters and initializes PanelClientActor
 */

import { PanelClientActor } from './PanelClientActor.js';

// Parse URL parameters to get config
const urlParams = new URLSearchParams(window.location.search);
const processId = urlParams.get('processId');
const panelId = urlParams.get('panelId');

if (!processId || !panelId) {
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Error: Missing processId or panelId parameters</div>';
  throw new Error('Missing required URL parameters');
}

// Build server URL
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const serverUrl = `${protocol}//${window.location.host}/ws/panel?processId=${processId}&panelId=${panelId}`;

const config = {
  processId,
  panelId,
  serverUrl
};

console.log('[Panel Client] Starting with config:', config);

// Update subtitle with panel info
const subtitle = document.getElementById('subtitle');
if (subtitle) {
  subtitle.textContent = `Panel: ${panelId} | Process: ${processId}`;
}

// Initialize panel client actor
const panelClient = new PanelClientActor(config);

// Setup button event listeners
document.getElementById('send-btn').addEventListener('click', () => {
  panelClient.handleSendClick();
});

document.getElementById('data-btn').addEventListener('click', () => {
  panelClient.handleRequestData();
});

// Initialize the actor
panelClient.initialize().catch((error) => {
  console.error('[Panel Client] Initialization failed:', error);
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = 'Failed: ' + error.message;
    statusEl.style.color = 'red';
  }
});
