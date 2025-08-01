/**
 * NodeRenderer - Renders individual tree nodes with content delegation and accessibility
 */

export class NodeRenderer {
  constructor(rendererRegistry) {
    console.log('[NodeRenderer] Constructor called with registry:', {
      hasRegistry: !!rendererRegistry,
      registryType: rendererRegistry ? rendererRegistry.constructor.name : 'none',
      hasGetRenderer: rendererRegistry ? typeof rendererRegistry.getRenderer === 'function' : false
    });
    this.registry = rendererRegistry;
    this.destroyed = false;
    this.nodeElements = new Map(); // nodeId -> DOM element
    this.eventListeners = new Map(); // eventType -> [callbacks]
    
    // Create error fallback content
    this.errorRenderer = {
      render: (content, container) => {
        container.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-content';
        errorDiv.textContent = 'Error rendering content';
        container.appendChild(errorDiv);
        return container;
      }
    };
  }

  /**
   * Render a tree node into the container
   */
  renderNode(nodeData, container) {
    if (this.destroyed) return null;
    
    // Validate inputs
    if (!nodeData) {
      throw new Error('Node data is required');
    }
    
    if (!container) {
      throw new Error('Container is required');
    }
    
    if (!container.nodeType || container.nodeType !== Node.ELEMENT_NODE) {
      throw new Error('Container must be a DOM element');
    }

    const nodeId = nodeData.id;
    
    // Check if we can reuse existing element
    let nodeElement = this.nodeElements.get(nodeId);
    if (nodeElement && container.contains(nodeElement)) {
      // Update existing element
      this._updateNodeElement(nodeElement, nodeData);
      return nodeElement;
    }

    // Create new node element
    nodeElement = this._createNodeElement(nodeData);
    
    // Clean up any old element with different ID in same container
    const existingElements = container.querySelectorAll('.tree-node');
    existingElements.forEach(el => {
      if (el !== nodeElement) {
        this._cleanupElement(el);
        el.remove();
      }
    });
    
    // Store reference
    this.nodeElements.set(nodeId, nodeElement);
    
    // Add to container
    container.appendChild(nodeElement);
    
    return nodeElement;
  }

  /**
   * Create a new node DOM element
   * @private
   */
  _createNodeElement(nodeData) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.setAttribute('data-node-id', nodeData.id);
    
    // Create header
    const header = this._createNodeHeader(nodeData);
    nodeElement.appendChild(header);
    
    // Create content area
    const contentArea = this._createNodeContent(nodeData);
    nodeElement.appendChild(contentArea);
    
    // Apply initial state
    this._updateNodeElement(nodeElement, nodeData);
    
