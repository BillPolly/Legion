/**
 * InstructionGenerator - Generate intelligent prompt instructions
 * 
 * Combines schema analysis with example data to generate optimal
 * format instructions for LLM prompts
 */

import { SchemaAnalyzer } from './SchemaAnalyzer.js';

export class InstructionGenerator {
  /**
   * Generate prompt instructions from schema and example
   * @param {Object} schema - Extended JSON Schema
   * @param {*} exampleData - Example data that matches the schema
   * @param {Object} options - Generation options
   * @returns {string} Generated prompt instructions
   */
  static generateInstructions(schema, exampleData, options = {}) {
    const opts = {
      format: 'json',
      verbosity: 'detailed',
      includeExample: true,
      includeConstraints: true,
      includeDescriptions: true,
      errorPrevention: true,
      ...options
    };

    // Analyze schema
    const analysis = SchemaAnalyzer.analyzeSchema(schema);
    
    // Generate format-specific instructions
    let instructions = this._generateFormatHeader(opts.format);
    instructions += this._generateStructureExample(schema, exampleData, opts);
    
    if (opts.includeExample && exampleData) {
      instructions += this._generateExampleSection(exampleData, opts.format);
    }
    
    if (opts.includeConstraints) {
      instructions += this._generateConstraintsSection(analysis.validationRules);
    }
    
    if (opts.errorPrevention) {
      instructions += this._generateErrorPreventionSection(opts.format);
    }

    return instructions;
  }

  /**
   * Generate format header
   * @private
   */
  static _generateFormatHeader(format) {
    switch (format) {
      case 'json':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid JSON matching this exact structure:\n\n';
      case 'xml':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid XML with this exact structure:\n\n';
      case 'delimited':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using delimited sections with this exact format:\n\n';
      case 'tagged':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using XML-style tags with this exact format:\n\n';
      case 'markdown':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as structured markdown with this exact format:\n\n';
      case 'yaml':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid YAML with this exact structure:\n\n';
      default:
        return 'RESPONSE FORMAT REQUIRED:\n\n';
    }
  }

  /**
   * Generate structure example
   * @private
   */
  static _generateStructureExample(schema, exampleData, options) {
    switch (options.format) {
      case 'json':
        return this._generateJSONStructure(schema, exampleData, options);
      case 'xml':
        return this._generateXMLStructure(schema, exampleData, options);
      case 'delimited':
        return this._generateDelimitedStructure(schema, exampleData, options);
      case 'tagged':
        return this._generateTaggedStructure(schema, exampleData, options);
      case 'markdown':
        return this._generateMarkdownStructure(schema, exampleData, options);
      case 'yaml':
        return this._generateYAMLStructure(schema, exampleData, options);
      default:
        return '';
    }
  }

  /**
   * Generate JSON structure example
   * @private
   */
  static _generateJSONStructure(schema, exampleData, options) {
    let structure = '{\n';
    
    if (schema.properties) {
      const props = Object.entries(schema.properties);
      props.forEach(([name, propSchema], index) => {
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        const isRequired = schema.required?.includes(name);
        
        structure += `  "${name}": ${typeHint}`;
        
        if (propSchema.description) {
          structure += ` // ${propSchema.description}`;
        } else if (!isRequired) {
          structure += ' // optional';
        }
        
        if (index < props.length - 1) structure += ',';
        structure += '\n';
      });
    }
    
    structure += '}\n\n';
    return structure;
  }

  /**
   * Generate example section in target format
   * @private
   */
  static _generateExampleSection(exampleData, format = 'json') {
    if (!exampleData) return '';
    
    let exampleOutput = '';
    
    switch (format) {
      case 'json':
        exampleOutput = JSON.stringify(exampleData, null, 2);
        break;
      case 'xml':
        exampleOutput = this._convertDataToXML(exampleData);
        break;
      case 'delimited':
        exampleOutput = this._convertDataToDelimited(exampleData);
        break;
      case 'tagged':
        exampleOutput = this._convertDataToTagged(exampleData);
        break;
      case 'markdown':
        exampleOutput = this._convertDataToMarkdown(exampleData);
        break;
      case 'yaml':
        exampleOutput = this._convertDataToYAML(exampleData);
        break;
      default:
        exampleOutput = JSON.stringify(exampleData, null, 2);
    }
    
    return `EXAMPLE OUTPUT:\n${exampleOutput}\n\n`;
  }

