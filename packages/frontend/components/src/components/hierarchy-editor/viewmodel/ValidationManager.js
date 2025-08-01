/**
 * ValidationManager - Handles validation operations
 */

export class ValidationManager {
  constructor(viewModel) {
    this.viewModel = viewModel;
    this.model = viewModel.model;
    this.view = viewModel.view;
  }

  /**
   * Validate source content
   */
  validateSource(source, format) {
    if (!source || typeof source !== 'string') {
      return {
        valid: false,
        errors: ['Source must be a non-empty string']
      };
    }

    try {
      switch (format) {
        case 'json':
          return this.validateJSON(source);
        case 'xml':
          return this.validateXML(source);
        case 'yaml':
          return this.validateYAML(source);
        case 'markdown':
          return this.validateMarkdown(source);
        default:
          return {
            valid: false,
            errors: [`Unknown format: ${format}`]
          };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate JSON content
   */
  validateJSON(source) {
    try {
      JSON.parse(source);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${error.message}`]
      };
    }
  }

  /**
   * Validate XML content
   */
  validateXML(source) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(source, 'text/xml');
      
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        return {
          valid: false,
          errors: [`Invalid XML: ${parseError.textContent}`]
        };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`XML validation error: ${error.message}`]
      };
    }
  }

  /**
   * Validate YAML content (basic validation)
   */
  validateYAML(source) {
    // TODO: Implement proper YAML validation
    // For now, just check for basic syntax issues
    const lines = source.split('\n');
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Check for invalid indentation (tabs mixed with spaces)
      if (line.includes('\t') && line.match(/^ +/)) {
        errors.push(`Line ${lineNum}: Mixed tabs and spaces in indentation`);
      }
      
      // Check for invalid key-value syntax
      if (line.includes(':') && !line.match(/^\s*[^:]+:\s*.*$/)) {
        errors.push(`Line ${lineNum}: Invalid key-value syntax`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Markdown content
   */
  validateMarkdown(source) {
    // Markdown is generally permissive, so we'll do basic checks
    const errors = [];
    
    // Check for unclosed code blocks
    const codeBlockMatches = source.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      errors.push('Unclosed code block (```)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate node value for specific type
   */
  validateNodeValue(value, nodeType) {
    switch (nodeType) {
      case 'value':
        return this.validatePrimitiveValue(value);
      case 'array':
        return { valid: true, errors: [] }; // Arrays don't have direct values
      case 'object':
        return { valid: true, errors: [] }; // Objects don't have direct values
      default:
        return {
          valid: false,
          errors: [`Unknown node type: ${nodeType}`]
        };
    }
  }

  /**
   * Validate primitive value
   */
  validatePrimitiveValue(value) {
    // Most primitive values are valid
    // Could add specific validation rules here
    return { valid: true, errors: [] };
  }

  /**
   * Validate node name
   */
  validateNodeName(name, parentNode) {
    const errors = [];
    
    if (!name || typeof name !== 'string') {
      errors.push('Node name must be a non-empty string');
    }
    
    if (name.trim() !== name) {
      errors.push('Node name cannot have leading or trailing whitespace');
    }
    
    if (parentNode && parentNode.children) {
      const siblings = parentNode.children.filter(child => child.name === name);
      if (siblings.length > 1) {
        errors.push('Duplicate node name in same parent');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate entire hierarchy
   */
  validateHierarchy(rootNode) {
    const errors = [];
    
    const validateNode = (node, path = []) => {
      const currentPath = [...path, node.name || 'root'];
      
      // Validate node structure
      if (!node.id) {
        errors.push(`Node at ${currentPath.join('.')} missing ID`);
      }
      
      if (!node.type) {
        errors.push(`Node at ${currentPath.join('.')} missing type`);
      }
      
      // Validate children
      if (node.children) {
        if (!Array.isArray(node.children)) {
          errors.push(`Node at ${currentPath.join('.')} children must be array`);
        } else {
          node.children.forEach(child => {
            if (child.parent !== node) {
              errors.push(`Child at ${currentPath.join('.')}.${child.name} has incorrect parent reference`);
            }
            validateNode(child, currentPath);
          });
        }
      }
    };
    
    if (rootNode) {
      validateNode(rootNode);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get validation summary
   */
  getValidationSummary() {
    const sourceValidation = this.model.validate();
    const hierarchyValidation = this.validateHierarchy(this.model.root);
    
    return {
      source: sourceValidation,
      hierarchy: hierarchyValidation,
      overall: {
        valid: sourceValidation.valid && hierarchyValidation.valid,
        errors: [...sourceValidation.errors, ...hierarchyValidation.errors]
      }
    };
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    // No cleanup needed
  }
}