/**
 * SVGRenderer - SVG-based renderer for graph elements
 */

import { Renderer } from './Renderer.js';

export class SVGRenderer extends Renderer {
  constructor(container, config = {}) {
    super(container, config);
    
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.style.position = 'absolute';
    this.svg.style.top = '0';
    this.svg.style.left = '0';
    
    // Create defs for reusable elements
    this.defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.appendChild(this.defs);
    
    // Create main group for transforms
    this.mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(this.mainGroup);
    
    // Element cache for updates
    this.elementCache = new Map();
    
    // Reverse mapping from DOM elements to graph elements
    this.domToGraphMap = new WeakMap();
    
    // Add to container
    this.container.appendChild(this.svg);
    
    // Create default markers
    this._createDefaultMarkers();
  }

  /**
   * Create default arrow markers
   * @private
   */
  _createDefaultMarkers() {
    // Arrow marker
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    arrow.setAttribute('id', 'arrow');
    arrow.setAttribute('viewBox', '0 -5 10 10');
    arrow.setAttribute('refX', '10');
    arrow.setAttribute('refY', '0');
    arrow.setAttribute('markerWidth', '10');
    arrow.setAttribute('markerHeight', '10');
    arrow.setAttribute('orient', 'auto');
    
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M0,-5L10,0L0,5');
    arrowPath.setAttribute('fill', '#999999');
    arrow.appendChild(arrowPath);
    
    this.defs.appendChild(arrow);
    
    // Filled arrow marker
    const arrowFilled = arrow.cloneNode(true);
    arrowFilled.setAttribute('id', 'arrow-filled');
    arrowFilled.querySelector('path').setAttribute('fill', '#666666');
    this.defs.appendChild(arrowFilled);
  }

  /**
   * Begin a new frame
   */
  beginFrame() {
    // Mark all cached elements as not updated
    this.elementCache.forEach(entry => {
      entry.updated = false;
    });
  }

