/**
 * DiagramTooltip - Tooltip component for diagram elements
 * 
 * Shows contextual information on hover
 */

export class DiagramTooltip {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    
    // Tooltip state
    this.isVisible = false;
    this.currentElement = null;
    this.hideTimeout = null;
    
    // Configuration
    this.delay = config.delay || 500;
    this.offset = config.offset || { x: 10, y: 10 };
    this.maxWidth = config.maxWidth || 250;
    
    // Create tooltip element
    this._createTooltip();
  }

  /**
   * Create tooltip DOM element
   * @private
   */
  _createTooltip() {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'diagram-tooltip';
    this.tooltipElement.style.position = 'absolute';
    this.tooltipElement.style.display = 'none';
    this.tooltipElement.style.pointerEvents = 'none';
    this.tooltipElement.style.zIndex = '1000';
    this.tooltipElement.style.backgroundColor = 'rgba(33, 37, 41, 0.95)';
    this.tooltipElement.style.color = '#fff';
    this.tooltipElement.style.padding = '8px 12px';
    this.tooltipElement.style.borderRadius = '4px';
    this.tooltipElement.style.fontSize = '12px';
    this.tooltipElement.style.maxWidth = `${this.maxWidth}px`;
    this.tooltipElement.style.wordWrap = 'break-word';
    this.tooltipElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    
    // Add arrow
    this.tooltipArrow = document.createElement('div');
    this.tooltipArrow.className = 'diagram-tooltip-arrow';
    this.tooltipArrow.style.position = 'absolute';
    this.tooltipArrow.style.width = '0';
    this.tooltipArrow.style.height = '0';
    this.tooltipArrow.style.borderStyle = 'solid';
    
    this.container.appendChild(this.tooltipElement);
  }

  /**
   * Show tooltip for an element
   * @param {Object} elementInfo - Element information
   * @param {Object} position - Mouse position { x, y }
   */
  show(elementInfo, position) {
    if (!elementInfo || !elementInfo.data) return;
    
    // Clear any existing hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    
    // Update content
    this._updateContent(elementInfo);
    
    // Position tooltip
    this._positionTooltip(position);
    
    // Show with delay
    setTimeout(() => {
      if (this.currentElement === elementInfo.id) {
        this.tooltipElement.style.display = 'block';
        this.isVisible = true;
      }
    }, this.delay);
    
    this.currentElement = elementInfo.id;
  }

  /**
   * Hide tooltip
   */
  hide() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    this.hideTimeout = setTimeout(() => {
      this.tooltipElement.style.display = 'none';
      this.isVisible = false;
      this.currentElement = null;
      this.hideTimeout = null;
    }, 100);
  }

  /**
   * Update tooltip immediately (for hover transitions)
   * @param {Object} elementInfo - Element information
   * @param {Object} position - Mouse position
   */
  update(elementInfo, position) {
    if (!elementInfo || elementInfo.id === this.currentElement) {
      return;
    }
    
    // Hide immediately if changing elements
    if (this.isVisible) {
      this.tooltipElement.style.display = 'none';
      this.isVisible = false;
    }
    
    // Show new tooltip
    this.show(elementInfo, position);
  }

  /**
   * Update tooltip content
   * @private
   */
  _updateContent(elementInfo) {
    const { type, data } = elementInfo;
    let content = '';
    
    if (type === 'node') {
      content = this._getNodeContent(data);
    } else if (type === 'edge') {
      content = this._getEdgeContent(data);
    }
    
    this.tooltipElement.innerHTML = content;
  }

  /**
   * Get node tooltip content
   * @private
   */
  _getNodeContent(node) {
    let html = `<div class="tooltip-header"><strong>${node.label || node.id}</strong></div>`;
    
    if (node.type) {
      html += `<div class="tooltip-row">Type: ${node.type}</div>`;
    }
    
    if (node.description) {
      html += `<div class="tooltip-row">${node.description}</div>`;
    }
    
    // Add metadata if present
    if (node.metadata) {
      for (const [key, value] of Object.entries(node.metadata)) {
        if (typeof value === 'string' || typeof value === 'number') {
          html += `<div class="tooltip-row">${this._formatKey(key)}: ${value}</div>`;
        }
      }
    }
    
    // Add position info in development mode
    if (this.config.showDebugInfo) {
      html += `<div class="tooltip-row tooltip-debug">`;
      html += `Position: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})<br>`;
      html += `Size: ${node.size.width}×${node.size.height}`;
      html += `</div>`;
    }
    
    return html;
  }

  /**
   * Get edge tooltip content
   * @private
   */
  _getEdgeContent(edge) {
    let html = `<div class="tooltip-header"><strong>${edge.label || edge.id}</strong></div>`;
    
    if (edge.type) {
      html += `<div class="tooltip-row">Type: ${edge.type}</div>`;
    }
    
    html += `<div class="tooltip-row">From: ${edge.source}</div>`;
    html += `<div class="tooltip-row">To: ${edge.target}</div>`;
    
    if (edge.description) {
      html += `<div class="tooltip-row">${edge.description}</div>`;
    }
    
    // Add metadata if present
    if (edge.metadata) {
      for (const [key, value] of Object.entries(edge.metadata)) {
        if (typeof value === 'string' || typeof value === 'number') {
          html += `<div class="tooltip-row">${this._formatKey(key)}: ${value}</div>`;
        }
      }
    }
    
    return html;
  }

  /**
   * Format metadata key for display
   * @private
   */
  _formatKey(key) {
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Position tooltip near mouse
   * @private
   */
  _positionTooltip(position) {
    const containerRect = this.container.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    let x = position.x - containerRect.left + this.offset.x;
    let y = position.y - containerRect.top + this.offset.y;
    
    // Keep tooltip within container bounds
    const maxX = containerRect.width - tooltipRect.width - 10;
    const maxY = containerRect.height - tooltipRect.height - 10;
    
    // Flip to left if too far right
    if (x > maxX) {
      x = position.x - containerRect.left - tooltipRect.width - this.offset.x;
    }
    
    // Flip to top if too far down
    if (y > maxY) {
      y = position.y - containerRect.top - tooltipRect.height - this.offset.y;
    }
    
    // Ensure not negative
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    this.tooltipElement.style.left = `${x}px`;
    this.tooltipElement.style.top = `${y}px`;
  }

  /**
   * Destroy tooltip
   */
  destroy() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    
    if (this.tooltipElement && this.tooltipElement.parentNode) {
      this.tooltipElement.parentNode.removeChild(this.tooltipElement);
    }
    
    this.tooltipElement = null;
    this.tooltipArrow = null;
    this.container = null;
  }
}