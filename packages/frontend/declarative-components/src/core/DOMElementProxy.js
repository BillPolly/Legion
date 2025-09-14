/**
 * DOMElementProxy - Proxy wrapper for DOM elements extending Handle
 * 
 * Provides projection-based element creation and event streams.
 * Elements are projected from parents, not created directly.
 */

import { Handle } from '@legion/handle';
import { EventStream } from '@legion/declarative-components/core/EventStream.js';

export class DOMElementProxy extends Handle {
  constructor(resourceManager, element) {
    // Validate resourceManager
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    // Validate element before calling super
    if (!element) {
      throw new Error('DOM element is required');
    }
    
    if (!(element instanceof Element)) {
      throw new Error('Must be a valid DOM element');
    }
    
    // Call Handle constructor
    super(resourceManager);
    
    // Store DOM element reference
    this.element = element;
    
    // Track child proxies for cleanup
    this._childProxies = new Set();
    
    // Cache event streams
    this._eventStreams = new Map();
    
    // Track bindings
    this._bindings = new Set();
  }
  
  /**
   * Project a child element from this element
   * @param {string} tagName - HTML tag name
   * @param {string} selector - Optional class and/or id selector
   * @returns {DOMElementProxy} Proxy for the projected child
   */
  _projectElement(tagName, selector = '') {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    // Create the child element
    const childElement = document.createElement(tagName);
    
    // Parse selector for class and id
    if (selector) {
      // Extract ID if present
      const idMatch = selector.match(/#([^.#\s]+)/);
      if (idMatch) {
        childElement.id = idMatch[1];
        // Remove ID from selector for class processing
        selector = selector.replace(/#[^.#\s]+/, '');
      }
      
      // Process classes - everything that's not an ID
      const classString = selector.trim();
      if (classString && !classString.startsWith('#')) {
        // Replace dots with spaces and handle multiple classes
        childElement.className = classString.replace(/\./g, ' ').trim();
      }
    }
    
    // Append to parent
    this.element.appendChild(childElement);
    
    // Create proxy for child
    const childProxy = new DOMElementProxy(this.resourceManager, childElement);
    
    // Track child for cleanup
    this._childProxies.add(childProxy);
    
    return childProxy;
  }
  
  // Element projection methods for all common HTML elements
  div(selector) { return this._projectElement('div', selector); }
  span(selector) { return this._projectElement('span', selector); }
  p(selector) { return this._projectElement('p', selector); }
  h1(selector) { return this._projectElement('h1', selector); }
  h2(selector) { return this._projectElement('h2', selector); }
  h3(selector) { return this._projectElement('h3', selector); }
  h4(selector) { return this._projectElement('h4', selector); }
  h5(selector) { return this._projectElement('h5', selector); }
  h6(selector) { return this._projectElement('h6', selector); }
  ul(selector) { return this._projectElement('ul', selector); }
  ol(selector) { return this._projectElement('ol', selector); }
  li(selector) { return this._projectElement('li', selector); }
  button(selector) { return this._projectElement('button', selector); }
  input(selector) { return this._projectElement('input', selector); }
  textarea(selector) { return this._projectElement('textarea', selector); }
  select(selector) { return this._projectElement('select', selector); }
  label(selector) { return this._projectElement('label', selector); }
  a(selector) { return this._projectElement('a', selector); }
  img(selector) { return this._projectElement('img', selector); }
  section(selector) { return this._projectElement('section', selector); }
  article(selector) { return this._projectElement('article', selector); }
  header(selector) { return this._projectElement('header', selector); }
  footer(selector) { return this._projectElement('footer', selector); }
  nav(selector) { return this._projectElement('nav', selector); }
  
  // Table-related projection methods
  form(selector) { return this._projectElement('form', selector); }
  table(selector) { return this._projectElement('table', selector); }
  thead(selector) { return this._projectElement('thead', selector); }
  tbody(selector) { return this._projectElement('tbody', selector); }
  tr(selector) { return this._projectElement('tr', selector); }
  td(selector) { return this._projectElement('td', selector); }
  th(selector) { return this._projectElement('th', selector); }
  
  /**
   * Get or create an event stream for the specified event type
   * @param {string} eventType - DOM event type
   * @returns {EventStream} Stream of events
   */
  _getEventStream(eventType) {
    if (!this._eventStreams.has(eventType)) {
      const stream = new EventStream(this.element, eventType);
      this._eventStreams.set(eventType, stream);
    }
    return this._eventStreams.get(eventType);
  }
  
  // Event stream getters
  get clicks() { return this._getEventStream('click'); }
  get dblclicks() { return this._getEventStream('dblclick'); }
  get mousedowns() { return this._getEventStream('mousedown'); }
  get mouseups() { return this._getEventStream('mouseup'); }
  get mouseovers() { return this._getEventStream('mouseover'); }
  get mouseouts() { return this._getEventStream('mouseout'); }
  get mousemoves() { return this._getEventStream('mousemove'); }
  
  get keydowns() { return this._getEventStream('keydown'); }
  get keyups() { return this._getEventStream('keyup'); }
  get keypresses() { return this._getEventStream('keypress'); }
  
  get focuses() { return this._getEventStream('focus'); }
  get blurs() { return this._getEventStream('blur'); }
  get changes() { return this._getEventStream('change'); }
  get inputs() { return this._getEventStream('input'); }
  get submits() { return this._getEventStream('submit'); }
  
  // Special stream for input values
  get values() {
    const stream = new EventStream(this.element, 'input');
    // Transform event to value
    return {
      subscribe: (callback) => {
        return stream.subscribe(event => callback(event.target.value));
      }
    };
  }
  
  // DOM property proxies
  get textContent() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    return this.element.textContent;
  }
  
  set textContent(value) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    this.element.textContent = value;
  }
  
