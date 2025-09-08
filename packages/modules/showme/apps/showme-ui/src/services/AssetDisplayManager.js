/**
 * AssetDisplayManager
 * 
 * Manages floating windows for asset display
 * Extends ResourceWindowManager for window management capabilities
 */

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
    
    // Window management
    this.windows = new Map();
    this.activeWindow = null;
    this.nextZIndex = 1000;
    
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
   * Create a new window for asset display
   */
  createWindow(options = {}) {
    const windowId = options.id || this.generateWindowId();
    
    // Create window instance
    const window = new AssetWindow({
      id: windowId,
      title: options.title || 'Asset Viewer',
      type: options.type || 'default',
      width: options.width || this.config.defaultWidth,
      height: options.height || this.config.defaultHeight,
      minWidth: this.config.minWidth,
      minHeight: this.config.minHeight,
      x: options.x || this.calculateNextPosition().x,
      y: options.y || this.calculateNextPosition().y,
      zIndex: this.nextZIndex++,
      manager: this
    });
    
    // Store window
    this.windows.set(windowId, window);
    
    // Append to window area
    if (this.windowArea) {
      this.windowArea.appendChild(window.element);
    }
    
    return window;
  }
  
  /**
   * Get window by ID
   */
  getWindow(windowId) {
    return this.windows.get(windowId);
  }
  
  /**
   * Focus a window
   */
  focusWindow(windowId) {
    const window = this.windows.get(windowId);
    if (window) {
      // Bring to front
      window.setZIndex(this.nextZIndex++);
      
      // Set as active
      if (this.activeWindow && this.activeWindow !== window) {
        this.activeWindow.setActive(false);
      }
      window.setActive(true);
      this.activeWindow = window;
    }
  }
  
  /**
   * Close a window
   */
  closeWindow(windowId) {
    const window = this.windows.get(windowId);
    if (window) {
      window.destroy();
      this.windows.delete(windowId);
      
      if (this.activeWindow === window) {
        this.activeWindow = null;
      }
    }
  }
  
  /**
   * Close all windows
   */
  closeAllWindows() {
    for (const window of this.windows.values()) {
      window.destroy();
    }
    this.windows.clear();
    this.activeWindow = null;
  }
  
  /**
   * Calculate next window position (cascade)
   */
  calculateNextPosition() {
    const offset = 30;
    const count = this.windows.size;
    const x = 50 + (count * offset);
    const y = 50 + (count * offset);
    
    // Reset if too far
    const maxOffset = 300;
    if (x > maxOffset || y > maxOffset) {
      return { x: 50, y: 50 };
    }
    
    return { x, y };
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
  }
}

/**
 * AssetWindow class representing a single window
 */
class AssetWindow {
  constructor(config) {
    this.id = config.id;
    this.title = config.title;
    this.type = config.type;
    this.manager = config.manager;
    
    // Dimensions and position
    this.width = config.width;
    this.height = config.height;
    this.minWidth = config.minWidth;
    this.minHeight = config.minHeight;
    this.x = config.x;
    this.y = config.y;
    this.zIndex = config.zIndex;
    
    // State
    this.isActive = false;
    this.isDragging = false;
    this.isResizing = false;
    this.isMinimized = false;
    this.isMaximized = false;
    
    // Create DOM element
    this.createElement();
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Create the window DOM element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'asset-window';
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.zIndex = this.zIndex;
    
    // Header
    const header = document.createElement('div');
    header.className = 'asset-window-header';
    
    const title = document.createElement('div');
    title.className = 'asset-window-title';
    title.textContent = this.title;
    
    const controls = document.createElement('div');
    controls.className = 'asset-window-controls';
    
    // Minimize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'asset-window-control minimize';
    minimizeBtn.textContent = '−';
    minimizeBtn.onclick = () => this.minimize();
    
    // Maximize button
    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'asset-window-control maximize';
    maximizeBtn.textContent = '□';
    maximizeBtn.onclick = () => this.maximize();
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'asset-window-control close';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => this.close();
    
    controls.appendChild(minimizeBtn);
    controls.appendChild(maximizeBtn);
    controls.appendChild(closeBtn);
    
    header.appendChild(title);
    header.appendChild(controls);
    
    // Content area
    const content = document.createElement('div');
    content.className = 'asset-window-content';
    
    // Resize handles
    const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    resizeHandles.forEach(handle => {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = `asset-window-resize-handle resize-handle-${handle}`;
      resizeHandle.dataset.handle = handle;
      this.element.appendChild(resizeHandle);
    });
    
    this.element.appendChild(header);
    this.element.appendChild(content);
    
    this.header = header;
    this.content = content;
  }
  