  /**
   * Generate constraints section
   * @private
   */
  static _generateConstraintsSection(validationRules) {
    if (validationRules.length === 0) return '';
    
    let section = 'VALIDATION REQUIREMENTS:\n';
    validationRules.forEach(rule => {
      section += `- ${rule}\n`;
    });
    section += '\n';
    
    return section;
  }

  /**
   * Generate error prevention section
   * @private
   */
  static _generateErrorPreventionSection(format) {
    const commonErrors = {
      json: [
        'Return ONLY valid JSON, no additional text or markdown',
        'Use double quotes for all string keys and values',
        'No trailing commas in JSON',
        'Do NOT include any explanatory text before or after the JSON',
        'Do NOT wrap the JSON in code blocks or markdown'
      ],
      xml: [
        'Return ONLY valid XML, no additional text',
        'Ensure all opening tags have matching closing tags',
        'Use proper XML syntax with < and > characters',
        'Close self-closing tags with />',
        'Do NOT include any explanatory text before or after the XML'
      ],
      delimited: [
        'Return ONLY the delimited sections as shown',
        'Use exact delimiter format (three dashes followed by section name)',
        'Include all required sections',
        'Keep section content between delimiters',
        'Do NOT include any explanatory text before or after the sections',
        'Do NOT add any commentary or descriptions',
        'Start immediately with the first delimiter'
      ]
    };

    const errors = commonErrors[format] || [];
    if (errors.length === 0) return '';

    let section = '\nCRITICAL REQUIREMENTS:\n';
    errors.forEach(error => {
      section += `- ${error}\n`;
    });
    
    // Add final emphatic instruction
    section += '\n**FINAL INSTRUCTION**: ';
    switch (format) {
      case 'json':
        section += 'Your response must be ONLY valid JSON. No other text.\n';
        break;
      case 'xml':
        section += 'Your response must be ONLY valid XML. No other text.\n';
        break;
      case 'delimited':
        section += 'Your response must start with the first delimiter (---) and contain ONLY the delimited sections. No introductory or explanatory text.\n';
        break;
      default:
        section += `Your response must be ONLY in ${format} format. No other text.\n`;
    }
    section += '\n';

    return section;
  }

