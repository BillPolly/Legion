/**
 * DiagramView - Visual rendering component for diagrams
 * 
 * Pure view layer in MVVM pattern - only renders state, no business logic
 * All interaction events are captured at container level and forwarded to ViewModel
 */

import { DiagramTooltip } from './DiagramTooltip.js';
import { InteractionStateMachine, InteractionState, InteractionEvent } from './InteractionStateMachine.js';

export class DiagramView {
  constructor(container, config = {}) {
    if (!container) {
      throw new Error('DiagramView requires a container element');
    }

    this.container = container;
    this.config = config;
    this.viewModel = null; // Will be set by ViewModel
    
    // Current rendered state (managed by ViewModel)
    this.currentState = null;
    
    // Event listeners for ViewModel communication
    this.eventListeners = new Map();
    
    // Interaction config
    this.interaction = config.interaction || {
      enablePan: true,
      enableZoom: true,
      enableSelection: true,
      enableDragSelection: true,
      zoomLimits: { min: 0.1, max: 10 }
    };
    
    // Drag selection style options
    this.dragSelectionStyle = config.dragSelectionStyle || {
      stroke: '#007bff',
      strokeWidth: 2,
      fill: 'rgba(0, 123, 255, 0.1)',
      strokeDasharray: '5,5'
    };
    
    // Initialize interaction state machine
    this._initializeStateMachine();
    
    // Initialize view
    this._initializeSVG();
    this._setupInteractionLayer();
    this._applyTheme();
    
    // Initialize tooltip
    if (this.config.showTooltips !== false) {
      this.tooltip = new DiagramTooltip(this.container, {
        delay: this.config.tooltipDelay || 500,
        showDebugInfo: this.config.showDebugInfo
      });
    }
  }

  /**
   * Initialize SVG structure
   * @private
   */
  _initializeSVG() {
    // Create main SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('class', 'diagram-svg');
    
    // Create defs for patterns and markers
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this._createMarkers();
    this.svg.appendChild(this.defs);
    
    // Create viewport group for pan/zoom
    this.viewportGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.viewportGroup.setAttribute('class', 'viewport-group');
    
    // Create render layers
    this.backgroundLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.backgroundLayer.setAttribute('class', 'diagram-background');
    
    this.edgesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.edgesLayer.setAttribute('class', 'diagram-edges');
    
    this.nodesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodesLayer.setAttribute('class', 'diagram-nodes');
    
    this.overlayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.overlayLayer.setAttribute('class', 'diagram-overlay');
    
    // Build layer hierarchy
    this.viewportGroup.appendChild(this.backgroundLayer);
    this.viewportGroup.appendChild(this.edgesLayer);
    this.viewportGroup.appendChild(this.nodesLayer);
    this.viewportGroup.appendChild(this.overlayLayer);
    
    this.svg.appendChild(this.viewportGroup);
    this.container.appendChild(this.svg);
    
    // Create background rect for click detection
    this._createBackground();
  }

