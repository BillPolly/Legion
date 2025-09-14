/**
 * ProjectionRoot - Root of a DOM projection hierarchy
 * 
 * Manages a tree of projected DOM elements, providing factory methods
 * for creating child elements through projection and tracking the
 * complete hierarchy.
 */

import { DOMElementProxy } from '@legion/declarative-components/core/DOMElementProxy.js';

export class ProjectionRoot extends DOMElementProxy {
  constructor(resourceManager, element) {
    super(resourceManager, element);
    
    // Mark as root of projection hierarchy
    this.isRoot = true;
    this.parent = null;
    this.depth = 0;
    
    // Track all children directly projected from this root
    this.children = new Set();
  }
  
  /**
   * Create projection root from a CSS selector
   * @param {Object} resourceManager - Resource manager instance
   * @param {string} selector - CSS selector for root element
   * @returns {ProjectionRoot} New projection root
   */
  static fromSelector(resourceManager, selector) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found for selector: ${selector}`);
    }
    return new ProjectionRoot(resourceManager, element);
  }
  
  /**
   * Create projection root from document body
   * @param {Object} resourceManager - Resource manager instance
   * @returns {ProjectionRoot} New projection root attached to body
   */
  static fromBody(resourceManager) {
    return new ProjectionRoot(resourceManager, document.body);
  }
  
  /**
   * Override projection to track parent-child relationships
   */
  _projectElement(tagName, selector = '') {
    const childProxy = super._projectElement(tagName, selector);
    
    // Set up parent-child relationship
    childProxy.parent = this;
    childProxy.depth = this.depth + 1;
    childProxy.isRoot = false;
    
    // Track as direct child
    this.children.add(childProxy);
    
    // Ensure child has children set
    if (!childProxy.children) {
      childProxy.children = new Set();
    }
    
    // Setup hierarchy tracking for the child
    this._setupHierarchyTracking(childProxy);
    
    return childProxy;
  }
  
  /**
   * Setup hierarchy tracking on a proxy
   * @param {DOMElementProxy} proxy - Proxy to setup tracking on
   */
  _setupHierarchyTracking(proxy) {
    // Save original projection method
    const originalProject = proxy._projectElement.bind(proxy);
    
    // Override to add hierarchy tracking
    proxy._projectElement = function(tagName, selector) {
      const child = originalProject(tagName, selector);
      
      // Set up parent-child relationship
      child.parent = this;
      child.depth = this.depth + 1;
      child.isRoot = false;
      
      // Track as child
      if (!this.children) {
        this.children = new Set();
      }
      this.children.add(child);
      
      // Ensure child has children set
      if (!child.children) {
        child.children = new Set();
      }
      
      // Recursively setup tracking for this child
      proxy.getRoot()._setupHierarchyTracking(child);
      
      return child;
    };
    
    // Add navigation methods
    proxy.getAncestors = () => this.getAncestors.call(proxy);
    proxy.getRoot = () => this.getRoot.call(proxy);
    proxy.getSiblings = () => this.getSiblings.call(proxy);
    proxy.getAllDescendants = () => this.getAllDescendants.call(proxy);
  }
  
  /**
   * Get all ancestors up to the root
   * @returns {Array} Array of ancestors from immediate parent to root
   */
  getAncestors() {
    const ancestors = [];
    let current = this.parent;
    
    while (current) {
      ancestors.push(current);
      current = current.parent;
    }
    
    return ancestors;
  }
  
  /**
   * Get the root of the projection hierarchy
   * @returns {ProjectionRoot} The root node
   */
  getRoot() {
    let current = this;
    while (current.parent) {
      current = current.parent;
    }
    return current;
  }
  
  /**
   * Get sibling projections (same parent)
   * @returns {Array} Array of sibling proxies
   */
  getSiblings() {
    if (!this.parent || !this.parent.children) {
      return [];
    }
    
    return Array.from(this.parent.children).filter(child => child !== this);
  }
  
  /**
   * Get all descendants recursively
   * @returns {Set} Set of all descendant proxies
   */
  getAllDescendants() {
    const descendants = new Set();
    
    function collectDescendants(node) {
      if (node.children) {
        for (const child of node.children) {
          descendants.add(child);
          collectDescendants(child);
        }
      }
    }
    
    collectDescendants(this);
    return descendants;
  }
  
  // Additional projection methods for tables
  form(selector) { return this._projectElement('form', selector); }
  table(selector) { return this._projectElement('table', selector); }
  thead(selector) { return this._projectElement('thead', selector); }
  tbody(selector) { return this._projectElement('tbody', selector); }
  tr(selector) { return this._projectElement('tr', selector); }
  td(selector) { return this._projectElement('td', selector); }
  th(selector) { return this._projectElement('th', selector); }
  
  /**
   * Override destroy to clean up hierarchy tracking
   */
  destroy() {
    // First destroy all children
    if (this.children) {
      // Create array copy to avoid modification during iteration
      const childrenArray = Array.from(this.children);
      for (const child of childrenArray) {
        child.destroy();
      }
      this.children.clear();
    }
    
    // Remove from parent's children set
    if (this.parent && this.parent.children) {
      this.parent.children.delete(this);
    }
    
    // Call parent destroy
    super.destroy();
  }
}