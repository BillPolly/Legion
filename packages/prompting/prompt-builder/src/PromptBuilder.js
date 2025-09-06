/**
 * PromptBuilder - Intelligent template processing with labeled inputs
 * 
 * Main class that coordinates template processing, content handling, 
 * and size management for optimal prompt generation
 */

import { TemplateProcessor } from './TemplateProcessor.js';
import { ContentHandlerRegistry } from './ContentHandlers.js';
import { SizeManager } from './SizeManager.js';
import { ContextManager } from './ContextManager.js';

export class PromptBuilder {
  /**
   * Create a prompt builder with template and configuration
   * @param {Object} configuration - Builder configuration
   */
  constructor(configuration) {
    if (!configuration || typeof configuration !== 'object') {
      throw new Error('Configuration is required');
    }

    if (configuration.template === null || configuration.template === undefined) {
      throw new Error('Template is required in configuration');
    }
    
    if (typeof configuration.template !== 'string' || configuration.template.trim().length === 0) {
      throw new Error('Template must be a non-empty string');
    }

    this.template = configuration.template;
    
    // Default configuration
    this.maxTokens = configuration.maxTokens || 4000;
    this.reserveTokens = configuration.reserveTokens || 500;
    this.contentHandlers = configuration.contentHandlers || {};
    this.contextVariables = configuration.contextVariables || {
      enabled: true,
      maxVariables: 10,
      namingStrategy: 'descriptive'
    };

    // Create template processor
    this.templateProcessor = new TemplateProcessor(this.template);
    
    // Create content processing systems
    this.contentRegistry = new ContentHandlerRegistry();
    this.sizeManager = new SizeManager(this.maxTokens, this.reserveTokens);
    this.contextManager = new ContextManager(this.contextVariables);
    
    // Validate template on construction
    this.validateTemplate();
    
    // Extract placeholders for validation
    this.placeholders = this.templateProcessor.extractPlaceholders();
  }

  /**
   * Build optimized prompt from labeled inputs
   * @param {Object} labeledInputs - Values for template placeholders
   * @param {Object} options - Build options
   * @returns {string} Generated prompt
   */
  build(labeledInputs = {}, options = {}) {
    // Input validation
    if (labeledInputs === null || labeledInputs === undefined) {
      labeledInputs = {};
    }

    if (typeof labeledInputs !== 'object' || Array.isArray(labeledInputs)) {
      throw new Error('Labeled inputs must be an object');
    }

    // Process content intelligently
    const processedInputs = this._processContentWithHandlers(labeledInputs, options);
    
    // Handle context variables
    const contextSection = this._processContextVariables(labeledInputs);
    
    // Apply template processing
    let prompt = this.templateProcessor.substituteBasic(processedInputs);
    
    // Add context variables section if present
    if (contextSection) {
      prompt = contextSection + prompt;
    }
    
    // Apply size constraints
    prompt = this._applySizeConstraints(prompt, options);
    
    return prompt;
  }

  /**
   * Process labeled inputs with appropriate content handlers
   * @private
   */
  _processContentWithHandlers(labeledInputs, options) {
    const processed = { ...labeledInputs }; // Start with all original values
    
    for (const [key, value] of Object.entries(labeledInputs)) {
      // Skip context variables (handled separately)
      if (key.startsWith('@') || this._isContextVariable(key)) {
        continue;
      }

      // Get content handler configuration for this key
      const handlerConfig = this.contentHandlers[key] || {};
      
      // Find appropriate content handler
      const handler = this.contentRegistry.findHandler(value, handlerConfig);
      
      if (handler) {
        processed[key] = handler.process(value, handlerConfig);
      } else {
        // Use basic processing if no specific handler
        processed[key] = this._basicProcess(value);
      }
    }
    
    return processed;
  }

  /**
   * Process context variables from labeled inputs
   * @private
   */
  _processContextVariables(labeledInputs) {
    this.contextManager.clear();
    
    // Extract context variables from labeled inputs
    for (const [key, value] of Object.entries(labeledInputs)) {
      if (this._isContextVariable(key)) {
        const varName = key.replace(/^@?/, ''); // Remove @ prefix if present
        this.contextManager.declareVariable(varName, value);
      }
    }
    
    return this.contextManager.formatVariables();
  }

  /**
   * Apply size constraints to final prompt
   * @private
   */
  _applySizeConstraints(prompt, options) {
    const currentSize = this.sizeManager.estimateTokens(prompt);
    
    if (currentSize <= this.sizeManager.availableTokens) {
      return prompt; // Fits within limits
    }
    
    // For MVP, basic truncation (advanced optimization in future phases)
    const maxChars = this.sizeManager.availableTokens * 4; // Rough conversion
    if (prompt.length > maxChars) {
      return prompt.substring(0, maxChars - 100) + '\n\n[Content truncated to fit size limits]';
    }
    
    return prompt;
  }

  /**
   * Check if key represents a context variable
   * @private
   */
  _isContextVariable(key) {
    return key.includes('@') || 
           this.placeholders.some(p => p.startsWith('@') && p.includes(':' + key));
  }

  /**
   * Basic content processing fallback
   * @private
   */
  _basicProcess(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    } else {
      return String(value);
    }
  }

  /**
   * Validate the configured template
   * @throws {Error} If template is invalid
   */
  validateTemplate() {
    this.templateProcessor.validateTemplate();
  }

  /**
   * Get placeholders from configured template
   * @returns {string[]} Array of placeholder names
   */
  getPlaceholders() {
    return this.placeholders;
  }

  /**
   * Analyze template complexity
   * @returns {Object} Complexity analysis
   */
  analyzeComplexity() {
    return this.templateProcessor.analyzeComplexity();
  }

  /**
   * Update configuration (template cannot be changed)
   * @param {Object} newConfiguration - Configuration updates
   */
  updateConfiguration(newConfiguration) {
    if (newConfiguration.template !== undefined) {
      throw new Error('Template cannot be changed after construction');
    }

    if (newConfiguration.maxTokens !== undefined) {
      if (typeof newConfiguration.maxTokens !== 'number' || newConfiguration.maxTokens <= 0) {
        throw new Error('maxTokens must be a positive number');
      }
      this.maxTokens = newConfiguration.maxTokens;
    }

    if (newConfiguration.reserveTokens !== undefined) {
      if (typeof newConfiguration.reserveTokens !== 'number' || newConfiguration.reserveTokens < 0) {
        throw new Error('reserveTokens must be a non-negative number');
      }
      this.reserveTokens = newConfiguration.reserveTokens;
    }

    if (newConfiguration.contentHandlers !== undefined) {
      this.contentHandlers = { ...this.contentHandlers, ...newConfiguration.contentHandlers };
    }

    if (newConfiguration.contextVariables !== undefined) {
      this.contextVariables = { ...this.contextVariables, ...newConfiguration.contextVariables };
    }
  }

  /**
   * Get available content handlers
   * @returns {Object} Content handler configurations
   */
  getContentHandlers() {
    return { ...this.contentHandlers };
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration (excluding template)
   */
  getConfiguration() {
    return {
      maxTokens: this.maxTokens,
      reserveTokens: this.reserveTokens,
      contentHandlers: { ...this.contentHandlers },
      contextVariables: { ...this.contextVariables }
    };
  }
}