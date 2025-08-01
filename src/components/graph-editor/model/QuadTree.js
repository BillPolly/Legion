/**
 * QuadTree - Spatial indexing for efficient hit testing
 * 
 * Divides 2D space into quadrants recursively to enable fast spatial queries.
 */

/**
 * Rectangle class for bounds representation
 */
export class Rectangle {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Check if rectangle contains a point
   */
  contains(x, y) {
    return x >= this.x &&
           x <= this.x + this.width &&
           y >= this.y &&
           y <= this.y + this.height;
  }

  /**
   * Check if this rectangle intersects another
   */
  intersects(rect) {
    return !(rect.x >= this.x + this.width ||
             rect.x + rect.width <= this.x ||
             rect.y >= this.y + this.height ||
             rect.y + rect.height <= this.y);
  }

  /**
   * Create from bounds object
   */
  static fromBounds(bounds) {
    return new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }
}

/**
 * QuadTree node
 */
class QuadTreeNode {
  constructor(bounds, depth = 0, config = {}) {
    this.bounds = bounds;
    this.depth = depth;
    this.config = config;
    
    this.objects = [];
    this.nodes = null; // [NW, NE, SW, SE]
  }

  /**
   * Check if node has been subdivided
   */
  hasChildren() {
    return this.nodes !== null;
  }

  /**
   * Subdivide into four quadrants
   */
  subdivide() {
    const x = this.bounds.x;
    const y = this.bounds.y;
    const halfWidth = this.bounds.width / 2;
    const halfHeight = this.bounds.height / 2;
    const nextDepth = this.depth + 1;
    
    this.nodes = [
      // Northwest
      new QuadTreeNode(
        new Rectangle(x, y, halfWidth, halfHeight),
        nextDepth,
        this.config
      ),
      // Northeast
      new QuadTreeNode(
        new Rectangle(x + halfWidth, y, halfWidth, halfHeight),
        nextDepth,
        this.config
      ),
      // Southwest
      new QuadTreeNode(
        new Rectangle(x, y + halfHeight, halfWidth, halfHeight),
        nextDepth,
        this.config
      ),
      // Southeast
      new QuadTreeNode(
        new Rectangle(x + halfWidth, y + halfHeight, halfWidth, halfHeight),
        nextDepth,
        this.config
      )
    ];
  }

  /**
   * Get quadrant index for a rectangle (0-3, or -1 if spanning multiple)
   */
  getQuadrant(rect) {
    const midX = this.bounds.x + this.bounds.width / 2;
    const midY = this.bounds.y + this.bounds.height / 2;
    
    const inTop = rect.y + rect.height < midY;
    const inBottom = rect.y > midY;
    const inLeft = rect.x + rect.width < midX;
    const inRight = rect.x > midX;
    
    if (inTop) {
      if (inLeft) return 0; // NW
      if (inRight) return 1; // NE
    } else if (inBottom) {
      if (inLeft) return 2; // SW
      if (inRight) return 3; // SE
    }
    
    return -1; // Spanning multiple quadrants
  }

  /**
   * Insert object into this node or children
   */
  insert(obj) {
    // If we have children, try to insert into appropriate quadrant
    if (this.hasChildren()) {
      const quadrant = this.getQuadrant(obj.bounds);
      if (quadrant !== -1) {
        this.nodes[quadrant].insert(obj);
        return;
      }
    }
    
    // Add to this node
    this.objects.push(obj);
    
    // Split if we exceed capacity and haven't reached max depth
    if (!this.hasChildren() &&
        this.objects.length > this.config.maxObjects &&
        this.depth < this.config.maxDepth) {
      
      this.subdivide();
      
      // Redistribute objects
      const objects = this.objects;
      this.objects = [];
      
      objects.forEach(obj => {
        const quadrant = this.getQuadrant(obj.bounds);
        if (quadrant !== -1) {
          this.nodes[quadrant].insert(obj);
        } else {
          this.objects.push(obj);
        }
      });
    }
  }

  /**
   * Retrieve objects that might intersect with given bounds
   */
  retrieve(rect, results = []) {
    // Add objects from this node
    this.objects.forEach(obj => {
      if (rect.intersects(obj.bounds)) {
        results.push(obj);
      }
    });
    
    // If we have children, check relevant quadrants
    if (this.hasChildren()) {
      for (let i = 0; i < 4; i++) {
        if (this.nodes[i].bounds.intersects(rect)) {
          this.nodes[i].retrieve(rect, results);
        }
      }
    }
    
    return results;
  }

  /**
   * Remove object from this node or children
   */
  remove(obj) {
    const index = this.objects.indexOf(obj);
    if (index !== -1) {
      this.objects.splice(index, 1);
      return true;
    }
    
    // Try to remove from children
    if (this.hasChildren()) {
      for (let i = 0; i < 4; i++) {
        if (this.nodes[i].remove(obj)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Clear all objects
   */
  clear() {
    this.objects = [];
    this.nodes = null;
  }

  /**
   * Get statistics
   */
  getStats(stats = { totalObjects: 0, maxDepthReached: 0, nodeCount: 1 }) {
    stats.totalObjects += this.objects.length;
    stats.maxDepthReached = Math.max(stats.maxDepthReached, this.depth);
    
    if (this.hasChildren()) {
      this.nodes.forEach(node => {
        stats.nodeCount++;
        node.getStats(stats);
      });
    }
    
    return stats;
  }
}

/**
 * QuadTree - Main spatial index class
 */
export class QuadTree {
  constructor(bounds, config = {}) {
    this.config = {
      maxObjects: config.maxObjects || 4,
      maxDepth: config.maxDepth || 5,
      ...config
    };
    
    this.root = new QuadTreeNode(bounds, 0, this.config);
    this.objectMap = new WeakMap(); // Track object locations for updates
  }

  /**
   * Get bounds
   */
  getBounds() {
    return this.root.bounds;
  }

  /**
   * Get configuration
   */
  getMaxObjects() {
    return this.config.maxObjects;
  }

  getMaxDepth() {
    return this.config.maxDepth;
  }

  getDepth() {
    return this.root.depth;
  }

  /**
   * Check if root has children
   */
  hasChildren() {
    return this.root.hasChildren();
  }

  /**
   * Insert object with bounds
   */
  insert(obj) {
    this.root.insert(obj);
    this.objectMap.set(obj, obj.bounds);
  }

  /**
   * Retrieve objects that might intersect with given bounds
   */
  retrieve(rect) {
    return this.root.retrieve(rect);
  }

  /**
   * Retrieve objects at a specific point
   */
  retrieveAt(x, y) {
    // Use a small rectangle for point queries
    const pointRect = new Rectangle(x - 0.5, y - 0.5, 1, 1);
    const results = this.retrieve(pointRect);
    
    // Filter to exact point containment
    return results.filter(obj => obj.bounds.contains(x, y));
  }

  /**
   * Update object position
   */
  update(obj, newBounds) {
    // Remove from old position
    this.remove(obj);
    
    // Update bounds
    obj.bounds = newBounds;
    
    // Insert at new position
    this.insert(obj);
  }

  /**
   * Remove object
   */
  remove(obj) {
    const removed = this.root.remove(obj);
    if (removed) {
      this.objectMap.delete(obj);
    }
    return removed;
  }

  /**
   * Clear all objects
   */
  clear() {
    this.root.clear();
    this.objectMap = new WeakMap();
  }

  /**
   * Get maximum depth reached
   */
  getMaxDepthReached() {
    return this.getStats().maxDepthReached;
  }

  /**
   * Get tree statistics
   */
  getStats() {
    return this.root.getStats();
  }
}