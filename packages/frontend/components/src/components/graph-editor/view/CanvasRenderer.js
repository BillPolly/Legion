/**
 * CanvasRenderer - Canvas-based renderer for graph elements
 */

import { Renderer } from './Renderer.js';

export class CanvasRenderer extends Renderer {
  constructor(container, config = {}) {
    super(container, config);
    
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    
    // Get context
    this.ctx = this.canvas.getContext('2d');
    
    // In test environment (jsdom), getContext may return null
    if (!this.ctx) {
      // Create a mock context for testing
      this.ctx = this._createMockContext();
    }
    
    // Handle high DPI displays
    this.pixelRatio = window.devicePixelRatio || 1;
    
    // Current transform
    this.currentTransform = null;
    
    // Hit regions for mouse interaction (since canvas has no DOM)
    this.hitRegions = [];
    
    // Add to container
    this.container.appendChild(this.canvas);
    
    // Initial resize
    this.resize();
  }

  /**
   * Resize canvas to match container
   */
  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width || parseInt(this.container.style.width) || 800;
    const height = rect.height || parseInt(this.container.style.height) || 600;
    
    // Set display size
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    
    // Set actual size accounting for pixel ratio
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    
    // Scale context to match pixel ratio
    if (this.ctx && this.ctx.scale) {
      this.ctx.scale(this.pixelRatio, this.pixelRatio);
    }
    
