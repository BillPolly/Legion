/**
 * InheritanceRelationship - Support for inheritance/ISA relationships in ER diagrams
 * 
 * Represents inheritance relationships between entities in ER diagrams.
 * Supports both total/partial and disjoint/overlapping inheritance.
 */

export class InheritanceRelationship {
  /**
   * Create a new inheritance relationship
   * @param {Object} config - Configuration object
   * @param {string} config.parent - Parent entity ID
   * @param {string[]} config.children - Child entity IDs
   * @param {string} [config.type='disjoint'] - 'disjoint' or 'overlapping'
   * @param {string} [config.participation='partial'] - 'total' or 'partial'
   */
  constructor(config = {}) {
    this.parent = config.parent || null;
    this.children = config.children || [];
    this.type = config.type || 'disjoint';
    this.participation = config.participation || 'partial';
    this.symbol = this._getSymbol();
  }

  /**
   * Get the symbol representation for the inheritance
   * @private
   */
  _getSymbol() {
    return {
      type: 'inheritance',
      subtype: this.type,
      participation: this.participation,
      shape: 'triangle',
      label: this.type === 'disjoint' ? 'd' : 'o'
    };
  }

  /**
   * Add a child entity to the inheritance
   * @param {string} childId - Child entity ID
   */
  addChild(childId) {
    if (!this.children.includes(childId)) {
      this.children.push(childId);
    }
  }

  /**
   * Remove a child entity from the inheritance
   * @param {string} childId - Child entity ID
   */
  removeChild(childId) {
    const index = this.children.indexOf(childId);
    if (index > -1) {
      this.children.splice(index, 1);
    }
  }

  /**
   * Validate the inheritance relationship
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    
    if (!this.parent) {
      errors.push('Inheritance relationship must have a parent entity');
    }
    
    if (this.children.length === 0) {
      errors.push('Inheritance relationship must have at least one child entity');
    }
    
    if (!['disjoint', 'overlapping'].includes(this.type)) {
      errors.push('Inheritance type must be either "disjoint" or "overlapping"');
    }
    
    if (!['total', 'partial'].includes(this.participation)) {
      errors.push('Inheritance participation must be either "total" or "partial"');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to layout representation
   * @returns {Object} Layout representation
   */
  toLayoutFormat() {
    return {
      type: 'inheritance',
      parent: this.parent,
      children: this.children,
      properties: {
        inheritanceType: this.type,
        participation: this.participation
      },
      symbol: this.symbol
    };
  }

  /**
   * Export to various formats
   * @param {string} format - Export format ('svg', 'json', 'sql')
   * @returns {*} Exported representation
   */
  export(format = 'json') {
    switch (format) {
      case 'svg':
        return this._exportToSVG();
      case 'sql':
        return this._exportToSQL();
      case 'json':
      default:
        return this._exportToJSON();
    }
  }

  /**
   * Export to JSON
   * @private
   */
  _exportToJSON() {
    return {
      type: 'inheritance',
      parent: this.parent,
      children: this.children,
      inheritanceType: this.type,
      participation: this.participation
    };
  }

  /**
   * Export to SVG
   * @private
   */
  _exportToSVG() {
    // SVG representation would be generated here
    return `<g class="inheritance-relationship">
      <polygon points="0,0 20,0 10,20" fill="none" stroke="black"/>
      <text x="10" y="10" text-anchor="middle">${this.type === 'disjoint' ? 'd' : 'o'}</text>
    </g>`;
  }

  /**
   * Export to SQL constraints
   * @private
   */
  _exportToSQL() {
    const constraints = [];
    
    if (this.type === 'disjoint') {
      // Add CHECK constraints to ensure disjoint inheritance
      constraints.push(`-- Disjoint inheritance: ${this.parent} -> ${this.children.join(', ')}`);
    }
    
    if (this.participation === 'total') {
      // Add constraint to ensure parent must exist in at least one child
      constraints.push(`-- Total participation: ${this.parent} must exist in child tables`);
    }
    
    return constraints.join('\n');
  }
}