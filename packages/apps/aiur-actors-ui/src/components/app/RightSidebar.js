/**
 * RightSidebar - Right sidebar container component
 * Creates and manages variables panel
 */
import { BaseView } from '../base/BaseView.js';

export class RightSidebar extends BaseView {
  constructor(dom, config = {}) {
    super();
    this.dom = dom;
    this.config = config;
    
    // DOM element references
    this.elements = {
      variablesPanelMount: null
    };
    
    // Child components
    this.children = {
      variablesPanel: null
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the sidebar
   */
  initialize() {
    if (this.initialized) return;
    
    this.createDOMStructure();
    this.createChildren();
    this.initialized = true;
  }
  
  /**
   * Create DOM structure - ONLY CALLED ONCE
   */
  createDOMStructure() {
    // Clear any existing content
    while (this.dom.firstChild) {
      this.dom.removeChild(this.dom.firstChild);
    }
    
    // Use the document that owns our DOM element
    const doc = this.dom.ownerDocument || document;
    
    // Create mount point for variables panel
    this.elements.variablesPanelMount = doc.createElement('div');
    this.elements.variablesPanelMount.id = 'variables-panel';
    this.elements.variablesPanelMount.className = 'panel';
    
    // Add to DOM
    this.dom.appendChild(this.elements.variablesPanelMount);
  }
  
  /**
   * Create child components - ONLY CALLED ONCE
   */
  createChildren() {
    const { componentFactory, actorSpace } = this.config;
    
    if (componentFactory) {
      // Create variables panel
      this.children.variablesPanel = componentFactory.createVariablesPanel({
        dom: this.elements.variablesPanelMount,
        actorSpace,
        config: this.config.variablesPanelConfig
      });
    }
  }
  
  /**
   * Get child component
   */
  getChild(name) {
    return this.children[name];
  }
  
  /**
   * Destroy
   */
  destroy() {
    // Destroy children
    Object.values(this.children).forEach(child => {
      if (child && child.destroy) {
        child.destroy();
      }
    });
    
    this.children = {};
    this.elements = {};
    this.initialized = false;
    super.destroy();
  }
}