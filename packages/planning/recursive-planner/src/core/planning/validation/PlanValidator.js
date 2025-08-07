/**
 * PlanValidator - Comprehensive validation for execution plans
 * 
 * Validates:
 * - Tool existence and availability
 * - Parameter schemas against tool metadata
 * - Artifact references and flow
 * - Dependencies between steps
 * - Output field mappings
 */

import { ValidationUtils } from '../../../foundation/utils/validation/ValidationUtils.js';

/**
 * Plan validation result
 */
export class ValidationResult {
  constructor(valid = true, errors = [], warnings = []) {
    this.valid = valid;
    this.errors = errors;
    this.warnings = warnings;
    this.timestamp = Date.now();
  }

  addError(type, message, stepId = null, details = {}) {
    this.errors.push({
      type,
      message,
      stepId,
      details,
      severity: 'error'
    });
    this.valid = false;
  }

  addWarning(type, message, stepId = null, details = {}) {
    this.warnings.push({
      type,
      message,
      stepId,
      details,
      severity: 'warning'
    });
  }

  merge(other) {
    this.valid = this.valid && other.valid;
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
  }
}

/**
 * Plan validator class
 */
export class PlanValidator {
  constructor(options = {}) {
    this.schemaValidator = options.schemaValidator || null;
    this.strictMode = options.strictMode !== false;
    this.validateArtifacts = options.validateArtifacts !== false;
    this.debugMode = options.debugMode || false;
  }

  /**
   * Validate a complete plan
   * @param {Array} plan - Plan steps to validate
   * @param {Array} tools - Available tools
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>} Validation result
   */
  async validate(plan, tools, context = {}) {
    const result = new ValidationResult();

    // Basic plan validation
    if (!Array.isArray(plan) || plan.length === 0) {
      result.addError('EMPTY_PLAN', 'Plan must be a non-empty array');
      return result;
    }

    // Build tool metadata map
    const toolMap = await this.buildToolMap(tools);
    
    // Track artifacts and dependencies
    const artifactRegistry = new Map(); // name -> { type, stepId, outputField }
    const stepIds = new Set();
    const dependencyGraph = new Map(); // stepId -> [dependencies]

    // Validate each step
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const stepResult = await this.validateStep(
        step, 
        i, 
        toolMap, 
        artifactRegistry, 
        stepIds,
        dependencyGraph,
        context
      );
      
      result.merge(stepResult);

      // Track step for dependency validation
      if (step.id) {
        stepIds.add(step.id);
        if (step.dependencies) {
          dependencyGraph.set(step.id, step.dependencies);
        }
      }

      // Track artifacts created by this step
      if (step.saveOutputs && !stepResult.errors.some(e => e.type === 'TOOL_NOT_FOUND')) {
        this.trackStepArtifacts(step, artifactRegistry, toolMap);
      }
    }

    // Validate dependency graph
    const depResult = this.validateDependencyGraph(dependencyGraph, stepIds);
    result.merge(depResult);

    // Check for unreferenced artifacts (warning)
    if (this.validateArtifacts) {
      const artifactResult = this.validateArtifactUsage(artifactRegistry, plan);
      result.merge(artifactResult);
    }

