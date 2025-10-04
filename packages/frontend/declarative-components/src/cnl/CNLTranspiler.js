/**
 * CNL to JSON Component Definition Transpiler
 * Converts CNL AST to JSON Component Definition format
 */

export class CNLTranspiler {
  constructor(options = {}) {
    this.elementCounter = 0;
    this.componentParameter = 'state'; // Default to state
  }

  /**
   * Transpile CNL AST to JSON Component Definition
   * @param {Object} ast - The CNL AST
   * @returns {Object} JSON Component Definition
   */
  transpile(ast) {
    if (ast.type !== 'Component') {
      throw new Error('Root node must be a Component');
    }
    
    // Reset element counter for each component
    this.elementCounter = 0;
    
    // Store the component parameter for use in bindings
    this.componentParameter = ast.parameter;
    
    // Initialize component definition
    const componentDef = {
      name: ast.name,
      entity: ast.parameter,
      structure: {},
      bindings: [],
      events: [],
      methods: {}
    };
    
    // Process the body statements
    if (ast.body && ast.body.length > 0) {
      // Process each top-level statement
      ast.body.forEach((statement, index) => {
        const elementKey = index === 0 ? 'root' : `root_sibling_${index}`;
        this.processNode(statement, componentDef, elementKey, null);
      });
    }
    
    return componentDef;
  }

  /**
   * Process an AST node and add to component definition
   */
  processNode(node, componentDef, elementKey, parentKey) {
    if (!node) return;
    
    switch (node.type) {
      case 'element':
        this.processElement(node, componentDef, elementKey, parentKey);
        break;

      case 'conditional':
        // For now, we'll create a wrapper div for conditionals
        // Future improvement: handle conditional rendering properly
        this.processConditional(node, componentDef, elementKey, parentKey);
        break;

      case 'iteration':
        // For now, we'll create a wrapper div for iterations
        // Future improvement: handle iteration properly
        this.processIteration(node, componentDef, elementKey, parentKey);
        break;

      case 'methods':
        // Process methods block
        this.processMethods(node, componentDef);
        break;

      case 'text':
        // Text nodes are handled as part of their parent element
        break;

      default:
        console.warn('Unknown node type:', node.type);
    }
  }

  /**
   * Process an element node
   */
  processElement(node, componentDef, elementKey, parentKey) {
    // Add element to structure
    const structureEntry = {
      element: node.tag
    };
    
    // Add parent if not root
    if (parentKey) {
      structureEntry.parent = parentKey;
    }
    
    // Add class if present
    if (node.className) {
      structureEntry.class = node.className;
    }
    
    // Add static text content if present
    if (node.content || node.text) {
      const textContent = node.content || node.text;
      // Remove quotes if they exist
      structureEntry.textContent = textContent.replace(/^["']|["']$/g, '');
    }
    
    // Add element to structure
    componentDef.structure[elementKey] = structureEntry;
    
    // Add binding if present
    if (node.binding) {
      let binding = node.binding;
      // Add component parameter prefix if not already present
      if (!binding.includes('.')) {
        binding = `${this.componentParameter}.${binding}`;
      }
      
      componentDef.bindings.push({
        source: binding,
        target: `${elementKey}.textContent`,
        transform: 'identity'
      });
    }
    
    // Add event if present
    if (node.event) {
      componentDef.events.push({
        element: elementKey,
        event: node.event.type,
        action: node.event.action,
        modifiers: []
      });
    }
    
    // Process children
    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const childKey = `${elementKey}_child_${index}`;
        this.processNode(child, componentDef, childKey, elementKey);
      });
    }
  }

  /**
   * Process a conditional node (simplified for now)
   */
  processConditional(node, componentDef, elementKey, parentKey) {
    // Create a wrapper div for the conditional
    componentDef.structure[elementKey] = {
      element: 'div',
      class: 'conditional-wrapper'
    };
    
    if (parentKey) {
      componentDef.structure[elementKey].parent = parentKey;
    }
    
    // Process children in the then branch
    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const childKey = `${elementKey}_then_${index}`;
        this.processNode(child, componentDef, childKey, elementKey);
      });
    }
    
    // Note: Conditional rendering logic would need to be handled by the runtime
  }

  /**
   * Process an iteration node (simplified for now)
   */
  processIteration(node, componentDef, elementKey, parentKey) {
    // Create a wrapper div for the iteration
    componentDef.structure[elementKey] = {
      element: 'div',
      class: 'iteration-wrapper'
    };
    
    if (parentKey) {
      componentDef.structure[elementKey].parent = parentKey;
    }
    
    // Process children as template
    if (node.children && node.children.length > 0) {
      node.children.forEach((child, index) => {
        const childKey = `${elementKey}_template_${index}`;
        this.processNode(child, componentDef, childKey, elementKey);
      });
    }
    
    // Note: Iteration logic would need to be handled by the runtime
  }

  /**
   * Process a methods node
   */
  processMethods(node, componentDef) {
    if (!node.methods || !Array.isArray(node.methods)) {
      return;
    }

    // Convert methods array to methods object
    node.methods.forEach(method => {
      const methodBody = method.body.map(stmt => stmt.code).join('\n      ');
      componentDef.methods[method.name] = `function() {\n      ${methodBody}\n    }`;
    });
  }
}

