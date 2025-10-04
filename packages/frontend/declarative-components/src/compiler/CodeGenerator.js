/**
 * Code Generator for the Declarative Components DSL
 * Converts AST into executable component code
 */

export class CodeGenerator {
  constructor() {
    this.elementCounter = 0;
  }

  /**
   * Extract source path from expression for binding
   * @param {Object} expr - Expression AST node
   * @param {string} entityParam - Entity parameter name
   * @returns {string|null} Source path or null
   */
  extractSourcePath(expr, entityParam) {
    if (!expr) return null;

    if (expr.type === 'MemberExpression') {
      if (expr.object && expr.object.name === entityParam) {
        return `${entityParam}.${expr.property}`;
      }
    } else if (expr.type === 'Identifier') {
      return `${entityParam}.${expr.name}`;
    }

    return null;
  }

  /**
   * Generate a component definition from AST
   * @param {Object} ast - Abstract syntax tree
   * @returns {Object} Component definition with structure, bindings, events, methods, and computed
   */
  generate(ast) {
    if (ast.type !== 'Component') {
      throw new Error('Root node must be a Component');
    }

    // Reset element counter for each component
    this.elementCounter = 0;

    // Generate component definition
    const componentDef = {
      name: ast.name,
      entity: ast.entityParam,
      structure: {},
      bindings: [],
      events: [],
      methods: {},
      computed: {}
    };

    // Process methods if present
    if (ast.methods && ast.methods.length > 0) {
      for (const method of ast.methods) {
        componentDef.methods[method.name] = {
          params: method.params,
          body: method.body
        };
      }
    }

    // Process computed properties if present
    if (ast.computed && ast.computed.length > 0) {
      for (const prop of ast.computed) {
        componentDef.computed[prop.name] = {
          body: prop.body
        };
      }
    }

    // Process the body to extract structure, bindings, and events
    if (ast.body) {
      this.processNode(ast.body, componentDef, 'root', ast.entityParam, null);
    }

    return componentDef;
  }
  
  /**
   * Process an AST node and extract structure, bindings, and events
   */
  processNode(node, componentDef, elementKey, entityParam, parentKey = null) {
    if (!node) return null;
    
    if (node.type === 'Element') {
      elementKey = elementKey || 'root';
      
      // Add to structure
      componentDef.structure[elementKey] = {
        element: node.tagName || node.tag,
        class: node.classes ? node.classes.join(' ') : undefined,
        id: node.id,
        parent: parentKey,
        attributes: {}
      };

      // Process attributes and extract dynamic bindings
      if (node.attributes) {
        for (const [attrName, attrValue] of Object.entries(node.attributes)) {
          if (typeof attrValue === 'object' && attrValue.type === 'DynamicAttribute') {
            // This is a dynamic attribute binding
            const expr = attrValue.expression;

            // Extract source path from expression
            let sourcePath;
            if (expr.type === 'MemberExpression' && expr.object && expr.object.name === entityParam) {
              sourcePath = `${entityParam}.${expr.property}`;
            } else if (expr.type === 'Identifier') {
              sourcePath = `${entityParam}.${expr.name}`;
            } else {
              // For more complex expressions, try to extract the path
              sourcePath = this.extractSourcePath(expr, entityParam);
            }

            if (sourcePath) {
              componentDef.bindings.push({
                source: sourcePath,
                target: `${elementKey}.${attrName}`,
                transform: 'identity'
              });
            }
          } else {
            // Static attribute value
            componentDef.structure[elementKey].attributes[attrName] = attrValue;
          }
        }
      }

      // Process content/binding
      if (node.content) {
        if (node.content.type === 'DataBinding') {
          componentDef.bindings.push({
            source: `${entityParam}.${node.content.property}`,
            target: `${elementKey}.textContent`,
            transform: 'identity'
          });
        } else if (node.content.type === 'MemberExpression') {
          // Member expression is a data binding
          if (node.content.object && node.content.object.name === entityParam) {
            componentDef.bindings.push({
              source: `${entityParam}.${node.content.property}`,
              target: `${elementKey}.textContent`,
              transform: 'identity'
            });
          } else if (node.content.object && node.content.object.name === 'computed') {
            // Computed property reference
            componentDef.bindings.push({
              source: `computed.${node.content.property}`,
              target: `${elementKey}.textContent`,
              transform: 'identity'
            });
          } else if (node.content.object && node.content.object.name === 'helpers') {
            // Helper function reference (for simple property-like helpers)
            componentDef.bindings.push({
              source: `helpers.${node.content.property}`,
              target: `${elementKey}.textContent`,
              transform: 'identity'
            });
          }
        } else if (node.content.type === 'Literal' || node.content.type === 'Text') {
          // Static text - set as initial content
          componentDef.structure[elementKey].textContent = node.content.value;
        }
      }
      
      // Process children
      if (node.children && node.children.length > 0) {
        node.children.forEach((child, index) => {
          const childKey = `${elementKey}_child_${index}`;
          this.processNode(child, componentDef, childKey, entityParam, elementKey);
        });
      }
      
      // Process events
      if (node.events) {
        node.events.forEach(event => {
          componentDef.events.push({
            element: elementKey,
            event: event.event,
            action: event.action,
            modifiers: event.modifiers || []
          });
        });
      }
      
      return elementKey;
    } else if (node.type === 'Literal') {
      // Handle literal text nodes in children
      // These would be text nodes that need to be created
      // For now, we'll skip them as they're not elements
      return null;
    }
    
    return null;
  }
}