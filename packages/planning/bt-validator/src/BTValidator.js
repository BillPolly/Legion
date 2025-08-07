/**
 * BTValidator - Comprehensive validation for Behavior Tree structures
 * 
 * Validates:
 * - BT node structures and hierarchy
 * - Node type validity (sequence, selector, action, retry, condition, parallel)
 * - Tool existence and availability
 * - Parameter schemas against tool metadata
 * - Tree structural integrity (cycles, orphans)
 * - Intelligent defaults application
 */

import { createValidator } from '@legion/schema';
import { ValidationUtils } from './ValidationUtils.js';

/**
 * BT validation result
 */
export class ValidationResult {
  constructor(valid = true, errors = [], warnings = []) {
    this.valid = valid;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = Date.now();
  }

  addError(type, message, nodeId = null, details = {}) {
    this.errors.push({
      type,
      message,
      nodeId,
      details,
      severity: 'error'
    });
    this.valid = false;
  }

  addWarning(type, message, nodeId = null, details = {}) {
    this.warnings.push({
      type,
      message,
      nodeId,
      details,
      severity: 'warning'
    });
  }

  merge(other) {
    this.valid = this.valid && other.valid;
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
    return this;
  }

  toString() {
    const status = this.valid ? 'VALID' : 'INVALID';
    const errorCount = this.errors.length;
    const warningCount = this.warnings.length;
    return `BT Validation: ${status} (${errorCount} errors, ${warningCount} warnings)`;
  }
}

/**
 * Behavior Tree validator with intelligent defaults
 */
