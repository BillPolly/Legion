/**
 * CLIWindow - Self-contained floating window component for CLI terminal
 *
 * This component manages its own HTML and CSS, creating a floating window
 * that contains the terminal interface. It's draggable and closable.
 */

import { Terminal } from './Terminal.js';

export class CLIWindow {
  constructor(config = {}) {
    this.config = {
      title: config.title || 'Legion CLI',
      x: config.x || window.innerWidth / 2 - 400,
      y: config.y || window.innerHeight / 2 - 300,
      width: config.width || 800,
      height: config.height || 600,
      onClose: config.onClose || (() => {}),
      ...config
    };

    this.windowElement = null;
    this.terminal = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
  }

  /**
   * Initialize and create the window
   */
  initialize() {
    this.windowElement = this.createWindow();
    this.setupDragging();

    return this.windowElement;
  }

  /**
   * Initialize terminal after window is added to DOM
   * Must be called after the window element is appended to the document
   */
  initializeTerminal() {
    const terminalContainer = this.windowElement.querySelector('.cli-window-content');
    this.terminal = new Terminal(terminalContainer);
    this.terminal.initialize();
  }

  /**
   * Create window HTML structure
   */
  createWindow() {
    const window = document.createElement('div');
    window.className = 'cli-floating-window';
    window.style.cssText = this.getWindowCSS();

    window.innerHTML = `
      <div class="cli-window-header">
        <span class="cli-window-title">${this.config.title}</span>
        <button class="cli-window-close" title="Close">×</button>
      </div>
      <div class="cli-window-content"></div>
    `;

    // Inject CSS
    this.injectCSS();

    // Setup close button
    const closeBtn = window.querySelector('.cli-window-close');
    closeBtn.addEventListener('click', () => this.close());

    return window;
  }

  /**
   * Get window positioning CSS
   */
  getWindowCSS() {
    return `
      position: absolute;
      left: ${this.config.x}px;
      top: ${this.config.y}px;
      width: ${this.config.width}px;
      height: ${this.config.height}px;
    `;
  }

  /**
   * Inject component CSS into document head
   */
  injectCSS() {
    // Check if already injected
    if (document.getElementById('cli-window-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'cli-window-styles';
    style.textContent = `
      .cli-floating-window {
        background: #2d2d2d;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
      }

      .cli-window-header {
        background: #1e1e1e;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
        border-bottom: 1px solid #404040;
      }

      .cli-window-title {
        color: #e0e0e0;
        font-weight: 600;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .cli-window-close {
        background: transparent;
        border: none;
        color: #a0a0a0;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .cli-window-close:hover {
        background: #ef4444;
        color: white;
      }

      .cli-window-content {
        flex: 1;
        overflow: hidden;
        background: #1e1e1e;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Setup dragging functionality
   */
  setupDragging() {
    const header = this.windowElement.querySelector('.cli-window-header');

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking close button
      if (e.target.classList.contains('cli-window-close')) {
        return;
      }

      this.isDragging = true;
      this.dragStartX = e.clientX - this.config.x;
      this.dragStartY = e.clientY - this.config.y;

      // Bring to front
      this.windowElement.style.zIndex = '1001';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      this.config.x = e.clientX - this.dragStartX;
      this.config.y = e.clientY - this.dragStartY;

      this.windowElement.style.left = `${this.config.x}px`;
      this.windowElement.style.top = `${this.config.y}px`;
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.windowElement.style.zIndex = '1000';
      }
    });
  }

  /**
   * Set terminal command handler
   */
  onCommand(handler) {
    if (this.terminal) {
      this.terminal.onCommand = handler;
    }
  }

  /**
   * Get terminal instance
   */
  getTerminal() {
    return this.terminal;
  }

  /**
   * Close the window
   */
  close() {
    this.config.onClose();
    this.destroy();
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.terminal) {
      this.terminal.destroy();
    }

    if (this.windowElement && this.windowElement.parentNode) {
      this.windowElement.parentNode.removeChild(this.windowElement);
    }

    this.windowElement = null;
    this.terminal = null;
  }
}
