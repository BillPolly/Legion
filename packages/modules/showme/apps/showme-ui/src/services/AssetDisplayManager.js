/**
 * AssetDisplayManager
 * 
 * Manages asset display using the ShowMe WindowManager
 * Connects the ShowMe module's WindowManager to the client UI
 */

import { WindowManager } from '/showme-src/ui/WindowManager.js';

export class AssetDisplayManager {
  constructor(config = {}) {
    this.config = {
      container: config.container || document.body,
      defaultWidth: config.defaultWidth || 800,
      defaultHeight: config.defaultHeight || 600,
      minWidth: config.minWidth || 400,
      minHeight: config.minHeight || 300,
      ...config
    };
    
    // Use ShowMe WindowManager instead of custom window management
    this.windowManager = new WindowManager({
      defaultWidth: this.config.defaultWidth,
      defaultHeight: this.config.defaultHeight,
      zIndexBase: 1000,
      positionOffset: 30,
      defaultX: 50,
      defaultY: 50
    });
    
    // Window area
    this.windowArea = null;
  }
  
  /**
   * Initialize the display manager
   */
  async initialize() {
    // Set up window area if not provided
    if (!this.windowArea) {
      this.windowArea = this.config.container;
    }
    
    // Apply global styles
    this.applyGlobalStyles();
  }
  
  /**
   * Set the window area container
   */
  setWindowArea(container) {
    this.windowArea = container;
  }
  
  /**
   * Get the underlying WindowManager
   */
  getWindowManager() {
    return this.windowManager;
  }
  
  /**
   * Create a new window for asset display
   */
  createWindow(options = {}) {
    const windowId = options.id || this.generateWindowId();
    
    // Create asset display window using WindowManager
    const windowConfig = {
      id: windowId,
      title: options.title || 'Asset Viewer',
      content: '<div class="asset-content">Loading...</div>', // Initial content
      width: options.width || this.config.defaultWidth,
      height: options.height || this.config.defaultHeight,
      x: options.x,
      y: options.y,
      resizable: options.resizable !== false,
      closable: options.closable !== false
    };
    
    // Create window via WindowManager
    const window = this.windowManager.createWindow(windowConfig);
    
    // If assetId provided, render the asset content
    if (options.assetId && this.server) {
      this.renderAssetInWindow(window, options.assetId, options);
    }
    
    // Wrap with asset-specific methods
    const assetWindow = this.wrapWindowWithAssetMethods(window, options);
    
    return assetWindow;
  }

  /**
   * Set the server reference for asset fetching
   */
  setServer(server) {
    this.server = server;
  }

  /**
   * Render asset content in window
   */
  async renderAssetInWindow(window, assetId, options = {}) {
    try {
      if (!this.server || !this.server.assets) {
        throw new Error('Server not available for asset fetching');
      }

      // Get asset from server state
      const assetData = this.server.assets.get(assetId);
      if (!assetData) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      // Get appropriate renderer based on asset type
      const renderer = this.getRendererForType(assetData.type);
      if (!renderer) {
        throw new Error(`No renderer available for type: ${assetData.type}`);
      }

      // Render the asset
      const renderResult = renderer.render(assetData.asset);
      
      // Update window content
      const contentElement = window.element.querySelector('.showme-window-content');
      if (contentElement && renderResult.element) {
        contentElement.innerHTML = '';
        contentElement.appendChild(renderResult.element);
      }

    } catch (error) {
      console.error('Failed to render asset in window:', error);
      // Show error in window
      const contentElement = window.element.querySelector('.showme-window-content');
      if (contentElement) {
        contentElement.innerHTML = `<div class="error-message">Failed to load asset: ${error.message}</div>`;
      }
    }
  }

  /**
   * Get renderer for asset type
   */
  getRendererForType(assetType) {
    if (!this.renderers) {
      this.initializeRenderers();
    }
    return this.renderers[assetType];
  }