export class BTValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false; // Default true
    this.validateTools = options.validateTools !== false; // Default true
    this.debugMode = options.debugMode || false;
    this.coerceTypes = options.coerceTypes || false;
    this.applyDefaults = options.applyDefaults !== false; // Default true
  }

  /**
   * Validate a BT structure with intelligent defaults
   * @param {Object|Array} bt - BT structure or legacy plan array
   * @param {Array} tools - Available tools with metadata
   * @param {Object} context - Optional validation context
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validate(bt, tools = [], context = {}) {
    const result = new ValidationResult();

    try {
      // Apply intelligent defaults first
      const normalizedBT = this.applyDefaults ? this.applyIntelligentDefaults(bt) : bt;
      
      if (this.debugMode) {
        console.log('[BT Validator] Validating BT:', JSON.stringify(normalizedBT, null, 2));
      }

      // Basic structure validation
      this.validateBTStructure(normalizedBT, result);
      if (!result.valid && !this.debugMode) return result;

      // Node type validation
      this.validateNodeTypes(normalizedBT, result);
      if (!result.valid && !this.debugMode) return result;

      // Tool availability validation
      if (this.validateTools && tools.length > 0) {
        await this.validateToolAvailability(normalizedBT, tools, result);
      }

      // Parameter schema validation
      if (this.validateTools && tools.length > 0) {
        await this.validateParameters(normalizedBT, tools, result);
      }

      // Tree integrity validation
      this.validateTreeIntegrity(normalizedBT, result);

    } catch (error) {
      result.addError('VALIDATION_ERROR', `Validation failed: ${error.message}`, null, { 
        error: error.message,
        stack: error.stack 
      });
    }

    return result;
  }

  /**
   * Apply intelligent defaults to BT structure
   * @param {Object|Array} input - Input BT or legacy plan
   * @returns {Object} Normalized BT structure
   */
  applyIntelligentDefaults(input) {
    // Handle legacy array format
    if (Array.isArray(input)) {
      return {
        type: 'sequence',
        id: 'root',
        description: 'Converted from linear plan',
        children: input.map((step, index) => this.applyNodeDefaults(step, index))
      };
    }

    // Handle object format
    if (typeof input === 'object' && input !== null) {
      return this.applyNodeDefaults(input);
    }

    throw new Error('BT input must be object or array');
  }

  /**
   * Apply defaults to individual node
   * @param {Object} node - BT node
   * @param {number} index - Node index for ID generation
   * @returns {Object} Node with defaults applied
   */
  applyNodeDefaults(node, index = 0) {
    const result = { ...node };

    // Generate ID if missing
    if (!result.id) {
      result.id = this.generateNodeId(result, index);
    }

    // Apply type defaults
    if (!result.type) {
      if (result.tool) {
        result.type = 'action';
      } else if (result.children && Array.isArray(result.children)) {
        result.type = 'sequence';
      } else {
        result.type = 'action'; // Default fallback
      }
    }

    // Recursively apply defaults to children
    if (result.children && Array.isArray(result.children)) {
      result.children = result.children.map((child, childIndex) => 
        this.applyNodeDefaults(child, childIndex)
      );
    }

    // Ensure params object exists for action nodes
    if (result.type === 'action' && !result.params) {
      result.params = {};
    }

    return result;
  }

  /**
   * Generate node ID
   * @param {Object} node - Node data
   * @param {number} index - Node index
   * @returns {string} Generated ID
   */
  generateNodeId(node, index) {
    const type = node.type || (node.tool ? 'action' : 'sequence');
    const suffix = node.tool ? `_${node.tool}` : '';
    return `${type}_${index}${suffix}`;
  }

  /**
   * Validate basic BT structure
   * @param {Object} bt - BT structure
   * @param {ValidationResult} result - Result object
   */
  validateBTStructure(bt, result) {
    if (!bt || typeof bt !== 'object') {
      result.addError('INVALID_BT_STRUCTURE', 'BT must be an object');
      return;
    }

    if (Array.isArray(bt)) {
      result.addError('INVALID_BT_STRUCTURE', 'BT structure should be normalized to object format');
      return;
    }

    // Validate required fields
    if (!bt.type) {
      result.addError('MISSING_NODE_TYPE', 'BT root node missing type field', bt.id);
    }

    if (!bt.id) {
      result.addError('MISSING_NODE_ID', 'BT root node missing id field');
    }
  }

  /**
   * Validate node types throughout tree
   * @param {Object} node - BT node
   * @param {ValidationResult} result - Result object
   * @param {string} path - Node path for error reporting
   */
  validateNodeTypes(node, result, path = 'root') {
    const validTypes = ['sequence', 'selector', 'action', 'retry', 'parallel', 'condition'];
    
    if (!validTypes.includes(node.type)) {
      result.addError('INVALID_NODE_TYPE', 
        `Invalid node type '${node.type}'. Must be one of: ${validTypes.join(', ')}`,
        node.id, { validTypes, path });
    }

    // Validate type-specific requirements
    switch (node.type) {
      case 'action':
        if (!node.tool) {
          result.addError('MISSING_TOOL', 'Action nodes must specify a tool', node.id, { path });
        }
        if (node.children && node.children.length > 0) {
          result.addWarning('UNEXPECTED_CHILDREN', 'Action nodes should not have children', node.id, { path });
        }
        break;

      case 'sequence':
      case 'selector':
      case 'parallel':
        if (!node.children || !Array.isArray(node.children) || node.children.length === 0) {
          result.addError('MISSING_CHILDREN', `${node.type} nodes must have children`, node.id, { path });
        }
        break;

      case 'retry':
        if (!node.child && (!node.children || node.children.length !== 1)) {
          result.addError('INVALID_RETRY_STRUCTURE', 'Retry nodes must have exactly one child', node.id, { path });
        }
        break;

      case 'condition':
        if (!node.check && !node.condition) {
          result.addError('MISSING_CONDITION', 'Condition nodes must specify check or condition expression', node.id, { path });
        }
        if (node.children && node.children.length > 0) {
          result.addWarning('UNEXPECTED_CHILDREN', 'Condition nodes should not have children', node.id, { path });
        }
        break;
    }

    // Recursively validate children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child, index) => {
        this.validateNodeTypes(child, result, `${path}.children[${index}]`);
      });
    }

    if (node.child) { // Single child (for retry nodes)
      this.validateNodeTypes(node.child, result, `${path}.child`);
    }
  }

  /**
   * Validate tool availability
   * @param {Object} node - BT node
   * @param {Array} tools - Available tools
   * @param {ValidationResult} result - Result object
   */
  async validateToolAvailability(node, tools, result) {
    const toolMap = new Map(tools.map(tool => [tool.name, tool]));

    await this.traverseNodes(node, async (currentNode) => {
      if (currentNode.type === 'action' && currentNode.tool) {
        if (!toolMap.has(currentNode.tool)) {
          result.addError('TOOL_NOT_FOUND', 
            `Tool '${currentNode.tool}' not found in available tools`,
            currentNode.id, { 
              availableTools: Array.from(toolMap.keys()),
              requestedTool: currentNode.tool 
            });
        }
      }
    });
  }

  /**
   * Validate parameters against tool schemas
   * @param {Object} node - BT node
   * @param {Array} tools - Available tools
   * @param {ValidationResult} result - Result object
   */
  async validateParameters(node, tools, result) {
    const toolMap = new Map(tools.map(tool => [tool.name, tool]));

    await this.traverseNodes(node, async (currentNode) => {
      if (currentNode.type === 'action' && currentNode.tool && currentNode.params) {
        const tool = toolMap.get(currentNode.tool);
        if (tool && tool.getMetadata) {
          try {
            const metadata = await tool.getMetadata();
            if (metadata.input) {
              await this.validateNodeParameters(currentNode, metadata.input, result);
            }
          } catch (error) {
            result.addWarning('TOOL_METADATA_ERROR', 
              `Could not validate parameters for tool '${currentNode.tool}': ${error.message}`,
              currentNode.id);
          }
        }
      }
    });
  }

  /**
   * Validate individual node parameters
   * @param {Object} node - BT node
   * @param {Object} schema - Parameter schema
   * @param {ValidationResult} result - Result object
   */
  async validateNodeParameters(node, schema, result) {
    try {
      const validator = createValidator(schema, {
        strict: this.strictMode,
        coerce: this.coerceTypes
      });

      const validation = validator.validate(node.params);
      
      if (!validation.valid) {
        validation.errors.forEach(error => {
          result.addError('SCHEMA_VALIDATION_ERROR',
            `Parameter validation failed for '${node.tool}': ${error.message}`,
            node.id, { 
              field: error.path,
              expectedType: error.expected,
              actualValue: error.actual 
            });
        });
      }
    } catch (error) {
      result.addWarning('PARAMETER_VALIDATION_ERROR',
        `Could not validate parameters for node '${node.id}': ${error.message}`,
        node.id);
    }
  }

  /**
   * Validate tree structural integrity
   * @param {Object} bt - BT structure
   * @param {ValidationResult} result - Result object
   */
  validateTreeIntegrity(bt, result) {
    const nodeIds = new Set();
    const duplicateIds = new Set();

    // Check for duplicate IDs
    this.traverseNodesSync(bt, (node) => {
      if (nodeIds.has(node.id)) {
        duplicateIds.add(node.id);
        result.addError('DUPLICATE_NODE_ID', `Duplicate node ID: ${node.id}`, node.id);
      } else {
        nodeIds.add(node.id);
      }
    });

    // Check for circular references (basic check)
    try {
      JSON.stringify(bt);
    } catch (error) {
      if (error.message.includes('circular')) {
        result.addError('CIRCULAR_REFERENCE', 'BT structure contains circular references');
      }
    }
  }

  /**
   * Traverse all nodes in BT (async)
   * @param {Object} node - Starting node
   * @param {Function} callback - Callback for each node
   */
  async traverseNodes(node, callback) {
    await callback(node);

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        await this.traverseNodes(child, callback);
      }
    }

    if (node.child) {
      await this.traverseNodes(node.child, callback);
    }
  }

  /**
   * Traverse all nodes in BT (sync)
   * @param {Object} node - Starting node  
   * @param {Function} callback - Callback for each node
   */
  traverseNodesSync(node, callback) {
    callback(node);

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.traverseNodesSync(child, callback);
      }
    }

    if (node.child) {
      this.traverseNodesSync(node.child, callback);
    }
  }
}

// Export legacy name for compatibility
export const PlanValidator = BTValidator;