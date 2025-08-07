/**
 * TemplateStrategy - Template-based BT generation strategy
 * 
 * Uses predefined BT templates that match goal patterns.
 * Templates define complete BT structures with parameter substitution.
 */

import { PlanningStrategy } from './PlanningStrategy.js';

export class TemplateStrategy extends PlanningStrategy {
  constructor(templates = {}, options = {}) {
    super(options);
    this.templates = new Map();
    this.caseSensitive = options.caseSensitive || false;
    
    // Register initial templates
    Object.entries(templates).forEach(([pattern, template]) => {
      this.addTemplate(pattern, template);
    });
  }

  /**
   * Add a BT template
   * @param {string} pattern - Goal pattern to match (keywords)
   * @param {Object|Function} template - BT template or function returning BT
   */
  addTemplate(pattern, template) {
    const key = this.caseSensitive ? pattern : pattern.toLowerCase();
    this.templates.set(key, {
      pattern: pattern,
      template: template,
      addedAt: new Date().toISOString()
    });
    
    this.debug(`Added template for pattern: ${pattern}`);
  }

  /**
   * Remove a template
   * @param {string} pattern - Pattern to remove
   */
  removeTemplate(pattern) {
    const key = this.caseSensitive ? pattern : pattern.toLowerCase();
    const removed = this.templates.delete(key);
    
    if (removed) {
      this.debug(`Removed template for pattern: ${pattern}`);
    }
    
    return removed;
  }

  /**
   * List all templates
   * @returns {Array} Template information
   */
  listTemplates() {
    return Array.from(this.templates.entries()).map(([key, info]) => ({
      pattern: info.pattern,
      addedAt: info.addedAt,
      isFunction: typeof info.template === 'function'
    }));
  }

  /**
   * Generate BT using template matching
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Generated BT structure
   */
  async generateBT(request, context = {}) {
    this.debug(`Finding template for: ${request.description}`);
    
    // Find matching template
    const matchedTemplate = this.findMatchingTemplate(request.description);
    
    if (!matchedTemplate) {
      throw new Error(`No template found for goal: ${request.description}`);
    }
    
    this.debug(`Using template for pattern: ${matchedTemplate.pattern}`);
    
    // Generate BT from template
    const bt = await this.generateBTFromTemplate(matchedTemplate.template, request, context);
    
    // Validate all required tools are available
    this.validateToolsAvailable(bt, request.allowableActions);
    
    return this.applyBTDefaults(bt);
  }

  /**
   * Find template matching the goal description
   * @param {string} description - Goal description
   * @returns {Object|null} Matching template info
   */
  findMatchingTemplate(description) {
    const searchText = this.caseSensitive ? description : description.toLowerCase();
    
    // Try exact matches first
    for (const [key, templateInfo] of this.templates) {
      if (searchText.includes(key)) {
        return templateInfo;
      }
    }
    
    // Try word-based matching
    const words = searchText.split(/\s+/);
    for (const [key, templateInfo] of this.templates) {
      const patternWords = key.split(/\s+/);
      const matchCount = patternWords.filter(word => words.includes(word)).length;
      
      // Require at least half of pattern words to match
      if (matchCount >= Math.ceil(patternWords.length / 2)) {
        return templateInfo;
      }
    }
    
    return null;
  }

  /**
   * Generate BT from template
   * @param {Object|Function} template - Template definition
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Promise<Object>} Generated BT
   */
  async generateBTFromTemplate(template, request, context) {
    if (typeof template === 'function') {
      // Dynamic template - call function
      return await template(request, context, this);
    }
    
    // Static template - clone and substitute parameters
    const bt = JSON.parse(JSON.stringify(template));
    return this.substituteTemplateParameters(bt, request, context);
  }

  /**
   * Substitute template parameters
   * @param {Object} bt - BT template structure
   * @param {PlanningRequest} request - Planning request
   * @param {Object} context - Generation context
   * @returns {Object} BT with substituted parameters
   */
  substituteTemplateParameters(bt, request, context) {
    const substitutionMap = {
      '{{goal}}': request.description,
      '{{inputs}}': request.inputs,
      '{{outputs}}': request.requiredOutputs,
      '{{maxSteps}}': request.maxSteps,
      '{{initialData}}': request.initialInputData,
      ...context // Allow context to override
    };
    
    return this.deepSubstitute(bt, substitutionMap);
  }