  /**
   * Generate XML structure example
   * @private
   */
  static _generateXMLStructure(schema, exampleData, options) {
    const rootElement = schema['x-format']?.xml?.['root-element'] || 'response';
    let structure = `<${rootElement}>\n`;
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        structure += `  <${name}>${typeHint}</${name}>\n`;
      }
    }
    
    structure += `</${rootElement}>\n\n`;
    return structure;
  }

  /**
   * Generate delimited structure example
   * @private
   */
  static _generateDelimitedStructure(schema, exampleData, options) {
    let structure = '';
    
    if (schema.properties) {
      const props = Object.entries(schema.properties);
      props.forEach(([name, propSchema], index) => {
        const upperName = name.toUpperCase();
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        structure += `---${upperName}---\n${typeHint}\n---END-${upperName}---\n`;
        if (index < props.length - 1) structure += '\n';
      });
    }
    
    return structure + '\n\n';
  }

  /**
   * Generate tagged structure example
   * @private
   */
  static _generateTaggedStructure(schema, exampleData, options) {
    let structure = '';
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const upperName = name.toUpperCase();
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        structure += `<${upperName}>${typeHint}</${upperName}>\n`;
      }
    }
    
    return structure + '\n';
  }

  /**
   * Generate markdown structure example
   * @private
   */
  static _generateMarkdownStructure(schema, exampleData, options) {
    let structure = '';
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        structure += `## ${title}\n${typeHint}\n\n`;
      }
    }
    
    return structure;
  }

  /**
   * Generate YAML structure example
   * @private
   */
  static _generateYAMLStructure(schema, exampleData, options) {
    let structure = '';
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        const typeHint = SchemaAnalyzer.generateTypeHint(propSchema);
        
        if (propSchema.type === 'array') {
          structure += `${name}:\n  - ${typeHint}\n`;
        } else if (propSchema.type === 'object') {
          structure += `${name}:\n  key: ${typeHint}\n`;
        } else {
          structure += `${name}: ${typeHint}\n`;
        }
      }
    }
    
    return structure + '\n';
  }

  /**
   * Convert example data to XML format
   * @private
   */
  static _convertDataToXML(data, rootElement = 'response') {
    let xml = `<${rootElement}>\n`;
    
    for (const [key, value] of Object.entries(data)) {
      xml += `  <${key}>`;
      
      if (Array.isArray(value)) {
        xml += '\n';
        value.forEach(item => {
          xml += `    <item>${this._escapeXML(String(item))}</item>\n`;
        });
        xml += `  `;
      } else if (typeof value === 'object' && value !== null) {
        xml += '\n';
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          xml += `    <${nestedKey}>${this._escapeXML(String(nestedValue))}</${nestedKey}>\n`;
        }
        xml += `  `;
      } else {
        xml += this._escapeXML(String(value));
      }
      
      xml += `</${key}>\n`;
    }
    
    xml += `</${rootElement}>`;
    return xml;
  }

  /**
   * Convert example data to delimited format
   * @private
   */
  static _convertDataToDelimited(data) {
    let delimited = '';
    
    for (const [key, value] of Object.entries(data)) {
      const upperKey = key.toUpperCase();
      delimited += `---${upperKey}---\n`;
      
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          delimited += `${index + 1}. ${item}\n`;
        });
      } else if (typeof value === 'object' && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          delimited += `${nestedKey}: ${nestedValue}\n`;
        }
      } else {
        delimited += `${value}\n`;
      }
      
      delimited += `---END-${upperKey}---\n\n`;
    }
    
    return delimited.trim();
  }

  /**
   * Convert example data to tagged format
   * @private
   */
  static _convertDataToTagged(data) {
    let tagged = '';
    
    for (const [key, value] of Object.entries(data)) {
      const upperKey = key.toUpperCase();
      
      if (Array.isArray(value)) {
        value.forEach(item => {
          tagged += `<${upperKey}>${this._escapeXML(String(item))}</${upperKey}>\n`;
        });
      } else {
        tagged += `<${upperKey}>${this._escapeXML(String(value))}</${upperKey}>\n`;
      }
    }
    
    return tagged;
  }

  /**
   * Convert example data to markdown format
   * @private
   */
  static _convertDataToMarkdown(data) {
    let markdown = '';
    
    for (const [key, value] of Object.entries(data)) {
      const title = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      markdown += `## ${title}\n`;
      
      if (Array.isArray(value)) {
        value.forEach(item => {
          markdown += `- ${item}\n`;
        });
      } else if (typeof value === 'object' && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          markdown += `- **${nestedKey}**: ${nestedValue}\n`;
        }
      } else {
        markdown += `${value}\n`;
      }
      
      markdown += '\n';
    }
    
    return markdown;
  }

  /**
   * Convert example data to YAML format
   * @private
   */
  static _convertDataToYAML(data) {
    let yaml = '';
    
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        yaml += `${key}:\n`;
        value.forEach(item => {
          yaml += `  - ${item}\n`;
        });
      } else if (typeof value === 'object' && value !== null) {
        yaml += `${key}:\n`;
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          yaml += `  ${nestedKey}: ${nestedValue}\n`;
        }
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }

  /**
   * Escape XML special characters
   * @private
   */
  static _escapeXML(text) {
    return text.replace(/[&<>"']/g, function (match) {
      switch (match) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        default: return match;
      }
    });
  }
}