  /**
   * Initialize renderers
   */
  initializeRenderers() {
    // Import renderers dynamically in a real implementation
    // For now, create mock renderers for testing
    this.renderers = {
      image: {
        render: (asset) => {
          const element = document.createElement('div');
          element.className = 'image-viewer';
          const img = document.createElement('img');
          img.src = asset;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          element.appendChild(img);
          return { element };
        }
      },
      json: {
        render: (asset) => {
          const element = document.createElement('div');
          element.className = 'json-viewer';
          const pre = document.createElement('pre');
          pre.style.cssText = 'margin: 0; padding: 16px; background: #f5f5f5; border-radius: 4px; overflow: auto;';
          pre.textContent = typeof asset === 'string' ? asset : JSON.stringify(asset, null, 2);
          element.appendChild(pre);
          return { element };
        }
      },
      data: {
        render: (asset) => {
          const element = document.createElement('div');
          element.className = 'table-viewer';
          if (Array.isArray(asset) && asset.length > 0) {
            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse;';
            
            // Headers
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = Object.keys(asset[0]);
            headers.forEach(header => {
              const th = document.createElement('th');
              th.textContent = header;
              th.style.cssText = 'border: 1px solid #ddd; padding: 8px; background: #f9f9f9;';
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Body
            const tbody = document.createElement('tbody');
            asset.forEach(row => {
              const tr = document.createElement('tr');
              headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = row[header];
                td.style.cssText = 'border: 1px solid #ddd; padding: 8px;';
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            element.appendChild(table);
          }
          return { element };
        }
      },
      table: {
        render: (asset) => {
          // Same as data renderer
          const element = document.createElement('div');
          element.className = 'table-viewer';
          if (Array.isArray(asset) && asset.length > 0) {
            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse;';
            
            // Headers
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = Object.keys(asset[0]);
            headers.forEach(header => {
              const th = document.createElement('th');
              th.textContent = header;
              th.style.cssText = 'border: 1px solid #ddd; padding: 8px; background: #f9f9f9;';
              headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Body
            const tbody = document.createElement('tbody');
            asset.forEach(row => {
              const tr = document.createElement('tr');
              headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = row[header];
                td.style.cssText = 'border: 1px solid #ddd; padding: 8px;';
                tr.appendChild(td);
              });
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            element.appendChild(table);
          }
          return { element };
        }
      },
      csv: {
        render: (asset) => {
          const element = document.createElement('div');
          element.className = 'table-viewer';
          
          // Parse CSV string
          if (typeof asset === 'string') {
            const lines = asset.trim().split('\n');
            if (lines.length > 0) {
              const table = document.createElement('table');
              table.style.cssText = 'width: 100%; border-collapse: collapse;';
              
              // Headers (first line)
              const thead = document.createElement('thead');
              const headerRow = document.createElement('tr');
              const headers = lines[0].split(',').map(h => h.trim());
              headers.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                th.style.cssText = 'border: 1px solid #ddd; padding: 8px; background: #f9f9f9;';
                headerRow.appendChild(th);
              });
              thead.appendChild(headerRow);
              table.appendChild(thead);
              
              // Body (remaining lines)
              const tbody = document.createElement('tbody');
              for (let i = 1; i < lines.length; i++) {
                const cells = lines[i].split(',').map(c => c.trim());
                const tr = document.createElement('tr');
                cells.forEach(cell => {
                  const td = document.createElement('td');
                  td.textContent = cell;
                  td.style.cssText = 'border: 1px solid #ddd; padding: 8px;';
                  tr.appendChild(td);
                });
                tbody.appendChild(tr);
              }
              table.appendChild(tbody);
              element.appendChild(table);
            }
          }
          return { element };
        }
      }
    };
  }
  
  /**
   * Get window by ID
   */
  getWindow(windowId) {
    return this.windowManager.getWindow(windowId);
  }
  
  /**
   * Focus a window
   */
  focusWindow(windowId) {
    return this.windowManager.focusWindow(windowId);
  }
  
  /**
   * Close a window
   */
  closeWindow(windowId) {
    return this.windowManager.closeWindow(windowId);
  }
  
  /**
   * Close all windows
   */
  closeAllWindows() {
    this.windowManager.closeAllWindows();
  }
  
  /**
   * Wrap WindowManager window with asset-specific methods
   */
  wrapWindowWithAssetMethods(window, options) {
    // Add asset-specific methods to the window
    window.setContent = (content) => {
      const contentElement = window.element.querySelector('.showme-window-content');
      if (contentElement) {
        if (typeof content === 'string') {
          contentElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          contentElement.innerHTML = '';
          contentElement.appendChild(content);
        }
      }
    };
    
    window.show = () => {
      window.element.style.display = 'block';
      this.windowManager.focusWindow(window.id);
    };
    
    window.hide = () => {
      window.element.style.display = 'none';
    };
    
    window.close = () => {
      this.windowManager.closeWindow(window.id);
    };
    
    window.focus = () => {
      this.windowManager.focusWindow(window.id);
    };
    
    return window;
  }
  
  /**
   * Generate unique window ID
   */
  generateWindowId() {
    return `window_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
  
  /**
   * Apply global styles for windows
   */
  applyGlobalStyles() {
    const styleId = 'asset-display-manager-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .asset-window {
        position: absolute;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
        transition: box-shadow 0.2s;
      }
      
      .asset-window.active {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }
      
      .asset-window-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        border-radius: 8px 8px 0 0;
        cursor: move;
        user-select: none;
      }
      
      .asset-window-title {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }
      
      .asset-window-controls {
        display: flex;
        gap: 8px;
      }
      
      .asset-window-control {
        width: 24px;
        height: 24px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
      }
      
      .asset-window-control:hover {
        background: #f3f4f6;
      }
      
      .asset-window-content {
        flex: 1;
        overflow: auto;
        padding: 16px;
      }
      
      .asset-window-resize-handle {
        position: absolute;
        background: transparent;
      }
      
      .resize-handle-n { top: 0; left: 10px; right: 10px; height: 5px; cursor: ns-resize; }
      .resize-handle-s { bottom: 0; left: 10px; right: 10px; height: 5px; cursor: ns-resize; }
      .resize-handle-e { top: 10px; right: 0; bottom: 10px; width: 5px; cursor: ew-resize; }
      .resize-handle-w { top: 10px; left: 0; bottom: 10px; width: 5px; cursor: ew-resize; }
      .resize-handle-ne { top: 0; right: 0; width: 10px; height: 10px; cursor: nesw-resize; }
      .resize-handle-nw { top: 0; left: 0; width: 10px; height: 10px; cursor: nwse-resize; }
      .resize-handle-se { bottom: 0; right: 0; width: 10px; height: 10px; cursor: nwse-resize; }
      .resize-handle-sw { bottom: 0; left: 0; width: 10px; height: 10px; cursor: nesw-resize; }
    `;
    
    document.head.appendChild(style);
  }
  
  /**
   * Cleanup and destroy
   */
  destroy() {
    this.closeAllWindows();
    this.windowArea = null;
    this.windowManager = null;
  }
}

// AssetWindow class is now replaced by WindowManager with asset-specific methods
// The wrapWindowWithAssetMethods() function above provides the necessary asset display functionality