/**
 * Helper function to transpile CNL to JSON Component Definition
 */
export async function cnlToJSON(cnlText) {
  const { CNLParser } = await import('./CNLParser.js');
  const parser = new CNLParser();
  const ast = parser.parse(cnlText);
  
  const transpiler = new CNLTranspiler();
  return transpiler.transpile(ast);
}

/**
 * Legacy helper function to transpile CNL to DSL (for backward compatibility)
 * @deprecated Use cnlToJSON instead
 */
export async function cnlToDSL(cnlText) {
  // For backward compatibility, convert to JSON then to DSL
  const componentDef = await cnlToJSON(cnlText);
  
  // Convert JSON back to DSL format (simplified)
  const lines = [];
  lines.push(`${componentDef.name} :: ${componentDef.entity} =>`);
  
  // Find root element
  const rootKey = Object.keys(componentDef.structure).find(key => !componentDef.structure[key].parent);
  if (rootKey) {
    const root = componentDef.structure[rootKey];
    let dsl = `  ${root.element}`;
    if (root.class) {
      dsl += `.${root.class}`;
    }
    
    // Add events for root
    const rootEvents = componentDef.events.filter(e => e.element === rootKey);
    rootEvents.forEach(event => {
      dsl += ` @${event.event}="${event.action}"`;
    });
    
    // Add bindings or text
    const rootBindings = componentDef.bindings.filter(b => b.target.startsWith(rootKey));
    if (rootBindings.length > 0) {
      dsl += ` { ${rootBindings[0].source} }`;
    } else if (root.textContent) {
      dsl += ` { "${root.textContent}" }`;
    }
    
    // Simplified child handling
    const children = Object.keys(componentDef.structure).filter(key => 
      componentDef.structure[key].parent === rootKey
    );
    
    if (children.length > 0) {
      dsl += ' [';
      lines.push(dsl);
      
      children.forEach(childKey => {
        const child = componentDef.structure[childKey];
        let childDsl = `    ${child.element}`;
        if (child.class) {
          childDsl += `.${child.class}`;
        }
        
        // Add events
        const childEvents = componentDef.events.filter(e => e.element === childKey);
        childEvents.forEach(event => {
          childDsl += ` @${event.event}="${event.action}"`;
        });
        
        // Add bindings or text
        const childBindings = componentDef.bindings.filter(b => b.target.startsWith(childKey));
        if (childBindings.length > 0) {
          childDsl += ` { ${childBindings[0].source} }`;
        } else if (child.textContent) {
          childDsl += ` { "${child.textContent}" }`;
        }
        
        lines.push(childDsl);
      });
      
      lines.push('  ]');
    } else {
      lines.push(dsl);
    }
  }
  
  return lines.join('\n');
}