  /**
   * Deep substitute template variables
   * @param {any} obj - Object to process
   * @param {Object} substitutionMap - Variable substitutions
   * @returns {any} Processed object
   */
  deepSubstitute(obj, substitutionMap) {
    if (typeof obj === 'string') {
      // String substitution
      let result = obj;
      for (const [key, value] of Object.entries(substitutionMap)) {
        const stringValue = Array.isArray(value) ? value.join(', ') : String(value);
        result = result.replace(new RegExp(this.escapeRegex(key), 'g'), stringValue);
      }
      return result;
    }
    
    if (Array.isArray(obj)) {
      // Array substitution
      return obj.map(item => this.deepSubstitute(item, substitutionMap));
    }
    
    if (obj && typeof obj === 'object') {
      // Object substitution
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = this.deepSubstitute(key, substitutionMap);
        result[newKey] = this.deepSubstitute(value, substitutionMap);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Escape string for regex
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&');
  }

  /**
   * Validate all required tools are available
   * @param {Object} bt - BT structure
   * @param {Array} allowableActions - Available actions
   */
  validateToolsAvailable(bt, allowableActions) {
    const availableTools = new Set(allowableActions.map(a => a.type || a.toolName || a.name));
    const requiredTools = new Set();
    
    this.collectRequiredTools(bt, requiredTools);
    
    for (const tool of requiredTools) {
      if (!availableTools.has(tool)) {
        throw new Error(`Template requires tool '${tool}' which is not in allowable actions`);
      }
    }
  }

  /**
   * Collect all required tools from BT structure
   * @param {Object} node - BT node
   * @param {Set} requiredTools - Set to collect tools
   */
  collectRequiredTools(node, requiredTools) {
    if (node.type === 'action' && node.tool) {
      requiredTools.add(node.tool);
    }
    
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.collectRequiredTools(child, requiredTools);
      }
    }
    
    if (node.child) {
      this.collectRequiredTools(node.child, requiredTools);
    }
  }

  /**
   * Check if strategy can handle request
   * @param {PlanningRequest} request - Planning request
   * @returns {boolean} True if template exists for request
   */
  canHandle(request) {
    return this.findMatchingTemplate(request.description) !== null;
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      name: this.name || 'TemplateStrategy',
      type: 'template',
      description: 'Template-based BT generation with pattern matching',
      capabilities: ['bt-generation', 'pattern-matching', 'parameter-substitution'],
      templateCount: this.templates.size,
      caseSensitive: this.caseSensitive,
      templates: this.listTemplates()
    };
  }

  // Common template builders

  /**
   * Create simple file operation template
   * @returns {Object} File operation BT template
   */
  static createFileOperationTemplate() {
    return {
      type: 'sequence',
      id: 'file_operation',
      description: 'File operation: {{goal}}',
      children: [
        {
          type: 'action',
          id: 'read_input',
          tool: 'readFile',
          description: 'Read input file',
          params: {
            path: '{{inputFile}}'
          }
        },
        {
          type: 'action',
          id: 'process_data',
          tool: 'processData',
          description: 'Process file data',
          params: {
            input: '@read_input.content',
            format: '{{format}}'
          }
        },
        {
          type: 'action',
          id: 'write_output',
          tool: 'writeFile',
          description: 'Write processed output',
          params: {
            path: '{{outputFile}}',
            content: '@process_data.result'
          }
        }
      ]
    };
  }

  /**
   * Create API workflow template
   * @returns {Object} API workflow BT template
   */
  static createAPIWorkflowTemplate() {
    return {
      type: 'selector',
      id: 'api_workflow',
      description: 'API workflow with fallback: {{goal}}',
      children: [
        {
          type: 'sequence',
          id: 'primary_api',
          description: 'Primary API approach',
          children: [
            {
              type: 'action',
              id: 'fetch_primary',
              tool: 'httpRequest',
              description: 'Fetch from primary API',
              params: {
                url: '{{primaryUrl}}',
                method: 'GET',
                headers: { 'Authorization': '{{apiKey}}' }
              }
            },
            {
              type: 'action',
              id: 'process_response',
              tool: 'processJson',
              description: 'Process API response',
              params: {
                input: '@fetch_primary.data',
                format: '{{format}}'
              }
            }
          ]
        },
        {
          type: 'retry',
          id: 'backup_api',
          description: 'Backup API with retry',
          maxRetries: 3,
          child: {
            type: 'action',
            id: 'fetch_backup',
            tool: 'httpRequest',
            description: 'Fetch from backup API',
            params: {
              url: '{{backupUrl}}',
              method: 'GET'
            }
          }
        }
      ]
    };
  }

  /**
   * Create testing workflow template
   * @returns {Object} Testing workflow BT template
   */
  static createTestingWorkflowTemplate() {
    return {
      type: 'sequence',
      id: 'testing_workflow',
      description: 'Testing workflow: {{goal}}',
      children: [
        {
          type: 'parallel',
          id: 'setup_tests',
          description: 'Setup test environment',
          children: [
            {
              type: 'action',
              id: 'setup_db',
              tool: 'setupDatabase',
              description: 'Setup test database',
              params: { config: '{{dbConfig}}' }
            },
            {
              type: 'action',
              id: 'setup_server',
              tool: 'startServer',
              description: 'Start test server',
              params: { port: '{{testPort}}' }
            }
          ]
        },
        {
          type: 'action',
          id: 'run_tests',
          tool: 'runTests',
          description: 'Execute test suite',
          params: {
            suite: '{{testSuite}}',
            coverage: true
          }
        },
        {
          type: 'parallel',
          id: 'cleanup',
          description: 'Cleanup test environment',
          children: [
            {
              type: 'action',
              id: 'stop_server',
              tool: 'stopServer',
              description: 'Stop test server',
              params: {}
            },
            {
              type: 'action',
              id: 'cleanup_db',
              tool: 'cleanupDatabase',
              description: 'Cleanup test database',
              params: {}
            }
          ]
        }
      ]
    };
  }
}