/**
 * GraphEditorView - View layer for the Graph Editor
 * 
 * Handles rendering and user input for the graph editor.
 */

import { Transform } from '../model/Transform.js';
import { Renderer } from './Renderer.js';

export class GraphEditorView {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    this._destroyed = false;
    
    // Create viewport
    this.viewport = new Viewport();
    
    // Create renderer (default to SVG)
    this.rendererType = config.rendererType || 'svg';
    this.renderer = null; // Will be created asynchronously
    
    // Event handling
    this.eventListeners = [];
    this.renderListeners = [];
    
    // Render scheduling
    this.renderRequested = false;
    
    // Setup container
    this._setupContainer();
    
    // Setup event listeners
    this._setupEventListeners();
    
    // Initialize renderer
    this._initializeRenderer();
  }

  /**
   * Get container element
   */
  getContainer() {
    return this.container;
  }

  /**
   * Get renderer
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Get renderer type
   */
  getRendererType() {
    return this.rendererType;
  }

  /**
   * Set renderer type and recreate renderer
   */
  async setRendererType(type) {
    if (type === this.rendererType) return;
    
    // Destroy old renderer
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    // Create new renderer
    this.rendererType = type;
    this.renderer = await this._createRenderer(type);
    
    // Request render
    this.requestRender();
  }

  /**
   * Get viewport
   */
  getViewport() {
    return this.viewport;
  }

  /**
   * Request render on next animation frame
   */
  requestRender() {
    if (this.renderRequested || this._destroyed) return;
    
    this.renderRequested = true;
    requestAnimationFrame(() => {
      this.renderRequested = false;
      this._render();
    });
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenPoint) {
    const rect = this.container.getBoundingClientRect();
    const x = screenPoint.x - rect.left;
    const y = screenPoint.y - rect.top;
    
    return this.viewport.transform.inverseTransformPoint({ x, y });
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldPoint) {
    const screenPoint = this.viewport.transform.transformPoint(worldPoint);
    const rect = this.container.getBoundingClientRect();
    
    return {
      x: screenPoint.x + rect.left,
      y: screenPoint.y + rect.top
    };
  }

  /**
   * Add render listener
   */
  onRender(listener) {
    this.renderListeners.push(listener);
  }

  /**
   * Remove render listener
   */
  offRender(listener) {
    const index = this.renderListeners.indexOf(listener);
    if (index !== -1) {
      this.renderListeners.splice(index, 1);
    }
  }

  /**
   * Add event listener
   */
  onEvent(listener) {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  offEvent(listener) {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Notify event (for testing)
   * @private
   */
  _notifyEvent(event) {
    this.eventListeners.forEach(listener => listener(event));
  }

  /**
   * Setup container
   * @private
   */
  _setupContainer() {
    // Ensure container has position
    const position = window.getComputedStyle(this.container).position;
    if (position === 'static') {
      this.container.style.position = 'relative';
    }
    
    // Add graph editor class
    this.container.classList.add('graph-editor-view');
    
    // Create renderer container
    const rendererContainer = document.createElement('div');
    rendererContainer.className = 'graph-editor-renderer';
    rendererContainer.style.width = '100%';
    rendererContainer.style.height = '100%';
    rendererContainer.style.position = 'absolute';
    rendererContainer.style.top = '0';
    rendererContainer.style.left = '0';
    
    this.container.appendChild(rendererContainer);
    this.rendererContainer = rendererContainer;
  }

  /**
   * Set cursor style
   */
  setCursor(cursor) {
    this.container.style.cursor = cursor;
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupEventListeners() {
    // Mouse events
    this.container.addEventListener('mousedown', (e) => this._handleMouseEvent(e));
    this.container.addEventListener('mousemove', (e) => this._handleMouseEvent(e));
    this.container.addEventListener('mouseup', (e) => this._handleMouseEvent(e));
    this.container.addEventListener('click', (e) => this._handleMouseEvent(e));
    this.container.addEventListener('dblclick', (e) => this._handleMouseEvent(e));
    
    // Touch events
    this.container.addEventListener('touchstart', (e) => this._handleTouchEvent(e));
    this.container.addEventListener('touchmove', (e) => this._handleTouchEvent(e));
    this.container.addEventListener('touchend', (e) => this._handleTouchEvent(e));
    
    // Wheel event
    this.container.addEventListener('wheel', (e) => this._handleWheelEvent(e));
    
    // Context menu
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._handleMouseEvent(e);
    });
  }

  /**
   * Handle mouse events
   * @private
   */
  _handleMouseEvent(event) {
    const rect = this.container.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const worldPosition = this.viewport.transform.inverseTransformPoint(position);
    
    this._notifyEvent({
      type: event.type,
      position: worldPosition,
      screenPosition: position,
      button: event.button || 0,
      buttons: event.buttons || 0,
      modifiers: {
        shift: event.shiftKey || false,
        ctrl: event.ctrlKey || false,
        alt: event.altKey || false,
        meta: event.metaKey || false
      },
      originalEvent: event
    });
  }

  /**
   * Handle touch events
   * @private
   */
  _handleTouchEvent(event) {
    const rect = this.container.getBoundingClientRect();
    
    // Use first touch for position
    const touch = event.touches.length > 0 ? event.touches[0] : event.changedTouches[0];
    const position = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    
    const worldPosition = this.viewport.transform.inverseTransformPoint(position);
    
    this._notifyEvent({
      type: event.type,
      position: worldPosition,
      screenPosition: position,
      touches: event.touches.length,
      modifiers: {
        shift: false,
        ctrl: false,
        alt: false,
        meta: false
      },
      originalEvent: event
    });
  }

  /**
   * Handle wheel events
   * @private
   */
  _handleWheelEvent(event) {
    event.preventDefault();
    
    const rect = this.container.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const worldPosition = this.viewport.transform.inverseTransformPoint(position);
    
    this._notifyEvent({
      type: 'wheel',
      position: worldPosition,
      screenPosition: position,
      deltaX: event.deltaX || 0,
      deltaY: event.deltaY || 0,
      deltaZ: event.deltaZ || 0,
      deltaMode: event.deltaMode || 0,
      modifiers: {
        shift: event.shiftKey || false,
        ctrl: event.ctrlKey || false,
        alt: event.altKey || false,
        meta: event.metaKey || false
      },
      originalEvent: event
    });
  }

  /**
   * Create renderer
   * @private
   */
  async _createRenderer(type) {
    return await Renderer.create(type, this.rendererContainer, this.config.rendererConfig);
  }

  /**
   * Initialize renderer
   * @private
   */
  async _initializeRenderer() {
    this.renderer = await this._createRenderer(this.rendererType);
    this.requestRender();
  }

  /**
   * Render
   * @private
   */
  _render() {
    if (!this.renderer) return;
    
    // Apply viewport transform
    this.renderer.setTransform(this.viewport.getTransform());
    
    // Notify listeners (they will do the actual rendering)
    this.renderListeners.forEach(listener => listener());
  }

  /**
   * Destroy the view and clean up resources
   */
  destroy() {
    this._destroyed = true;
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    // Clear listeners
    this.eventListeners = [];
    this.renderListeners = [];
    
    // Clear container
    if (this.rendererContainer && this.rendererContainer.parentNode) {
      this.rendererContainer.parentNode.removeChild(this.rendererContainer);
    }
  }
}

