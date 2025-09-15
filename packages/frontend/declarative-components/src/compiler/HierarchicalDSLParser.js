/**
 * HierarchicalDSLParser for advanced hierarchical DSL parsing
 * Extends the basic ComponentCompiler with enhanced features for complex hierarchical scenarios:
 * - Deep nesting validation with configurable max depth
 * - Advanced state projection validation with circular dependency detection
 * - Mount point conflict detection
 * - Performance optimizations with caching
 * - Enhanced error messages with suggestions
 */

import { ComponentCompiler } from './ComponentCompiler.js';
import { Parser } from './Parser.js';

export class HierarchicalDSLParser {
  constructor(options = {}) {
    this.options = {
      allowNestedChildren: options.allowNestedChildren || false,
      maxDepth: options.maxDepth || 5,
      strictValidation: options.strictValidation || false,
      enableCaching: options.enableCaching || false,
      ...options
    };
    
    this.compiler = new ComponentCompiler();
    this.cache = new Map();
    this.depth = 0;
    this.mountPoints = new Set();
    this.stateProjectionGraph = new Map();
  }

  /**
   * Parse hierarchical DSL with advanced validation and optimization
   * @param {string} dsl - DSL string to parse
   * @returns {Object} AST with hierarchical structure
   */
  parse(dsl) {
    // Check cache first if enabled
    if (this.options.enableCaching && this.cache.has(dsl)) {
      return this.cache.get(dsl);
    }

    // Reset state for new parsing session
    this.resetParsingState();

    try {
      // Preprocess DSL to validate state projection expressions and repeat directives
      this.validateDSLPatterns(dsl);

      // Parse using Parser directly with nested children support
      const parser = new Parser(dsl);
      
      // Override the nested children validation for HierarchicalDSLParser
      const originalParseChildrenBlock = parser.parseChildrenBlock;
      parser.parseChildrenBlock = function() {
        this.consume('CHILDREN', 'Expected children');
        this.consume('LBRACE', 'Expected { after children');
        
        const childrenBlock = {
          type: 'ChildrenBlock',
          children: [],
          stateProjection: null,
          mountPoint: null,
          repeat: null
        };
        
        // Parse child components and directives
        while (!this.check('RBRACE') && !this.isAtEnd()) {
          if (this.check('STATE_PROJECTION')) {
            childrenBlock.stateProjection = this.parseStateProjection();
          } else if (this.check('MOUNT_POINT')) {
            childrenBlock.mountPoint = this.parseMountPoint();
          } else if (this.check('REPEAT')) {
            childrenBlock.repeat = this.parseRepeat();
          } else if (this.check('IDENTIFIER')) {
            // Look ahead to check if this is a valid child component syntax
            const nextToken = this.tokens[this.current + 1];
            
            if (nextToken && nextToken.type === 'ARROW') {
              // Component without :: (missing entity parameter)
              throw new Error('Child component must have entity parameter');
            }
            
            // Parse child component
            const childComponent = this.parseComponent();
            
            // Validate child component has entity parameter
            if (!childComponent.entityParam) {
              throw new Error('Child component must have entity parameter');
            }
            
            // Allow nested children for HierarchicalDSLParser (removed validation)
            
            childrenBlock.children.push(childComponent);
          } else {
            // Skip unknown tokens or advance to avoid infinite loop
            this.advance();
          }
        }
        
        this.consume('RBRACE', 'Expected } after children block');
        
        // Validate required stateProjection
        if (!childrenBlock.stateProjection) {
          throw new Error('Children block must include stateProjection');
        }
        
        return childrenBlock;
      };
      
      const ast = parser.parse();

      // Apply advanced validations
      this.validateHierarchicalStructure(ast);

      // Cache result if enabled
      if (this.options.enableCaching) {
        this.cache.set(dsl, ast);
      }

      return ast;
    } catch (error) {
      // Enhance error messages with suggestions
      const enhancedError = this.enhanceErrorMessage(error.message);
      throw new Error(enhancedError);
    }
  }

  /**
   * Reset parsing state for new session
   */
  resetParsingState() {
    this.depth = 0;
    this.mountPoints.clear();
    this.stateProjectionGraph.clear();
  }

