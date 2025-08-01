import { UmbilicalUtils, UmbilicalError } from '../../umbilical/index.js';

/**
 * Window Component
 * 
 * Creates an interactive floating window with dragging, resizing, and controls.
 * Manages z-index stacking, minimize/maximize states, and content rendering.
 */
export const Window = {
  // Static property to track the next z-index value
  nextZIndex: 1000,

  /**
   * Create a Window instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element to contain the window');
      requirements.add('title', 'string', 'Window title (optional, defaults to "Window")');
      requirements.add('width', 'number', 'Initial width in pixels (optional, defaults to 500)');
      requirements.add('height', 'number', 'Initial height in pixels (optional, defaults to 400)');
      requirements.add('position', 'object', 'Initial position {x, y} (optional, defaults to {x: 20, y: 20})');
      requirements.add('resizable', 'boolean', 'Whether window can be resized (optional, defaults to true)');
      requirements.add('draggable', 'boolean', 'Whether window can be dragged (optional, defaults to true)');
      requirements.add('theme', 'string', 'Visual theme: "light" or "dark" (optional, defaults to "light")');
      requirements.add('onClose', 'function', 'Callback when window is closed (optional)');
      requirements.add('onResize', 'function', 'Callback when window is resized (optional)');
      requirements.add('onMinimize', 'function', 'Callback when window is minimized/restored (optional)');
      requirements.add('onMaximize', 'function', 'Callback when window is maximized/restored (optional)');
      requirements.add('onFocus', 'function', 'Callback when window gains focus (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme),
        hasValidPosition: !umbilical.position || (typeof umbilical.position.x === 'number' && typeof umbilical.position.y === 'number')
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'Window');

    if (umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('Window requires a valid DOM element', 'Window');
    }

    // Initialize options with defaults
    const options = {
      title: umbilical.title || 'Window',
      width: umbilical.width || 500,
      height: umbilical.height || 400,
      resizable: umbilical.resizable !== undefined ? umbilical.resizable : true,
      draggable: umbilical.draggable !== undefined ? umbilical.draggable : true,
      theme: umbilical.theme || 'light',
      position: umbilical.position || { x: 20, y: 20 }
    };

    // State
    let isMinimized = false;
    let isMaximized = false;
    let prevHeight = null;
    let prevDimensions = null;

    // Create DOM elements
    const windowEl = document.createElement('div');
    windowEl.className = 'umbilical-window-container';
    windowEl.style.position = 'absolute';
    windowEl.style.width = `${options.width}px`;
    windowEl.style.height = `${options.height}px`;
    windowEl.style.left = `${options.position.x}px`;
    windowEl.style.top = `${options.position.y}px`;
    windowEl.style.backgroundColor = options.theme === 'dark' ? '#2a2a2a' : '#ffffff';
    windowEl.style.color = options.theme === 'dark' ? '#ffffff' : '#333333';
    windowEl.style.border = options.theme === 'dark' ? '1px solid #444' : '1px solid #ccc';
    windowEl.style.borderRadius = '6px';
    windowEl.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    windowEl.style.display = 'flex';
    windowEl.style.flexDirection = 'column';
    windowEl.style.overflow = 'hidden';
    windowEl.style.fontFamily = 'Arial, sans-serif';
    windowEl.style.zIndex = Window.nextZIndex++;

    // Title bar
    const titleBar = document.createElement('div');
    titleBar.className = 'umbilical-window-title-bar';
    titleBar.style.padding = '8px 10px';
    titleBar.style.backgroundColor = options.theme === 'dark' ? '#333' : '#f0f0f0';
    titleBar.style.borderBottom = options.theme === 'dark' ? '1px solid #444' : '1px solid #ddd';
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.alignItems = 'center';
    titleBar.style.cursor = options.draggable ? 'move' : 'default';
    titleBar.style.userSelect = 'none';
    titleBar.style.borderTopLeftRadius = '6px';
    titleBar.style.borderTopRightRadius = '6px';

    // Title element
    const titleElement = document.createElement('div');
    titleElement.textContent = options.title;
    titleElement.style.fontWeight = 'bold';

    // Controls container
    const controls = document.createElement('div');
    controls.className = 'umbilical-window-controls';
    controls.style.display = 'flex';
    controls.style.gap = '8px';

    // Helper to style buttons
    const styleButton = (button, bgColor = null) => {
      button.style.border = 'none';
      button.style.width = '14px';
      button.style.height = '14px';
      button.style.borderRadius = '7px';
      button.style.backgroundColor = bgColor || (options.theme === 'dark' ? '#555' : '#ddd');
      button.style.color = options.theme === 'dark' ? '#eee' : '#333';
      button.style.display = 'flex';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
      button.style.fontSize = '10px';
      button.style.fontWeight = 'bold';
      button.style.cursor = 'pointer';
      button.style.textAlign = 'center';
      button.style.lineHeight = '1';

      button.onmouseover = () => button.style.opacity = '0.8';
      button.onmouseout = () => button.style.opacity = '1';
    };

    // Control buttons
    const minimizeBtn = document.createElement('button');
    minimizeBtn.innerHTML = '&#8211;';
    minimizeBtn.title = 'Minimize';
    styleButton(minimizeBtn);

    const maximizeBtn = document.createElement('button');
    maximizeBtn.innerHTML = '&#9744;';
    maximizeBtn.title = 'Maximize';
    styleButton(maximizeBtn);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#10005;';
    closeBtn.title = 'Close';
    styleButton(closeBtn, '#ff5f57');

    controls.appendChild(minimizeBtn);
    controls.appendChild(maximizeBtn);
    controls.appendChild(closeBtn);

    titleBar.appendChild(titleElement);
    titleBar.appendChild(controls);

    // Content area
    const content = document.createElement('div');
    content.className = 'umbilical-window-content';
    content.style.flexGrow = '1';
    content.style.padding = '10px';
    content.style.overflow = 'auto';
    content.style.position = 'relative';
    content.id = `umbilical-window-content-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Resize handle
    let resizeHandle = null;
    if (options.resizable) {
      resizeHandle = document.createElement('div');
      resizeHandle.className = 'umbilical-window-resize-handle';
      resizeHandle.style.position = 'absolute';
      resizeHandle.style.width = '12px';
      resizeHandle.style.height = '12px';
      resizeHandle.style.right = '0';
      resizeHandle.style.bottom = '0';
      resizeHandle.style.cursor = 'nwse-resize';
      resizeHandle.style.zIndex = '1001';

      const resizeIndicator = document.createElement('div');
      resizeIndicator.style.width = '8px';
      resizeIndicator.style.height = '8px';
      resizeIndicator.style.borderRight = options.theme === 'dark' ? '2px solid #666' : '2px solid #ccc';
      resizeIndicator.style.borderBottom = options.theme === 'dark' ? '2px solid #666' : '2px solid #ccc';
      resizeIndicator.style.position = 'absolute';
      resizeIndicator.style.right = '2px';
      resizeIndicator.style.bottom = '2px';

      resizeHandle.appendChild(resizeIndicator);
    }

    // Assemble window
    windowEl.appendChild(titleBar);
    windowEl.appendChild(content);
    if (resizeHandle) {
      windowEl.appendChild(resizeHandle);
    }

    // Helper functions
    const bringToFront = () => {
      windowEl.style.zIndex = Window.nextZIndex++;
      if (umbilical.onFocus) {
        umbilical.onFocus(instance);
      }
    };

    const dispatchResize = (width, height) => {
      const event = new CustomEvent('windowresize', {
        detail: { width, height }
      });
      windowEl.dispatchEvent(event);
      
      if (umbilical.onResize) {
        umbilical.onResize(width, height, instance);
      }
    };

    // Set up event listeners
    let isDragging = false;
    let isResizing = false;
    let offsetX, offsetY, startWidth, startHeight;

    // Store document event handlers for cleanup
    const documentHandlers = {
      mousemove: null,
      mouseup: null
    };

    // Close button
    closeBtn.addEventListener('click', () => {
      instance.close();
    });

    // Minimize button
    minimizeBtn.addEventListener('click', () => {
      instance.minimize();
    });

    // Maximize button
    maximizeBtn.addEventListener('click', () => {
      instance.maximize();
    });

    // Focus on click
    windowEl.addEventListener('mousedown', bringToFront);
    content.addEventListener('mousedown', bringToFront);

    // Document-level mouse handlers
    documentHandlers.mousemove = (e) => {
      if (isDragging) {
        e.preventDefault();
        
        // Calculate new position
        const parentRect = umbilical.dom.getBoundingClientRect();
        const x = e.clientX - parentRect.left - offsetX;
        const y = e.clientY - parentRect.top - offsetY;

        // Apply boundaries relative to parent container
        const maxX = parentRect.width - windowEl.offsetWidth;
        const maxY = parentRect.height - windowEl.offsetHeight;

        windowEl.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
        windowEl.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
      } else if (isResizing) {
        e.preventDefault();
        const width = startWidth + (e.clientX - offsetX);
        const height = startHeight + (e.clientY - offsetY);

        if (width > 200 && height > 150) {
          windowEl.style.width = `${width}px`;
          windowEl.style.height = `${height}px`;
          dispatchResize(width, height);
        }
      }
    };

    documentHandlers.mouseup = (e) => {
      if (isDragging || isResizing) {
        e.preventDefault();
        isDragging = false;
        isResizing = false;
        
        // Reset cursor
        document.body.style.cursor = '';
      }
    };

    // Add document listeners
    document.addEventListener('mousemove', documentHandlers.mousemove);
    document.addEventListener('mouseup', documentHandlers.mouseup);

    // Dragging
    if (options.draggable) {
      titleBar.addEventListener('mousedown', (e) => {
        // Only start drag if clicking on titlebar itself or title text
        if (e.target === titleBar || e.target === titleElement) {
          e.preventDefault();
          isDragging = true;
          
          // Calculate offset from mouse position to window position
          const rect = windowEl.getBoundingClientRect();
          offsetX = e.clientX - rect.left;
          offsetY = e.clientY - rect.top;
          
          // Set grabbing cursor
          document.body.style.cursor = 'grabbing';
          
          // Bring to front when starting drag
          bringToFront();
        }
      });
    }

    // Resizing
    if (options.resizable && resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        startWidth = parseInt(getComputedStyle(windowEl).width, 10);
        startHeight = parseInt(getComputedStyle(windowEl).height, 10);
        offsetX = e.clientX;
        offsetY = e.clientY;
        
        // Bring to front when starting resize
        bringToFront();
      });
    }

    // Create instance interface
    const instance = {
      // DOM access
      get window() {
        return windowEl;
      },

      get contentElement() {
        return content;
      },

      get titleElement() {
        return titleElement;
      },

      // State access
      get isMinimized() {
        return isMinimized;
      },

      get isMaximized() {
        return isMaximized;
      },

      get isVisible() {
        return windowEl.style.display !== 'none';
      },

      // Content manipulation
      setContent(html) {
        content.innerHTML = html;
      },

      appendContent(html) {
        content.innerHTML += html;
      },

      appendElement(element) {
        content.appendChild(element);
      },

      clearContent() {
        content.innerHTML = '';
      },

      // Window control
      show() {
        windowEl.style.display = 'flex';
        bringToFront();
      },

      close() {
        windowEl.style.display = 'none';
        
        if (umbilical.onClose) {
          umbilical.onClose(instance);
        }

        const event = new CustomEvent('windowclose', {
          detail: { window: instance }
        });
        windowEl.dispatchEvent(event);
      },

      minimize() {
        bringToFront();

        if (!isMinimized) {
          prevHeight = windowEl.style.height;
          content.style.display = 'none';
          windowEl.style.height = 'auto';
          minimizeBtn.innerHTML = '&#10133;';
          minimizeBtn.title = 'Restore';
          isMinimized = true;
        } else {
          content.style.display = 'block';
          windowEl.style.height = prevHeight;
          minimizeBtn.innerHTML = '&#8211;';
          minimizeBtn.title = 'Minimize';
          isMinimized = false;
        }

        if (umbilical.onMinimize) {
          umbilical.onMinimize(isMinimized, instance);
        }
      },

      maximize() {
        bringToFront();

        if (!isMaximized) {
          prevDimensions = {
            width: windowEl.style.width,
            height: windowEl.style.height,
            left: windowEl.style.left,
            top: windowEl.style.top
          };

          const parentRect = umbilical.dom.getBoundingClientRect();
          const width = parentRect.width - 20;
          const height = parentRect.height - 20;

          windowEl.style.width = `${width}px`;
          windowEl.style.height = `${height}px`;
          windowEl.style.left = '10px';
          windowEl.style.top = '10px';

          maximizeBtn.innerHTML = '&#9635;';
          maximizeBtn.title = 'Restore';
          isMaximized = true;

          dispatchResize(width, height);
        } else {
          windowEl.style.width = prevDimensions.width;
          windowEl.style.height = prevDimensions.height;
          windowEl.style.left = prevDimensions.left;
          windowEl.style.top = prevDimensions.top;

          maximizeBtn.innerHTML = '&#9744;';
          maximizeBtn.title = 'Maximize';
          isMaximized = false;

          dispatchResize(
            parseInt(prevDimensions.width),
            parseInt(prevDimensions.height)
          );
        }

        if (umbilical.onMaximize) {
          umbilical.onMaximize(isMaximized, instance);
        }
      },

      // Window properties
      setTitle(title) {
        options.title = title;
        titleElement.textContent = title;
      },

      setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
          throw new UmbilicalError('Theme must be either "light" or "dark"', 'Window');
        }

        options.theme = theme;

        windowEl.style.backgroundColor = theme === 'dark' ? '#2a2a2a' : '#ffffff';
        windowEl.style.color = theme === 'dark' ? '#ffffff' : '#333333';
        windowEl.style.border = theme === 'dark' ? '1px solid #444' : '1px solid #ccc';

        titleBar.style.backgroundColor = theme === 'dark' ? '#333' : '#f0f0f0';
        titleBar.style.borderBottom = theme === 'dark' ? '1px solid #444' : '1px solid #ddd';

        [minimizeBtn, maximizeBtn].forEach(btn => {
          btn.style.backgroundColor = theme === 'dark' ? '#555' : '#ddd';
          btn.style.color = theme === 'dark' ? '#eee' : '#333';
        });

        if (resizeHandle) {
          const indicator = resizeHandle.querySelector('div');
          indicator.style.borderRight = theme === 'dark' ? '2px solid #666' : '2px solid #ccc';
          indicator.style.borderBottom = theme === 'dark' ? '2px solid #666' : '2px solid #ccc';
        }
      },

      // Focus management
      bringToFront,

      // Event handling
      addEventListener(event, callback) {
        windowEl.addEventListener(event, callback);
      },

      removeEventListener(event, callback) {
        windowEl.removeEventListener(event, callback);
      }
    };

    // Append to parent DOM
    umbilical.dom.appendChild(windowEl);

    // Bring to front on creation
    bringToFront();

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    instance.destroy = () => {
      // Remove document event listeners
      document.removeEventListener('mousemove', documentHandlers.mousemove);
      document.removeEventListener('mouseup', documentHandlers.mouseup);
      
      // Remove window from DOM
      windowEl.remove();
      
      // Call destroy callback if provided
      if (umbilical.onDestroy) {
        umbilical.onDestroy(instance);
      }
    };

    return instance;
  }
};