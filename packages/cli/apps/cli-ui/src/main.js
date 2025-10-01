/**
 * CLI Web UI Application Entry Point
 *
 * Main application that connects to CLI server and provides terminal interface
 */

import { CLIWebApp } from './CLIWebApp.js';

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

async function initialize() {
  try {
    console.log('Initializing CLI Web UI...');

    // Get app container
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('App container not found');
    }

    // Get server URL from query params or use default
    const serverUrl = getServerUrl();

    // Create and initialize app
    const app = new CLIWebApp({
      container,
      serverUrl
    });

    await app.initialize();

    console.log('CLI Web UI initialized successfully');

    // Store app reference for debugging
    window.cliApp = app;

  } catch (error) {
    console.error('Failed to initialize CLI Web UI:', error);
    showError(error);
  }
}

/**
 * Get server URL from query params or environment
 */
function getServerUrl() {
  const params = new URLSearchParams(window.location.search);

  // If server URL provided via query param or window var, use it
  if (params.get('server')) {
    return params.get('server');
  }
  if (window.CLI_SERVER_URL) {
    return window.CLI_SERVER_URL;
  }

  // Otherwise, auto-detect from current page location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // includes port
  return `${protocol}//${host}/ws?route=/cli`;
}

/**
 * Show error message in UI
 */
function showError(error) {
  const container = document.getElementById('app');
  if (container) {
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background: #1e1e1e;
        color: #f48771;
        text-align: center;
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <h1 style="font-size: 24px; margin-bottom: 10px;">Initialization Error</h1>
        <p style="color: #d4d4d4; max-width: 500px;">${error.message}</p>
        <button onclick="location.reload()" style="
          margin-top: 20px;
          padding: 10px 20px;
          background: #569cd6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        ">Retry</button>
      </div>
    `;
  }
}