  /**
   * Set up event handlers for dragging and resizing
   */
  setupEventHandlers() {
    // Dragging
    this.header.addEventListener('mousedown', (e) => this.startDrag(e));
    
    // Resizing
    const resizeHandles = this.element.querySelectorAll('.asset-window-resize-handle');
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => this.startResize(e, handle.dataset.handle));
    });
    
    // Focus on click
    this.element.addEventListener('mousedown', () => {
      this.manager.focusWindow(this.id);
    });
  }
  
  /**
   * Start dragging the window
   */
  startDrag(e) {
    if (e.target.classList.contains('asset-window-control')) return;
    
    this.isDragging = true;
    this.dragStartX = e.clientX - this.x;
    this.dragStartY = e.clientY - this.y;
    
    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      
      this.x = e.clientX - this.dragStartX;
      this.y = e.clientY - this.dragStartY;
      
      this.element.style.left = `${this.x}px`;
      this.element.style.top = `${this.y}px`;
    };
    
    const handleMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  /**
   * Start resizing the window
   */
  startResize(e, handle) {
    e.preventDefault();
    this.isResizing = true;
    this.resizeHandle = handle;
    this.resizeStartX = e.clientX;
    this.resizeStartY = e.clientY;
    this.resizeStartWidth = this.width;
    this.resizeStartHeight = this.height;
    this.resizeStartLeft = this.x;
    this.resizeStartTop = this.y;
    
    const handleMouseMove = (e) => {
      if (!this.isResizing) return;
      
      const dx = e.clientX - this.resizeStartX;
      const dy = e.clientY - this.resizeStartY;
      
      // Handle different resize directions
      if (handle.includes('e')) {
        this.width = Math.max(this.minWidth, this.resizeStartWidth + dx);
      }
      if (handle.includes('w')) {
        this.width = Math.max(this.minWidth, this.resizeStartWidth - dx);
        this.x = this.resizeStartLeft + dx;
      }
      if (handle.includes('s')) {
        this.height = Math.max(this.minHeight, this.resizeStartHeight + dy);
      }
      if (handle.includes('n')) {
        this.height = Math.max(this.minHeight, this.resizeStartHeight - dy);
        this.y = this.resizeStartTop + dy;
      }
      
      this.element.style.width = `${this.width}px`;
      this.element.style.height = `${this.height}px`;
      this.element.style.left = `${this.x}px`;
      this.element.style.top = `${this.y}px`;
    };
    
    const handleMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  /**
   * Set window content
   */
  setContent(content) {
    if (typeof content === 'string') {
      this.content.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      this.content.innerHTML = '';
      this.content.appendChild(content);
    }
  }
  
  /**
   * Show the window
   */
  show() {
    this.element.style.display = 'flex';
    this.manager.focusWindow(this.id);
  }
  
  /**
   * Hide the window
   */
  hide() {
    this.element.style.display = 'none';
  }
  
  /**
   * Minimize the window
   */
  minimize() {
    if (this.isMinimized) {
      this.element.style.display = 'flex';
      this.isMinimized = false;
    } else {
      this.element.style.display = 'none';
      this.isMinimized = true;
    }
  }
  
  /**
   * Maximize the window
   */
  maximize() {
    if (this.isMaximized) {
      // Restore
      this.element.style.width = `${this.width}px`;
      this.element.style.height = `${this.height}px`;
      this.element.style.left = `${this.x}px`;
      this.element.style.top = `${this.y}px`;
      this.isMaximized = false;
    } else {
      // Save current state
      this.restoreWidth = this.width;
      this.restoreHeight = this.height;
      this.restoreX = this.x;
      this.restoreY = this.y;
      
      // Maximize
      this.element.style.width = '100%';
      this.element.style.height = '100%';
      this.element.style.left = '0';
      this.element.style.top = '0';
      this.isMaximized = true;
    }
  }
  
  /**
   * Focus the window
   */
  focus() {
    this.manager.focusWindow(this.id);
  }
  
  /**
   * Close the window
   */
  close() {
    this.manager.closeWindow(this.id);
  }
  
  /**
   * Set active state
   */
  setActive(active) {
    this.isActive = active;
    if (active) {
      this.element.classList.add('active');
    } else {
      this.element.classList.remove('active');
    }
  }
  
  /**
   * Set z-index
   */
  setZIndex(zIndex) {
    this.zIndex = zIndex;
    this.element.style.zIndex = zIndex;
  }
  
  /**
   * Destroy the window
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.header = null;
    this.content = null;
  }
}