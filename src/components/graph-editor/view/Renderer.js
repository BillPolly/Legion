/**
 * Renderer - Abstract base class for graph rendering
 */

export class Renderer {
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
  }

  /**
   * Begin a new frame
   */
  beginFrame() {
    throw new Error('beginFrame must be implemented by subclass');
  }

  /**
   * End the current frame
   */
  endFrame() {
    throw new Error('endFrame must be implemented by subclass');
  }

  /**
   * Clear the render surface
   */
  clear() {
    throw new Error('clear must be implemented by subclass');
  }

  /**
   * Render a node
   */
  renderNode(node, options = {}) {
    throw new Error('renderNode must be implemented by subclass');
  }

  /**
   * Render an edge
   */
  renderEdge(edge, sourceNode, targetNode, options = {}) {
    throw new Error('renderEdge must be implemented by subclass');
  }

  /**
   * Render connection preview
   */
  renderConnectionPreview(preview) {
    // Optional - subclasses can override
  }

  /**
   * Set the viewport transform
   */
  setTransform(transform) {
    throw new Error('setTransform must be implemented by subclass');
  }

  /**
   * Get graph element at a specific point
   * @param {number} x - X coordinate in container space
   * @param {number} y - Y coordinate in container space
   * @returns {{type: string, element: Node|Edge}|null}
   */
  getElementAt(x, y) {
    throw new Error('getElementAt must be implemented by subclass');
  }

  /**
   * Convert client coordinates to graph coordinates
   * @param {number} clientX - Client X coordinate
   * @param {number} clientY - Client Y coordinate
   * @returns {{x: number, y: number}} Graph coordinates
   */
  clientToGraph(clientX, clientY) {
    throw new Error('clientToGraph must be implemented by subclass');
  }

  /**
   * Resize the render surface
   */
  resize() {
    // Optional - subclasses can override
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy() {
    // Subclasses should override to clean up
  }

  /**
   * Factory method to create renderer by type
   */
  static async create(type, container, config = {}) {
    switch (type) {
      case 'svg': {
        const { SVGRenderer } = await import('./SVGRenderer.js');
        return new SVGRenderer(container, config);
      }
      case 'canvas': {
        const { CanvasRenderer } = await import('./CanvasRenderer.js');
        return new CanvasRenderer(container, config);
      }
      default:
        throw new Error(`Unknown renderer type: ${type}`);
    }
  }
}