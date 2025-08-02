/**
 * MainContent - Main content area component
 * Creates and manages the terminal
 */
import { BaseView } from '../base/BaseView.js';

export class MainContent extends BaseView {
  constructor(dom, config = {}) {
    super();
    this.dom = dom;
    this.config = config;
    
    // DOM element references
    this.elements = {
      terminalMount: null
    };
    
    // Child components
    this.children = {
      terminal: null
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the main content
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
    
    // Create mount point for terminal
    this.elements.terminalMount = doc.createElement('div');
    this.elements.terminalMount.id = 'terminal';
    this.elements.terminalMount.className = 'terminal-mount';
    
    // Add to DOM
    this.dom.appendChild(this.elements.terminalMount);
  }
  
  /**
   * Create child components - ONLY CALLED ONCE
   */
  createChildren() {
    const { componentFactory, actorSpace, app } = this.config;
    
    if (componentFactory) {
      // Create terminal component
      this.children.terminal = componentFactory.createTerminal({
        dom: this.elements.terminalMount,
        actorSpace,
        app,
        config: this.config.terminalConfig
      });
    }
  }
  
  /**
   * Get terminal component
   */
  getTerminal() {
    return this.children.terminal;
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