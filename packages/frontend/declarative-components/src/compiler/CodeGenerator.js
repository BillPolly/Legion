/**
 * Code Generator for the Declarative Components DSL
 * Converts AST into executable component code
 */

export class CodeGenerator {
  constructor() {
    this.elementCounter = 0;
  }

  /**
   * Generate a component definition from AST
   * @param {Object} ast - Abstract syntax tree
   * @returns {Object} Component definition with structure, bindings, and events
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
      events: []
    };
    
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
        attributes: node.attributes || {}
      };
      
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