/**
 * DisplayManager - Manages display windows for ShowMe assets
 * Creates and manages DOM windows for displaying images and other assets
 */

export class DisplayManager {
  constructor(container) {
    this.container = container || document.body;
    this.windows = new Map();
    this.nextWindowId = 1;
  }

  /**
   * Create a display window for an asset
   * @param {Object} config - Window configuration
   * @param {string} config.id - Asset ID
   * @param {string} config.title - Window title
   * @param {string} config.type - Asset type (image, json, etc)
   * @returns {Object} Window object with methods
   */
  createWindow(config) {
    const windowId = `window-${this.nextWindowId++}`;

    // Create window element
    const windowEl = document.createElement('div');
    windowEl.setAttribute('data-showme-window', windowId);
    windowEl.setAttribute('data-asset-id', config.id);
    windowEl.className = 'showme-window';
    windowEl.style.cssText = `
      position: relative;
      border: 1px solid #ccc;
      border-radius: 8px;
      background: white;
      margin: 10px;
      padding: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    // Create title bar
    const titleBar = document.createElement('div');
    titleBar.setAttribute('data-window-title', 'true');
    titleBar.className = 'showme-window-title';
    titleBar.textContent = config.title || 'Untitled';
    titleBar.style.cssText = `
      font-weight: bold;
      padding: 5px 10px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'showme-window-close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #999;
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 20px;
    `;
    closeBtn.onclick = () => this.closeWindow(windowId);

    titleBar.appendChild(closeBtn);
    windowEl.appendChild(titleBar);

    // Create content container
    const contentEl = document.createElement('div');
    contentEl.className = 'showme-window-content';
    contentEl.setAttribute('data-window-content', 'true');
    contentEl.style.cssText = `
      padding: 10px;
      overflow: auto;
      max-height: 600px;
    `;
    windowEl.appendChild(contentEl);

    // Add to container
    this.container.appendChild(windowEl);

    // Create window object
    const windowObj = {
      id: windowId,
      element: windowEl,
      contentElement: contentEl,

      setContent(html) {
        contentEl.innerHTML = html;
      },

      show() {
        windowEl.style.display = 'block';
      },

      hide() {
        windowEl.style.display = 'none';
      },

      focus() {
        windowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        windowEl.style.borderColor = '#4CAF50';
        setTimeout(() => {
          windowEl.style.borderColor = '#ccc';
        }, 1000);
      }
    };

    // Store window
    this.windows.set(windowId, windowObj);

    return windowObj;
  }

  /**
   * Close a window
   * @param {string} windowId - Window ID to close
   */
  closeWindow(windowId) {
    const window = this.windows.get(windowId);
    if (window && window.element && window.element.parentNode) {
      window.element.parentNode.removeChild(window.element);
      this.windows.delete(windowId);
    }
  }

  /**
   * Focus a window
   * @param {string} windowId - Window ID to focus
   */
  focusWindow(windowId) {
    const window = this.windows.get(windowId);
    if (window) {
      window.focus();
    }
  }

  /**
   * Get a window by ID
   * @param {string} windowId - Window ID
   * @returns {Object|null} Window object or null
   */
  getWindow(windowId) {
    return this.windows.get(windowId) || null;
  }

  /**
   * Close all windows
   */
  closeAll() {
    for (const windowId of this.windows.keys()) {
      this.closeWindow(windowId);
    }
  }

  /**
   * Destroy the display manager
   */
  destroy() {
    this.closeAll();
    this.windows.clear();
  }
}