/**
 * AppLayout - Main layout component for the application
 * Creates and manages the overall app structure
 */
import { BaseView } from '../base/BaseView.js';
import { Header } from './Header.js';
import { LeftSidebar } from './LeftSidebar.js';
import { MainContent } from './MainContent.js';
import { RightSidebar } from './RightSidebar.js';

export class AppLayout extends BaseView {
  constructor(dom, config = {}) {
    super();
    this.dom = dom;
    this.config = config;
    
    // DOM element references - create once, never recreate
    this.elements = {
      container: null,
      layout: null
    };
    
    // Child components
    this.children = {
      header: null,
      leftSidebar: null,
      mainContent: null,
      rightSidebar: null
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the layout
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
    
    // Add app class
    this.dom.classList.add('aiur-app');
    
    // Create layout container
    this.elements.layout = doc.createElement('div');
    this.elements.layout.className = 'app-layout';
    
    // Create mount points for children
    this.elements.headerMount = doc.createElement('header');
    this.elements.headerMount.className = 'app-header';
    
    this.elements.leftSidebarMount = doc.createElement('aside');
    this.elements.leftSidebarMount.className = 'sidebar sidebar-left';
    
    this.elements.mainContentMount = doc.createElement('main');
    this.elements.mainContentMount.className = 'main-content';
    
    this.elements.rightSidebarMount = doc.createElement('aside');
    this.elements.rightSidebarMount.className = 'sidebar sidebar-right';
    
    // Assemble structure
    this.dom.appendChild(this.elements.headerMount);
    
    this.elements.layout.appendChild(this.elements.leftSidebarMount);
    this.elements.layout.appendChild(this.elements.mainContentMount);
    this.elements.layout.appendChild(this.elements.rightSidebarMount);
    
    this.dom.appendChild(this.elements.layout);
  }
  
  /**
   * Create child components - ONLY CALLED ONCE
   */
  createChildren() {
    // Create header
    this.children.header = new Header(this.elements.headerMount, {
      title: this.config.title || 'Aiur Actors'
    });
    this.children.header.initialize();
    
    // Create left sidebar with tools and sessions
    this.children.leftSidebar = new LeftSidebar(this.elements.leftSidebarMount, {
      componentFactory: this.config.componentFactory,
      actorSpace: this.config.actorSpace
    });
    this.children.leftSidebar.initialize();
    
    // Create main content with terminal
    this.children.mainContent = new MainContent(this.elements.mainContentMount, {
      componentFactory: this.config.componentFactory,
      actorSpace: this.config.actorSpace,
      app: this.config.app
    });
    this.children.mainContent.initialize();
    
    // Create right sidebar with variables
    this.children.rightSidebar = new RightSidebar(this.elements.rightSidebarMount, {
      componentFactory: this.config.componentFactory,
      actorSpace: this.config.actorSpace
    });
    this.children.rightSidebar.initialize();
  }
  
  /**
   * Get child component
   */
  getChild(name) {
    return this.children[name];
  }
  
  /**
   * Get terminal component (convenience method)
   */
  getTerminal() {
    return this.children.mainContent?.getTerminal();
  }
  
  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    if (this.children.header) {
      this.children.header.updateConnectionStatus(status);
    }
  }
  
  /**
   * Destroy the layout
   */
  destroy() {
    // Destroy children
    Object.values(this.children).forEach(child => {
      if (child && child.destroy) {
        child.destroy();
      }
    });
    
    // Clear references
    this.children = {};
    this.elements = {};
    this.initialized = false;
    
    super.destroy();
  }
}