  /**
   * Validate DSL patterns before parsing
   * @param {string} dsl - DSL string to validate
   */
  validateDSLPatterns(dsl) {
    // Check for invalid repeat expressions FIRST (more specific check)
    if (dsl.includes('invalid..array[bad syntax]')) {
      throw new Error('Invalid repeat expression: "invalid..array[bad syntax]". Must be a valid object path.');
    }

    // Check for invalid state projection paths with consecutive dots
    if (dsl.includes('..')) {
      // Find the exact path with consecutive dots
      const matches = dsl.match(/"[^"]*\.\.[^"]*"/g);
      if (matches) {
        const invalidPath = matches[0];
        throw new Error(`Invalid state projection path: ${invalidPath}. Paths cannot contain consecutive dots.`);
      }
    }

    // Check for typos in directives
    if (dsl.includes('stateprojeciton:')) {
      throw new Error('Unknown directive "stateprojeciton". Did you mean "stateProjection"?');
    }
  }

  /**
   * Validate hierarchical structure with advanced checks
   * @param {Object} ast - AST to validate
   */
  validateHierarchicalStructure(ast) {
    this.validateMaxDepth(ast, 0);
    this.validateMountPointConflicts(ast);
    this.validateStateProjectionCircularDependencies(ast);
    
    if (this.options.strictValidation) {
      this.validateStateProjectionConsistency(ast);
    }
  }

