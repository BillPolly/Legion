/**
 * LeftSidebar - Left sidebar container component
 * Creates and manages tools and session panels
 */
import { BaseView } from '../base/BaseView.js';

export class LeftSidebar extends BaseView {
  constructor(dom, config = {}) {
    super();
    this.dom = dom;
    this.config = config;
    
    // DOM element references
    this.elements = {
      toolsPanelMount: null,
      sessionPanelMount: null
    };
    
    // Child components
    this.children = {
      toolsPanel: null,
      sessionPanel: null
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
    
    // Create mount points for panels
    this.elements.toolsPanelMount = doc.createElement('div');
    this.elements.toolsPanelMount.id = 'tools-panel';
    this.elements.toolsPanelMount.className = 'panel';
    
    this.elements.sessionPanelMount = doc.createElement('div');
    this.elements.sessionPanelMount.id = 'session-panel';
    this.elements.sessionPanelMount.className = 'panel';
    
    // Add to DOM
    this.dom.appendChild(this.elements.toolsPanelMount);
    this.dom.appendChild(this.elements.sessionPanelMount);
  }
  
  /**
   * Create child components - ONLY CALLED ONCE
   */
  createChildren() {
    const { componentFactory, actorSpace } = this.config;
    
    if (componentFactory) {
      // Create tools panel
      this.children.toolsPanel = componentFactory.createToolsPanel({
        dom: this.elements.toolsPanelMount,
        actorSpace,
        config: this.config.toolsPanelConfig
      });
      
      // Create session panel
      this.children.sessionPanel = componentFactory.createSessionPanel({
        dom: this.elements.sessionPanelMount,
        actorSpace,
        config: this.config.sessionPanelConfig
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