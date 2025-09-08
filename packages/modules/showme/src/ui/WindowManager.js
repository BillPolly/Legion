/**
 * WindowManager
 * 
 * Core system for managing floating window lifecycles in the ShowMe module
 * Handles window creation, positioning, focus management, and cleanup
 */

export class WindowManager {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      defaultWidth: 800,
      defaultHeight: 600,
      zIndexBase: 1000,
      positionOffset: 30,
      defaultX: 50,
      defaultY: 50,
      ...config
    };

    // Window registry and state
    this.windows = new Map();
    this.activeWindow = null;
    this.nextZIndex = this.config.zIndexBase;
    this.windowCounter = 0;
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration object
   */
  getConfiguration() {
    return { ...this.config };
  }

  /**
   * Create a new floating window
   * @param {Object} options - Window creation options
   * @param {string} [options.id] - Unique window ID (auto-generated if not provided)
   * @param {string} options.title - Window title (required)
   * @param {string} options.content - Window content HTML (required)
   * @param {number} [options.width] - Window width
   * @param {number} [options.height] - Window height
   * @param {number} [options.x] - Window X position
   * @param {number} [options.y] - Window Y position
   * @param {boolean} [options.resizable=true] - Whether window is resizable
   * @param {boolean} [options.closable=true] - Whether window has close button
   * @returns {Object} Created window object
   */
  createWindow(options = {}) {
    // Validate required parameters
    if (!options.title) {
      throw new Error('Window title is required');
    }
    if (!options.content && options.content !== '') {
      throw new Error('Window content is required');
    }

    // Generate ID if not provided
    const id = options.id || this.generateWindowId();
    
    // Check for duplicate IDs
    if (this.windows.has(id)) {
      throw new Error(`Window with ID ${id} already exists`);
    }

    // Calculate position (auto-offset to avoid overlap)
    const position = this.calculateWindowPosition(options);
    
    // Create window object
    const window = {
      id,
      title: options.title,
      content: options.content,
      width: options.width || this.config.defaultWidth,
      height: options.height || this.config.defaultHeight,
      x: position.x,
      y: position.y,
      zIndex: this.nextZIndex++,
      resizable: options.resizable !== false,
      closable: options.closable !== false,
      element: null,
      created: new Date()
    };

    // Create DOM element
    window.element = this.createWindowElement(window);
    
    // Add to registry
    this.windows.set(id, window);
    
    // Make this window active
    this.activeWindow = window;
    
    // Add to DOM
    document.body.appendChild(window.element);

    return window;
  }

  /**
   * Generate unique window ID
   * @private
   * @returns {string} Unique window identifier
   */
  generateWindowId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `window_${timestamp}_${random}`;
  }

  /**
   * Calculate window position with auto-offset
   * @private
   * @param {Object} options - Window options
   * @returns {Object} Position with x, y coordinates
   */
  calculateWindowPosition(options) {
    if (options.x !== undefined && options.y !== undefined) {
      return { x: options.x, y: options.y };
    }

    // Auto-position to avoid overlap
    const windowCount = this.windows.size;
    const offset = windowCount * this.config.positionOffset;
    
    return {
      x: this.config.defaultX + offset,
      y: this.config.defaultY + offset
    };
  }

  /**
   * Create DOM element for window
   * @private
   * @param {Object} window - Window object
   * @returns {HTMLElement} Window DOM element
   */
  createWindowElement(window) {
    const element = document.createElement('div');
    element.className = 'showme-window';
    element.id = `showme-window-${window.id}`;
    
    // Set initial styles
    Object.assign(element.style, {
      position: 'fixed',
      left: `${window.x}px`,
      top: `${window.y}px`,
      width: `${window.width}px`,
      height: `${window.height}px`,
      zIndex: window.zIndex.toString(),
      backgroundColor: '#ffffff',
      border: '1px solid #cccccc',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Create window structure
    element.innerHTML = `
      <div class="showme-window-header" style="
        height: 30px;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        cursor: move;
      ">
        <div class="showme-window-title" style="
          font-size: 12px;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">${window.title}</div>
        ${window.closable ? `
          <button class="showme-window-close" style="
            background: none;
            border: none;
            width: 20px;
            height: 20px;
            border-radius: 2px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #666;
          " title="Close window">&times;</button>
        ` : ''}
      </div>
      <div class="showme-window-content" style="
        height: calc(100% - 31px);
        overflow: auto;
        padding: 8px;
      ">${window.content}</div>
    `;

    // Attach event listeners
    this.attachWindowEventListeners(element, window);

    return element;
  }

  /**
   * Attach event listeners to window element
   * @private
   * @param {HTMLElement} element - Window DOM element
   * @param {Object} window - Window object
   */
  attachWindowEventListeners(element, window) {
    // Focus on click
    element.addEventListener('mousedown', () => {
      this.focusWindow(window.id);
    });

    // Close button
    const closeButton = element.querySelector('.showme-window-close');
    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeWindow(window.id);
      });
    }

    // Basic drag functionality (simplified for MVP)
    const header = element.querySelector('.showme-window-header');
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('showme-window-close')) return;
      
      isDragging = true;
      dragStart.x = e.clientX - window.x;
      dragStart.y = e.clientY - window.y;
      
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
    });

    const handleDrag = (e) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      this.moveWindow(window.id, newX, newY);
    };

    const handleDragEnd = () => {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }

  /**
   * Get window by ID
   * @param {string} id - Window ID
   * @returns {Object|null} Window object or null if not found
   */
  getWindow(id) {
    return this.windows.get(id) || null;
  }

  /**
   * Check if window exists
   * @param {string} id - Window ID
   * @returns {boolean} True if window exists
   */
  hasWindow(id) {
    return this.windows.has(id);
  }

  /**
   * Get all active windows
   * @returns {Array} Array of window objects
   */
  getActiveWindows() {
    return Array.from(this.windows.values());
  }

  /**
   * Get number of active windows
   * @returns {number} Window count
   */
  getWindowCount() {
    return this.windows.size;
  }

  /**
   * Get currently active (focused) window
   * @returns {Object|null} Active window object or null
   */
  getActiveWindow() {
    return this.activeWindow;
  }

  /**
   * Focus window and bring to front
   * @param {string} id - Window ID
   * @returns {boolean} True if window was focused
   */
  focusWindow(id) {
    const window = this.windows.get(id);
    if (!window) {
      return false;
    }

    // Bring to front
    window.zIndex = this.nextZIndex++;
    window.element.style.zIndex = window.zIndex.toString();
    
    // Set as active
    this.activeWindow = window;

    return true;
  }

  /**
   * Move window to new position
   * @param {string} id - Window ID
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   * @returns {boolean} True if window was moved
   */
  moveWindow(id, x, y) {
    const window = this.windows.get(id);
    if (!window) {
      return false;
    }

    window.x = x;
    window.y = y;
    window.element.style.left = `${x}px`;
    window.element.style.top = `${y}px`;

    return true;
  }

  /**
   * Resize window to new dimensions
   * @param {string} id - Window ID
   * @param {number} width - New width
   * @param {number} height - New height
   * @returns {boolean} True if window was resized
   */
  resizeWindow(id, width, height) {
    const window = this.windows.get(id);
    if (!window) {
      return false;
    }

    window.width = width;
    window.height = height;
    window.element.style.width = `${width}px`;
    window.element.style.height = `${height}px`;

    return true;
  }

  /**
   * Close window by ID
   * @param {string} id - Window ID
   * @returns {boolean} True if window was closed
   */
  closeWindow(id) {
    const window = this.windows.get(id);
    if (!window) {
      return false;
    }

    // Remove from DOM
    if (window.element && window.element.parentNode) {
      window.element.parentNode.removeChild(window.element);
    }

    // Remove from registry
    this.windows.delete(id);

    // Update active window
    if (this.activeWindow === window) {
      // Set active to most recent window, or null if no windows left
      const remaining = this.getActiveWindows();
      this.activeWindow = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    return true;
  }

  /**
   * Close all windows
   */
  closeAllWindows() {
    const windowIds = Array.from(this.windows.keys());
    windowIds.forEach(id => this.closeWindow(id));
  }
}