    return result;
  }

  /**
   * Validate a single plan step
   */
  async validateStep(step, index, toolMap, artifactRegistry, stepIds, dependencyGraph, context) {
    const result = new ValidationResult();

    // Validate basic step structure
    try {
      ValidationUtils.planStep(step);
    } catch (error) {
      result.addError('INVALID_STEP_STRUCTURE', error.message, step.id || `step_${index}`);
      return result; // Can't continue validation for this step
    }

    // Check tool exists
    const toolMetadata = toolMap.get(step.tool);
    if (!toolMetadata) {
      result.addError(
        'TOOL_NOT_FOUND',
        `Tool '${step.tool}' is not available`,
        step.id,
        { availableTools: Array.from(toolMap.keys()) }
      );
      return result; // Can't validate params without tool metadata
    }

    // Validate parameters
    if (step.params) {
      const paramResult = await this.validateParameters(
        step.params,
        toolMetadata.input || {},
        artifactRegistry,
        step.id
      );
      result.merge(paramResult);
    }

    // Validate saveOutputs
    if (step.saveOutputs) {
      const outputResult = this.validateSaveOutputs(
        step.saveOutputs,
        toolMetadata.output || {},
        artifactRegistry,
        step.id
      );
      result.merge(outputResult);
    }

    // Validate dependencies
    if (step.dependencies && step.dependencies.length > 0) {
      const depResult = this.validateStepDependencies(
        step.dependencies,
        stepIds,
        step.id
      );
      result.merge(depResult);
    }

    return result;
  }

  /**
   * Validate step parameters including artifact references
   */
  async validateParameters(params, schema, artifactRegistry, stepId) {
    const result = new ValidationResult();

    // Check each parameter
    for (const [key, value] of Object.entries(params)) {
      // Check artifact references
      if (typeof value === 'string' && value.startsWith('@')) {
        const artifactName = value.substring(1);
        if (!artifactRegistry.has(artifactName)) {
          result.addError(
            'ARTIFACT_NOT_FOUND',
            `Artifact '@${artifactName}' has not been created yet`,
            stepId,
            { 
              parameter: key,
              reference: value,
              availableArtifacts: Array.from(artifactRegistry.keys())
            }
          );
        }
      } else if (Array.isArray(value)) {
        // Check artifact references in arrays
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'string' && value[i].startsWith('@')) {
            const artifactName = value[i].substring(1);
            if (!artifactRegistry.has(artifactName)) {
              result.addError(
                'ARTIFACT_NOT_FOUND',
                `Artifact '@${artifactName}' in array has not been created yet`,
                stepId,
                { 
                  parameter: `${key}[${i}]`,
                  reference: value[i],
                  availableArtifacts: Array.from(artifactRegistry.keys())
                }
              );
            }
          }
        }
      } else if (value && typeof value === 'object') {
        // Recursively check nested objects
        const nestedResult = await this.validateParameters(
          value,
          schema[key] || {},
          artifactRegistry,
          stepId
        );
        result.merge(nestedResult);
      }
    }

    // Validate against schema if available
    if (this.schemaValidator && Object.keys(schema).length > 0) {
      const schemaResult = await this.schemaValidator.validate(params, schema, stepId);
      result.merge(schemaResult);
    } else if (this.strictMode) {
      // Basic schema validation without SchemaValidator
      const basicResult = this.validateBasicSchema(params, schema, stepId);
      result.merge(basicResult);
    }

    return result;
  }

  /**
   * Basic schema validation (when SchemaValidator not available)
   */
  validateBasicSchema(params, schema, stepId) {
    const result = new ValidationResult();

    // Check required parameters
    for (const [paramName, paramType] of Object.entries(schema)) {
      const isOptional = paramType.endsWith('?');
      const cleanType = paramType.replace('?', '');

      if (!isOptional && !(paramName in params)) {
        result.addError(
          'MISSING_PARAMETER',
          `Required parameter '${paramName}' is missing`,
          stepId,
          { parameter: paramName, expectedType: cleanType }
        );
      }
    }

    // Check for unexpected parameters
    if (this.strictMode) {
      const expectedParams = Object.keys(schema);
      for (const paramName of Object.keys(params)) {
        if (!expectedParams.includes(paramName)) {
          result.addWarning(
            'UNEXPECTED_PARAMETER',
            `Parameter '${paramName}' is not defined in tool schema`,
            stepId,
            { 
              parameter: paramName,
              expectedParameters: expectedParams
            }
          );
        }
      }
    }

    return result;
  }

  /**
   * Validate saveOutputs configuration
   */
  validateSaveOutputs(saveOutputs, outputSchema, artifactRegistry, stepId) {
    const result = new ValidationResult();

    for (const [outputField, artifactConfig] of Object.entries(saveOutputs)) {
      // Check artifact config structure
      if (!artifactConfig || typeof artifactConfig !== 'object') {
        result.addError(
          'INVALID_SAVE_OUTPUT',
          `saveOutputs.${outputField} must be an object with 'name' and 'description'`,
          stepId,
          { field: outputField }
        );
        continue;
      }

      if (!artifactConfig.name) {
        result.addError(
          'MISSING_ARTIFACT_NAME',
          `saveOutputs.${outputField} must have a 'name' field`,
          stepId,
          { field: outputField }
        );
      }

      if (!artifactConfig.description) {
        result.addWarning(
          'MISSING_ARTIFACT_DESCRIPTION',
          `saveOutputs.${outputField} should have a 'description' field`,
          stepId,
          { field: outputField }
        );
      }

      // Check if output field exists in tool schema
      if (this.strictMode && Object.keys(outputSchema).length > 0) {
        if (!(outputField in outputSchema)) {
          result.addError(
            'INVALID_OUTPUT_FIELD',
            `Output field '${outputField}' does not exist in tool output schema`,
            stepId,
            { 
              field: outputField,
              availableOutputs: Object.keys(outputSchema)
            }
          );
        }
      }

      // Check for duplicate artifact names
      if (artifactConfig.name && artifactRegistry.has(artifactConfig.name)) {
        result.addError(
          'DUPLICATE_ARTIFACT_NAME',
          `Artifact name '${artifactConfig.name}' is already used`,
          stepId,
          { 
            artifactName: artifactConfig.name,
            previousStep: artifactRegistry.get(artifactConfig.name).stepId
          }
        );
      }
    }

    return result;
  }

  /**
   * Validate step dependencies
   */
  validateStepDependencies(dependencies, existingStepIds, stepId) {
    const result = new ValidationResult();

    for (const depId of dependencies) {
      if (!existingStepIds.has(depId)) {
        result.addError(
          'INVALID_DEPENDENCY',
          `Dependency '${depId}' does not exist or comes after this step`,
          stepId,
          { 
            dependency: depId,
            availableSteps: Array.from(existingStepIds)
          }
        );
      }
    }

    return result;
  }

  /**
   * Validate the entire dependency graph for cycles
   */
  validateDependencyGraph(dependencyGraph, stepIds) {
    const result = new ValidationResult();
    
    // Check for cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (nodeId, path = []) => {
      if (recursionStack.has(nodeId)) {
        return [...path, nodeId]; // Return the cycle path
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependencies = dependencyGraph.get(nodeId) || [];
      for (const dep of dependencies) {
        const cyclePath = hasCycle(dep, [...path]);
        if (cyclePath) {
          return cyclePath;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const stepId of stepIds) {
      if (!visited.has(stepId)) {
        const cyclePath = hasCycle(stepId);
        if (cyclePath) {
          result.addError(
            'CIRCULAR_DEPENDENCY',
            `Circular dependency detected: ${cyclePath.join(' -> ')}`,
            stepId,
            { cycle: cyclePath }
          );
          break; // One cycle is enough to fail
        }
      }
    }

    return result;
  }

  /**
   * Check for unused artifacts (warnings)
   */
  validateArtifactUsage(artifactRegistry, plan) {
    const result = new ValidationResult();
    const usedArtifacts = new Set();

    // Find all artifact references
    for (const step of plan) {
      if (step.params) {
        this.findArtifactReferences(step.params, usedArtifacts);
      }
    }

    // Check for unused artifacts
    for (const [name, info] of artifactRegistry.entries()) {
      if (!usedArtifacts.has(name)) {
        result.addWarning(
          'UNUSED_ARTIFACT',
          `Artifact '${name}' is created but never used`,
          info.stepId,
          { artifactName: name }
        );
      }
    }

    return result;
  }

  /**
   * Recursively find artifact references in parameters
   */
  findArtifactReferences(obj, usedArtifacts) {
    if (typeof obj === 'string' && obj.startsWith('@')) {
      usedArtifacts.add(obj.substring(1));
    } else if (Array.isArray(obj)) {
      obj.forEach(item => this.findArtifactReferences(item, usedArtifacts));
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(value => 
        this.findArtifactReferences(value, usedArtifacts)
      );
    }
  }

  /**
   * Track artifacts created by a step
   */
  trackStepArtifacts(step, artifactRegistry, toolMap) {
    const toolMetadata = toolMap.get(step.tool);
    if (!toolMetadata || !step.saveOutputs) return;

    for (const [outputField, artifactConfig] of Object.entries(step.saveOutputs)) {
      if (artifactConfig.name) {
        const outputType = toolMetadata.output?.[outputField] || 'any';
        artifactRegistry.set(artifactConfig.name, {
          stepId: step.id,
          outputField,
          type: outputType,
          description: artifactConfig.description
        });
      }
    }
  }

  /**
   * Build tool metadata map
   */
  async buildToolMap(tools) {
    const toolMap = new Map();

    for (const tool of tools) {
      let metadata = {
        name: tool.name,
        description: tool.description,
        input: {},
        output: {}
      };

      // Get metadata from tool if available
      if (tool.getMetadata && typeof tool.getMetadata === 'function') {
        try {
          const toolMeta = await tool.getMetadata();
          metadata = { ...metadata, ...toolMeta };
        } catch (error) {
          if (this.debugMode) {
            console.warn(`[PlanValidator] Failed to get metadata for tool ${tool.name}: ${error.message}`);
          }
        }
      }

      toolMap.set(tool.name, metadata);
    }

    return toolMap;
  }
}