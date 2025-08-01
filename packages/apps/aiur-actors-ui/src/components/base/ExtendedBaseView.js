/**
 * Extended base view with DOM operations and utilities
 */
import { BaseView } from './BaseView.js';

export class ExtendedBaseView extends BaseView {
  constructor(dom) {
    super();
    
    this.dom = dom;
    this.elements = {};
    this.eventListeners = [];
    this.destroyed = false;
  }

  // Element creation
  createElement(tagName, classes = [], attributes = {}) {
    const element = document.createElement(tagName);
    
    // Add classes
    if (classes.length > 0) {
      element.classList.add(...classes);
    }
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    return element;
  }

  // Element querying
  query(selector) {
    return this.dom.querySelector(selector);
  }

  queryAll(selector) {
    return Array.from(this.dom.querySelectorAll(selector));
  }

  // Event handling with cleanup
  addEventListener(element, eventType, handler) {
    element.addEventListener(eventType, handler);
    this.eventListeners.push({ element, eventType, handler });
  }

  removeAllEventListeners() {
    this.eventListeners.forEach(({ element, eventType, handler }) => {
      element.removeEventListener(eventType, handler);
    });
    this.eventListeners = [];
  }

  // Visibility utilities
  show(element, displayType = 'block') {
    element.style.display = displayType;
  }

  hide(element) {
    element.style.display = 'none';
  }

  toggle(element) {
    if (element.style.display === 'none') {
      element.style.display = 'block';
    } else {
      element.style.display = 'none';
    }
  }

  // Class manipulation
  addClass(element, ...classes) {
    element.classList.add(...classes);
  }

  removeClass(element, ...classes) {
    element.classList.remove(...classes);
  }

  toggleClass(element, className) {
    element.classList.toggle(className);
  }

  // Content manipulation
  setText(element, text) {
    element.textContent = text;
  }

  setHTML(element, html) {
    element.innerHTML = html;
  }

  // Form utilities
  getValue(element) {
    return element.value;
  }

  setValue(element, value) {
    element.value = value;
  }

  // Focus management
  focus(element) {
    element.focus();
  }

  blur(element) {
    element.blur();
  }

  // Scrolling
  scrollIntoView(element, options = {}) {
    const defaultOptions = { behavior: 'smooth' };
    const mergedOptions = { ...defaultOptions, ...options };
    element.scrollIntoView(mergedOptions);
  }

  // Template rendering
  renderTemplate(template, data) {
    let html = template;
    
    // Simple template replacement
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    });
    
    return html;
  }

  // Terminal-specific view methods (override in subclasses)
  appendOutput(output) {
    // Override in terminal view
  }

  clearOutput() {
    // Override in terminal view
  }

  updateConnectionStatus(connected) {
    // Override in terminal view
  }

  updateToolsList(tools) {
    // Override in terminal view
  }
  
  setExecuting(executing) {
    // Override in terminal view
  }

  // Cleanup
  destroy() {
    this.removeAllEventListeners();
    this.destroyed = true;
    this.elements = {};
  }
}