  /**
   * Create background for interaction
   * @private
   */
  _createBackground() {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '-10000');
    rect.setAttribute('y', '-10000');
    rect.setAttribute('width', '20000');
    rect.setAttribute('height', '20000');
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('class', 'background-rect');
    this.backgroundLayer.appendChild(rect);
  }

  /**
   * Create arrow markers
   * @private
   */
  _createMarkers() {
    // Arrow marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrow');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    path.setAttribute('fill', '#666');
    
    marker.appendChild(path);
    this.defs.appendChild(marker);
  }

  /**
   * Apply theme styles
   * @private
   */
  _applyTheme() {
    if (this.config.theme === 'dark') {
      this.container.classList.add('diagram-view--dark');
    }
  }

  /**
   * Initialize interaction state machine
   * @private
   */
  _initializeStateMachine() {
    // Initialize the interaction state object that existing methods expect
    this.interactionState = {
      isDragSelecting: false,
      isPanning: false,
      potentialDragStart: null,
      dragSelectionStart: null,
      dragSelectionCurrent: null,
      dragSelectionRect: null,
      previewSelectedElements: new Set(),
      hoveredElement: null,
      panStart: null,
      panStartViewport: null
    };

    this.stateMachine = new InteractionStateMachine({
      enablePan: this.interaction.enablePan,
      enableDragSelection: this.interaction.enableDragSelection,
      enableNodeDragging: this.interaction.enableNodeDragging,
      dragThreshold: 5
    });

    // Register state machine event handlers
    this._setupStateMachineHandlers();
  }

  /**
   * Set up state machine event handlers
   * @private
   */
  _setupStateMachineHandlers() {
    // Pan handlers
    this.stateMachine.on('startPanning', (data) => {
      this.interactionState.isPanning = true;
      this.interactionState.panStart = data.startPoint;
      this.interactionState.panStartViewport = { ...this.viewport };
      
      // Apply initial pan delta if current point is different from start point
      if (data.currentPoint && (
          data.currentPoint.x !== data.startPoint.x || 
          data.currentPoint.y !== data.startPoint.y)) {
        const deltaX = data.currentPoint.x - data.startPoint.x;
        const deltaY = data.currentPoint.y - data.startPoint.y;
        
        this.viewport.panX = this.interactionState.panStartViewport.panX + deltaX;
        this.viewport.panY = this.interactionState.panStartViewport.panY + deltaY;
        this._updateViewportTransform();
        this._emit('viewportChange', this.viewport);
      }
    });

    this.stateMachine.on('updatePanning', (data) => {
      this.viewport.panX = this.interactionState.panStartViewport.panX + data.delta.x;
      this.viewport.panY = this.interactionState.panStartViewport.panY + data.delta.y;
      this._updateViewportTransform();
      this._emit('viewportChange', this.viewport);
    });

    this.stateMachine.on('completePanning', () => {
      this._resetInteractionState();
    });

    this.stateMachine.on('cancelPanning', () => {
      this._resetInteractionState();
    });

    // Potential start handler (for backward compatibility)
    this.stateMachine.on('potentialStartDetected', (data) => {
      this.interactionState.potentialDragStart = data.point;
      if (this.interaction.enablePan) {
        this.interactionState.panStartViewport = { ...this.viewport };
      }
    });

    // Drag selection handlers
    this.stateMachine.on('startDragSelection', (data) => {
      this.interactionState.isDragSelecting = true;
      this.interactionState.dragSelectionStart = data.startPoint;
      this.interactionState.dragSelectionCurrent = data.currentPoint;
      this.interactionState.dragSelectionRect = null;
      this.interactionState.previewSelectedElements.clear();
      this._createSelectionRectangle();
      this._updateSelectionRectangle();
      this._updatePreviewSelection(data);
    });

    this.stateMachine.on('updateDragSelection', (data) => {
      this.interactionState.dragSelectionCurrent = data.currentPoint;
      this._updateSelectionRectangle();
      this._updatePreviewSelection(data);
    });

    this.stateMachine.on('completeDragSelection', (data) => {
      this._completeDragSelectionLogic(data);
      this._resetInteractionState();
    });

    this.stateMachine.on('cancelDragSelection', () => {
      this._cleanupDragSelection();
      this._resetInteractionState();
    });

    // Hover handlers
    this.stateMachine.on('hover', (data) => {
      this.interactionState.hoveredElement = data.elementInfo;
      // Handle hover logic here
    });

    // Interaction preparation (potential drag start)
    this.stateMachine.on('prepareInteraction', (data) => {
      this.interactionState.potentialDragStart = { x: data.event.clientX, y: data.event.clientY };
      if (this.interaction.enablePan) {
        this.interactionState.panStartViewport = { ...this.viewport };
      }
    });

    // State change handler
    this.stateMachine.on('stateChange', (data) => {
      // Useful for debugging
      if (this.config.debug) {
        console.log('State transition:', data.fromState, '->', data.toState);
      }
    });
  }

  /**
   * Reset interaction state
   * @private
   */
  _resetInteractionState() {
    if (!this.interactionState) {
      return; // State not initialized yet
    }
    
    this.interactionState.isDragSelecting = false;
    this.interactionState.isPanning = false;
    this.interactionState.potentialDragStart = null;
    this.interactionState.dragSelectionStart = null;
    this.interactionState.dragSelectionCurrent = null;
    this.interactionState.dragSelectionRect = null;
    
    // Safely clear the Set
    if (this.interactionState.previewSelectedElements && typeof this.interactionState.previewSelectedElements.clear === 'function') {
      this.interactionState.previewSelectedElements.clear();
    }
    
    this.interactionState.hoveredElement = null;
    this.interactionState.panStart = null;
    this.interactionState.panStartViewport = null;
  }

  /**
   * Complete drag selection logic for state machine
   * @private
   */
  _completeDragSelectionLogic(data) {
    // Calculate selection box
    const selectionBox = this._getSelectionBox();
    
    // Apply selection based on modifier keys
    if (data.modifiers.ctrl) {
      // Add to existing selection
      this._selectInBoxWithModifier('add', selectionBox);
    } else if (data.modifiers.alt) {
      // Toggle selection
      this._selectInBoxWithModifier('toggle', selectionBox);
    } else {
      // Replace selection
      if (this.viewModel) {
        this.viewModel.selectInBox(selectionBox);
      }
    }
    
    // Emit drag selection event
    this._emit('dragSelection', {
      startX: data.startPoint.x,
      startY: data.startPoint.y,
      endX: data.endPoint.x,
      endY: data.endPoint.y,
      selectedElements: this.viewModel ? Array.from(this.viewModel.selection) : []
    });
    
    // Cleanup visual elements
    this._cleanupDragSelection();
  }

  /**
   * Set up container-level interaction layer
   * All events are captured at the SVG container level and delegated
   * @private
   */
  _setupInteractionLayer() {
    // State is now managed by state machine in _initializeStateMachine()
    
    // Initialize viewport
    this.viewport = {
      zoom: 1,
      panX: 0,
      panY: 0
    };
    
    // Single event handler at container level
    this._handleContainerEvent = (event) => {
      const target = event.target;
      const type = event.type;
      
      // Determine what was interacted with
      const elementInfo = this._getElementInfo(target);
      
      switch (type) {
        case 'mousedown':
          this._handleMouseDown(event, elementInfo);
          break;
        case 'mousemove':
          this._handleMouseMove(event, elementInfo);
          break;
        case 'mouseup':
          this._handleMouseUp(event, elementInfo);
          break;
        case 'click':
          this._handleClick(event, elementInfo);
          break;
        case 'wheel':
          this._handleWheel(event, elementInfo);
          break;
        case 'mouseover':
          this._handleMouseOver(event, elementInfo);
          break;
        case 'mouseout':
          this._handleMouseOut(event, elementInfo);
          break;
      }
    };
    
    // Attach single handler to SVG container
    this.svg.addEventListener('mousedown', this._handleContainerEvent);
    this.svg.addEventListener('mousemove', this._handleContainerEvent);
    this.svg.addEventListener('mouseup', this._handleContainerEvent);
    this.svg.addEventListener('click', this._handleContainerEvent);
    this.svg.addEventListener('wheel', this._handleContainerEvent);
    this.svg.addEventListener('mouseover', this._handleContainerEvent);
    this.svg.addEventListener('mouseout', this._handleContainerEvent);
    
    // Add container mouse leave for cancelling interactions
    this._handleContainerMouseLeave = (event) => {
      this.stateMachine.handleEvent(InteractionEvent.MOUSE_LEAVE, { event });
    };
    this.container.addEventListener('mouseleave', this._handleContainerMouseLeave);
    
    // Set up keyboard shortcuts
    this._setupKeyboardShortcuts();
  }
  
  /**
   * Set up keyboard shortcuts
   * @private
   */
  _setupKeyboardShortcuts() {
    // Make container focusable
    this.container.tabIndex = 0;
    
    // Initialize shortcuts map
    this.shortcuts = new Map();
    this.disabledShortcuts = new Set();
    
    // Register default shortcuts
    this._registerDefaultShortcuts();
    
    // Keyboard event handler
    this._handleKeyboardEvent = (event) => {
      // Only handle if container is focused
      if (document.activeElement !== this.container) {
        return;
      }
      
      const shortcutKey = this._getShortcutKey(event);
      
      // Check if shortcut is disabled
      if (this.disabledShortcuts.has(shortcutKey)) {
        return;
      }
      
      // Check if shortcut exists
      const handler = this.shortcuts.get(shortcutKey);
      if (handler) {
        event.preventDefault();
        handler(event);
      }
    };
    
    // Attach keyboard handler
    this.container.addEventListener('keydown', this._handleKeyboardEvent);
    
    // Focus container on click
    this.svg.addEventListener('click', () => {
      this.container.focus();
    });
    
    // Setup focus management
    this._setupFocusManagement();
  }
  
  /**
   * Register default keyboard shortcuts
   * @private
   */
  _registerDefaultShortcuts() {
    // Selection shortcuts
    this.shortcuts.set('ctrl+a', () => this._selectAll());
    this.shortcuts.set('cmd+a', () => this._selectAll());
    this.shortcuts.set('escape', () => {
      // Send escape to state machine first (cancels active interactions)
      this.stateMachine.handleEvent(InteractionEvent.KEY_ESCAPE);
      // Then clear selection
      this._clearSelection();
    });
    
    // Edit shortcuts
    this.shortcuts.set('delete', () => this._deleteSelection());
    this.shortcuts.set('backspace', () => this._deleteSelection());
    this.shortcuts.set('ctrl+c', () => this._copySelection());
    this.shortcuts.set('cmd+c', () => this._copySelection());
    this.shortcuts.set('ctrl+x', () => this._cutSelection());
    this.shortcuts.set('cmd+x', () => this._cutSelection());
    this.shortcuts.set('ctrl+v', () => this._paste());
    this.shortcuts.set('cmd+v', () => this._paste());
    
    // Undo/Redo
    this.shortcuts.set('ctrl+z', () => this._undo());
    this.shortcuts.set('cmd+z', () => this._undo());
    this.shortcuts.set('ctrl+y', () => this._redo());
    this.shortcuts.set('cmd+y', () => this._redo());
    this.shortcuts.set('ctrl+shift+z', () => this._redo());
    this.shortcuts.set('cmd+shift+z', () => this._redo());
    
    // Navigation
    this.shortcuts.set('arrowup', () => this._navigate('up'));
    this.shortcuts.set('arrowdown', () => this._navigate('down'));
    this.shortcuts.set('arrowleft', () => this._navigate('left'));
    this.shortcuts.set('arrowright', () => this._navigate('right'));
    this.shortcuts.set('shift+arrowup', () => this._pan('up'));
    this.shortcuts.set('shift+arrowdown', () => this._pan('down'));
    this.shortcuts.set('shift+arrowleft', () => this._pan('left'));
    this.shortcuts.set('shift+arrowright', () => this._pan('right'));
    
    // Zoom
    this.shortcuts.set('ctrl++', () => this._zoomIn());
    this.shortcuts.set('cmd++', () => this._zoomIn());
    this.shortcuts.set('ctrl+-', () => this._zoomOut());
    this.shortcuts.set('cmd+-', () => this._zoomOut());
    this.shortcuts.set('ctrl+0', () => this._resetZoom());
    this.shortcuts.set('cmd+0', () => this._resetZoom());
    this.shortcuts.set('ctrl+shift+0', () => this.zoomToFit());
    this.shortcuts.set('cmd+shift+0', () => this.zoomToFit());
    
    // Help
    this.shortcuts.set('?', () => this._showKeyboardHelp());
  }
  
  /**
   * Get shortcut key from keyboard event
   * @private
   */
  _getShortcutKey(event) {
    const parts = [];
    
    if (event.ctrlKey) parts.push('ctrl');
    if (event.metaKey) parts.push('cmd');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    // Add the key
    const key = event.key.toLowerCase();
    parts.push(key);
    
    return parts.join('+');
  }
  
  /**
   * Keyboard shortcut handlers
   * @private
   */
  _selectAll() {
    if (this.viewModel) {
      this.viewModel.selectAll();
      this.render(this.viewModel.getState());
    }
  }
  
  _clearSelection() {
    // Cancel drag selection if active
    if (this.interactionState.isDragSelecting) {
      this._cancelDragSelection();
    }
    
    if (this.viewModel) {
      this.viewModel.clearSelection();
      this.viewModel.clearHover();
      this.render(this.viewModel.getState());
    }
  }
  
  _deleteSelection() {
    const selection = this.viewModel?.selection;
    if (selection && selection.size > 0) {
      this._emit('deleteSelection', Array.from(selection));
    }
  }
  
  _copySelection() {
    const selection = this.viewModel?.selection;
    if (selection && selection.size > 0) {
      this._emit('copySelection', Array.from(selection));
    }
  }
  
  _cutSelection() {
    const selection = this.viewModel?.selection;
    if (selection && selection.size > 0) {
      this._emit('cutSelection', Array.from(selection));
    }
  }
  
  _paste() {
    this._emit('paste');
  }
  
  _undo() {
    this._emit('undo');
  }
  
  _redo() {
    this._emit('redo');
  }
  
  _navigate(direction) {
    this._emit('navigateSelection', direction);
  }
  
  _pan(direction) {
    const panAmount = 50;
    switch (direction) {
      case 'up':
        this.viewport.panY += panAmount;
        break;
      case 'down':
        this.viewport.panY -= panAmount;
        break;
      case 'left':
        this.viewport.panX += panAmount;
        break;
      case 'right':
        this.viewport.panX -= panAmount;
        break;
    }
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }
  
  _zoomIn() {
    this.viewport.zoom *= 1.2;
    const limits = this.interaction.zoomLimits;
    this.viewport.zoom = Math.min(limits.max, this.viewport.zoom);
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }
  
  _zoomOut() {
    this.viewport.zoom *= 0.8;
    const limits = this.interaction.zoomLimits;
    this.viewport.zoom = Math.max(limits.min, this.viewport.zoom);
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }
  
  _resetZoom() {
    this.viewport.zoom = 1;
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }
  
  _showKeyboardHelp() {
    this._emit('showKeyboardHelp');
  }

  /**
   * Setup focus management
   * @private
   */
  _setupFocusManagement() {
    // Focus state
    this.currentFocusedElement = null;
    this.lastFocusedElement = null;
    this.focusIndex = -1;
    this.focusableElements = [];
    this.activeFocusTraps = [];

    // Setup focus event listeners - store bound functions for proper cleanup
    this._boundHandleContainerFocus = this._handleContainerFocus.bind(this);
    this._boundHandleContainerBlur = this._handleContainerBlur.bind(this);
    this.container.addEventListener('focus', this._boundHandleContainerFocus);
    this.container.addEventListener('blur', this._boundHandleContainerBlur);

    // Setup ARIA attributes
    this.container.setAttribute('role', 'img');
    this.container.setAttribute('aria-label', 'Software Engineering Diagram Viewer');

    // Create live region for announcements
    this.announceRegion = document.createElement('div');
    this.announceRegion.setAttribute('aria-live', 'polite');
    this.announceRegion.setAttribute('aria-atomic', 'true');
    this.announceRegion.style.position = 'absolute';
    this.announceRegion.style.left = '-10000px';
    this.announceRegion.style.width = '1px';
    this.announceRegion.style.height = '1px';
    this.announceRegion.style.overflow = 'hidden';
    this.container.appendChild(this.announceRegion);

    // Register Tab navigation shortcuts
    this.shortcuts.set('tab', (event) => {
      event.preventDefault();
      this._emit('navigateFocus', 'forward');
      this.navigateToNextFocusableElement('forward');
    });
    
    this.shortcuts.set('shift+tab', (event) => {
      event.preventDefault();
      this._emit('navigateFocus', 'backward');
      this.navigateToNextFocusableElement('backward');
    });
  }

  /**
   * Handle container focus
   * @private
   */
  _handleContainerFocus() {
    this.container.classList.add('diagram-focused');
    this._updateFocusableElements();
  }

  /**
   * Handle container blur
   * @private
   */
  _handleContainerBlur() {
    this.container.classList.remove('diagram-focused');
  }

  /**
   * Update list of focusable elements
   * @private
   */
  _updateFocusableElements() {
    this.focusableElements = [];
    
    // Add all nodes
    if (this.viewModel) {
      for (const nodeId of this.viewModel.nodes.keys()) {
        this.focusableElements.push(nodeId);
      }
      
      // Add all edges
      for (const edgeId of this.viewModel.edges.keys()) {
        this.focusableElements.push(edgeId);
      }
    }
  }

  /**
   * Navigate to next focusable element
   * @param {string} direction - 'forward' or 'backward'
   */
  navigateToNextFocusableElement(direction) {
    if (this.focusableElements.length === 0) {
      this._updateFocusableElements();
      return;
    }

    if (direction === 'forward') {
      this.focusIndex = (this.focusIndex + 1) % this.focusableElements.length;
    } else {
      this.focusIndex = this.focusIndex <= 0 
        ? this.focusableElements.length - 1 
        : this.focusIndex - 1;
    }

    const elementId = this.focusableElements[this.focusIndex];
    this.setElementFocus(elementId);
  }

  /**
   * Set focus on specific element
   * @param {string} elementId - ID of element to focus
   */
  setElementFocus(elementId) {
    // Clear previous focus
    this.clearElementFocus();

    // Set new focus
    this.currentFocusedElement = elementId;
    this.lastFocusedElement = elementId;

    // Apply focus visual indicator
    this._applyFocusIndicator(elementId);

    // Announce to screen readers
    this._announceElementFocus(elementId);
  }

  /**
   * Clear element focus
   */
  clearElementFocus() {
    if (this.currentFocusedElement) {
      this._removeFocusIndicator(this.currentFocusedElement);
      this.currentFocusedElement = null;
    }
  }

  /**
   * Restore focus to last focused element
   */
  restoreLastFocus() {
    if (this.lastFocusedElement && 
        (this.viewModel?.nodes.has(this.lastFocusedElement) || 
         this.viewModel?.edges.has(this.lastFocusedElement))) {
      this.setElementFocus(this.lastFocusedElement);
    }
  }

  /**
   * Apply focus indicator to element
   * @private
   */
  _applyFocusIndicator(elementId) {
    const element = this._getElementByIdFromSVG(elementId);
    if (element) {
      element.classList.add('focused');
    }
  }

  /**
   * Remove focus indicator from element
   * @private
   */
  _removeFocusIndicator(elementId) {
    const element = this._getElementByIdFromSVG(elementId);
    if (element) {
      element.classList.remove('focused');
    }
  }

  /**
   * Get SVG element by ID
   * @private
   */
  _getElementByIdFromSVG(elementId) {
    return this.svg.querySelector(`[data-id="${elementId}"]`);
  }

  /**
   * Announce element focus to screen readers
   * @private
   */
  _announceElementFocus(elementId) {
    if (!this.viewModel) return;

    const node = this.viewModel.nodes.get(elementId);
    const edge = this.viewModel.edges.get(elementId);

    let announcement = '';
    if (node) {
      announcement = `Focused on node: ${node.label || elementId}`;
      if (node.type) {
        announcement += ` (${node.type})`;
      }
    } else if (edge) {
      announcement = `Focused on edge: ${edge.label || elementId}`;
      if (edge.source && edge.target) {
        announcement += ` from ${edge.source} to ${edge.target}`;
      }
    }

    if (announcement) {
      // Delay announcement to avoid conflicts
      setTimeout(() => {
        this.announceRegion.textContent = announcement;
      }, 100);
    }
  }

  /**
   * Set focus indicator style
   * @param {Object} style - CSS style properties
   */
  setFocusIndicatorStyle(style) {
    this.focusIndicatorStyle = style;
  }

  /**
   * Create focus trap for modal dialogs
   * @param {HTMLElement} modalContent - Modal content element
   * @returns {Object} Focus trap controller
   */
  createFocusTrap(modalContent) {
    const focusableElements = modalContent.querySelectorAll(
      'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const focusTrap = {
      modalContent,
      firstFocusable,
      lastFocusable,
      previousActiveElement: document.activeElement,

      activate() {
        if (this.firstFocusable) {
          this.firstFocusable.focus();
        }
        document.addEventListener('keydown', this.handleTrapKeydown);
      },

      deactivate() {
        document.removeEventListener('keydown', this.handleTrapKeydown);
        if (this.previousActiveElement) {
          this.previousActiveElement.focus();
        }
      },

      handleTrapKeydown(event) {
        if (event.key === 'Tab') {
          if (event.shiftKey) {
            // Shift + Tab: move backwards
            if (document.activeElement === firstFocusable) {
              event.preventDefault();
              lastFocusable.focus();
            }
          } else {
            // Tab: move forwards
            if (document.activeElement === lastFocusable) {
              event.preventDefault();
              firstFocusable.focus();
            }
          }
        }
      }
    };

    this.activeFocusTraps.push(focusTrap);
    return focusTrap;
  }

  /**
   * Enable high contrast mode
   * @param {boolean} enabled - Whether to enable high contrast
   */
  enableHighContrastMode(enabled) {
    if (enabled) {
      this.container.classList.add('high-contrast');
    } else {
      this.container.classList.remove('high-contrast');
    }
  }

  /**
   * Get keyboard navigation instructions
   * @returns {string} Instructions text
   */
  getKeyboardNavigationInstructions() {
    return [
      'Tab to navigate between elements',
      'Arrow keys to move selection', 
      'Enter or Space to activate',
      'Escape to clear selection',
      'Ctrl+A to select all',
      '? for keyboard shortcuts help'
    ].join(', ');
  }
  
  /**
   * Set drag selection rectangle styling
   * @param {Object} style - Style properties
   */
  setDragSelectionStyle(style) {
    this.dragSelectionStyle = { ...this.dragSelectionStyle, ...style };
  }
  
  /**
   * Register custom keyboard shortcut
   * @param {string} shortcut - Shortcut key combination
   * @param {Function} handler - Handler function
   */
  registerShortcut(shortcut, handler) {
    this.shortcuts.set(shortcut.toLowerCase(), handler);
  }
  
  /**
   * Disable a keyboard shortcut
   * @param {string} shortcut - Shortcut to disable
   */
  disableShortcut(shortcut) {
    this.disabledShortcuts.add(shortcut.toLowerCase());
  }
  
  /**
   * Enable a keyboard shortcut
   * @param {string} shortcut - Shortcut to enable
   */
  enableShortcut(shortcut) {
    this.disabledShortcuts.delete(shortcut.toLowerCase());
  }
  
  /**
   * Get list of keyboard shortcuts
   * @returns {Array} List of shortcuts with descriptions
   */
  getKeyboardShortcuts() {
    return [
      // Selection
      { key: 'ctrl+a', description: 'Select all elements', category: 'Selection' },
      { key: 'escape', description: 'Clear selection', category: 'Selection' },
      
      // Edit
      { key: 'delete', description: 'Delete selected elements', category: 'Edit' },
      { key: 'ctrl+c', description: 'Copy selection', category: 'Edit' },
      { key: 'ctrl+x', description: 'Cut selection', category: 'Edit' },
      { key: 'ctrl+v', description: 'Paste', category: 'Edit' },
      
      // Undo/Redo
      { key: 'ctrl+z', description: 'Undo', category: 'Edit' },
      { key: 'ctrl+y', description: 'Redo', category: 'Edit' },
      
      // Navigation
      { key: 'arrow keys', description: 'Navigate selection', category: 'Navigation' },
      { key: 'shift+arrow keys', description: 'Pan viewport', category: 'Navigation' },
      
      // Zoom
      { key: 'ctrl++', description: 'Zoom in', category: 'View' },
      { key: 'ctrl+-', description: 'Zoom out', category: 'View' },
      { key: 'ctrl+0', description: 'Reset zoom', category: 'View' },
      { key: 'ctrl+shift+0', description: 'Fit to viewport', category: 'View' },
      
      // Help
      { key: '?', description: 'Show keyboard shortcuts', category: 'Help' }
    ];
  }
  
  /**
   * Get element information from DOM target
   * @private
   */
  _getElementInfo(target) {
    // Walk up DOM tree to find diagram element
    let element = target;
    while (element && element !== this.svg) {
      // Check if it's a node
      if (element.classList && element.classList.contains('node')) {
        return {
          type: 'node',
          id: element.getAttribute('data-id'),
          element: element
        };
      }
      
      // Check if it's an edge
      if (element.classList && element.classList.contains('edge')) {
        return {
          type: 'edge',
          id: element.getAttribute('data-id'),
          element: element
        };
      }
      
      // Check if it's background
      if (element.classList && element.classList.contains('background-rect')) {
        return {
          type: 'background',
          element: element
        };
      }
      
      element = element.parentNode;
    }
    
    return { type: 'unknown', element: target };
  }

  /**
   * Handle mouse down event
   * @private
   */
  _handleMouseDown(event, elementInfo) {
    // Only handle left mouse button
    if (event.button !== 0) return;
    
    // Use state machine for all mouse down events
    const eventType = elementInfo.type === 'background' 
      ? InteractionEvent.MOUSE_DOWN_BACKGROUND 
      : InteractionEvent.MOUSE_DOWN_NODE;
      
    this.stateMachine.handleEvent(eventType, {
      clientX: event.clientX,
      clientY: event.clientY,
      elementInfo,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      event
    });
    
    event.preventDefault();
  }

  /**
   * Handle mouse move event
   * @private
   */
  _handleMouseMove(event, elementInfo) {
    // Send mouse move event to state machine
    this.stateMachine.handleEvent(InteractionEvent.MOUSE_MOVE, {
      clientX: event.clientX,
      clientY: event.clientY,
      elementInfo,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      event
    });
  }

  /**
   * Handle mouse up event
   * @private
   */
  _handleMouseUp(event, elementInfo) {
    // Send mouse up event to state machine
    this.stateMachine.handleEvent(InteractionEvent.MOUSE_UP, {
      clientX: event.clientX,
      clientY: event.clientY,
      elementInfo,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      event
    });
    
    // Prevent default if we're completing an interaction
    if (!this.stateMachine.isInState(InteractionState.IDLE)) {
      event.preventDefault();
    }
    
    // Clear drag selection start if we didn't actually start selecting
    if (this.interactionState.dragSelectionStart && !this.interactionState.isDragSelecting) {
      this.interactionState.dragSelectionStart = null;
    }
  }
  
  /**
   * Handle click event
   * @private
   */
  _handleClick(event, elementInfo) {
    event.stopPropagation();
    
    // Focus the container to enable keyboard interactions
    if (this.container && this.container !== document.activeElement) {
      this.container.focus();
    }
    
    // Emit click events based on element type
    if (elementInfo.type === 'node') {
      this._emit('nodeClick', elementInfo.id);
    } else if (elementInfo.type === 'edge') {
      this._emit('edgeClick', elementInfo.id);
    } else if (elementInfo.type === 'background') {
      this._emit('backgroundClick');
    }
  }

  /**
   * Handle wheel event for zooming
   * @private
   */
  _handleWheel(event, elementInfo) {
    if (!this.interaction.enableZoom) return;
    
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = this.viewport.zoom * delta;
    
    // Apply zoom limits
    const limits = this.interaction.zoomLimits;
    this.viewport.zoom = Math.max(limits.min, Math.min(limits.max, newZoom));
    
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }
  
  /**
   * Handle mouse over event
   * @private
   */
  _handleMouseOver(event, elementInfo) {
    // Track hover state
    if (elementInfo.type === 'node' || elementInfo.type === 'edge') {
      if (this.interactionState.hoveredElement !== elementInfo.id) {
        this.interactionState.hoveredElement = elementInfo.id;
        this._emit('elementHover', { 
          type: elementInfo.type, 
          id: elementInfo.id 
        });
        
        // Show tooltip if available
        if (this.tooltip && this.viewModel) {
          const hoverInfo = this.viewModel.getHoverInfo();
          if (hoverInfo) {
            this.tooltip.show(hoverInfo, {
              x: event.clientX,
              y: event.clientY
            });
          }
        }
      }
    }
  }
  
  /**
   * Handle mouse out event
   * @private
   */
  _handleMouseOut(event, elementInfo) {
    // Clear hover state when leaving diagram elements
    if (this.interactionState.hoveredElement) {
      this._emit('elementHoverEnd', { 
        id: this.interactionState.hoveredElement 
      });
      this.interactionState.hoveredElement = null;
      
      // Hide tooltip
      if (this.tooltip) {
        this.tooltip.hide();
      }
    }
  }

  /**
   * Update viewport transform
   * @private
   */
  _updateViewportTransform() {
    const transform = `translate(${this.viewport.panX}, ${this.viewport.panY}) scale(${this.viewport.zoom})`;
    this.viewportGroup.setAttribute('transform', transform);
  }

  /**
   * Render the diagram
   * @param {Object} state - Diagram state from ViewModel
   */
  render(state) {
    if (!state) return;
    
    // Store reference to ViewModel for display properties
    this.viewModel = state.viewModel;
    
    // Update viewport if provided
    if (state.viewport) {
      this.viewport = { ...state.viewport };
      this._updateViewportTransform();
    }
    
    // Clear existing content
    this._clearLayers();
    
    // Render edges
    if (state.edges) {
      state.edges.forEach(edge => this._renderEdge(edge, state.selection, state.hoveredElement));
    }
    
    // Render nodes
    if (state.nodes) {
      state.nodes.forEach(node => this._renderNode(node, state.selection, state.hoveredElement));
    }
    
    // Store layout bounds for zoom to fit
    this.layoutBounds = state.layoutBounds;
    
    // Validate focus - clear if focused element no longer exists
    if (this.currentFocusedElement) {
      const stillExists = this._elementExists(this.currentFocusedElement, state);
      if (!stillExists) {
        this.clearElementFocus();
      }
    }
  }

  /**
   * Check if an element still exists in the current state
   * @private
   */
  _elementExists(elementId, state) {
    // Check nodes
    if (state.nodes) {
      for (const node of state.nodes.values()) {
        if (node.id === elementId) {
          return true;
        }
      }
    }
    
    // Check edges
    if (state.edges) {
      for (const edge of state.edges.values()) {
        if (edge.id === elementId) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Clear render layers
   * @private
   */
  _clearLayers() {
    // Keep background rect
    const bgRect = this.backgroundLayer.querySelector('.background-rect');
    this.backgroundLayer.innerHTML = '';
    if (bgRect) this.backgroundLayer.appendChild(bgRect);
    
    this.edgesLayer.innerHTML = '';
    this.nodesLayer.innerHTML = '';
    this.overlayLayer.innerHTML = '';
  }

  /**
   * Render a node
   * @private
   */
  _renderNode(node, selection, hoveredElement) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('data-id', node.id);
    g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);
    
    const isSelected = selection && selection.has(node.id);
    const isHovered = hoveredElement === node.id;
    
    // Add state classes
    if (isSelected) {
      g.classList.add('node--selected', 'selected');
    }
    if (isHovered) {
      g.classList.add('node--hovered');
    }
    
    // Create node shape
    const shape = this._createNodeShape(node);
    g.appendChild(shape);
    
    // Add selection outline
    if (isSelected) {
      const selectionOutline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selectionOutline.setAttribute('x', -3);
      selectionOutline.setAttribute('y', -3);
      selectionOutline.setAttribute('width', node.size.width + 6);
      selectionOutline.setAttribute('height', node.size.height + 6);
      selectionOutline.setAttribute('rx', '6');
      selectionOutline.setAttribute('fill', 'none');
      selectionOutline.setAttribute('stroke', '#007bff');
      selectionOutline.setAttribute('stroke-width', '2');
      selectionOutline.setAttribute('stroke-dasharray', '5,5');
      selectionOutline.setAttribute('class', 'node-selection-outline');
      g.appendChild(selectionOutline);
    }
    
    // Add hover outline
    if (isHovered) {
      const hoverOutline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      hoverOutline.setAttribute('x', -2);
      hoverOutline.setAttribute('y', -2);
      hoverOutline.setAttribute('width', node.size.width + 4);
      hoverOutline.setAttribute('height', node.size.height + 4);
      hoverOutline.setAttribute('rx', '5');
      hoverOutline.setAttribute('fill', 'none');
      hoverOutline.setAttribute('stroke', '#28a745');
      hoverOutline.setAttribute('stroke-width', '2');
      hoverOutline.setAttribute('opacity', '0.8');
      hoverOutline.setAttribute('class', 'node-hover-outline');
      g.appendChild(hoverOutline);
    }
    
    // Add label
    if (node.label) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.size.width / 2);
      text.setAttribute('y', node.size.height / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'node-label');
      text.textContent = node.label;
      g.appendChild(text);
    }
    
    // No individual event handlers - using container-level delegation
    
    this.nodesLayer.appendChild(g);
  }

  /**
   * Create node shape based on style
   * @private
   */
  _createNodeShape(node) {
    const shape = node.style?.shape || 'rectangle';
    let element;
    
    switch (shape) {
      case 'circle':
        element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        element.setAttribute('cx', node.size.width / 2);
        element.setAttribute('cy', node.size.height / 2);
        element.setAttribute('r', Math.min(node.size.width, node.size.height) / 2);
        break;
        
      case 'diamond':
        element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const hw = node.size.width / 2;
        const hh = node.size.height / 2;
        element.setAttribute('points', `${hw},0 ${node.size.width},${hh} ${hw},${node.size.height} 0,${hh}`);
        break;
        
      default: // rectangle
        element = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        element.setAttribute('width', node.size.width);
        element.setAttribute('height', node.size.height);
        element.setAttribute('rx', '4');
    }
    
    element.setAttribute('fill', node.style?.color || '#fff');
    element.setAttribute('stroke', '#333');
    element.setAttribute('stroke-width', '2');
    element.setAttribute('class', 'node-shape');
    
    return element;
  }

  /**
   * Render an edge
   * @private
   */
  _renderEdge(edge, selection, hoveredElement) {
    if (!edge.path) return;
    
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'edge');
    g.setAttribute('data-id', edge.id);
    
    const isSelected = selection && selection.has(edge.id);
    const isHovered = hoveredElement === edge.id;
    
    // Add state classes
    if (isSelected) {
      g.classList.add('edge--selected', 'selected');
    }
    if (isHovered) {
      g.classList.add('edge--hovered');
    }
    
    const d = `M${edge.path.start.x},${edge.path.start.y} L${edge.path.end.x},${edge.path.end.y}`;
    
    // Add selection/hover highlight path (below main path)
    if (isSelected || isHovered) {
      const highlightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      highlightPath.setAttribute('d', d);
      highlightPath.setAttribute('stroke', isSelected ? '#007bff' : '#28a745');
      highlightPath.setAttribute('stroke-width', '4');
      highlightPath.setAttribute('fill', 'none');
      highlightPath.setAttribute('opacity', '0.5');
      highlightPath.setAttribute('class', isSelected ? 'edge-selection-highlight' : 'edge-hover-highlight');
      g.appendChild(highlightPath);
    }
    
    // Create main path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', isSelected ? '#007bff' : (isHovered ? '#28a745' : '#666'));
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrow)');
    path.setAttribute('class', 'edge-path');
    
    // Add invisible wider path for easier clicking
    const clickPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    clickPath.setAttribute('d', d);
    clickPath.setAttribute('stroke', 'transparent');
    clickPath.setAttribute('stroke-width', '10');
    clickPath.setAttribute('fill', 'none');
    clickPath.setAttribute('class', 'edge-click-area');
    
    g.appendChild(path);
    g.appendChild(clickPath);
    
    // Add label if present
    if (edge.label) {
      const midX = (edge.path.start.x + edge.path.end.x) / 2;
      const midY = (edge.path.start.y + edge.path.end.y) / 2;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX);
      text.setAttribute('y', midY - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'edge-label');
      text.textContent = edge.label;
      g.appendChild(text);
    }
    
    // No individual event handlers - using container-level delegation
    
    this.edgesLayer.appendChild(g);
  }

  /**
   * Zoom to fit all content
   */
  zoomToFit() {
    if (!this.layoutBounds) return;
    
    const containerRect = this.container.getBoundingClientRect();
    const padding = 50;
    
    const scaleX = (containerRect.width - padding * 2) / this.layoutBounds.width;
    const scaleY = (containerRect.height - padding * 2) / this.layoutBounds.height;
    const scale = Math.min(scaleX, scaleY);
    
    // Apply zoom limits
    const limits = this.interaction.zoomLimits;
    this.viewport.zoom = Math.max(limits.min, Math.min(limits.max, scale));
    
    this.viewport.panX = (containerRect.width - this.layoutBounds.width * this.viewport.zoom) / 2 - this.layoutBounds.x * this.viewport.zoom;
    this.viewport.panY = (containerRect.height - this.layoutBounds.height * this.viewport.zoom) / 2 - this.layoutBounds.y * this.viewport.zoom;
    
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }

  /**
   * Pan to specific position
   * @param {Object} position - { x, y } position to center on
   */
  panTo(position) {
    const containerRect = this.container.getBoundingClientRect();
    
    this.viewport.panX = containerRect.width / 2 - position.x * this.viewport.zoom;
    this.viewport.panY = containerRect.height / 2 - position.y * this.viewport.zoom;
    
    this._updateViewportTransform();
    this._emit('viewportChange', this.viewport);
  }

  /**
   * Export as SVG string
   * @returns {string} SVG string
   */
  exportSVG() {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(this.svg);
  }

  /**
   * Export as PNG
   * @returns {Promise<Blob>} PNG blob
   */
  async exportPNG() {
    // In a real browser environment, this would create a PNG
    // For testing environment, we'll return a mock promise
    if (typeof window !== 'undefined' && window.URL && window.URL.createObjectURL) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        const svgString = this.exportSVG();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = window.URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          canvas.width = this.container.clientWidth;
          canvas.height = this.container.clientHeight;
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            window.URL.revokeObjectURL(url);
            resolve(blob);
          }, 'image/png');
        };
        
        img.onerror = () => {
          window.URL.revokeObjectURL(url);
          reject(new Error('Failed to export PNG'));
        };
        
        img.src = url;
      });
    } else {
      // Return a mock blob for testing
      return Promise.resolve(new Blob(['mock-png-data'], { type: 'image/png' }));
    }
  }

  /**
   * Register event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback
   */
  /**
   * Set ViewModel reference
   * @param {DiagramViewModel} viewModel - ViewModel instance
   */
  setViewModel(viewModel) {
    this.viewModel = viewModel;
  }

  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(callback);
  }

  /**
   * Remove event listener
   * @param {string} eventName - Event name
   * @param {Function} callback - Event callback
   */
  off(eventName, callback) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   * @private
   */
  _emit(eventName, ...args) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => callback(...args));
    }
  }

  /**
   * Destroy the view
   */
  destroy() {
    // Clean up drag selection first (before clearing interactionState)
    if (this.interactionState && this.interactionState.isDragSelecting) {
      this._cleanupDragSelection();
    }
    
    // Remove container-level event handler
    if (this._handleContainerEvent && this.svg) {
      this.svg.removeEventListener('mousedown', this._handleContainerEvent);
      this.svg.removeEventListener('mousemove', this._handleContainerEvent);
      this.svg.removeEventListener('mouseup', this._handleContainerEvent);
      this.svg.removeEventListener('click', this._handleContainerEvent);
      this.svg.removeEventListener('wheel', this._handleContainerEvent);
      this.svg.removeEventListener('mouseover', this._handleContainerEvent);
      this.svg.removeEventListener('mouseout', this._handleContainerEvent);
    }
    
    // Remove keyboard event handler
    if (this._handleKeyboardEvent && this.container) {
      this.container.removeEventListener('keydown', this._handleKeyboardEvent);
    }
    
    // Remove container mouse leave handler
    if (this._handleContainerMouseLeave && this.container) {
      this.container.removeEventListener('mouseleave', this._handleContainerMouseLeave);
    }
    
    // Destroy tooltip
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Clear shortcuts
    if (this.shortcuts) {
      this.shortcuts.clear();
    }
    if (this.disabledShortcuts) {
      this.disabledShortcuts.clear();
    }
    
    // Clean up state machine
    if (this.stateMachine) {
      this.stateMachine.destroy();
      this.stateMachine = null;
    }
    
    // Clean up focus management
    this.clearElementFocus();
    if (this.focusableElements) {
      this.focusableElements.length = 0;
    }
    if (this.activeFocusTraps) {
      this.activeFocusTraps.forEach(trap => trap.deactivate());
      this.activeFocusTraps.length = 0;
    }
    
    // Remove focus event listeners
    if (this.container) {
      this.container.removeEventListener('focus', this._boundHandleContainerFocus);
      this.container.removeEventListener('blur', this._boundHandleContainerBlur);
    }
    
    // Remove DOM elements
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    
    // Clear drag selection state
    if (this.interactionState) {
      if (this.interactionState.isDragSelecting) {
        this._cleanupDragSelection();
      }
      this.interactionState.isDragSelecting = false;
      this.interactionState.potentialDragStart = null;
      this.interactionState.dragSelectionStart = null;
      this.interactionState.dragSelectionCurrent = null;
      this.interactionState.dragSelectionRect = null;
      if (this.interactionState.previewSelectedElements) {
        this.interactionState.previewSelectedElements.clear();
      }
    }
    
    // Clear references
    this.svg = null;
    this.container = null;
    this.viewportGroup = null;
    this.backgroundLayer = null;
    this.edgesLayer = null;
    this.nodesLayer = null;
    this.overlayLayer = null;
    this.defs = null;
    this.interactionState = null;
    this.viewport = null;
    this._handleContainerEvent = null;
    this._handleKeyboardEvent = null;
  }

  /**
   * Start drag selection
   * @private
   */
  _startDragSelection(event) {
    this.interactionState.isDragSelecting = true;
    this.interactionState.dragSelectionCurrent = { x: event.clientX, y: event.clientY };
    this.interactionState.previewSelectedElements.clear();
    
    this._createSelectionRectangle();
    this._updateSelectionRectangle();
  }

  /**
   * Update drag selection
   * @private
   */
  _updateDragSelection(event) {
    this.interactionState.dragSelectionCurrent = { x: event.clientX, y: event.clientY };
    
    this._updateSelectionRectangle();
    this._updatePreviewSelection(event);
  }

  /**
   * Complete drag selection
   * @private
   */
  _completeDragSelection(event) {
    if (!this.interactionState.isDragSelecting) return;
    
    const { dragSelectionStart, dragSelectionCurrent } = this.interactionState;
    
    // Calculate selection box
    const selectionBox = this._getSelectionBox();
    
    // Apply selection based on modifier keys
    if (event.ctrlKey || event.metaKey) {
      // Add to existing selection
      this._selectInBoxWithModifier('add', selectionBox);
    } else if (event.altKey) {
      // Toggle selection
      this._selectInBoxWithModifier('toggle', selectionBox);
    } else {
      // Replace selection
      if (this.viewModel) {
        this.viewModel.selectInBox(selectionBox);
      }
    }
    
    // Emit drag selection event
    this._emit('dragSelection', {
      startX: dragSelectionStart.x,
      startY: dragSelectionStart.y,
      endX: dragSelectionCurrent.x,
      endY: dragSelectionCurrent.y,
      selectedElements: this.viewModel ? Array.from(this.viewModel.selection) : []
    });
    
    this._cleanupDragSelection();
  }

  /**
   * Cancel drag selection
   * @private
   */
  _cancelDragSelection() {
    if (!this.interactionState.isDragSelecting) return;
    
    this._cleanupDragSelection();
  }

  /**
   * Cleanup drag selection state
   * @private
   */
  _cleanupDragSelection() {
    // Remove selection rectangle
    if (this.interactionState.dragSelectionRect) {
      this.interactionState.dragSelectionRect.remove();
      this.interactionState.dragSelectionRect = null;
    }
    
    // Clear preview selection styling
    this._clearPreviewSelection();
    
    // Reset drag selection state
    this.interactionState.isDragSelecting = false;
    this.interactionState.potentialDragStart = null;
    this.interactionState.dragSelectionStart = null;
    this.interactionState.dragSelectionCurrent = null;
    this.interactionState.previewSelectedElements.clear();
  }

  /**
   * Create selection rectangle element
   * @private
   */
  _createSelectionRectangle() {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'drag-selection-rect');
    rect.setAttribute('stroke', this.dragSelectionStyle.stroke);
    rect.setAttribute('stroke-width', this.dragSelectionStyle.strokeWidth);
    rect.setAttribute('fill', this.dragSelectionStyle.fill);
    rect.setAttribute('stroke-dasharray', this.dragSelectionStyle.strokeDasharray);
    rect.setAttribute('pointer-events', 'none');
    
    this.overlayLayer.appendChild(rect);
    this.interactionState.dragSelectionRect = rect;
  }

  /**
   * Update selection rectangle dimensions
   * @private
   */
  _updateSelectionRectangle() {
    if (!this.interactionState.dragSelectionRect) return;
    
    const { dragSelectionStart, dragSelectionCurrent } = this.interactionState;
    
    const x1 = Math.min(dragSelectionStart.x, dragSelectionCurrent.x);
    const y1 = Math.min(dragSelectionStart.y, dragSelectionCurrent.y);
    const width = Math.abs(dragSelectionCurrent.x - dragSelectionStart.x);
    const height = Math.abs(dragSelectionCurrent.y - dragSelectionStart.y);
    
    this.interactionState.dragSelectionRect.setAttribute('x', x1);
    this.interactionState.dragSelectionRect.setAttribute('y', y1);
    this.interactionState.dragSelectionRect.setAttribute('width', width);
    this.interactionState.dragSelectionRect.setAttribute('height', height);
  }

  /**
   * Update preview selection during drag
   * @private
   */
  _updatePreviewSelection(eventOrData) {
    if (!this.viewModel) return;
    
    // Clear previous preview selection
    this._clearPreviewSelection();
    
    const selectionBox = this._getSelectionBox();
    
    // Find elements in selection box
    const elementsInBox = [];
    
    // Check nodes
    this.viewModel.nodes.forEach((node, id) => {
      if (this._isNodeInBox(node, selectionBox)) {
        elementsInBox.push(id);
      }
    });
    
    // Check edges (if both endpoints are in box)
    this.viewModel.edges.forEach((edge, id) => {
      const sourceNode = this.viewModel.nodes.get(edge.source);
      const targetNode = this.viewModel.nodes.get(edge.target);
      if (sourceNode && targetNode && 
          this._isNodeInBox(sourceNode, selectionBox) && 
          this._isNodeInBox(targetNode, selectionBox)) {
        elementsInBox.push(id);
      }
    });
    
    // Apply preview selection styling (excluding already selected elements)
    elementsInBox.forEach(elementId => {
      if (!this.viewModel.selection.has(elementId)) {
        this.interactionState.previewSelectedElements.add(elementId);
        this._applyPreviewSelectionStyling(elementId);
      }
    });
  }

  /**
   * Get selection box in SVG coordinates
   * @private
   */
  _getSelectionBox() {
    const { dragSelectionStart, dragSelectionCurrent } = this.interactionState;
    
    // Convert screen coordinates to SVG coordinates
    const containerRect = this.container.getBoundingClientRect();
    const svgRect = this.svg.getBoundingClientRect();
    
    const startSVG = this._screenToSVG(dragSelectionStart.x, dragSelectionStart.y);
    const currentSVG = this._screenToSVG(dragSelectionCurrent.x, dragSelectionCurrent.y);
    
    return {
      x: Math.min(startSVG.x, currentSVG.x),
      y: Math.min(startSVG.y, currentSVG.y),
      width: Math.abs(currentSVG.x - startSVG.x),
      height: Math.abs(currentSVG.y - startSVG.y)
    };
  }

  /**
   * Convert screen coordinates to SVG coordinates
   * @private
   */
  _screenToSVG(screenX, screenY) {
    const svgRect = this.svg.getBoundingClientRect();
    const svgX = screenX - svgRect.left;
    const svgY = screenY - svgRect.top;
    
    // Account for viewport transform
    const adjustedX = (svgX - this.viewport.panX) / this.viewport.zoom;
    const adjustedY = (svgY - this.viewport.panY) / this.viewport.zoom;
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * Check if a node is within a selection box
   * @private
   */
  _isNodeInBox(node, box) {
    const nodeRight = node.position.x + node.size.width;
    const nodeBottom = node.position.y + node.size.height;
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;
    
    return !(node.position.x > boxRight || 
             nodeRight < box.x || 
             node.position.y > boxBottom || 
             nodeBottom < box.y);
  }

  /**
   * Apply preview selection styling to element
   * @private
   */
  _applyPreviewSelectionStyling(elementId) {
    const element = this._getElementByIdFromSVG(elementId);
    if (element) {
      element.classList.add('preview-selected');
    }
  }


  /**
   * Get SVG element by ID
   * @private
   */
  _getElementByIdFromSVG(elementId) {
    return this.svg.querySelector(`[data-id="${elementId}"]`);
  }

  /**
   * Clear all preview selection styling
   * @private
   */
  _clearPreviewSelection() {
    if (this.interactionState.previewSelectedElements) {
      this.interactionState.previewSelectedElements.forEach(elementId => {
        const element = this._getElementByIdFromSVG(elementId);
        if (element) {
          element.classList.remove('preview-selected');
        }
      });
      this.interactionState.previewSelectedElements.clear();
    }
  }

  /**
   * Select elements in box with modifier
   * @private
   */
  _selectInBoxWithModifier(mode, selectionBox) {
    if (!this.viewModel) return;
    
    // Find elements in box
    const elementsInBox = [];
    
    // Check nodes
    this.viewModel.nodes.forEach((node, id) => {
      if (this._isNodeInBox(node, selectionBox)) {
        elementsInBox.push(id);
      }
    });
    
    // Check edges
    this.viewModel.edges.forEach((edge, id) => {
      const sourceNode = this.viewModel.nodes.get(edge.source);
      const targetNode = this.viewModel.nodes.get(edge.target);
      if (sourceNode && targetNode && 
          this._isNodeInBox(sourceNode, selectionBox) && 
          this._isNodeInBox(targetNode, selectionBox)) {
        elementsInBox.push(id);
      }
    });
    
    if (mode === 'add') {
      // Add to existing selection
      elementsInBox.forEach(id => {
        this.viewModel.addToSelection(id);
      });
    } else if (mode === 'toggle') {
      // Toggle selection
      elementsInBox.forEach(id => {
        this.viewModel.toggleSelection(id);
      });
    }
  }
}