    // Reapply transform if exists
    if (this.currentTransform) {
      this.setTransform(this.currentTransform);
    }
  }

  /**
   * Begin a new frame
   */
  beginFrame() {
    this.ctx.save();
    // Clear hit regions for new frame
    this.hitRegions = [];
  }

  /**
   * End the current frame
   */
  endFrame() {
    this.ctx.restore();
  }

  /**
   * Clear the render surface
   */
  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  /**
   * Render a node
   */
  renderNode(node, options = {}) {
    const pos = node.getPosition();
    const size = node.getSize();
    const style = node.getStyle();
    
    this.ctx.save();
    
    // Apply node transform
    this.ctx.translate(pos.x, pos.y);
    
    // Selection highlight
    if (options.selected) {
      this.ctx.strokeStyle = '#007acc';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this._roundRect(-4, -4, size.width + 8, size.height + 8, 6);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    // Draw node background
    this.ctx.fillStyle = style.fill || '#ffffff';
    this.ctx.strokeStyle = style.stroke || '#000000';
    this.ctx.lineWidth = style.strokeWidth || 1;
    this.ctx.globalAlpha = style.opacity !== undefined ? style.opacity : 1;
    
    this._roundRect(0, 0, size.width, size.height, 4);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw label
    const label = node.getLabel();
    if (label) {
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '14px Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, size.width / 2, size.height / 2);
    }
    
    this.ctx.restore();
    
    // Store hit region for this node
    this.hitRegions.push({
      type: 'node',
      element: node,
      bounds: {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height
      }
    });
  }

  /**
   * Render an edge
   */
  renderEdge(edge, sourceNode, targetNode, options = {}) {
    const path = edge.calculatePath(sourceNode, targetNode);
    const style = edge.getStyle();
    
    // Get intersection points
    const startPoint = edge.getIntersectionPoint(path.start, path.end, sourceNode);
    const endPoint = edge.getIntersectionPoint(path.end, path.start, targetNode);
    
    this.ctx.save();
    
    // Set edge style
    this.ctx.strokeStyle = style.stroke || '#999999';
    this.ctx.lineWidth = style.strokeWidth || 2;
    this.ctx.globalAlpha = style.opacity !== undefined ? style.opacity : 1;
    
    if (style.strokeDasharray) {
      const dashArray = style.strokeDasharray.split(',').map(n => parseInt(n));
      this.ctx.setLineDash(dashArray);
    }
    
    // Draw path
    this.ctx.beginPath();
    this.ctx.moveTo(startPoint.x, startPoint.y);
    
    if (path.controlPoints && path.controlPoints.length > 0) {
      // Curved edge
      if (path.controlPoints.length === 1) {
        // Quadratic curve
        const cp = path.controlPoints[0];
        this.ctx.quadraticCurveTo(cp.x, cp.y, endPoint.x, endPoint.y);
      } else {
        // Cubic bezier curves
        for (let i = 0; i < path.controlPoints.length; i += 2) {
          const cp1 = path.controlPoints[i];
          const cp2 = path.controlPoints[i + 1] || cp1;
          const end = i + 2 >= path.controlPoints.length ? endPoint : path.controlPoints[i + 2];
          this.ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
        }
      }
    } else {
      // Straight line
      this.ctx.lineTo(endPoint.x, endPoint.y);
    }
    
    this.ctx.stroke();
    
    // Draw arrow for directed edges
    if (edge.isDirected() && style.markerEnd) {
      this._drawArrow(endPoint, startPoint, style);
    }
    
    // Draw label
    const label = edge.getLabel();
    if (label) {
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      
      // Background for readability
      this.ctx.fillStyle = 'white';
      const metrics = this.ctx.measureText(label);
      const padding = 4;
      this.ctx.fillRect(
        midX - metrics.width / 2 - padding,
        midY - 10 - padding,
        metrics.width + padding * 2,
        20
      );
      
      // Text
      this.ctx.fillStyle = '#666666';
      this.ctx.font = '12px Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(label, midX, midY - 5);
    }
    
    this.ctx.restore();
  }

  /**
   * Set the viewport transform
   */
  setTransform(transform) {
    this.currentTransform = transform;
    const matrix = transform.getMatrix();
    this.ctx.setTransform(
      matrix[0] * this.pixelRatio,
      matrix[1] * this.pixelRatio,
      matrix[2] * this.pixelRatio,
      matrix[3] * this.pixelRatio,
      matrix[4] * this.pixelRatio,
      matrix[5] * this.pixelRatio
    );
  }

  /**
   * Draw a rounded rectangle
   * @private
   */
  _roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  /**
   * Draw an arrow
   * @private
   */
  _drawArrow(tip, from, style) {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6; // 30 degrees
    
    this.ctx.save();
    
    this.ctx.fillStyle = style.stroke || '#999999';
    this.ctx.beginPath();
    this.ctx.moveTo(tip.x, tip.y);
    this.ctx.lineTo(
      tip.x - arrowLength * Math.cos(angle - arrowAngle),
      tip.y - arrowLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.lineTo(
      tip.x - arrowLength * Math.cos(angle + arrowAngle),
      tip.y - arrowLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.restore();
  }

  /**
   * Get graph element at a specific point
   * @param {number} x - X coordinate in container space
   * @param {number} y - Y coordinate in container space
   * @returns {{type: string, element: Node|Edge}|null}
   */
  getElementAt(x, y) {
    // Convert to graph coordinates
    const graphPt = this.clientToGraph(x, y);
    
    // Check hit regions in reverse order (top to bottom)
    for (let i = this.hitRegions.length - 1; i >= 0; i--) {
      const region = this.hitRegions[i];
      
      if (region.type === 'node') {
        const bounds = region.bounds;
        if (graphPt.x >= bounds.x && 
            graphPt.x <= bounds.x + bounds.width &&
            graphPt.y >= bounds.y && 
            graphPt.y <= bounds.y + bounds.height) {
          return { type: region.type, element: region.element };
        }
      }
      // TODO: Add edge hit testing with line distance calculation
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
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (clientX - rect.left) * this.pixelRatio;
    const canvasY = (clientY - rect.top) * this.pixelRatio;
    
    if (this.currentTransform) {
      // Apply inverse transform
      const matrix = this.currentTransform.getMatrix();
      const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
      
      if (det !== 0) {
        const invMatrix = [
          matrix[3] / det,
          -matrix[1] / det,
          -matrix[2] / det,
          matrix[0] / det,
          (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / det,
          (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / det
        ];
        
        return {
          x: invMatrix[0] * canvasX + invMatrix[2] * canvasY + invMatrix[4],
          y: invMatrix[1] * canvasX + invMatrix[3] * canvasY + invMatrix[5]
        };
      }
    }
    
    return { x: canvasX, y: canvasY };
  }

  /**
   * Create mock context for testing environments
   * @private
   */
  _createMockContext() {
    const transforms = [];
    let currentTransform = [1, 0, 0, 1, 0, 0];
    
    const mockCtx = {
      // State management
      save: () => transforms.push([...currentTransform]),
      restore: () => { 
        if (transforms.length > 0) {
          currentTransform = transforms.pop();
        }
      },
      
      // Transformation
      setTransform: (a, b, c, d, e, f) => {
        currentTransform = [a, b, c, d, e, f];
      },
      scale: (x, y) => {},
      translate: (x, y) => {},
      
      // Drawing operations
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      
      // Path operations
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      fill: () => {},
      stroke: () => {},
      
      // Text
      fillText: () => {},
      measureText: (text) => ({ width: text.length * 8 }),
      
      // Image data (for testing)
      getImageData: (x, y, w, h) => ({
        data: new Uint8ClampedArray(w * h * 4)
      }),
      
      // Style properties
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      font: '14px Arial',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      globalAlpha: 1,
      setLineDash: () => {},
      
      // Canvas size (mock)
      canvas: {
        width: 800,
        height: 600
      }
    };
    
    return mockCtx;
  }

  /**
   * Render connection preview
   */
  renderConnectionPreview(preview) {
    if (!preview || !preview.active || !this.ctx) return;
    
    const ctx = this.ctx;
    ctx.save();
    
    // Set preview style
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.globalAlpha = 0.7;
    
    // Calculate source position
    let sourceX = preview.sourcePosition.x;
    let sourceY = preview.sourcePosition.y;
    
    if (preview.sourceNode) {
      const size = preview.sourceNode.getSize();
      sourceX += size.width / 2;
      sourceY += size.height / 2;
    }
    
    // Draw preview line
    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.lineTo(preview.targetPosition.x, preview.targetPosition.y);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(
      preview.targetPosition.y - sourceY,
      preview.targetPosition.x - sourceX
    );
    
    ctx.save();
    ctx.translate(preview.targetPosition.x, preview.targetPosition.y);
    ctx.rotate(angle);
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    
    ctx.restore();
    ctx.restore();
  }

  /**
   * Destroy the renderer
   */
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}