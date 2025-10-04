import { UmbilicalUtils, UmbilicalError } from '@legion/components';

/**
 * Divider Component
 * 
 * Creates a draggable divider that can be vertical or horizontal, allowing users
 * to resize areas by dragging. Supports programmatic control and positioning.
 */
export const Divider = {
  /**
   * Create a Divider instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical.describe) {
      const requirements = UmbilicalUtils.createRequirements();
      requirements.add('dom', 'HTMLElement', 'Parent DOM element to contain the divider');
      requirements.add('orientation', 'string', 'Divider orientation: "vertical" or "horizontal" (optional, defaults to "vertical")');
      requirements.add('initialPosition', 'number', 'Initial position as percentage 0-100 (optional, defaults to 50)');
      requirements.add('minPosition', 'number', 'Minimum position as percentage 0-100 (optional, defaults to 10)');
      requirements.add('maxPosition', 'number', 'Maximum position as percentage 0-100 (optional, defaults to 90)');
      requirements.add('thickness', 'number', 'Divider thickness in pixels (optional, defaults to 4)');
      requirements.add('disabled', 'boolean', 'Whether divider is disabled (optional, defaults to false)');
      requirements.add('locked', 'boolean', 'Whether divider is locked from dragging (optional, defaults to false)');
      requirements.add('theme', 'string', 'Visual theme: "light" or "dark" (optional, defaults to "light")');
      requirements.add('onResize', 'function', 'Callback when divider position changes (optional)');
      requirements.add('onDragStart', 'function', 'Callback when drag operation starts (optional)');
      requirements.add('onDragEnd', 'function', 'Callback when drag operation ends (optional)');
      
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical.validate) {
      return umbilical.validate({
        hasDomElement: umbilical.dom && umbilical.dom.nodeType === Node.ELEMENT_NODE,
        hasValidOrientation: !umbilical.orientation || ['vertical', 'horizontal'].includes(umbilical.orientation),
        hasValidPosition: !umbilical.initialPosition || (typeof umbilical.initialPosition === 'number' && umbilical.initialPosition >= 0 && umbilical.initialPosition <= 100),
        hasValidMinMax: !umbilical.minPosition || !umbilical.maxPosition || umbilical.minPosition < umbilical.maxPosition,
        hasValidTheme: !umbilical.theme || ['light', 'dark'].includes(umbilical.theme)
      });
    }

    // Instance creation mode
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'Divider');

    if (!umbilical.dom || umbilical.dom.nodeType !== Node.ELEMENT_NODE) {
      throw new UmbilicalError('Divider requires a valid DOM element', 'Divider');
    }

    // Initialize options with defaults
    const options = {
      orientation: umbilical.orientation || 'vertical',
      initialPosition: umbilical.initialPosition || 50,
      minPosition: umbilical.minPosition || 10,
      maxPosition: umbilical.maxPosition || 90,
      thickness: umbilical.thickness || 4,
      disabled: umbilical.disabled || false,
      locked: umbilical.locked || false,
      theme: umbilical.theme || 'light'
    };

    // Validate position bounds
    if (options.initialPosition < options.minPosition) {
      options.initialPosition = options.minPosition;
    }
    if (options.initialPosition > options.maxPosition) {
      options.initialPosition = options.maxPosition;
    }

    // State
    let currentPosition = options.initialPosition;
    let isDragging = false;
    let isEnabled = !options.disabled;
    let isLocked = options.locked;
    let dragStartPosition = null;
    let dragOffset = 0;

    // Create DOM elements
    const containerEl = umbilical.dom;
    containerEl.style.position = 'relative';
    
    const dividerEl = document.createElement('div');
    dividerEl.className = 'umbilical-divider';
    
    // Apply base styles
    const isVertical = options.orientation === 'vertical';
    dividerEl.style.position = 'absolute';
    dividerEl.style.zIndex = '100';
    dividerEl.style.userSelect = 'none';
    dividerEl.style.transition = isDragging ? 'none' : 'all 0.2s ease';
    
    if (isVertical) {
      dividerEl.style.width = `${options.thickness}px`;
      dividerEl.style.height = '100%';
      dividerEl.style.top = '0';
      dividerEl.style.left = `${currentPosition}%`;
      dividerEl.style.transform = 'translateX(-50%)';
      dividerEl.style.cursor = isEnabled && !isLocked ? 'col-resize' : 'default';
    } else {
      dividerEl.style.height = `${options.thickness}px`;
      dividerEl.style.width = '100%';
      dividerEl.style.left = '0';
      dividerEl.style.top = `${currentPosition}%`;
      dividerEl.style.transform = 'translateY(-50%)';
      dividerEl.style.cursor = isEnabled && !isLocked ? 'row-resize' : 'default';
    }

    // Apply theme colors
    const updateTheme = (theme) => {
      if (theme === 'dark') {
        dividerEl.style.backgroundColor = isEnabled ? '#4b5563' : '#6b7280';
        dividerEl.style.borderLeft = isVertical ? '1px solid #374151' : 'none';
        dividerEl.style.borderRight = isVertical ? '1px solid #374151' : 'none';
        dividerEl.style.borderTop = !isVertical ? '1px solid #374151' : 'none';
        dividerEl.style.borderBottom = !isVertical ? '1px solid #374151' : 'none';
      } else {
        dividerEl.style.backgroundColor = isEnabled ? '#d1d5db' : '#e5e7eb';
        dividerEl.style.borderLeft = isVertical ? '1px solid #9ca3af' : 'none';
        dividerEl.style.borderRight = isVertical ? '1px solid #9ca3af' : 'none';
        dividerEl.style.borderTop = !isVertical ? '1px solid #9ca3af' : 'none';
        dividerEl.style.borderBottom = !isVertical ? '1px solid #9ca3af' : 'none';
      }
    };

    updateTheme(options.theme);

    // Add hover effects
    const handleMouseEnter = () => {
      if (!isEnabled || isLocked) return;
      dividerEl.style.backgroundColor = options.theme === 'dark' ? '#6b7280' : '#9ca3af';
    };

    const handleMouseLeave = () => {
      if (isDragging) return;
      updateTheme(options.theme);
    };

    dividerEl.addEventListener('mouseenter', handleMouseEnter);
    dividerEl.addEventListener('mouseleave', handleMouseLeave);

    // Helper functions
    const updatePosition = (newPosition, skipCallback = false) => {
      // Clamp position to bounds
      newPosition = Math.max(options.minPosition, Math.min(options.maxPosition, newPosition));
      
      if (newPosition === currentPosition) return false;
      
      currentPosition = newPosition;
      
      if (isVertical) {
        dividerEl.style.left = `${currentPosition}%`;
      } else {
        dividerEl.style.top = `${currentPosition}%`;
      }
      
      if (!skipCallback && umbilical.onResize) {
        umbilical.onResize(currentPosition, instance);
      }
      
      return true;
    };

    const getPositionFromEvent = (event) => {
      const containerRect = containerEl.getBoundingClientRect();
      
      if (isVertical) {
        const x = event.clientX - containerRect.left;
        return (x / containerRect.width) * 100;
      } else {
        const y = event.clientY - containerRect.top;
        return (y / containerRect.height) * 100;
      }
    };

    // Document-level event handlers for cleanup
    const documentHandlers = {
      mousemove: null,
      mouseup: null
    };

    // Mouse event handlers
    const handleMouseDown = (event) => {
      if (!isEnabled || isLocked) return;
      
      event.preventDefault();
      
      isDragging = true;
      dragStartPosition = currentPosition;
      
      const eventPosition = getPositionFromEvent(event);
      dragOffset = eventPosition - currentPosition;
      
      dividerEl.style.transition = 'none';
      document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      
      if (umbilical.onDragStart) {
        umbilical.onDragStart(currentPosition, instance);
      }
    };

    documentHandlers.mousemove = (event) => {
      if (!isDragging) return;
      
      event.preventDefault();
      
      const eventPosition = getPositionFromEvent(event);
      const newPosition = eventPosition - dragOffset;
      
      updatePosition(newPosition);
    };

    documentHandlers.mouseup = (event) => {
      if (!isDragging) return;
      
      event.preventDefault();
      
      isDragging = false;
      dragStartPosition = null;
      dragOffset = 0;
      
      dividerEl.style.transition = 'all 0.2s ease';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      updateTheme(options.theme);
      
      if (umbilical.onDragEnd) {
        umbilical.onDragEnd(currentPosition, instance);
      }
    };

    // Attach event listeners
    dividerEl.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', documentHandlers.mousemove);
    document.addEventListener('mouseup', documentHandlers.mouseup);

    // Create instance interface
    const instance = {
      // DOM access
      get element() {
        return dividerEl;
      },

      get container() {
        return containerEl;
      },

      // State access
      get position() {
        return currentPosition;
      },

      get orientation() {
        return options.orientation;
      },

      get enabled() {
        return isEnabled;
      },

      get locked() {
        return isLocked;
      },

      get dragging() {
        return isDragging;
      },

      // Position control
      setPosition(position) {
        if (typeof position !== 'number') {
          throw new UmbilicalError('Position must be a number', 'Divider');
        }
        return updatePosition(position);
      },

      getPosition() {
        return currentPosition;
      },

      // State control
      enable() {
        if (isEnabled) return false;
        
        isEnabled = true;
        updateTheme(options.theme);
        dividerEl.style.cursor = isLocked ? 'default' : (isVertical ? 'col-resize' : 'row-resize');
        return true;
      },

      disable() {
        if (!isEnabled) return false;
        
        isEnabled = false;
        updateTheme(options.theme);
        dividerEl.style.cursor = 'default';
        return true;
      },

      lock() {
        if (isLocked) return false;
        
        isLocked = true;
        dividerEl.style.cursor = 'default';
        return true;
      },

      unlock() {
        if (!isLocked) return false;
        
        isLocked = false;
        dividerEl.style.cursor = isEnabled ? (isVertical ? 'col-resize' : 'row-resize') : 'default';
        return true;
      },

      // Theme control
      setTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
          throw new UmbilicalError('Theme must be "light" or "dark"', 'Divider');
        }
        
        options.theme = theme;
        updateTheme(theme);
      },

      getTheme() {
        return options.theme;
      },

      // Bounds control
      setBounds(min, max) {
        if (typeof min !== 'number' || typeof max !== 'number') {
          throw new UmbilicalError('Bounds must be numbers', 'Divider');
        }
        
        if (min >= max) {
          throw new UmbilicalError('Minimum bound must be less than maximum bound', 'Divider');
        }
        
        options.minPosition = Math.max(0, Math.min(100, min));
        options.maxPosition = Math.max(0, Math.min(100, max));
        
        // Adjust current position if out of bounds
        if (currentPosition < options.minPosition || currentPosition > options.maxPosition) {
          const newPosition = Math.max(options.minPosition, Math.min(options.maxPosition, currentPosition));
          updatePosition(newPosition);
        }
      },

      getBounds() {
        return {
          min: options.minPosition,
          max: options.maxPosition
        };
      }
    };

    // Append to parent DOM
    containerEl.appendChild(dividerEl);

    // Lifecycle setup
    if (umbilical.onMount) {
      umbilical.onMount(instance);
    }

    // Cleanup handler
    instance.destroy = () => {
      // Remove event listeners
      dividerEl.removeEventListener('mousedown', handleMouseDown);
      dividerEl.removeEventListener('mouseenter', handleMouseEnter);
      dividerEl.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mousemove', documentHandlers.mousemove);
      document.removeEventListener('mouseup', documentHandlers.mouseup);
      
      // Reset body styles
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Remove element from DOM
      dividerEl.remove();
      
      // Call destroy callback if provided
      if (umbilical.onDestroy) {
        umbilical.onDestroy(instance);
      }
    };

    return instance;
  }
};