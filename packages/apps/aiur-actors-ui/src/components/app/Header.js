/**
 * Header - Application header component
 */
import { BaseView } from '../base/BaseView.js';

export class Header extends BaseView {
  constructor(dom, config = {}) {
    super();
    this.dom = dom;
    this.config = config;
    
    // DOM element references
    this.elements = {
      title: null,
      connectionStatus: null,
      statusIndicator: null,
      statusText: null
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the header
   */
  initialize() {
    if (this.initialized) return;
    
    this.createDOMStructure();
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
    
    // Create title
    this.elements.title = doc.createElement('h1');
    this.elements.title.className = 'app-title';
    this.elements.title.textContent = this.config.title || 'Aiur Actors';
    
    // Create connection status
    this.elements.connectionStatus = doc.createElement('div');
    this.elements.connectionStatus.className = 'connection-status';
    this.elements.connectionStatus.id = 'connection-status';
    
    this.elements.statusIndicator = doc.createElement('span');
    this.elements.statusIndicator.className = 'status-indicator';
    
    this.elements.statusText = doc.createElement('span');
    this.elements.statusText.className = 'status-text';
    this.elements.statusText.textContent = 'Disconnected';
    
    // Assemble
    this.elements.connectionStatus.appendChild(this.elements.statusIndicator);
    this.elements.connectionStatus.appendChild(this.elements.statusText);
    
    this.dom.appendChild(this.elements.title);
    this.dom.appendChild(this.elements.connectionStatus);
  }
  
  /**
   * Update connection status
   */
  updateConnectionStatus(status) {
    if (!this.elements.connectionStatus) return;
    
    this.elements.connectionStatus.className = `connection-status status-${status}`;
    
    switch (status) {
      case 'connected':
        this.elements.statusText.textContent = 'Connected';
        break;
      case 'error':
        this.elements.statusText.textContent = 'Connection Error';
        break;
      case 'connecting':
        this.elements.statusText.textContent = 'Connecting...';
        break;
      default:
        this.elements.statusText.textContent = 'Disconnected';
    }
  }
  
  /**
   * Destroy
   */
  destroy() {
    this.elements = {};
    this.initialized = false;
    super.destroy();
  }
}