    return nodeElement;
  }

  /**
   * Create node header with toggle and title
   * @private
   */
  _createNodeHeader(nodeData) {
    const header = document.createElement('div');
    header.className = 'node-header';
    header.id = `header-${nodeData.id}`;
    
    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'node-toggle';
    toggle.setAttribute('aria-controls', `content-${nodeData.id}`);
    toggle.setAttribute('title', 'Toggle node expansion');
    
    // Add click handler
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._handleToggleClick(nodeData.id, nodeData.expanded);
    });
    
    header.appendChild(toggle);
    
    // Create title
    const title = document.createElement('span');
    title.className = 'node-title';
    title.textContent = nodeData.title || 'Untitled';
    header.appendChild(title);
    
    // Create metadata
    const meta = document.createElement('span');
    meta.className = 'node-meta';
    
    if (nodeData.contentType) {
      const typeSpan = document.createElement('span');
      typeSpan.className = 'content-type';
      typeSpan.textContent = nodeData.contentType;
      meta.appendChild(typeSpan);
    }
    
    header.appendChild(meta);
    
    return header;
  }

  /**
   * Create node content area with delegated rendering
   * @private
   */
  _createNodeContent(nodeData) {
    const contentArea = document.createElement('div');
    contentArea.className = 'node-content';
    contentArea.id = `content-${nodeData.id}`;
    contentArea.setAttribute('aria-labelledby', `header-${nodeData.id}`);
    
    this._renderNodeContent(contentArea, nodeData);
    
    return contentArea;
  }

  /**
   * Render content using appropriate renderer
   * @private
   */
  _renderNodeContent(contentArea, nodeData) {
    console.log('[NodeRenderer] Rendering content for node:', {
      nodeId: nodeData.id,
      title: nodeData.title,
      contentType: nodeData.contentType,
      hasContent: !!nodeData.content,
      contentLength: nodeData.content ? nodeData.content.length : 0
    });
    
    try {
      // Get appropriate renderer
      const renderer = this.registry.getRenderer(nodeData.contentType);
      console.log('[NodeRenderer] Selected renderer:', renderer ? renderer.constructor.name : 'none');
      
      if (renderer) {
        renderer.render(nodeData.content, contentArea);
        console.log('[NodeRenderer] Content rendered successfully');
      } else {
        // Fallback to error renderer
        console.warn('[NodeRenderer] No renderer found for content type:', nodeData.contentType);
        this.errorRenderer.render('No renderer available', contentArea);
      }
      
      // Add interaction event listeners to rendered content
      this._addContentEventListeners(contentArea, nodeData.id);
      
    } catch (error) {
      console.warn('[NodeRenderer] Content rendering failed:', error);
      this.errorRenderer.render('Rendering error', contentArea);
    }
  }

  /**
   * Add event listeners to rendered content
   * @private
   */
  _addContentEventListeners(contentArea, nodeId) {
    // Handle link clicks
    const links = contentArea.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        this._emit('contentInteraction', {
          nodeId,
          type: 'link',
          url: link.href,
          text: link.textContent,
          event: e
        });
      });
    });

    // Handle copy button clicks
    const copyButtons = contentArea.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        this._emit('contentInteraction', {
          nodeId,
          type: 'copy',
          text: button.getAttribute('data-clipboard-text'),
          event: e
        });
      });
    });
  }

  /**
   * Update existing node element with new data
   * @private
   */
  _updateNodeElement(nodeElement, nodeData) {
    // Update basic attributes
    nodeElement.setAttribute('data-node-id', nodeData.id);
    nodeElement.setAttribute('data-depth', nodeData.depth || 0);
    
    // Apply CSS classes based on state
    nodeElement.className = 'tree-node';
    if (nodeData.expanded) {
      nodeElement.classList.add('expanded');
    } else {
      nodeElement.classList.add('collapsed');
    }
    
    if (nodeData.searchHighlight) {
      nodeElement.classList.add('search-highlight');
    }
    
    if (nodeData.isLeaf) {
      nodeElement.classList.add('leaf-node');
    }
    
    // Update visibility
    if (nodeData.visible === false) {
      nodeElement.style.display = 'none';
    } else {
      nodeElement.style.display = '';
    }
    
    // Apply depth-based indentation
    const depth = nodeData.depth || 0;
    nodeElement.style.paddingLeft = `${depth * 20}px`;
    
    // Update ARIA attributes
    this._updateAccessibilityAttributes(nodeElement, nodeData);
    
    // Update header content
    this._updateNodeHeader(nodeElement, nodeData);
    
    // Update content if needed
    this._updateNodeContent(nodeElement, nodeData);
  }

  /**
   * Update accessibility attributes
   * @private
   */
  _updateAccessibilityAttributes(nodeElement, nodeData) {
    nodeElement.setAttribute('role', 'treeitem');
    nodeElement.setAttribute('aria-level', (nodeData.depth || 0) + 1);
    nodeElement.setAttribute('tabindex', '0');
    
    // Set aria-expanded for non-leaf nodes
    if (!nodeData.isLeaf) {
      nodeElement.setAttribute('aria-expanded', nodeData.expanded ? 'true' : 'false');
    }
    
    // Create accessible label
    let label = nodeData.title || 'Untitled';
    label += `, level ${(nodeData.depth || 0) + 1}`;
    
    if (!nodeData.isLeaf) {
      label += nodeData.expanded ? ', expanded' : ', collapsed';
      label += `, ${nodeData.children?.length || 0} children`;
    }
    
    if (nodeData.searchHighlight) {
      label += ', search result';
    }
    
    nodeElement.setAttribute('aria-label', label);
  }

  /**
   * Update node header elements
   * @private
   */
  _updateNodeHeader(nodeElement, nodeData) {
    const header = nodeElement.querySelector('.node-header');
    if (!header) return;
    
    // Update toggle button
    const toggle = header.querySelector('.node-toggle');
    if (toggle) {
      toggle.textContent = nodeData.expanded ? '▼' : '▶';
      toggle.setAttribute('aria-expanded', nodeData.expanded ? 'true' : 'false');
      toggle.setAttribute('aria-label', `${nodeData.expanded ? 'Collapse' : 'Expand'} ${nodeData.title}`);
      
      // Hide toggle for leaf nodes
      if (nodeData.isLeaf) {
        toggle.style.visibility = 'hidden';
      } else {
        toggle.style.visibility = 'visible';
      }
    }
    
    // Update title
    const title = header.querySelector('.node-title');
    if (title) {
      title.textContent = nodeData.title || 'Untitled';
    }
    
    // Update metadata
    const meta = header.querySelector('.node-meta');
    if (meta) {
      const typeSpan = meta.querySelector('.content-type');
      if (typeSpan) {
        typeSpan.textContent = nodeData.contentType || '';
      }
    }
  }

  /**
   * Update node content if content or type changed
   * @private
   */
  _updateNodeContent(nodeElement, nodeData) {
    const contentArea = nodeElement.querySelector('.node-content');
    if (!contentArea) return;
    
    // Check if we need to re-render content
    const currentContentType = contentArea.getAttribute('data-content-type');
    const currentContentHash = contentArea.getAttribute('data-content-hash');
    const newContentHash = this._hashContent(nodeData.content);
    
    if (currentContentType !== nodeData.contentType || currentContentHash !== newContentHash) {
      // Clear existing content
      contentArea.innerHTML = '';
      
      // Re-render with new content
      this._renderNodeContent(contentArea, nodeData);
      
      // Update tracking attributes
      contentArea.setAttribute('data-content-type', nodeData.contentType || '');
      contentArea.setAttribute('data-content-hash', newContentHash);
    }
  }

  /**
   * Create simple hash of content for change detection
   * @private
   */
  _hashContent(content) {
    if (content === null || content === undefined) return 'null';
    if (typeof content === 'object') {
      return JSON.stringify(content).substring(0, 100);
    }
    return String(content).substring(0, 100);
  }

  /**
   * Handle toggle button click
   * @private
   */
  _handleToggleClick(nodeId, currentExpanded) {
    this._emit('nodeToggle', {
      nodeId,
      expanded: !currentExpanded
    });
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(eventType, data) {
    if (this.destroyed) return;
    
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * Clean up element resources
   * @private
   */
  _cleanupElement(element) {
    // Remove from tracking
    const nodeId = element.getAttribute('data-node-id');
    if (nodeId) {
      this.nodeElements.delete(nodeId);
    }
    
    // Remove event listeners (they'll be garbage collected with the element)
    // Modern browsers handle this automatically
  }

  /**
   * Get renderer information
   */
  getRendererInfo() {
    return {
      name: 'NodeRenderer',
      version: '1.0.0',
      description: 'Renders tree nodes with content delegation and accessibility support',
      registry: this.registry ? this.registry.getStatistics() : null
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    // Remove all node elements from DOM
    this.nodeElements.forEach((element, nodeId) => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    // Clear references
    this.nodeElements.clear();
    this.eventListeners.clear();
    this.registry = null;
    
    this.destroyed = true;
  }
}