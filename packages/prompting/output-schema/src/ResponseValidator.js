/**
 * ResponseValidator - Main class with dual functionality
 * 
 * 1. Generate format instructions from schema + example data
 * 2. Parse and validate LLM responses into structured data
 */

import { BaseValidator } from './BaseValidator.js';
import { FormatDetector } from './FormatDetector.js';
import { ResponseParser } from './ResponseParser.js';
import { InstructionGenerator } from './InstructionGenerator.js';
import { SchemaExtensions } from './SchemaExtensions.js';

export class ResponseValidator {
  /**
   * Create a response validator
   * @param {Object} schema - Extended JSON Schema
   * @param {Object} options - Validator options
   */
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      strictMode: false,
      preferredFormat: 'auto',
      autoRepair: true,
      partialResults: true,
      coerceTypes: true,
      ...options
    };

    // Validate schema structure
    this.validateSchema();

    // Initialize components
    this.baseValidator = new BaseValidator(schema, {
      coerceTypes: this.options.coerceTypes,
      strictMode: this.options.strictMode
    });

    this.formatDetector = new FormatDetector(
      schema, 
      this.baseValidator.getParsingConfig()
    );

    this.responseParser = new ResponseParser(schema, {
      strict: this.options.strictMode,
      autoRepair: this.options.autoRepair
    });
  }

  /**
   * Generate format instructions from schema and example data
   * @param {*} exampleData - Example data that matches the schema
   * @param {Object} options - Generation options
   * @returns {string} Generated prompt instructions
   */
  generateInstructions(exampleData, options = {}) {
    const instructionOptions = {
      format: this.options.preferredFormat === 'auto' ? 'json' : this.options.preferredFormat,
      verbosity: 'detailed',
      includeExample: !!exampleData,
      includeConstraints: true,
      includeDescriptions: true,
      errorPrevention: true,
      ...options
    };

    return InstructionGenerator.generateInstructions(
      this.schema, 
      exampleData, 
      instructionOptions
    );
  }

  /**
   * Process LLM response into structured data
   * @param {string} responseText - LLM response text
   * @returns {Object} Processing result {success, data?, errors?, format?, confidence?}
   */
  process(responseText) {
    // Input validation
    if (!responseText || typeof responseText !== 'string') {
      return {
        success: false,
        errors: [{
          type: 'parsing',
          message: 'Response is empty or invalid',
          field: null,
          suggestion: 'Ensure the LLM provided a response'
        }]
      };
    }

    // 1. Auto-detect format
    const detection = this.formatDetector.detect(responseText);
    
    if (detection.format === 'unknown') {
      return {
        success: false,
        errors: [{
          type: 'format',
          message: 'Could not determine response format',
          field: null,
          suggestion: 'Ensure the response follows one of the supported formats: JSON, XML, delimited sections, tagged content, or markdown'
        }],
        format: 'unknown',
        confidence: detection.confidence
      };
    }

    // 2. Parse using detected format
    const parseResult = this.responseParser.parse(responseText, detection.format);
    
    if (!parseResult.success) {
      return {
        success: false,
        errors: parseResult.errors,
        format: detection.format,
        confidence: detection.confidence
      };
    }

    // 3. Validate parsed data against schema
    const validationResult = this.baseValidator.validateData(parseResult.data);
    
    if (validationResult.success) {
      return {
        success: true,
        data: validationResult.data,
        format: detection.format,
        confidence: detection.confidence
      };
    } else {
      // Validation failed
      const result = {
        success: false,
        errors: validationResult.errors,
        format: detection.format,
        confidence: detection.confidence
      };

      // Include partial results if configured
      if (this.options.partialResults) {
        result.partialData = parseResult.data;
      }

      return result;
    }
  }

  /**
   * Validate the schema definition
   * @throws {Error} If schema is invalid
   */
  validateSchema() {
    SchemaExtensions.validateExtendedSchema(this.schema);
  }

  /**
   * Get supported formats for this schema
   * @returns {string[]} Array of supported format names
   */
  getSupportedFormats() {
    return this.baseValidator.getSupportedFormats();
  }

  /**
   * Update validator configuration
   * @param {Object} newOptions - New options to merge
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    
    // Update component configurations
    this.baseValidator = new BaseValidator(this.schema, {
      coerceTypes: this.options.coerceTypes,
      strictMode: this.options.strictMode
    });

    this.responseParser = new ResponseParser(this.schema, {
      strict: this.options.strictMode,
      autoRepair: this.options.autoRepair
    });
  }

  /**
   * Get format specifications for a specific format
   * @param {string} format - Format name
   * @returns {Object} Format specifications
   */
  getFormatSpecs(format) {
    return this.baseValidator.getFormatSpecs(format);
  }

  /**
   * Test if example data matches schema (for validation)
   * @param {*} exampleData - Example data to test
   * @returns {Object} Validation result
   */
  validateExample(exampleData) {
    return this.baseValidator.validateData(exampleData);
  }
}