  /**
   * End the current frame
   */
  endFrame() {
    // Remove elements that weren't updated this frame
    const toRemove = [];
    this.elementCache.forEach((entry, id) => {
      if (!entry.updated && entry.element.parentNode) {
        entry.element.parentNode.removeChild(entry.element);
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => this.elementCache.delete(id));
  }

  /**
   * Clear the render surface
   */
  clear() {
    // Remove all children from main group
    while (this.mainGroup.firstChild) {
      this.mainGroup.removeChild(this.mainGroup.firstChild);
    }
    
    // Remove connection preview if it exists
    const preview = this.svg.querySelector('.connection-preview');
    if (preview && preview.parentNode) {
      preview.parentNode.removeChild(preview);
    }
    
    this.elementCache.clear();
  }

  /**
   * Render a node
   */
  renderNode(node, options = {}) {
    const { isHovered = false, isSelected = false, isDragPreview = false, previewPosition = null } = options;
    const id = `node-${node.getId()}`;
    let g = this._getOrCreateElement(id, 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('data-node-id', node.getId());
    
    // Store reverse mapping
    this.domToGraphMap.set(g, { type: 'node', element: node });
    
    // Use preview position if available, otherwise use node position
    const pos = previewPosition || node.getPosition();
    g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    
    // Get or create rect
    let rect = g.querySelector('rect') || document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const size = node.getSize();
    rect.setAttribute('width', size.width);
    rect.setAttribute('height', size.height);
    rect.setAttribute('rx', '4'); // Rounded corners
    
    // Apply styles with hover and selection effects
    const style = node.getStyle();
    let fill = style.fill || '#ffffff';
    let stroke = style.stroke || '#000000';
    let strokeWidth = style.strokeWidth || 1;
    
    // Apply hover effects
    if (isHovered) {
      fill = this._brightenColor(fill, 0.1);
      stroke = '#0066cc';
      strokeWidth = Math.max(strokeWidth, 2);
    }
    
    // Apply selection effects (takes precedence over hover)
    if (isSelected) {
      stroke = '#0066cc';
      strokeWidth = Math.max(strokeWidth, 3);
    }
    
    // Apply drag preview effects (semi-transparent)
    let opacity = style.opacity !== undefined ? style.opacity : 1.0;
    if (isDragPreview) {
      opacity = 0.7;
      stroke = '#0066cc';
      strokeWidth = Math.max(strokeWidth, 2);
    }
    
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', strokeWidth);
    rect.setAttribute('opacity', opacity);
    
    if (!rect.parentNode) {
      g.appendChild(rect);
    }
    
    // Render label
    const label = node.getLabel();
    if (label) {
      let text = g.querySelector('text') || document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', size.width / 2);
      text.setAttribute('y', size.height / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#000000');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '14');
      text.setAttribute('opacity', isDragPreview ? 0.7 : 1.0);
      text.textContent = label;
      
      if (!text.parentNode) {
        g.appendChild(text);
      }
    }
    
    // Selection highlight
    if (options.selected) {
      let selection = g.querySelector('.selection-highlight') || 
                     document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      selection.setAttribute('class', 'selection-highlight');
      selection.setAttribute('width', size.width + 8);
      selection.setAttribute('height', size.height + 8);
      selection.setAttribute('x', -4);
      selection.setAttribute('y', -4);
      selection.setAttribute('rx', '6');
      selection.setAttribute('fill', 'none');
      selection.setAttribute('stroke', '#007acc');
      selection.setAttribute('stroke-width', '2');
      selection.setAttribute('stroke-dasharray', '5,5');
      
      if (!selection.parentNode) {
        if (g.firstChild) {
          g.insertBefore(selection, g.firstChild);
        } else {
          g.appendChild(selection);
        }
      }
    } else {
      // Remove selection if exists
      const selection = g.querySelector('.selection-highlight');
      if (selection) {
        selection.remove();
      }
    }
    
    // Add to main group if not already there
    if (!g.parentNode) {
      this.mainGroup.appendChild(g);
    }
  }

  /**
   * Render an edge
   */
  renderEdge(edge, sourceNode, targetNode, options = {}) {
    const { isHovered = false, isSelected = false } = options;
    const id = `edge-${edge.getId()}`;
    let g = this._getOrCreateElement(id, 'g');
    g.setAttribute('data-edge-id', edge.getId());
    
    // Store reverse mapping
    this.domToGraphMap.set(g, { type: 'edge', element: edge });
    
    // Calculate path
    const path = edge.calculatePath(sourceNode, targetNode);
    
    // Get intersection points with node bounds
    const startPoint = edge.getIntersectionPoint(path.start, path.end, sourceNode);
    const endPoint = edge.getIntersectionPoint(path.end, path.start, targetNode);
    
    // Create path element
    let pathEl = g.querySelector('path') || document.createElementNS('http://www.w3.org/2000/svg', 'path');
    
    // Build path data
    let d = `M${startPoint.x},${startPoint.y}`;
    
    if (path.controlPoints && path.controlPoints.length > 0) {
      // Curved edge with control points
      if (path.controlPoints.length === 1) {
        // Quadratic curve
        const cp = path.controlPoints[0];
        d += ` Q${cp.x},${cp.y} ${endPoint.x},${endPoint.y}`;
      } else {
        // Multiple control points - use cubic bezier
        for (let i = 0; i < path.controlPoints.length; i += 2) {
          const cp1 = path.controlPoints[i];
          const cp2 = path.controlPoints[i + 1] || cp1;
          const end = i + 2 >= path.controlPoints.length ? endPoint : path.controlPoints[i + 2];
          d += ` C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${end.x},${end.y}`;
        }
      }
    } else {
      // Straight line
      d += ` L${endPoint.x},${endPoint.y}`;
    }
    
    pathEl.setAttribute('d', d);
    
    // Apply styles with hover and selection effects
    const style = edge.getStyle();
    let stroke = style.stroke || '#999999';
    let strokeWidth = style.strokeWidth || 2;
    
    // Apply hover effects
    if (isHovered) {
      stroke = '#0066cc';
      strokeWidth = Math.max(strokeWidth, 3);
    }
    
    // Apply selection effects (takes precedence over hover)
    if (isSelected) {
      stroke = '#0066cc';
      strokeWidth = Math.max(strokeWidth, 4);
    }
    
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', stroke);
    pathEl.setAttribute('stroke-width', strokeWidth);
    if (style.strokeDasharray) {
      pathEl.setAttribute('stroke-dasharray', style.strokeDasharray);
    }
    if (style.opacity !== undefined) {
      pathEl.setAttribute('opacity', style.opacity);
    }
    
    // Arrow markers for directed edges
    if (edge.isDirected() && style.markerEnd) {
      pathEl.setAttribute('marker-end', `url(#${style.markerEnd})`);
    }
    if (style.markerStart) {
      pathEl.setAttribute('marker-start', `url(#${style.markerStart})`);
    }
    
    if (!pathEl.parentNode) {
      g.appendChild(pathEl);
    }
    
    // Edge label
    const label = edge.getLabel();
    if (label) {
      let text = g.querySelector('text') || document.createElementNS('http://www.w3.org/2000/svg', 'text');
      
      // Position at midpoint
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      
      text.setAttribute('x', midX);
      text.setAttribute('y', midY - 5); // Slightly above the line
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', '#666666');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '12');
      text.textContent = label;
      
      // Background for readability
      let textBg = g.querySelector('.edge-label-bg') || 
                   document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      textBg.setAttribute('class', 'edge-label-bg');
      textBg.setAttribute('fill', 'white');
      textBg.setAttribute('rx', '2');
      
      if (!textBg.parentNode) {
        if (text.parentNode === g) {
          g.insertBefore(textBg, text);
        } else {
          g.appendChild(textBg);
        }
      }
      
      if (!text.parentNode) {
        g.appendChild(text);
      }
      
      // Update background size after text is rendered
      setTimeout(() => {
        try {
          const bbox = text.getBBox ? text.getBBox() : {
            x: 0, y: -12, width: label.length * 8, height: 16
          };
          textBg.setAttribute('x', bbox.x - 2);
          textBg.setAttribute('y', bbox.y - 2);
          textBg.setAttribute('width', bbox.width + 4);
          textBg.setAttribute('height', bbox.height + 4);
        } catch (e) {
          // Fallback for jsdom - approximate text size
          const approxWidth = label.length * 8;
          textBg.setAttribute('x', -2);
          textBg.setAttribute('y', -14);
          textBg.setAttribute('width', approxWidth + 4);
          textBg.setAttribute('height', 20);
        }
      }, 0);
    }
    
    // Add to main group if not already there
    if (!g.parentNode) {
      // Insert edges before nodes
      if (this.mainGroup.firstChild) {
        this.mainGroup.insertBefore(g, this.mainGroup.firstChild);
      } else {
        this.mainGroup.appendChild(g);
      }
    }
  }

  /**
   * Set the viewport transform
   */
  setTransform(transform) {
    const matrix = transform.getMatrix();
    this.mainGroup.setAttribute('transform', 
      `matrix(${matrix[0]},${matrix[1]},${matrix[2]},${matrix[3]},${matrix[4]},${matrix[5]})`
    );
  }

  /**
   * Get or create an element by ID
   * @private
   */
  _getOrCreateElement(id, tagName) {
    let entry = this.elementCache.get(id);
    
    if (!entry) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
      entry = { element, updated: true };
      this.elementCache.set(id, entry);
    } else {
      entry.updated = true;
    }
    
    return entry.element;
  }

  /**
   * Get graph element at a specific point
   * @param {number} x - X coordinate in container space
   * @param {number} y - Y coordinate in container space
   * @returns {{type: string, element: Node|Edge}|null}
   */
  getElementAt(x, y) {
    const rect = this.container.getBoundingClientRect();
    
    // Get the element at this point (using client coordinates)
    const element = document.elementFromPoint(rect.left + x, rect.top + y);
    
    if (element && element !== this.svg) {
      // Walk up the DOM tree to find a mapped element
      let current = element;
      while (current && current !== this.svg) {
        const mapping = this.domToGraphMap.get(current);
        if (mapping) {
          return mapping;
        }
        current = current.parentElement;
      }
    }
    
    return null;
  }

  /**
   * Convert client coordinates to graph coordinates
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @returns {{x: number, y: number}} Graph coordinates
   */
  clientToGraph(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const pt = this.svg.createSVGPoint();
    pt.x = clientX - rect.left;
    pt.y = clientY - rect.top;
    
    // Transform through the inverse of the main group transform
    const matrix = this.mainGroup.getCTM();
    if (matrix) {
      const inversedMatrix = matrix.inverse();
      const transformedPt = pt.matrixTransform(inversedMatrix);
      return { x: transformedPt.x, y: transformedPt.y };
    }
    
    return { x: pt.x, y: pt.y };
  }

  /**
   * Brighten a color by a given factor
   * @private
   */
  _brightenColor(color, factor) {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const brightenChannel = (channel) => {
        return Math.min(255, Math.round(channel + (255 - channel) * factor));
      };
      
      const newR = brightenChannel(r).toString(16).padStart(2, '0');
      const newG = brightenChannel(g).toString(16).padStart(2, '0');
      const newB = brightenChannel(b).toString(16).padStart(2, '0');
      
      return `#${newR}${newG}${newB}`;
    }
    
    // Handle named colors - return a default brightened version
    const colorMap = {
      'white': '#ffffff',
      'black': '#333333',
      'red': '#ff6666',
      'green': '#66ff66',
      'blue': '#6666ff',
      'gray': '#cccccc',
      'grey': '#cccccc'
    };
    
    return colorMap[color.toLowerCase()] || '#e6e6e6';
  }

  /**
   * Render connection preview
   */
  renderConnectionPreview(preview) {
    if (!preview || !preview.active) return;
    
    // Create or update preview line
    let previewLine = this.svg.querySelector('.connection-preview');
    if (!previewLine) {
      // Create arrow marker for preview if needed
      this._ensurePreviewMarkers();
      
      previewLine = document.createElementNS(this.svgNS, 'line');
      previewLine.setAttribute('class', 'connection-preview');
      previewLine.setAttribute('stroke', '#3b82f6');
      previewLine.setAttribute('stroke-width', '2');
      previewLine.setAttribute('stroke-dasharray', '5,5');
      previewLine.setAttribute('opacity', '0.7');
      previewLine.setAttribute('pointer-events', 'none');
      previewLine.setAttribute('marker-end', 'url(#arrow-preview)');
      this.svg.appendChild(previewLine);
    }
    
    // Calculate source position (center of source node if available)
    let sourceX = preview.sourcePosition.x;
    let sourceY = preview.sourcePosition.y;
    
    if (preview.sourceNode) {
      const size = preview.sourceNode.getSize();
      sourceX += size.width / 2;
      sourceY += size.height / 2;
    }
    
    // Update line positions
    previewLine.setAttribute('x1', sourceX);
    previewLine.setAttribute('y1', sourceY);
    previewLine.setAttribute('x2', preview.targetPosition.x);
    previewLine.setAttribute('y2', preview.targetPosition.y);
  }

  /**
   * Ensure preview markers exist
   * @private
   */
  _ensurePreviewMarkers() {
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(this.svgNS, 'defs');
      if (this.svg.firstChild) {
        this.svg.insertBefore(defs, this.svg.firstChild);
      } else {
        this.svg.appendChild(defs);
      }
    }
    
    // Check if preview arrow marker exists
    if (!defs.querySelector('#arrow-preview')) {
      const marker = document.createElementNS(this.svgNS, 'marker');
      marker.setAttribute('id', 'arrow-preview');
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '9');
      marker.setAttribute('refY', '3');
      marker.setAttribute('orient', 'auto');
      marker.setAttribute('markerUnits', 'strokeWidth');
      
      const path = document.createElementNS(this.svgNS, 'path');
      path.setAttribute('d', 'M0,0 L0,6 L9,3 z');
      path.setAttribute('fill', '#3b82f6');
      path.setAttribute('opacity', '0.7');
      
      marker.appendChild(path);
      defs.appendChild(marker);
    }
  }

  /**
   * Destroy the renderer
   */
  destroy() {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    this.elementCache.clear();
    // WeakMap will be garbage collected automatically
  }
}