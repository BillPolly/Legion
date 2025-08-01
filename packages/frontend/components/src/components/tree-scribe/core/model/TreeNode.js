/**
 * TreeNode - Individual node representation in the tree structure
 */

export class TreeNode {
  constructor(data) {
    this.id = data.id || this._generateId();
    this.title = data.title || 'Untitled';
    this.content = data.description || data.content || '';
    this.contentType = data.contentType || this._detectContentType(this.content);
    this.children = [];
    this.parent = null;
    this.metadata = data.metadata || {};
    this.state = {
      expanded: true, // Start expanded by default
      visible: true,
      searchHighlight: false
    };
    
    console.log('[TreeNode] Created node:', {
      id: this.id,
      title: this.title,
      contentType: this.contentType,
      hasContent: !!this.content
    });
  }

  /**
   * Generate a unique ID for the node
   * @private
   */
  _generateId() {
    return 'node_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  /**
   * Detect content type from content
   * @private
   */
  _detectContentType(content) {
    if (typeof content === 'string') {
      // Check for triple-backtick directives
      const directiveMatch = content.match(/^```(\w+)/);
      return directiveMatch ? directiveMatch[1] : 'plaintext';
    } else if (content && typeof content === 'object' && content.type) {
      return content.type;
    } else if (content && typeof content === 'object') {
      return 'yaml'; // Structured object
    }
    return 'plaintext';
  }

  /**
   * Calculate depth from root
   */
  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Check if this is the root node
   */
  isRoot() {
    return this.parent === null;
  }

  /**
   * Check if this is a leaf node (no children)
   */
  isLeaf() {
    return this.children.length === 0;
  }

  /**
   * Get sibling nodes (nodes at same level)
   */
  getSiblings() {
    if (!this.parent) {
      return [];
    }
    return this.parent.children.filter(child => child !== this);
  }

  /**
   * Update node state
   */
  setState(newState) {
    Object.assign(this.state, newState);
  }

  /**
   * Get current state (returns copy)
   */
  getState() {
    return { ...this.state };
  }
}