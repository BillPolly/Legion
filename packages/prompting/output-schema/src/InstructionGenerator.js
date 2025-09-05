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
      instructions += this._generateExampleSection(exampleData);
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
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid JSON matching this structure:\n\n';
      case 'xml':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as valid XML structure:\n\n';
      case 'delimited':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using delimited sections:\n\n';
      case 'tagged':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response using tagged content:\n\n';
      case 'markdown':
        return 'RESPONSE FORMAT REQUIRED:\n\nReturn your response as structured markdown:\n\n';
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
   * Generate example section
   * @private
   */
  static _generateExampleSection(exampleData) {
    return `EXAMPLE OUTPUT:\n${JSON.stringify(exampleData, null, 2)}\n\n`;
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
        'No trailing commas in JSON'
      ],
      xml: [
        'Ensure all opening tags have matching closing tags',
        'Use proper XML syntax with < and > characters',
        'Close self-closing tags with />'
      ],
      delimited: [
        'Use exact delimiter format as shown',
        'Include all required sections',
        'Keep section content between delimiters'
      ]
    };

    const errors = commonErrors[format] || [];
    if (errors.length === 0) return '';

    let section = 'IMPORTANT:\n';
    errors.forEach(error => {
      section += `- ${error}\n`;
    });
    section += '\n';

    return section;
  }

  // Simplified implementations for other formats (MVP)
  static _generateXMLStructure(schema, exampleData, options) {
    const rootElement = schema['x-format']?.xml?.['root-element'] || 'response';
    return `<${rootElement}>...</${rootElement}>\n\n`;
  }

  static _generateDelimitedStructure(schema, exampleData, options) {
    return '---FIELD---\nvalue\n---END-FIELD---\n\n';
  }

  static _generateTaggedStructure(schema, exampleData, options) {
    return '<FIELD>value</FIELD>\n\n';
  }

  static _generateMarkdownStructure(schema, exampleData, options) {
    return '## Field\nvalue\n\n';
  }
}