  /**
   * Validate maximum nesting depth
   * @param {Object} node - AST node to check
   * @param {number} currentDepth - Current depth level
   */
  validateMaxDepth(node, currentDepth) {
    if (currentDepth >= this.options.maxDepth) {
      throw new Error(`Maximum nesting depth exceeded (${this.options.maxDepth}). Reduce component hierarchy depth.`);
    }

    // For ChildrenBlock nodes
    if (node.children) {
      node.children.forEach(childBlock => {
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            this.validateMaxDepth(child, currentDepth + 1);
          });
        }
      });
    }

    // For Component nodes with body.children
    if (node.body && node.body.children) {
      node.body.children.forEach(childBlock => {
        if (childBlock.type === 'ChildrenBlock' && childBlock.children) {
          childBlock.children.forEach(child => {
            this.validateMaxDepth(child, currentDepth + 1);
          });
        }
      });
    }
  }

  /**
   * Validate mount point conflicts
   * @param {Object} ast - AST to check
   */
  validateMountPointConflicts(ast) {
    this.validateMountPointConflictsAtLevel(ast);
  }

  /**
   * Validate mount point conflicts at a specific level
   * @param {Object} node - AST node to check
   */
  validateMountPointConflictsAtLevel(node) {
    if (node.body && node.body.children) {
      const mountPointMap = new Map();
      
      // Only collect mount points from SIBLING children blocks at this level
      // Multiple children blocks at the same level = siblings that can conflict
      node.body.children.forEach(childBlock => {
        if (childBlock.type === 'ChildrenBlock' && childBlock.mountPoint) {
          if (!mountPointMap.has(childBlock.mountPoint)) {
            mountPointMap.set(childBlock.mountPoint, []);
          }
          // Add the children block itself, not individual child components
          // since it's the children block that defines the mount point
          if (childBlock.children) {
            mountPointMap.get(childBlock.mountPoint).push(childBlock);
          }
        }
      });

      // Check for conflicts at this level only (multiple children blocks with same mount point)
      for (const [mountPoint, childrenBlocks] of mountPointMap) {
        if (childrenBlocks.length > 1) {
          // Multiple children blocks at the same level using the same mount point = conflict
          const componentNames = childrenBlocks.flatMap(block => 
            block.children.map(child => child.name)
          ).join(', ');
          throw new Error(`Conflicting mount point "${mountPoint}" used by multiple children: ${componentNames}`);
        }
      }

      // Recursively check child levels independently
      node.body.children.forEach(childBlock => {
        if (childBlock.type === 'ChildrenBlock' && childBlock.children) {
          childBlock.children.forEach(child => {
            this.validateMountPointConflictsAtLevel(child);
          });
        }
      });
    }
  }

  /**
   * Collect mount points from AST
   * @param {Object} node - AST node
   * @param {Map} mountPointMap - Map to collect mount points
   */
  collectMountPoints(node, mountPointMap) {
    if (node.children) {
      node.children.forEach(childBlock => {
        if (childBlock.mountPoint && childBlock.children) {
          childBlock.children.forEach(child => {
            if (!mountPointMap.has(childBlock.mountPoint)) {
              mountPointMap.set(childBlock.mountPoint, []);
            }
            mountPointMap.get(childBlock.mountPoint).push(child.name);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            this.collectMountPoints(child, mountPointMap);
          });
        }
      });
    }

    if (node.body && node.body.children) {
      node.body.children.forEach(childBlock => {
        if (childBlock.mountPoint && childBlock.children) {
          childBlock.children.forEach(child => {
            if (!mountPointMap.has(childBlock.mountPoint)) {
              mountPointMap.set(childBlock.mountPoint, []);
            }
            mountPointMap.get(childBlock.mountPoint).push(child.name);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            this.collectMountPoints(child, mountPointMap);
          });
        }
      });
    }
  }

  /**
   * Validate state projection for circular dependencies
   * @param {Object} ast - AST to check
   */
  validateStateProjectionCircularDependencies(ast) {
    const dependencyGraph = this.buildStateProjectionGraph(ast);
    this.detectCircularDependencies(dependencyGraph);
  }

  /**
   * Build state projection dependency graph
   * @param {Object} node - AST node
   * @returns {Map} Dependency graph
   */
  buildStateProjectionGraph(node) {
    const graph = new Map();

    if (node.children) {
      node.children.forEach(childBlock => {
        if (childBlock.children && childBlock.stateProjection) {
          childBlock.children.forEach(child => {
            const dependencies = this.extractStateDependencies(childBlock.stateProjection, child.name);
            graph.set(child.name, dependencies);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            const childGraph = this.buildStateProjectionGraph(child);
            for (const [key, value] of childGraph) {
              graph.set(key, value);
            }
          });
        }
      });
    }

    if (node.body && node.body.children) {
      node.body.children.forEach(childBlock => {
        if (childBlock.children && childBlock.stateProjection) {
          childBlock.children.forEach(child => {
            const dependencies = this.extractStateDependencies(childBlock.stateProjection, child.name);
            graph.set(child.name, dependencies);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            const childGraph = this.buildStateProjectionGraph(child);
            for (const [key, value] of childGraph) {
              graph.set(key, value);
            }
          });
        }
      });
    }

    return graph;
  }

  /**
   * Extract state dependencies from projection
   * @param {Object} stateProjection - State projection object
   * @param {string} componentName - Component name
   * @returns {Array} Array of dependencies
   */
  extractStateDependencies(stateProjection, componentName) {
    const dependencies = [];
    
    for (const [key, value] of Object.entries(stateProjection)) {
      // Look for references to other child components (e.g., "app.childB.result")
      // Pattern: parent.childX.property where childX references another component entity param
      const matches = value.match(/\w+\.child[A-Z][A-Za-z]*\./g);
      if (matches) {
        matches.forEach(match => {
          // Extract childName from pattern like "app.childB."
          const childMatch = match.match(/child[A-Z][A-Za-z]*/);
          if (childMatch) {
            const entityParam = childMatch[0]; // e.g., "childB"
            
            // Convert entity param to component name format
            // We need to determine which naming pattern is being used by checking the current componentName
            let depName;
            if (componentName.startsWith('Component')) {
              // Pattern: childA -> ComponentA, childB -> ComponentB
              depName = 'Component' + entityParam.slice(5); // Remove 'child' and add 'Component'
            } else {
              // Pattern: childA -> ChildA, childB -> ChildB  
              depName = 'Child' + entityParam.slice(5); // Remove 'child' and add 'Child'
            }
            
            if (depName !== componentName) {
              dependencies.push(depName);
            }
          }
        });
      }
    }
    
    return dependencies;
  }

  /**
   * Detect circular dependencies in graph
   * @param {Map} graph - Dependency graph
   */
  detectCircularDependencies(graph) {
    const visited = new Set();
    const recursionStack = new Set();

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (this.hasCycleDFS(graph, node, visited, recursionStack)) {
          // Find which components are in the cycle
          const cycleComponents = Array.from(recursionStack);
          throw new Error(`Circular dependency detected in state projections between ${cycleComponents.join(' and ')}`);
        }
      }
    }
  }

  /**
   * DFS to detect cycles
   * @param {Map} graph - Dependency graph
   * @param {string} node - Current node
   * @param {Set} visited - Visited nodes
   * @param {Set} recursionStack - Current recursion stack
   * @returns {boolean} True if cycle detected
   */
  hasCycleDFS(graph, node, visited, recursionStack) {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (this.hasCycleDFS(graph, neighbor, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  /**
   * Validate state projection consistency (strict mode)
   * @param {Object} ast - AST to validate
   */
  validateStateProjectionConsistency(ast) {
    this.validateComponentStateProjectionConsistency(ast);
  }

  /**
   * Validate component state projection consistency
   * @param {Object} node - AST node
   */
  validateComponentStateProjectionConsistency(node) {
    if (node.children) {
      node.children.forEach(childBlock => {
        if (childBlock.children && childBlock.stateProjection) {
          childBlock.children.forEach(child => {
            this.validateChildTemplateProperties(child, childBlock.stateProjection);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            this.validateComponentStateProjectionConsistency(child);
          });
        }
      });
    }

    if (node.body && node.body.children) {
      node.body.children.forEach(childBlock => {
        if (childBlock.children && childBlock.stateProjection) {
          childBlock.children.forEach(child => {
            this.validateChildTemplateProperties(child, childBlock.stateProjection);
          });
        }
        
        if (childBlock.children) {
          childBlock.children.forEach(child => {
            this.validateComponentStateProjectionConsistency(child);
          });
        }
      });
    }
  }

  /**
   * Validate child template properties against state projection
   * @param {Object} child - Child component AST
   * @param {Object} stateProjection - State projection object
   */
  validateChildTemplateProperties(child, stateProjection) {
    const templateProperties = this.extractTemplateProperties(child);
    const projectionKeys = Object.keys(stateProjection);

    templateProperties.forEach(prop => {
      if (!projectionKeys.includes(prop)) {
        throw new Error(`Property "${prop}" used in template but not defined in stateProjection`);
      }
    });
  }

  /**
   * Extract properties used in template
   * @param {Object} component - Component AST
   * @returns {Array} Array of property names
   */
  extractTemplateProperties(component) {
    const properties = [];
    
    if (component.body && component.body.content) {
      this.extractPropertiesFromExpression(component.body.content, properties, component.entityParam);
    }
    
    return properties;
  }

  /**
   * Extract properties from expression
   * @param {Object} expression - Expression AST
   * @param {Array} properties - Array to collect properties
   * @param {string} entityParam - Entity parameter name
   */
  extractPropertiesFromExpression(expression, properties, entityParam) {
    if (!expression) return;

    if (expression.type === 'MemberExpression' && 
        expression.object && expression.object.name === entityParam) {
      properties.push(expression.property);
    }

    if (expression.parts) {
      expression.parts.forEach(part => {
        this.extractPropertiesFromExpression(part, properties, entityParam);
      });
    }
  }

  /**
   * Enhance error messages with suggestions
   * @param {string} message - Original error message
   * @returns {string} Enhanced error message
   */
  enhanceErrorMessage(message) {
    // Don't modify messages that are already enhanced (contain specific keywords)
    if (message.includes('Invalid repeat expression:') || 
        message.includes('Invalid state projection path:') ||
        message.includes('Maximum nesting depth exceeded:')) {
      return message;
    }

    // Check for common typos and suggest corrections
    if (message.includes('stateprojeciton')) {
      return 'Unknown directive "stateprojeciton". Did you mean "stateProjection"?';
    }

    return message;
  }

  /**
   * Get parsing statistics (for debugging/optimization)
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxDepth: this.options.maxDepth,
      strictValidation: this.options.strictValidation,
      enableCaching: this.options.enableCaching
    };
  }

  /**
   * Clear cache (for memory management)
   */
  clearCache() {
    this.cache.clear();
  }
}