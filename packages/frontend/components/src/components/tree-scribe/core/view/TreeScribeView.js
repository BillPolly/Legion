/**
 * TreeScribeView - DOM rendering and interaction layer for TreeScribe
 */

import { NodeRenderer } from './NodeRenderer.js';

export class TreeScribeView {
  constructor(container, options = {}) {
    if (!container || !container.nodeType || container.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('TreeScribeView requires a valid DOM container');
    }

    this.container = container;
    this.options = {
      theme: options.theme || 'light',
      rendererRegistry: options.rendererRegistry,
      ...options
    };
    this.elements = {};
    this.destroyed = false;
    this.eventListeners = [];

    // Create NodeRenderer instance
    this.nodeRenderer = new NodeRenderer(this.options.rendererRegistry);

    this._initializeDOM();
    this._attachEventListeners();
  }

  /**
   * Initialize the DOM structure
   * @private
   */
  _initializeDOM() {
    // Clear container and add base class
    this.container.innerHTML = '';
    this.container.classList.add('tree-scribe', 'tree-scribe-container');
    
    // Apply theme
    this._applyTheme(this.options.theme);

    // Create header section
    this._createHeader();
    
    // Create content section
    this._createContent();
  }

  /**
   * Create header section with search and controls
   * @private
   */
  _createHeader() {
    const header = document.createElement('div');
    header.className = 'tree-scribe-header';
    
    // Search section
    const searchSection = document.createElement('div');
    searchSection.className = 'tree-scribe-search';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search content...';
    
    const searchButton = document.createElement('button');
    searchButton.textContent = 'Search';
    
    searchSection.appendChild(searchInput);
    searchSection.appendChild(searchButton);
    
    // Controls section
    const controlsSection = document.createElement('div');
    controlsSection.className = 'tree-scribe-controls';
    
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'expand-all';
    expandAllBtn.textContent = 'Expand All';
    
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'collapse-all';
    collapseAllBtn.textContent = 'Collapse All';
    
    const exportBtn = document.createElement('button');
    exportBtn.className = 'export';
    exportBtn.textContent = 'Export';
    
    controlsSection.appendChild(expandAllBtn);
    controlsSection.appendChild(collapseAllBtn);
    controlsSection.appendChild(exportBtn);
    
    header.appendChild(searchSection);
    header.appendChild(controlsSection);
    this.container.appendChild(header);
    
    // Store element references
    this.elements.header = header;
    this.elements.searchInput = searchInput;
    this.elements.searchButton = searchButton;
    this.elements.expandAllBtn = expandAllBtn;
    this.elements.collapseAllBtn = collapseAllBtn;
    this.elements.exportBtn = exportBtn;
  }

  /**
   * Create content section with tree container
   * @private
   */
  _createContent() {
    const content = document.createElement('div');
    content.className = 'tree-scribe-content';
    content.style.overflow = 'auto';
    content.style.maxHeight = 'calc(100% - 60px)'; // Account for header height
    
    const treeContainer = document.createElement('div');
    treeContainer.className = 'tree-scribe-tree';
    
    // Add empty state message
    this._showEmptyState(treeContainer);
    
    content.appendChild(treeContainer);
    this.container.appendChild(content);
    
    // Store element references
    this.elements.content = content;
    this.elements.treeContainer = treeContainer;
  }

