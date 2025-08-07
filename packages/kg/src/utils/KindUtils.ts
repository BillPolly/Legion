/**
 * Utility functions for working with hierarchical kind paths
 */

export interface KindInfo {
  path: string[];
  leaf: string;
  parent: string | null;
  depth: number;
  root: string;
}

export class KindUtils {
  /**
   * Valid root categories for kind paths
   */
  private static readonly VALID_ROOTS = [
    'action',      // things that can be performed
    'resource',    // things that exist or are needed
    'knowledge',   // information and constraints
    'organization', // structural groupings
    'metadata'     // system information
  ];

  /**
   * Parse a kind path into its components
   */
  static parse(kindPath: string): KindInfo {
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
  static isValidKindPath(kindPath: string): boolean {
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
  static isChildOf(childKind: string, parentKind: string): boolean {
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
  static isDescendantOf(descendantKind: string, ancestorKind: string): boolean {
    return descendantKind.startsWith(ancestorKind + '.') || descendantKind === ancestorKind;
  }

  /**
   * Get all direct children of a kind from a list of kinds
   */
  static getDirectChildren(parentKind: string, allKinds: string[]): string[] {
    const parentDepth = parentKind.split('.').length;
    return allKinds.filter(kind => 
      kind.startsWith(parentKind + '.') && 
      kind.split('.').length === parentDepth + 1
    );
  }

  /**
   * Get all descendants of a kind from a list of kinds
   */
  static getAllDescendants(ancestorKind: string, allKinds: string[]): string[] {
    return allKinds.filter(kind => 
      kind.startsWith(ancestorKind + '.') && kind !== ancestorKind
    );
  }

  /**
   * Get the MongoDB regex pattern for querying a kind and its descendants
   */
  static getQueryPattern(kindPath: string): RegExp {
    // Escape dots for regex and allow optional descendants
    return new RegExp(`^${kindPath.replace(/\./g, '\\.')}(\\..*)?$`);
  }

  /**
   * Get suggested kind paths based on partial input
   */
  static getSuggestions(partial: string, existingKinds: string[]): string[] {
    const suggestions = new Set<string>();
    
    // Add exact matches and extensions
    existingKinds.forEach(kind => {
      if (kind.startsWith(partial)) {
        suggestions.add(kind);
        
        // Add next level suggestions
        const nextDot = kind.indexOf('.', partial.length);
        if (nextDot > 0) {
          suggestions.add(kind.substring(0, nextDot));
        }
      }
    });
    
    return Array.from(suggestions).sort();
  }

  /**
   * Build a kind path from components
   */
  static buildPath(components: string[]): string {
    return components.join('.');
  }

  /**
   * Get the parent kind path
   */
  static getParent(kindPath: string): string | null {
    const parts = kindPath.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : null;
  }

  /**
   * Get all ancestor paths for a kind
   */
  static getAncestors(kindPath: string): string[] {
    const parts = kindPath.split('.');
    const ancestors: string[] = [];
    
    for (let i = 1; i < parts.length; i++) {
      ancestors.push(parts.slice(0, i).join('.'));
    }
    
    return ancestors;
  }

  /**
   * Check if a kind represents a specific type
   */
  static isTask(kindPath: string): boolean {
    return kindPath === 'action.task' || kindPath.endsWith('.task');
  }

  static isUse(kindPath: string): boolean {
    return kindPath === 'action.use' || kindPath.endsWith('.use');
  }

  static isPackage(kindPath: string): boolean {
    return kindPath === 'action.package' || kindPath.endsWith('.package');
  }

  static isConsumable(kindPath: string): boolean {
    return kindPath === 'resource.input.consumable' || kindPath.endsWith('.consumable');
  }

  static isEquipment(kindPath: string): boolean {
    return kindPath === 'resource.input.equipment' || kindPath.endsWith('.equipment');
  }

  static isTool(kindPath: string): boolean {
    return kindPath === 'resource.input.tool' || kindPath.endsWith('.tool');
  }

  static isPart(kindPath: string): boolean {
    return kindPath === 'resource.output.part' || kindPath.endsWith('.part');
  }

  static isAttribute(kindPath: string): boolean {
    return kindPath === 'knowledge.attribute' || kindPath.endsWith('.attribute');
  }

  static isConstraint(kindPath: string): boolean {
    return kindPath === 'knowledge.constraint' || kindPath.endsWith('.constraint');
  }

  static isState(kindPath: string): boolean {
    return kindPath === 'knowledge.object' || kindPath.endsWith('.object');
  }

  static isProfession(kindPath: string): boolean {
    return kindPath === 'organization.profession' || kindPath.endsWith('.profession');
  }

  /**
   * Check if a kind represents an action (task, use, package)
   */
  static isAction(kindPath: string): boolean {
    return kindPath.startsWith('action.');
  }

  /**
   * Check if a kind represents a resource (input, output, workspace)
   */
  static isResource(kindPath: string): boolean {
    return kindPath.startsWith('resource.');
  }

  /**
   * Check if a kind represents knowledge (attribute, constraint, state, transformation)
   */
  static isKnowledge(kindPath: string): boolean {
    return kindPath.startsWith('knowledge.');
  }

  /**
   * Check if a kind represents organization (profession, subcategory, domain)
   */
  static isOrganization(kindPath: string): boolean {
    return kindPath.startsWith('organization.');
  }

  /**
   * Get the category (root) of a kind path
   */
  static getCategory(kindPath: string): string {
    return kindPath.split('.')[0];
  }

  /**
   * Get the subcategory (second level) of a kind path
   */
  static getSubcategory(kindPath: string): string | null {
    const parts = kindPath.split('.');
    return parts.length > 1 ? parts[1] : null;
  }

  /**
   * Validate that a kind path follows the expected hierarchy
   */
  static validateHierarchy(kindPath: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.isValidKindPath(kindPath)) {
      errors.push(`Invalid kind path format: ${kindPath}`);
      return { valid: false, errors };
    }

    const parts = kindPath.split('.');
    const root = parts[0];
    
    // Validate specific hierarchies
    switch (root) {
      case 'action':
        if (parts.length === 2 && !['task', 'use', 'package'].includes(parts[1])) {
          errors.push(`Invalid action type: ${parts[1]}. Must be task, use, or package`);
        }
        break;
        
      case 'resource':
        if (parts.length >= 2) {
          const resourceType = parts[1];
          if (!['input', 'output', 'workspace'].includes(resourceType)) {
            errors.push(`Invalid resource type: ${resourceType}. Must be input, output, or workspace`);
          }
          
          if (parts.length === 3) {
            if (resourceType === 'input' && !['consumable', 'equipment', 'tool'].includes(parts[2])) {
              errors.push(`Invalid input type: ${parts[2]}. Must be consumable, equipment, or tool`);
            }
            if (resourceType === 'output' && !['part', 'product'].includes(parts[2])) {
              errors.push(`Invalid output type: ${parts[2]}. Must be part or product`);
            }
            if (resourceType === 'workspace' && !['entity', 'location'].includes(parts[2])) {
              errors.push(`Invalid workspace type: ${parts[2]}. Must be entity or location`);
            }
          }
        }
        break;
        
      case 'knowledge':
        if (parts.length === 2 && !['attribute', 'constraint', 'object', 'transformation'].includes(parts[1])) {
          errors.push(`Invalid knowledge type: ${parts[1]}. Must be attribute, constraint, object, or transformation`);
        }
        break;
        
      case 'organization':
        if (parts.length === 2 && !['profession', 'subcategory', 'domain'].includes(parts[1])) {
          errors.push(`Invalid organization type: ${parts[1]}. Must be profession, subcategory, or domain`);
        }
        break;
        
      case 'metadata':
        if (parts.length === 2 && !['template', 'schema'].includes(parts[1])) {
          errors.push(`Invalid metadata type: ${parts[1]}. Must be template or schema`);
        }
        break;
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if a kind represents a capability (general capability, not specific action)
   */
  static isCapability(kindPath: string): boolean {
    // For now, consider anything that's not an action as a capability
    // This can be refined based on specific requirements
    return !kindPath.startsWith('action.');
  }

  /**
   * Check if two kinds are compatible for inheritance (subtypeOf relationship)
   */
  static isKindCompatible(childKind: string, parentKind: string): boolean {
    // Same kind is always compatible
    if (childKind === parentKind) {
      return true;
    }

    // Child must be more specific than parent (descendant)
    if (this.isDescendantOf(childKind, parentKind)) {
      return true;
    }

    // Same category is compatible (e.g., action.task can inherit from action.use)
    const childCategory = this.getCategory(childKind);
    const parentCategory = this.getCategory(parentKind);
    
    if (childCategory === parentCategory) {
      return true;
    }

    // Cross-category compatibility rules
    // Resources can inherit from other resources
    if (this.isResource(childKind) && this.isResource(parentKind)) {
      return true;
    }

    // Knowledge can inherit from other knowledge
    if (this.isKnowledge(childKind) && this.isKnowledge(parentKind)) {
      return true;
    }

    // Organization can inherit from other organization
    if (this.isOrganization(childKind) && this.isOrganization(parentKind)) {
      return true;
    }

    return false;
  }

  /**
   * Get common kind paths for easy reference
   */
  static readonly COMMON_KINDS = {
    // Actions
    TASK: 'action.task',
    USE: 'action.use',
    PACKAGE: 'action.package',
    
    // Resources - Input
    CONSUMABLE: 'resource.input.consumable',
    EQUIPMENT: 'resource.input.equipment',
    TOOL: 'resource.input.tool',
    
    // Resources - Output
    PART: 'resource.output.part',
    PRODUCT: 'resource.output.product',
    
    // Resources - Workspace
    ENTITY: 'resource.workspace.entity',
    LOCATION: 'resource.workspace.location',
    
    // Knowledge
    ATTRIBUTE: 'knowledge.attribute',
    CONSTRAINT: 'knowledge.constraint',
    STATE: 'knowledge.object',
    TRANSFORMATION: 'knowledge.transformation',
    
    // Organization
    PROFESSION: 'organization.profession',
    SUBCATEGORY: 'organization.subcategory',
    DOMAIN: 'organization.domain',
    
    // Metadata
    TEMPLATE: 'metadata.template',
    SCHEMA: 'metadata.schema'
  } as const;
}
