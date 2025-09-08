/**
 * ShowMe UI Application Entry Point
 * 
 * Main application that connects to ShowMe server and displays assets
 */

import { ShowMeApp } from './ShowMeApp.js';

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

async function initialize() {
  try {
    console.log('Initializing ShowMe UI...');
    
    // Get app container
    const container = document.getElementById('app');
    if (!container) {
      throw new Error('App container not found');
    }
    
    // Create and initialize app
    const app = new ShowMeApp({
      container,
      serverUrl: getServerUrl()
    });
    
    await app.initialize();
    
    console.log('ShowMe UI initialized successfully');
    
    // Store app reference for debugging
    window.showMeApp = app;
    
  } catch (error) {
    console.error('Failed to initialize ShowMe UI:', error);
    showError(error);
  }
}

/**
 * Get server URL from query params or environment
 */
function getServerUrl() {
  const params = new URLSearchParams(window.location.search);
  const serverUrl = params.get('server') || 
                   window.SHOWME_SERVER_URL || 
                   'ws://localhost:3700/showme';
  return serverUrl;
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
        color: #dc2626;
        text-align: center;
        padding: 20px;
      ">
        <h1 style="font-size: 24px; margin-bottom: 10px;">Initialization Error</h1>
        <p style="color: #666; max-width: 500px;">${error.message}</p>
        <button onclick="location.reload()" style="
          margin-top: 20px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Retry</button>
      </div>
    `;
  }
}