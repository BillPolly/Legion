/**
 * Utility functions for working with hierarchical kind paths
 * ES6 JavaScript version
 */

export class KindUtils {
  /**
   * Valid root categories for kind paths
   */
  static VALID_ROOTS = [
    'action',      // things that can be performed
    'resource',    // things that exist or are needed
    'knowledge',   // information and constraints
    'organization', // structural groupings
    'metadata'     // system information
  ];

  /**
   * Parse a kind path into its components
   */
  static parse(kindPath) {
    const parts = kindPath.split('.');
    return {
      path: parts,
      leaf: parts[parts.length - 1],
      parent: parts.length > 1 ? parts.slice(0, -1).join('.') : null,
      depth: parts.length,
      root: parts[0]
    };
  }

  /**
   * Check if a kind path is valid
   */
  static isValidKindPath(kindPath) {
    // Must contain at least one dot (hierarchical)
    if (!kindPath.includes('.')) {
      return false;
    }

    // Must contain only lowercase letters and dots
    if (!/^[a-z]+(\.[a-z]+)*$/.test(kindPath)) {
      return false;
    }

    // Must have reasonable depth (2-5 levels)
    const depth = kindPath.split('.').length;
    if (depth < 2 || depth > 5) {
      return false;
    }

    // Must start with valid root category
    const root = kindPath.split('.')[0];
    return this.VALID_ROOTS.includes(root);
  }

  /**
   * Check if one kind is a direct child of another
   */
  static isChildOf(childKind, parentKind) {
    if (!childKind.startsWith(parentKind + '.') || childKind === parentKind) {
      return false;
    }
    
    // Check if it's a direct child (only one level deeper)
    const childParts = childKind.split('.');
    const parentParts = parentKind.split('.');
    
    return childParts.length === parentParts.length + 1;
  }

  /**
   * Check if one kind is a descendant of another (includes direct children)
   */
  static isDescendantOf(descendantKind, ancestorKind) {
    return descendantKind.startsWith(ancestorKind + '.') || descendantKind === ancestorKind;
  }

  /**
   * Get all direct children of a kind from a list of kinds
   */
  static getDirectChildren(parentKind, allKinds) {
    const parentDepth = parentKind.split('.').length;
    return allKinds.filter(kind => 
      kind.startsWith(parentKind + '.') && 
      kind.split('.').length === parentDepth + 1
    );
  }

  /**
   * Get all descendants of a kind from a list of kinds
   */
  static getAllDescendants(ancestorKind, allKinds) {
    return allKinds.filter(kind => 
      kind.startsWith(ancestorKind + '.') && kind !== ancestorKind
    );
  }

  /**
   * Build a tree structure from a flat list of kind paths
   */
  static buildTree(kindPaths) {
    const tree = {};
    
    for (const path of kindPaths) {
      const parts = path.split('.');
      let current = tree;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const fullPath = parts.slice(0, i + 1).join('.');
        
        if (!current[part]) {
          current[part] = {
            path: fullPath,
            children: {}
          };
        }
        
        if (i < parts.length - 1) {
          current = current[part].children;
        }
      }
    }
    
    return tree;
  }

  /**
   * Find common ancestor of two kind paths
   */
  static findCommonAncestor(kind1, kind2) {
    const parts1 = kind1.split('.');
    const parts2 = kind2.split('.');
    const common = [];
    
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        common.push(parts1[i]);
      } else {
        break;
      }
    }
    
    return common.length > 0 ? common.join('.') : null;
  }
}