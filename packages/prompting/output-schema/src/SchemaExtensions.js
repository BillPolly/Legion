/**
 * SchemaExtensions - Utilities for working with extended JSON Schema
 * 
 * Provides validation and processing for x-format and x-parsing extensions
 */

export class SchemaExtensions {
  /**
   * Validate an extended JSON Schema
   * @param {Object} schema - Extended JSON Schema to validate
   * @throws {Error} If schema is invalid
   */
  static validateExtendedSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }

    // Must have basic JSON Schema structure
    if (!schema.type) {
      throw new Error('Schema must have a type property');
    }

    // Validate x-format if present
    if (schema['x-format']) {
      if (typeof schema['x-format'] !== 'object') {
        throw new Error('x-format must be an object');
      }
      
      this._validateFormatSpecs(schema['x-format']);
    }

    // Validate x-parsing if present
    if (schema['x-parsing']) {
      if (typeof schema['x-parsing'] !== 'object') {
        throw new Error('x-parsing must be an object');
      }
      
      this._validateParsingSpecs(schema['x-parsing']);
    }

    // Validate property-level x-format extensions
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propSchema['x-format']) {
          this._validateFormatSpecs(propSchema['x-format']);
        }
      }
    }
  }

  /**
   * Get format specifications for a specific format
   * @param {Object} schema - Extended JSON Schema
   * @param {string} format - Format name (json, xml, delimited, etc.)
   * @returns {Object} Format specifications
   */
  static getFormatSpecs(schema, format) {
    const globalSpecs = schema['x-format']?.[format] || {};
    
    // Collect property-level format specs
    const propertySpecs = {};
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propSchema['x-format']?.[format]) {
          propertySpecs[propName] = propSchema['x-format'][format];
        }
      }
    }

    // Merge global and property-level specs
    const result = { ...globalSpecs };
    if (Object.keys(propertySpecs).length > 0) {
      result.properties = { ...result.properties, ...propertySpecs };
    }

    return result;
  }

  /**
   * Generate format instructions for a schema
   * @param {Object} schema - Extended JSON Schema
   * @param {string} format - Target format
   * @returns {string} Generated instructions
   */
  static generateInstructions(schema, format) {
    const supportedFormats = ['json', 'xml', 'delimited', 'tagged', 'markdown'];
    
    if (!supportedFormats.includes(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }

    switch (format) {
      case 'json':
        return this._generateJSONInstructions(schema);
      case 'xml':
        return this._generateXMLInstructions(schema);
      case 'delimited':
        return this._generateDelimitedInstructions(schema);
      case 'tagged':
        return this._generateTaggedInstructions(schema);
      case 'markdown':
        return this._generateMarkdownInstructions(schema);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Merge global and property-level format options
   * @param {Object} global - Global format options
   * @param {Object} property - Property-level format options
   * @returns {Object} Merged options
   */
  static mergeFormatOptions(global, property) {
    if (!global && !property) return {};
    if (!global) return { ...property };
    if (!property) return { ...global };
    
    return { ...global, ...property };
  }

  /**
   * Validate format specifications
   * @private
   */
  static _validateFormatSpecs(formatSpecs) {
    const supportedFormats = ['json', 'xml', 'delimited', 'tagged', 'markdown'];
    
    for (const format of Object.keys(formatSpecs)) {
      if (!supportedFormats.includes(format)) {
        throw new Error(`Unsupported format in x-format: ${format}`);
      }
    }
  }

  /**
   * Validate parsing specifications
   * @private
   */
  static _validateParsingSpecs(parsingSpecs) {
    if (parsingSpecs['error-recovery']?.mode) {
      const validModes = ['strict', 'lenient', 'aggressive'];
      if (!validModes.includes(parsingSpecs['error-recovery'].mode)) {
        throw new Error(`Invalid error-recovery mode: ${parsingSpecs['error-recovery'].mode}`);
      }
    }

    if (parsingSpecs['format-detection']?.strategies) {
      const validStrategies = ['json', 'xml', 'delimited', 'tagged', 'markdown'];
      const strategies = parsingSpecs['format-detection'].strategies;
      
      for (const strategy of strategies) {
        if (!validStrategies.includes(strategy)) {
          throw new Error(`Invalid format detection strategy: ${strategy}`);
        }
      }
    }
  }

  /**
   * Generate JSON format instructions
   * @private
   */
  static _generateJSONInstructions(schema) {
    let instructions = 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid JSON matching this structure:\n\n';
    
    instructions += this._generateJSONStructure(schema);
    
    // Add constraints and requirements
    const constraints = this._extractConstraints(schema);
    if (constraints.length > 0) {
      instructions += '\n\nVALIDATION REQUIREMENTS:\n';
      constraints.forEach(constraint => {
        instructions += `- ${constraint}\n`;
      });
    }

    return instructions;
  }

  /**
   * Generate XML format instructions
   * @private
   */
  static _generateXMLInstructions(schema) {
    const formatSpecs = this.getFormatSpecs(schema, 'xml');
    const rootElement = formatSpecs['root-element'] || 'response';
    
    let instructions = `RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid XML with root element <${rootElement}>:\n\n`;
    
    instructions += this._generateXMLStructure(schema, formatSpecs);
    
    return instructions;
  }

  /**
   * Generate other format instructions (simplified for now)
   * @private
   */
  static _generateDelimitedInstructions(schema) {
    return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using delimited sections:\n\n---FIELD---\nvalue\n---END-FIELD---';
  }

  static _generateTaggedInstructions(schema) {
    return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using XML-style tags:\n\n<FIELD>value</FIELD>';
  }

  static _generateMarkdownInstructions(schema) {
    return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as structured markdown:\n\n## Field\nvalue';
  }

  /**
   * Generate JSON structure representation
   * @private
   */
  static _generateJSONStructure(schema) {
    if (schema.type === 'object') {
      let structure = '{\n';
      
      if (schema.properties) {
        const props = Object.entries(schema.properties);
        props.forEach(([name, propSchema], index) => {
          const isRequired = schema.required?.includes(name);
          structure += `  "${name}": ${this._getTypeHint(propSchema)}`;
          
          if (propSchema.description) {
            structure += ` // ${propSchema.description}`;
          } else if (!isRequired) {
            structure += ' // optional';
          }
          
          if (index < props.length - 1) structure += ',';
          structure += '\n';
        });
      }
      
      structure += '}';
      return structure;
    }
    
    return this._getTypeHint(schema);
  }

  /**
   * Generate XML structure representation
   * @private
   */
  static _generateXMLStructure(schema, formatSpecs) {
    const rootElement = formatSpecs['root-element'] || 'response';
    let structure = `<${rootElement}>\n`;
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const propSpecs = formatSpecs.properties?.[name] || {};
        const elementName = propSpecs.element || name;
        
        structure += `  <${elementName}>${this._getTypeHint(propSchema)}</${elementName}>\n`;
      }
    }
    
    structure += `</${rootElement}>`;
    return structure;
  }

  /**
   * Get type hint for schema property
   * @private
   */
  static _getTypeHint(propSchema) {
    switch (propSchema.type) {
      case 'string':
        return '<string>';
      case 'number':
        if (propSchema.minimum !== undefined && propSchema.maximum !== undefined) {
          return `<number: ${propSchema.minimum}-${propSchema.maximum}>`;
        }
        return '<number>';
      case 'boolean':
        return '<boolean>';
      case 'array':
        return `[${this._getTypeHint(propSchema.items || { type: 'any' })}, ...]`;
      case 'object':
        return '<object>';
      default:
        return '<value>';
    }
  }

  /**
   * Extract constraint information from schema
   * @private
   */
  static _extractConstraints(schema) {
    const constraints = [];
    
    // Required fields
    if (schema.required?.length > 0) {
      constraints.push(`Required fields: ${schema.required.join(', ')}`);
    }
    
    // Return ONLY valid JSON
    constraints.push('Return ONLY valid JSON, no additional text or markdown');
    
    // Property-specific constraints
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.minimum !== undefined || propSchema.maximum !== undefined) {
          constraints.push(`${name} must be between ${propSchema.minimum || 'any'} and ${propSchema.maximum || 'any'}`);
        }
        if (propSchema.maxItems !== undefined) {
          constraints.push(`${name} array cannot exceed ${propSchema.maxItems} items`);
        }
      }
    }
    
    return constraints;
  }
}