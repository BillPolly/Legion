/**
 * MetadataManager - Centralized metadata management and standardization
 * 
 * Validates, generates, and manages metadata for modules and tools
 * Uses @legion/schema for all validation operations
 */

import { createValidator, jsonSchemaToZod } from '@legion/schema';
import { 
  ModuleMetadataSchema, 
  ToolMetadataSchema,
  ValidationErrorSchema 
} from './schemas/index.js';
import { Logger } from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

export class MetadataManager {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      autoFix: options.autoFix || false,
      inferMetadata: options.inferMetadata !== false,
      ...options
    };
    
    // Create validators using @legion/schema
    this.moduleValidator = createValidator(ModuleMetadataSchema);
    this.toolValidator = createValidator(ToolMetadataSchema);
    this.errorValidator = createValidator(ValidationErrorSchema);
    
    // Track validation results
    this.validationCache = new Map();
    this.complianceScores = new Map();
    this.logger = Logger.create('MetadataManager', { verbose: this.options.verbose });
  }
  
  /**
   * Validate module metadata
   * @param {Object} module - Module metadata to validate
   * @returns {Object} Validation result with errors and compliance score
   */
  validateModuleMetadata(module) {
    const result = this.moduleValidator.validate(module);
    
    // Calculate compliance score
    const score = this.calculateModuleComplianceScore(module, result);
    
    // Cache results
    const validationResult = {
      valid: result.valid,
      score,
      errors: result.errors || [],
      warnings: this.checkModuleWarnings(module),
      metadata: module
    };
    
    if (module.name) {
      this.validationCache.set(`module:${module.name}`, validationResult);
      this.complianceScores.set(`module:${module.name}`, score);
    }
    
    return validationResult;
  }
  
  /**
   * Validate tool metadata
   * @param {Object} tool - Tool metadata to validate
   * @returns {Object} Validation result with errors and compliance score
   */
  validateToolMetadata(tool) {
    const result = this.toolValidator.validate(tool);
    
    // Calculate compliance score
    const score = this.calculateToolComplianceScore(tool, result);
    
    // Cache results
    const validationResult = {
      valid: result.valid,
      score,
      errors: result.errors || [],
      warnings: this.checkToolWarnings(tool),
      metadata: tool
    };
    
    if (tool.name) {
      this.validationCache.set(`tool:${tool.name}`, validationResult);
      this.complianceScores.set(`tool:${tool.name}`, score);
    }
    
    return validationResult;
  }
  
  /**
   * Calculate compliance score for a module
   * @private
   */
  calculateModuleComplianceScore(module, validationResult) {
    let score = 100;
    const penalties = {
      missingRequired: 20,
      missingOptional: 5,
      invalidFormat: 10,
      noDescription: 15,
      shortDescription: 5,
      noKeywords: 10,
      noAuthor: 5,
      noVersion: 10,
      noCompliance: 5
    };
    
    // Validation errors
    if (!validationResult.valid) {
      score -= validationResult.errors.length * penalties.missingRequired;
    }
    
    // Check optional fields
    if (!module.author) score -= penalties.noAuthor;
    if (!module.keywords || module.keywords.length === 0) score -= penalties.noKeywords;
    if (!module.version) score -= penalties.noVersion;
    if (!module.compliance) score -= penalties.noCompliance;
    
    // Description quality
    if (!module.description) {
      score -= penalties.noDescription;
    } else if (module.description.length < 20) {
      score -= penalties.shortDescription;
    }
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate compliance score for a tool
   * @private
   */
  calculateToolComplianceScore(tool, validationResult) {
    let score = 100;
    const penalties = {
      missingRequired: 20,
      missingOptional: 5,
      invalidSchema: 15,
      noExamples: 10,
      noTestCases: 15,
      noPerformance: 5,
      noCategory: 5,
      shortDescription: 5
    };
    
    // Validation errors
    if (!validationResult.valid) {
      score -= validationResult.errors.length * penalties.missingRequired;
    }
    
    // Check optional but important fields
    if (!tool.examples || tool.examples.length === 0) score -= penalties.noExamples;
    if (!tool.testCases || tool.testCases.length === 0) score -= penalties.noTestCases;
    if (!tool.performance) score -= penalties.noPerformance;
    if (!tool.category) score -= penalties.noCategory;
    
    // Schema quality
    if (tool.inputSchema && !this.isValidSchema(tool.inputSchema)) {
      score -= penalties.invalidSchema;
    }
    if (tool.outputSchema && !this.isValidSchema(tool.outputSchema)) {
      score -= penalties.invalidSchema;
    }
    
    // Description quality
    if (tool.description && tool.description.length < 20) {
      score -= penalties.shortDescription;
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Check if a schema is valid JSON Schema
   * @private
   */
  isValidSchema(schema) {
    // Check basic schema structure first
    if (!schema || typeof schema !== 'object') {
      return false;
    }
    
    // Validate schema can be converted to Zod
    const validationResult = this._attemptSchemaConversion(schema);
    return validationResult.isValid;
  }

  /**
   * Attempt to convert schema to Zod and return result
   * @private
   * @returns {Object} Result with isValid property
   */
  _attemptSchemaConversion(schema) {
    try {
      jsonSchemaToZod(schema);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }
  
  /**
   * Check for module warnings (non-critical issues)
   * @private
   */
  checkModuleWarnings(module) {
    const warnings = [];
    
    if (module.description && module.description.length < 30) {
      warnings.push('Description is too short (recommended: 30+ characters)');
    }
    
    if (!module.keywords || module.keywords.length < 3) {
      warnings.push('Too few keywords (recommended: 3+ keywords)');
    }
    
    if (module.version && !module.version.match(/^\d+\.\d+\.\d+$/)) {
      warnings.push('Version should follow semantic versioning (x.y.z)');
    }
    
    if (!module.author) {
      warnings.push('Missing author information');
    }
    
    return warnings;
  }
  
  /**
   * Check for tool warnings (non-critical issues)
   * @private
   */
  checkToolWarnings(tool) {
    const warnings = [];
    
    if (!tool.examples || tool.examples.length === 0) {
      warnings.push('No usage examples provided');
    }
    
    if (!tool.testCases || tool.testCases.length === 0) {
      warnings.push('No test cases defined');
    }
    
    if (!tool.category) {
      warnings.push('Tool category not specified');
    }
    
    if (!tool.performance) {
      warnings.push('Performance constraints not defined');
    }
    
    if (tool.inputSchema && !tool.inputSchema.additionalProperties === false) {
      warnings.push('Consider setting additionalProperties: false in inputSchema');
    }
    
    return warnings;
  }
  
  /**
   * Generate missing metadata for an entity
   * @param {string} type - 'module' or 'tool'
   * @param {Object} entity - Module or tool object
   * @returns {Object} Entity with generated metadata
   */
  generateMissingMetadata(type, entity) {
    const generated = { ...entity };
    
    if (type === 'module') {
      // Generate module metadata
      if (!generated.version) generated.version = '1.0.0';
      if (!generated.author) generated.author = 'Unknown';
      if (!generated.license) generated.license = 'MIT';
      if (!generated.tags) generated.tags = ['untagged'];
      if (!generated.stability) generated.stability = 'experimental';
      if (!generated.keywords && generated.name) {
        generated.keywords = this.generateKeywordsFromName(generated.name);
      }
      if (!generated.description && generated.name) {
        generated.description = `Module for ${generated.name} functionality`;
      }
      if (!generated.compliance) {
        generated.compliance = {
          score: 0,
          validated: false,
          tested: false,
          issues: []
        };
      }
    } else if (type === 'tool') {
      // Generate tool metadata
      if (!generated.version) generated.version = '1.0.0';
      if (!generated.author) generated.author = 'Unknown';
      if (!generated.license) generated.license = 'MIT';
      if (!generated.category) generated.category = 'general';
      if (!generated.tags) generated.tags = ['untagged'];
      if (!generated.stability) generated.stability = 'experimental';
      if (!generated.keywords && generated.name) {
        generated.keywords = this.generateKeywordsFromName(generated.name);
      }
      if (!generated.description && generated.name) {
        generated.description = `Tool for ${generated.name} operations`;
      }
      if (!generated.examples) generated.examples = [];
      if (!generated.testCases) generated.testCases = [];
      if (!generated.performance) {
        generated.performance = {
          timeout: 30000,
          memory: 256
        };
      }
    }
    
    return generated;
  }
  
  /**
   * Generate keywords from name
   * @private
   */
  generateKeywordsFromName(name) {
    // Split by common separators and filter
    const words = name
      .split(/[-_\s]+/)
      .filter(word => word.length > 2)
      .map(word => word.toLowerCase());
    
    return [...new Set(words)];
  }
  
  /**
   * Infer metadata from code file
   * @param {string} filePath - Path to the code file
   * @returns {Object} Inferred metadata
   */
  async inferMetadataFromCode(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const metadata = {};
      
      // Extract from JSDoc comments
      const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
      if (jsdocMatch) {
        const jsdoc = jsdocMatch[1];
        
        // Extract description
        const descMatch = jsdoc.match(/@description\s+(.+)/);
        if (descMatch) metadata.description = descMatch[1].trim();
        
        // Extract author
        const authorMatch = jsdoc.match(/@author\s+(.+)/);
        if (authorMatch) metadata.author = authorMatch[1].trim();
        
        // Extract version
        const versionMatch = jsdoc.match(/@version\s+(.+)/);
        if (versionMatch) metadata.version = versionMatch[1].trim();
      }
      
      // Extract class/function name
      const classMatch = content.match(/class\s+(\w+)/);
      const functionMatch = content.match(/function\s+(\w+)/);
      const exportMatch = content.match(/export\s+(?:default\s+)?(?:class|function)\s+(\w+)/);
      
      if (exportMatch) {
        metadata.name = this.normalizeName(exportMatch[1]);
      } else if (classMatch) {
        metadata.name = this.normalizeName(classMatch[1]);
      } else if (functionMatch) {
        metadata.name = this.normalizeName(functionMatch[1]);
      }
      
      // Extract from package.json if exists
      const dir = path.dirname(filePath);
      try {
        const packagePath = path.join(dir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        
        if (!metadata.version && packageJson.version) {
          metadata.version = packageJson.version;
        }
        if (!metadata.author && packageJson.author) {
          metadata.author = packageJson.author;
        }
        if (!metadata.description && packageJson.description) {
          metadata.description = packageJson.description;
        }
      } catch {
        // No package.json or error reading it
      }
      
      return metadata;
    } catch (error) {
      this.logger.error(`Error inferring metadata from ${filePath}: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Normalize a name to follow conventions
   * @private
   */
  normalizeName(name) {
    // Convert CamelCase to kebab-case
    return name
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/module$/, '')
      .replace(/tool$/, '');
  }
  
  /**
   * Standardize schema format
   * @param {Object} schema - Schema in any format
   * @param {string} format - Target format (currently only 'jsonschema')
   * @returns {Object} Standardized schema
   */
  standardizeSchema(schema, format = 'jsonschema') {
    if (!schema) return null;
    
    // Already in JSON Schema format
    if (schema.type || schema.$ref || schema.properties) {
      return schema;
    }
    
    // Try to convert from other formats
    // For now, just ensure it has the basic structure
    const standardized = {
      type: 'object',
      properties: {},
      ...schema
    };
    
    // Ensure it's valid by trying to create a validator
    try {
      jsonSchemaToZod(standardized);
      return standardized;
    } catch {
      // If validation fails, return a basic schema
      return {
        type: 'object',
        properties: {},
        additionalProperties: true
      };
    }
  }
  
  /**
   * Normalize metadata to standard format
   * @param {Object} metadata - Raw metadata
   * @returns {Object} Normalized metadata
   */
  normalizeMetadata(metadata) {
    const normalized = { ...metadata };
    
    // Normalize name
    if (normalized.name) {
      normalized.name = normalized.name.toLowerCase().replace(/\s+/g, '-');
    }
    
    // Ensure arrays
    if (normalized.keywords && !Array.isArray(normalized.keywords)) {
      normalized.keywords = [normalized.keywords];
    }
    
    // Ensure version format
    if (normalized.version && !normalized.version.match(/^\d+\.\d+\.\d+/)) {
      normalized.version = '1.0.0';
    }
    
    // Ensure timestamps are ISO strings
    if (normalized.lastUpdated && !(typeof normalized.lastUpdated === 'string')) {
      normalized.lastUpdated = new Date(normalized.lastUpdated).toISOString();
    }
    
    return normalized;
  }
  
  /**
   * Generate compliance report for modules
   * @param {Array} modules - Array of module metadata
   * @returns {Object} Compliance report
   */
  generateComplianceReport(modules) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalModules: modules.length,
        averageScore: 0,
        fullyCompliant: 0,
        needsAttention: 0,
        critical: 0
      },
      modules: [],
      recommendations: []
    };
    
    let totalScore = 0;
    
    for (const module of modules) {
      const validation = this.validateModuleMetadata(module);
      const moduleReport = {
        name: module.name,
        score: validation.score,
        status: this.getComplianceStatus(validation.score),
        errors: validation.errors,
        warnings: validation.warnings
      };
      
      report.modules.push(moduleReport);
      totalScore += validation.score;
      
      // Categorize
      if (validation.score === 100) report.summary.fullyCompliant++;
      else if (validation.score >= 80) report.summary.needsAttention++;
      else report.summary.critical++;
      
      // Generate recommendations
      if (validation.score < 100) {
        report.recommendations.push(...this.generateRecommendations(module, validation));
      }
    }
    
    report.summary.averageScore = modules.length > 0 ? totalScore / modules.length : 0;
    
    return report;
  }
  
  /**
   * Get compliance status based on score
   * @private
   */
  getComplianceStatus(score) {
    if (score === 100) return 'compliant';
    if (score >= 80) return 'mostly-compliant';
    if (score >= 60) return 'needs-improvement';
    return 'non-compliant';
  }
  
  /**
   * Generate recommendations for improving compliance
   * @private
   */
  generateRecommendations(entity, validation) {
    const recommendations = [];
    const name = entity.name || 'unknown';
    
    for (const error of validation.errors) {
      recommendations.push({
        priority: 'high',
        entity: name,
        issue: error.message,
        solution: this.getSolutionForError(error),
        autoFixable: this.isAutoFixable(error)
      });
    }
    
    for (const warning of validation.warnings) {
      recommendations.push({
        priority: 'low',
        entity: name,
        issue: warning,
        solution: this.getSolutionForWarning(warning),
        autoFixable: true
      });
    }
    
    return recommendations;
  }
  
  /**
   * Get solution for a validation error
   * @private
   */
  getSolutionForError(error) {
    const solutions = {
      'required': 'Add the missing required field',
      'minLength': 'Increase the length of the field',
      'pattern': 'Fix the format to match the required pattern',
      'type': 'Change the field to the correct type'
    };
    
    return solutions[error.code] || 'Review and fix the validation error';
  }
  
  /**
   * Get solution for a warning
   * @private
   */
  getSolutionForWarning(warning) {
    if (warning.includes('description')) {
      return 'Add a more detailed description';
    }
    if (warning.includes('keywords')) {
      return 'Add more relevant keywords for better discoverability';
    }
    if (warning.includes('examples')) {
      return 'Add usage examples to help users understand the tool';
    }
    if (warning.includes('test cases')) {
      return 'Add test cases for automated validation';
    }
    return 'Review and address the warning';
  }
  
  /**
   * Check if an error is auto-fixable
   * @private
   */
  isAutoFixable(error) {
    const autoFixableCodes = ['required', 'minLength', 'default'];
    return autoFixableCodes.includes(error.code);
  }
  
  /**
   * Suggest metadata fixes
   * @param {Object} metadata - Current metadata
   * @returns {Array} List of suggested fixes
   */
  suggestMetadataFixes(metadata) {
    const validation = metadata.inputSchema ? 
      this.validateToolMetadata(metadata) : 
      this.validateModuleMetadata(metadata);
    
    const fixes = [];
    
    for (const error of validation.errors) {
      if (this.isAutoFixable(error)) {
        fixes.push({
          path: error.path,
          action: 'add',
          value: this.getDefaultValue(error),
          reason: error.message
        });
      }
    }
    
    return fixes;
  }
  
  /**
   * Get default value for a field
   * @private
   */
  getDefaultValue(error) {
    const defaults = {
      version: '1.0.0',
      author: 'Legion Team',
      description: 'No description provided',
      keywords: [],
      category: 'other'
    };
    
    const field = error.path.split('.').pop();
    return defaults[field] || '';
  }
  
  /**
   * Apply metadata fixes
   * @param {Object} metadata - Current metadata
   * @param {Array} fixes - Fixes to apply
   * @returns {Object} Fixed metadata
   */
  applyMetadataFixes(metadata, fixes) {
    const fixed = { ...metadata };
    
    for (const fix of fixes) {
      const path = fix.path.split('.');
      let target = fixed;
      
      // Navigate to the target field
      for (let i = 0; i < path.length - 1; i++) {
        if (!target[path[i]]) {
          target[path[i]] = {};
        }
        target = target[path[i]];
      }
      
      // Apply the fix
      const field = path[path.length - 1];
      if (fix.action === 'add' || fix.action === 'set') {
        target[field] = fix.value;
      } else if (fix.action === 'remove') {
        delete target[field];
      }
    }
    
    return fixed;
  }
  
  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
    this.complianceScores.clear();
  }
  
  /**
   * Get cached validation result
   * @param {string} key - Cache key (e.g., 'module:name' or 'tool:name')
   * @returns {Object|null} Cached validation result
   */
  getCachedValidation(key) {
    return this.validationCache.get(key);
  }
  
  /**
   * Get compliance score
   * @param {string} key - Score key
   * @returns {number|null} Compliance score
   */
  getComplianceScore(key) {
    return this.complianceScores.get(key);
  }

  /**
   * Calculate compliance score for metadata
   * @param {string} type - 'module' or 'tool'
   * @param {Object} metadata - Metadata to score
   * @returns {number} Compliance score (0-100)
   */
  calculateComplianceScore(type, metadata) {
    if (type === 'module') {
      return this.calculateModuleComplianceScore(metadata, { valid: true, errors: [] });
    } else if (type === 'tool') {
      return this.calculateToolComplianceScore(metadata, { valid: true, errors: [] });
    }
    return 0;
  }

  /**
   * Compare metadata between two versions
   * @param {Object} oldMetadata - Previous metadata
   * @param {Object} currentMetadata - Current metadata
   * @returns {Object} Comparison result
   */
  compareMetadata(oldMetadata, currentMetadata) {
    const diff = {
      added: [],
      modified: [],
      removed: [],
      complianceImprovement: 0
    };

    const oldKeys = new Set(Object.keys(oldMetadata));
    const currentKeys = new Set(Object.keys(currentMetadata));

    // Find added fields
    for (const key of currentKeys) {
      if (!oldKeys.has(key)) {
        diff.added.push(key);
      }
    }

    // Find removed fields
    for (const key of oldKeys) {
      if (!currentKeys.has(key)) {
        diff.removed.push(key);
      }
    }

    // Find modified fields
    for (const key of currentKeys) {
      if (oldKeys.has(key) && oldMetadata[key] !== currentMetadata[key]) {
        diff.modified.push(key);
      }
    }

    // Calculate compliance improvement
    const oldScore = this.calculateComplianceScore('module', oldMetadata);
    const currentScore = this.calculateComplianceScore('module', currentMetadata);
    diff.complianceImprovement = currentScore - oldScore;

    return diff;
  }
}

export default MetadataManager;