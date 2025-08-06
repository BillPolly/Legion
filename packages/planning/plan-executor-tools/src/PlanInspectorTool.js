/**
 * PlanInspectorTool - Static analysis tool for plan structure validation
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class PlanInspectorTool extends Tool {
  constructor(moduleLoaderOrRegistry = null) {
    super({
      name: 'plan_inspect',
      description: 'Analyze plan structure and validate dependencies',
      inputSchema: z.object({
        plan: z.any().describe('The llm-planner Plan object to inspect'),
        analyzeDepth: z.enum(['shallow', 'deep', 'complete']).optional().default('deep').describe('Depth of hierarchical analysis'),
        validateTools: z.boolean().optional().default(false).describe('Whether to validate tool availability'),
        showDependencies: z.boolean().optional().default(false).describe('Whether to include dependency graph')
      })
    });
    
    // Support both moduleLoader and legacy planToolRegistry for backward compatibility
    if (moduleLoaderOrRegistry && typeof moduleLoaderOrRegistry.hasTool === 'function') {
      // Legacy planToolRegistry interface
      this.planToolRegistry = moduleLoaderOrRegistry;
      this.moduleLoader = null;
    } else {
      // ModuleLoader interface  
      this.moduleLoader = moduleLoaderOrRegistry;
      this.planToolRegistry = null;
    }
  }
  
  async execute(params) {
    try {
      // Validate parameters
      if (params.plan === null) {
        return {
          success: false,
          error: 'Plan cannot be null'
        };
      }

      if (!params.plan) {
        return {
          success: false,
          error: 'Plan parameter is required'
        };
      }

      if (typeof params.plan !== 'object') {
        return {
          success: false,
          error: 'Plan must be an object'
        };
      }

      const plan = params.plan;
      const analyzeDepth = params.analyzeDepth || 'deep';
      const validateTools = params.validateTools || false;
      const showDependencies = params.showDependencies || false;

      // Perform plan validation
      const validation = await this._validatePlanStructure(plan);
      
      // If validation failed completely, return early but with success=true (analysis completed)
      if (!validation.isValid && validation.errors.includes('Plan missing steps array')) {
        return {
          success: true,
          validation,
          dependencyAnalysis: null,
          toolAnalysis: null,
          complexity: { totalSteps: 0, totalActions: 0, maxDepth: 0, dependencyCount: 0, complexityScore: 0 },
          hierarchicalStructure: null,
          analysis: {
            depth: analyzeDepth,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Perform dependency analysis if requested
      let dependencyAnalysis = null;
      if (showDependencies) {
        dependencyAnalysis = this._analyzeDependencies(plan);
        // Add dependency validation errors to main validation
        validation.errors.push(...dependencyAnalysis.errors);
        if (dependencyAnalysis.errors.length > 0) {
          validation.isValid = false;
        }
      }

      // Perform tool analysis if requested
      let toolAnalysis = null;
      if (validateTools) {
        toolAnalysis = this._analyzeTools(plan);
        
        // If tools are not available, add validation errors
        if (this.planToolRegistry) {
          const unavailableTools = [];
          Object.entries(toolAnalysis.toolStatus).forEach(([toolName, status]) => {
            if (status.available === false) {
              unavailableTools.push(toolName);
            }
          });
          
          if (unavailableTools.length > 0) {
            validation.errors.push(`Required tools not available: ${unavailableTools.join(', ')}`);
            validation.isValid = false;
          }
        }
      }

      // Calculate complexity metrics
      const complexity = this._calculateComplexity(plan);

      // Generate hierarchical structure for complete analysis
      let hierarchicalStructure = null;
      if (analyzeDepth === 'complete') {
        hierarchicalStructure = this._generateHierarchicalStructure(plan);
      }

      return {
        success: true,
        validation,
        dependencyAnalysis,
        toolAnalysis,
        complexity,
        hierarchicalStructure,
        analysis: {
          depth: analyzeDepth,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async _validatePlanStructure(plan) {
    const errors = [];
    let isValid = true;

    // Check required fields
    if (!plan.id) {
      errors.push('Plan missing required id field');
      isValid = false;
    }

    if (!plan.steps || !Array.isArray(plan.steps)) {
      errors.push('Plan missing steps array');
      isValid = false;
      return { isValid, errors }; // Can't continue without steps
    }

    // Validate inputs section if present
    if (plan.inputs) {
      const inputValidation = this._validatePlanInputs(plan.inputs);
      errors.push(...inputValidation.errors);
      if (!inputValidation.isValid) {
        isValid = false;
      }
    }

    // Validate each step
    for (let index = 0; index < plan.steps.length; index++) {
      const step = plan.steps[index];
      if (!step.id) {
        errors.push(`Step at index ${index} missing required id field`);
        isValid = false;
      }

      // Validate actions if present
      if (step.actions && Array.isArray(step.actions)) {
        for (let actionIndex = 0; actionIndex < step.actions.length; actionIndex++) {
          const action = step.actions[actionIndex];
          const actionErrors = await this._validateAction(action, step.id, actionIndex);
          errors.push(...actionErrors);
          if (actionErrors.length > 0) {
            isValid = false;
          }
        }
      }

      // Recursively validate sub-steps
      if (step.steps && Array.isArray(step.steps)) {
        const subValidation = await this._validatePlanStructure({ id: 'sub', steps: step.steps });
        errors.push(...subValidation.errors.map(error => `${step.id}: ${error}`));
        if (!subValidation.isValid) {
          isValid = false;
        }
      }
    }

    return { isValid, errors };
  }

  /**
   * Validate an action's parameters against tool schema
   * @private
   */
  async _validateAction(action, stepId, actionIndex) {
    const errors = [];
    
    if (!action.type) {
      errors.push(`Step ${stepId} action ${actionIndex}: missing 'type' field`);
      return errors;
    }

    // Check if we have a moduleLoader to validate against
    if (!this.moduleLoader) {
      // Can't validate parameters without moduleLoader
      return errors;
    }

    // Try to get the tool to check its schema
    try {
      const tool = await this.moduleLoader.getToolByNameOrAlias(action.type);
      if (!tool) {
        errors.push(`Step ${stepId} action ${actionIndex}: tool '${action.type}' not found`);
        return errors;
      }

      // Check if tool has inputSchema for validation
      if (tool.inputSchema && action.parameters) {
        // Validate parameters against schema
        const paramErrors = this._validateParameters(action.parameters, tool.inputSchema, action.type);
        paramErrors.forEach(err => {
          errors.push(`Step ${stepId} action ${actionIndex}: ${err}`);
        });
      }
    } catch (error) {
      // If we can't load the tool, note it as a warning
      errors.push(`Step ${stepId} action ${actionIndex}: unable to validate tool '${action.type}' - ${error.message}`);
    }

    return errors;
  }

  /**
   * Validate parameters against a schema
   * @private
   */
  _validateParameters(params, schema, toolName) {
    const errors = [];
    
    // Check for Zod schema
    if (schema && typeof schema.parse === 'function') {
      try {
        schema.parse(params);
      } catch (zodError) {
        if (zodError.errors) {
          zodError.errors.forEach(err => {
            errors.push(`${toolName} parameter '${err.path.join('.')}': ${err.message}`);
          });
        } else {
          errors.push(`${toolName} parameters invalid: ${zodError.message}`);
        }
      }
    } else if (schema && schema.properties) {
      // JSON Schema validation
      const required = schema.required || [];
      
      // Check required fields
      required.forEach(field => {
        if (!(field in params)) {
          errors.push(`${toolName} missing required parameter: ${field}`);
        }
      });
      
      // Check parameter types
      for (const [key, value] of Object.entries(params)) {
        if (schema.properties[key]) {
          const expectedType = schema.properties[key].type;
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          
          if (expectedType && expectedType !== actualType) {
            errors.push(`${toolName} parameter '${key}' should be ${expectedType} but got ${actualType}`);
          }
        } else if (schema.additionalProperties === false) {
          errors.push(`${toolName} has unknown parameter: ${key}`);
        }
      }
    }
    
    return errors;
  }

  _analyzeDependencies(plan) {
    const errors = [];
    const chains = {};
    const stepIds = new Set();

    // Collect all step IDs recursively
    const collectStepIds = (steps) => {
      steps.forEach(step => {
        stepIds.add(step.id);
        if (step.steps) {
          collectStepIds(step.steps);
        }
      });
    };
    collectStepIds(plan.steps);

    // Build dependency chains and detect issues
    const buildChains = (steps) => {
      steps.forEach(step => {
        if (step.dependencies) {
          // Validate dependency references
          step.dependencies.forEach(dep => {
            if (!stepIds.has(dep)) {
              errors.push(`Step ${step.id} depends on nonexistent step: ${dep}`);
            }
          });

          // Build dependency chain
          chains[step.id] = this._resolveDependencyChain(step.id, steps, chains);
        }

        // Recursively process sub-steps
        if (step.steps) {
          buildChains(step.steps);
        }
      });
    };

    buildChains(plan.steps);

    // Detect circular dependencies
    this._detectCircularDependencies(plan.steps, chains, errors);

    return {
      chains,
      errors,
      stepCount: stepIds.size
    };
  }

  _resolveDependencyChain(stepId, steps, chains) {
    const step = this._findStepById(stepId, steps);
    if (!step || !step.dependencies) {
      return [];
    }

    const chain = [];
    const visited = new Set();
    
    const addDependencies = (deps) => {
      deps.forEach(dep => {
        if (!visited.has(dep)) {
          visited.add(dep);
          
          // First recursively add dependencies of this dependency (deeper first)
          const depStep = this._findStepById(dep, steps);
          if (depStep && depStep.dependencies) {
            addDependencies(depStep.dependencies);
          }
          
          // Then add this dependency
          chain.push(dep);
        }
      });
    };

    addDependencies(step.dependencies);
    return chain;
  }

  _detectCircularDependencies(steps, chains, errors) {
    const visited = new Set();
    const visiting = new Set();

    const visit = (stepId, path = []) => {
      if (visiting.has(stepId)) {
        const cycle = [...path, stepId].slice(path.indexOf(stepId));
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
        return;
      }

      if (visited.has(stepId)) {
        return;
      }

      visiting.add(stepId);
      const step = this._findStepById(stepId, steps);
      
      if (step && step.dependencies) {
        step.dependencies.forEach(dep => {
          visit(dep, [...path, stepId]);
        });
      }

      visiting.delete(stepId);
      visited.add(stepId);
    };

    // Visit all steps to detect cycles
    const allSteps = this._getAllSteps(steps);
    allSteps.forEach(step => {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    });
  }

  _analyzeTools(plan) {
    const requiredTools = new Set();
    const toolStatus = {};

    // Collect all required tools
    const collectTools = (steps) => {
      steps.forEach(step => {
        if (step.actions) {
          step.actions.forEach(action => {
            requiredTools.add(action.type);
          });
        }
        if (step.steps) {
          collectTools(step.steps);
        }
      });
    };

    collectTools(plan.steps);

    // Check tool availability using the plan tool registry if available
    Array.from(requiredTools).forEach(toolName => {
      if (this.planToolRegistry) {
        // Actually check if the tool exists
        const toolExists = this.planToolRegistry.hasTool(toolName);
        toolStatus[toolName] = {
          available: toolExists,
          module: toolExists ? 'loaded' : 'not found'
        };
      } else {
        // No registry available, can't verify
        toolStatus[toolName] = {
          available: 'unknown',
          module: 'unknown'
        };
      }
    });

    return {
      requiredTools: Array.from(requiredTools),
      toolStatus,
      totalTools: requiredTools.size
    };
  }

  _calculateComplexity(plan) {
    let totalSteps = 0;
    let totalActions = 0;
    let maxDepth = 0;
    let dependencyCount = 0;

    const analyzeLevel = (steps, depth = 1) => {
      maxDepth = Math.max(maxDepth, depth);
      
      steps.forEach(step => {
        totalSteps++;
        
        if (step.actions) {
          totalActions += step.actions.length;
        }
        
        if (step.dependencies) {
          dependencyCount += step.dependencies.length;
        }
        
        if (step.steps) {
          analyzeLevel(step.steps, depth + 1);
        }
      });
    };

    analyzeLevel(plan.steps);

    return {
      totalSteps,
      totalActions,
      maxDepth,
      dependencyCount,
      complexityScore: totalSteps + totalActions + dependencyCount
    };
  }

  _generateHierarchicalStructure(plan) {
    const generateLevel = (steps, level = 0) => {
      return steps.map(step => ({
        id: step.id,
        title: step.title || step.id,
        level,
        hasActions: !!(step.actions && step.actions.length > 0),
        hasSubSteps: !!(step.steps && step.steps.length > 0),
        dependencies: step.dependencies || [],
        actionCount: step.actions ? step.actions.length : 0,
        subSteps: step.steps ? generateLevel(step.steps, level + 1) : []
      }));
    };

    return generateLevel(plan.steps);
  }

  _findStepById(stepId, steps) {
    for (const step of steps) {
      if (step.id === stepId) {
        return step;
      }
      if (step.steps) {
        const found = this._findStepById(stepId, step.steps);
        if (found) return found;
      }
    }
    return null;
  }

  _getAllSteps(steps) {
    const allSteps = [];
    steps.forEach(step => {
      allSteps.push(step);
      if (step.steps) {
        allSteps.push(...this._getAllSteps(step.steps));
      }
    });
    return allSteps;
  }

  /**
   * Validate plan inputs section
   * @private
   * @param {Array} inputs - Plan inputs array
   * @returns {Object} Validation result
   */
  _validatePlanInputs(inputs) {
    const errors = [];
    let isValid = true;

    if (!Array.isArray(inputs)) {
      errors.push('Plan inputs must be an array');
      return { isValid: false, errors };
    }

    const inputNames = new Set();

    inputs.forEach((input, index) => {
      // Check required fields
      if (!input.name) {
        errors.push(`Input at index ${index} missing required 'name' field`);
        isValid = false;
      } else {
        // Check for duplicate names
        if (inputNames.has(input.name)) {
          errors.push(`Duplicate input name: ${input.name}`);
          isValid = false;
        }
        inputNames.add(input.name);

        // Validate name format (should be valid variable name)
        if (!/^[A-Z_][A-Z0-9_]*$/.test(input.name)) {
          errors.push(`Input name '${input.name}' should be uppercase with underscores (e.g., ARTIFACT_DIR)`);
        }
      }

      // Validate type if present
      if (input.type && !['string', 'number', 'boolean', 'object', 'array'].includes(input.type)) {
        errors.push(`Input '${input.name}' has invalid type: ${input.type}`);
        isValid = false;
      }

      // Check description
      if (input.description && typeof input.description !== 'string') {
        errors.push(`Input '${input.name}' description must be a string`);
        isValid = false;
      }

      // Validate required field
      if (input.required !== undefined && typeof input.required !== 'boolean') {
        errors.push(`Input '${input.name}' required field must be boolean`);
        isValid = false;
      }

      // Validate default value type matches declared type
      if (input.default !== undefined && input.type) {
        const defaultType = typeof input.default;
        const expectedType = input.type === 'array' ? 'object' : input.type;
        
        if (defaultType !== expectedType && !(input.type === 'array' && Array.isArray(input.default))) {
          errors.push(`Input '${input.name}' default value type (${defaultType}) doesn't match declared type (${input.type})`);
          isValid = false;
        }
      }
    });

    return { isValid, errors };
  }
}