/**
 * Viewport - Manages view transformation
 */
class Viewport {
  constructor() {
    this.transform = new Transform();
    this.bounds = {
      minZoom: 0.1,
      maxZoom: 10
    };
  }

  /**
   * Get transform
   */
  getTransform() {
    return this.transform;
  }

  /**
   * Pan by delta
   */
  pan(dx, dy) {
    this.transform.translate(dx, dy);
  }

  /**
   * Zoom by factor at point
   */
  zoom(factor, point = { x: 0, y: 0 }) {
    const currentScale = this.transform.getScale();
    const newScale = currentScale.x * factor;
    
    // Apply zoom limits
    if (newScale < this.bounds.minZoom || newScale > this.bounds.maxZoom) {
      return false; // Indicate zoom was not applied
    }
    
    // Store current world position of the point
    const worldPoint = this.transform.inverseTransformPoint(point);
    
    // Apply scale
    this.transform.scale(factor);
    
    // Calculate new screen position of the same world point
    const newScreenPoint = this.transform.transformPoint(worldPoint);
    
    // Adjust position to keep the point stationary
    const dx = point.x - newScreenPoint.x;
    const dy = point.y - newScreenPoint.y;
    this.transform.translate(dx, dy);
    
    return true; // Indicate zoom was applied
  }

  /**
   * Set zoom level at point
   */
  setZoom(zoom, point = { x: 0, y: 0 }) {
    // Clamp zoom to bounds
    const clampedZoom = Math.max(this.bounds.minZoom, Math.min(this.bounds.maxZoom, zoom));
    
    // Get current zoom to calculate what point should stay fixed
    const currentZoom = this.getZoom();
    if (currentZoom === 0) return false;
    
    // Store current world position of the point
    const worldPoint = this.transform.inverseTransformPoint(point);
    
    // Set new scale
    this.transform.setScale(clampedZoom);
    
    // Calculate new screen position of the same world point
    const newScreenPoint = this.transform.transformPoint(worldPoint);
    
    // Adjust position to keep the point stationary
    const currentPos = this.transform.getPosition();
    const dx = point.x - newScreenPoint.x;
    const dy = point.y - newScreenPoint.y;
    this.transform.setPosition(currentPos.x + dx, currentPos.y + dy);
    
    return true;
  }

  /**
   * Get current zoom level
   */
  getZoom() {
    return this.transform.getScale().x;
  }

  /**
   * Get current pan position
   */
  getPan() {
    const position = this.transform.getPosition();
    return { x: position.x, y: position.y };
  }

  /**
   * Set pan position
   */
  setPan(x, y) {
    this.transform.setPosition(x, y);
  }

  /**
   * Reset to identity
   */
  reset() {
    this.transform.setPosition(0, 0);
    this.transform.setScale(1, 1);
    this.transform.setRotation(0);
  }
}