  /**
   * Show empty state message
   * @private
   */
  _showEmptyState(container) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'tree-scribe-empty';
    emptyMessage.textContent = 'No document loaded. Load a YAML document to begin.';
    container.appendChild(emptyMessage);
  }

  /**
   * Attach event listeners
   * @private
   */
  _attachEventListeners() {
    // Add click handler for expand/collapse arrows
    const handleNodeClick = (event) => {
      const arrow = event.target.closest('.node-arrow');
      const header = event.target.closest('.node-header');
      
      if (arrow || header) {
        const nodeElement = event.target.closest('.tree-node');
        if (nodeElement) {
          const nodeId = nodeElement.getAttribute('data-node-id');
          if (nodeId) {
            // Toggle the node
            if (this.onNodeToggle) {
              this.onNodeToggle(nodeId);
            }
            
            // Update arrow rotation
            const arrowEl = nodeElement.querySelector('.node-arrow');
            if (arrowEl) {
              arrowEl.classList.toggle('expanded');
            }
            
            // Update node state
            nodeElement.classList.toggle('expanded');
            nodeElement.classList.toggle('collapsed');
          }
        }
      }
    };
    
    if (this.elements.treeContainer) {
      this.elements.treeContainer.addEventListener('click', handleNodeClick);
      this.eventListeners.push({
        element: this.elements.treeContainer,
        event: 'click',
        handler: handleNodeClick
      });
    }
  }

  /**
   * Apply theme to container
   * @private
   */
  _applyTheme(theme) {
    // Remove existing theme classes
    this.container.classList.remove('tree-scribe-theme-light', 'tree-scribe-theme-dark');
    
    // Apply new theme (default to light for invalid themes)
    const validTheme = ['light', 'dark'].includes(theme) ? theme : 'light';
    this.container.classList.add(`tree-scribe-theme-${validTheme}`);
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    this._applyTheme(theme);
  }

  /**
   * Render tree structure
   */
  renderTree(nodes) {
    if (this.destroyed) return;
    
    const treeContainer = this.elements.treeContainer;
    if (!treeContainer) return;
    
    // Clear existing content
    treeContainer.innerHTML = '';
    
    // Handle invalid data
    if (!nodes || !Array.isArray(nodes)) {
      this._showEmptyState(treeContainer);
      return;
    }
    
    if (nodes.length === 0) {
      this._showEmptyState(treeContainer);
      return;
    }
    
    // Render nodes
    nodes.forEach(node => {
      const nodeElement = this._createNodeElement(node);
      treeContainer.appendChild(nodeElement);
    });
  }

  /**
   * Create DOM element for a tree node
   * @private
   */
  _createNodeElement(node) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.setAttribute('data-node-id', node.id);
    
    // Apply state classes
    if (node.expanded || node.state?.expanded) {
      nodeElement.classList.add('expanded');
    } else {
      nodeElement.classList.add('collapsed');
    }
    
    // Apply visibility state
    if (!node.visible) {
      nodeElement.classList.add('hidden');
    }
    
    // Apply depth styling
    if (node.depth !== undefined) {
      nodeElement.style.marginLeft = `${node.depth * 20}px`;
    }
    
    // Create header with expand/collapse control
    const headerElement = document.createElement('div');
    headerElement.className = 'node-header';
    
    // Add expand/collapse arrow if node has children
    console.log('[TreeScribeView] Creating node element for:', {
      title: node.title,
      hasChildren: !!node.children,
      childrenLength: node.children ? node.children.length : 0,
      children: node.children
    });
    
    if (node.children && node.children.length > 0) {
      console.log(`[TreeScribeView] Adding arrow to node "${node.title}" with ${node.children.length} children`);
      const arrowElement = document.createElement('span');
      arrowElement.className = 'node-arrow';
      arrowElement.innerHTML = '▶'; // Right-pointing triangle
      arrowElement.setAttribute('role', 'button');
      arrowElement.setAttribute('aria-label', node.expanded ? 'Collapse' : 'Expand');
      arrowElement.setAttribute('tabindex', '0');
      headerElement.appendChild(arrowElement);
      
      // Rotate arrow if expanded
      if (node.expanded || node.state?.expanded) {
        arrowElement.classList.add('expanded');
      }
    } else {
      console.log(`[TreeScribeView] No arrow for node "${node.title}" - children: ${node.children}, length: ${node.children ? node.children.length : 0}`);
    }
    
    // Create title element
    const titleElement = document.createElement('span');
    titleElement.className = 'node-title';
    titleElement.textContent = node.title;
    headerElement.appendChild(titleElement);
    
    // Add header to node
    nodeElement.appendChild(headerElement);
    
    // Create content element if content exists
    if (node.content) {
      const contentElement = document.createElement('div');
      contentElement.className = 'node-content';
      
      // Use NodeRenderer to render content based on contentType
      if (this.nodeRenderer) {
        console.log('[TreeScribeView] Using NodeRenderer for content');
        this.nodeRenderer._renderNodeContent(contentElement, node);
      } else {
        console.log('[TreeScribeView] No NodeRenderer available, using plain text');
        contentElement.textContent = node.content;
      }
      
      nodeElement.appendChild(contentElement);
    }
    
    // Render child nodes if they exist
    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'node-children';
      
      node.children.forEach(childNode => {
        const childElement = this._createNodeElement(childNode);
        childrenContainer.appendChild(childElement);
      });
      
      nodeElement.appendChild(childrenContainer);
    }
    
    return nodeElement;
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (this.destroyed || !this.elements.treeContainer) return;
    
    // Create loading indicator if it doesn't exist
    if (!this.elements.loadingIndicator) {
      const loading = document.createElement('div');
      loading.className = 'tree-scribe-loading';
      loading.innerHTML = '<div class="spinner"></div><div>Loading...</div>';
      this.elements.loadingIndicator = loading;
    }
    
    // Clear content and show loading
    this.elements.treeContainer.innerHTML = '';
    this.elements.treeContainer.appendChild(this.elements.loadingIndicator);
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (this.destroyed || !this.elements.loadingIndicator) return;
    
    if (this.elements.loadingIndicator.parentNode) {
      this.elements.loadingIndicator.parentNode.removeChild(this.elements.loadingIndicator);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.destroyed || !this.elements.treeContainer) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'tree-scribe-error error-message';
    errorDiv.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-title">Error</div>
      <div class="error-message">${this._escapeHtml(message)}</div>
    `;
    
    this.elements.treeContainer.innerHTML = '';
    this.elements.treeContainer.appendChild(errorDiv);
  }

  /**
   * Get all node elements
   */
  getAllNodeElements() {
    if (this.destroyed || !this.elements.treeContainer) return [];
    
    return Array.from(this.elements.treeContainer.querySelectorAll('.tree-node'));
  }

  /**
   * Get scroll container
   */
  getScrollContainer() {
    return this.elements.content || this.container;
  }

  /**
   * Clear search highlights
   */
  clearHighlights() {
    if (this.destroyed || !this.elements.treeContainer) return;
    
    const highlighted = this.elements.treeContainer.querySelectorAll('.search-highlight');
    highlighted.forEach(el => el.classList.remove('search-highlight'));
    
    // Also remove any mark tags
    const marks = this.elements.treeContainer.querySelectorAll('mark');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      const text = document.createTextNode(mark.textContent);
      parent.replaceChild(text, mark);
    });
  }

  /**
   * Highlight a node
   */
  highlightNode(nodeId, matches) {
    if (this.destroyed) return;
    
    const nodeElement = this.elements.treeContainer?.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    nodeElement.classList.add('search-highlight');
    
    // If matches provided, highlight specific text
    if (matches && matches.length > 0) {
      const contentEl = nodeElement.querySelector('.node-content');
      if (contentEl && contentEl.textContent) {
        let html = this._escapeHtml(contentEl.textContent);
        
        // Sort matches by position to avoid overlap
        const sortedMatches = [...matches].sort((a, b) => (b.position || 0) - (a.position || 0));
        
        sortedMatches.forEach(match => {
          const pos = match.position || 0;
          const len = match.length || match.match?.length || 0;
          const before = html.substring(0, pos);
          const matchText = html.substring(pos, pos + len);
          const after = html.substring(pos + len);
          html = `${before}<mark>${matchText}</mark>${after}`;
        });
        
        contentEl.innerHTML = html;
      }
    }
  }

  /**
   * Scroll to a node
   */
  scrollToNode(nodeId) {
    if (this.destroyed) return;
    
    const nodeElement = this.elements.treeContainer?.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Focus a node
   */
  focusNode(nodeId) {
    if (this.destroyed) return;
    
    const nodeElement = this.elements.treeContainer?.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) return;
    
    // Make it focusable if not already
    if (!nodeElement.hasAttribute('tabindex')) {
      nodeElement.setAttribute('tabindex', '0');
    }
    
    nodeElement.focus();
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    if (this.destroyed || !this.container) return;
    
    this._applyTheme(theme);
  }

  /**
   * Escape HTML to prevent XSS
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Clean up view and remove event listeners
   */
  destroy() {
    if (this.destroyed) return;
    
    // Remove event listeners
    this.eventListeners.forEach(removeListener => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    });
    this.eventListeners = [];
    
    // Clear DOM content
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Clear references
    this.container = null;
    this.elements = null;
    this.destroyed = true;
  }
}