  get innerHTML() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    return this.element.innerHTML;
  }
  
  set innerHTML(value) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    this.element.innerHTML = value;
  }
  
  get style() {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    return this.element.style;
  }
  
  getAttribute(name) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    return this.element.getAttribute(name);
  }
  
  setAttribute(name, value) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    this.element.setAttribute(name, value);
  }
  
  /**
   * Bind element to a state path
   * @param {string} path - State path to bind to
   * @returns {Object} Binding object
   */
  bind(path) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    const binding = {
      path,
      element: this.element,
      proxy: this,
      twoWay: false
    };
    
    this._bindings.add(binding);
    return binding;
  }
  
  /**
   * Create two-way binding to state path
   * @param {string} path - State path to sync with
   * @returns {Object} Binding object
   */
  sync(path) {
    if (this.isDestroyed()) {
      throw new Error('Handle has been destroyed');
    }
    
    const binding = {
      path,
      element: this.element,
      proxy: this,
      twoWay: true
    };
    
    this._bindings.add(binding);
    return binding;
  }
  
  /**
   * Check if handle has been destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed === true;
  }
  
  /**
   * Clean up and destroy this proxy
   */
  destroy() {
    if (this._destroyed) {
      return;
    }
    
    // Destroy all child proxies first
    for (const child of this._childProxies) {
      child.destroy();
    }
    this._childProxies.clear();
    
    // Also destroy children tracked for hierarchy (if any)
    if (this.children) {
      const childrenArray = Array.from(this.children);
      for (const child of childrenArray) {
        if (!child.isDestroyed()) {
          child.destroy();
        }
      }
      this.children.clear();
    }
    
    // Remove from parent's children set (if tracked)
    if (this.parent && this.parent.children) {
      this.parent.children.delete(this);
    }
    
    // Clean up event streams
    for (const stream of this._eventStreams.values()) {
      stream.destroy();
    }
    this._eventStreams.clear();
    
    // Clean up bindings
    this._bindings.clear();
    
    // Remove element from DOM
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Call parent cleanup
    super.destroy();
  }
}