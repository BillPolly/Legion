/**
 * ModuleJsonValidator - Validates module.json files against the schema
 * 
 * Uses the SchemaValidator from the shared codec package to validate
 * module.json files and ensure they conform to the expected structure.
 */

// Note: For now using a simple validator. In production, would integrate with full SchemaValidator
// import { SchemaValidator } from '../../../../shared/codec/src/validators/SchemaValidator.js';
import { MODULE_JSON_SCHEMA, VALIDATION_SCHEMAS } from './ModuleJsonSchema.js';

export class ModuleJsonValidator {
  constructor(options = {}) {
    // Simple validator for now - can be replaced with full AJV implementation later
    this.options = options;
    this.validationCache = new Map();
  }

  /**
   * Validate a module.json object
   * @param {Object} moduleJson - The parsed module.json object
   * @param {Object} options - Validation options
   * @returns {{ valid: boolean, errors: Array, warnings: Array, data: Object }}
   */
  validate(moduleJson, options = {}) {
    const cacheKey = JSON.stringify(moduleJson);
    
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey);
    }

    // Basic structural validation
    const structuralValidation = this.performStructuralValidation(moduleJson);
    
    // Additional semantic validation
    const semanticValidation = this.performSemanticValidation(moduleJson, options);
    
    const result = {
      valid: structuralValidation.valid && semanticValidation.valid,
      errors: [
        ...structuralValidation.errors,
        ...semanticValidation.errors
      ],
      warnings: semanticValidation.warnings,
      data: structuralValidation.valid ? moduleJson : null
    };

    // Cache the result
    this.validationCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Perform basic structural validation
   * @private
   */
  performStructuralValidation(moduleJson) {
    const errors = [];

    // Check required fields
    if (!moduleJson.name || typeof moduleJson.name !== 'string') {
      errors.push({
        path: '/name',
        message: 'Module name is required and must be a string'
      });
    }

    if (!moduleJson.description || typeof moduleJson.description !== 'string') {
      errors.push({
        path: '/description',
        message: 'Module description is required and must be a string'
      });
    } else if (moduleJson.description.length < 10) {
      errors.push({
        path: '/description',
        message: 'Module description must be at least 10 characters long'
      });
    }

    // Validate tools if present
    if (moduleJson.tools) {
      if (!Array.isArray(moduleJson.tools)) {
        errors.push({
          path: '/tools',
          message: 'Tools must be an array'
        });
      } else {
        moduleJson.tools.forEach((tool, index) => {
          if (!tool.name || typeof tool.name !== 'string') {
            errors.push({
              path: `/tools/${index}/name`,
              message: 'Tool name is required and must be a string'
            });
          }
          if (!tool.description || typeof tool.description !== 'string') {
            errors.push({
              path: `/tools/${index}/description`,
              message: 'Tool description is required and must be a string'
            });
          }
          if (!tool.function || typeof tool.function !== 'string') {
            errors.push({
              path: `/tools/${index}/function`,
              message: 'Tool function is required and must be a string'
            });
          }
        });
      }
    }

    // Validate dependencies if present
    if (moduleJson.dependencies && typeof moduleJson.dependencies !== 'object') {
      errors.push({
        path: '/dependencies',
        message: 'Dependencies must be an object'
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Perform semantic validation beyond schema validation
   * @private
   */
  performSemanticValidation(moduleJson, options = {}) {
    const errors = [];
    const warnings = [];

    // Validate dependencies and initialization config consistency
    if (moduleJson.dependencies && moduleJson.initialization?.config) {
      this.validateDependencyUsage(moduleJson, errors, warnings);
    }

    // Validate tool definitions
    if (moduleJson.tools) {
      this.validateTools(moduleJson.tools, errors, warnings);
    }

    // Validate package path if specified
    if (moduleJson.package) {
      this.validatePackagePath(moduleJson.package, errors, warnings);
    }

    // Check for potential naming conflicts
    this.validateNaming(moduleJson, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate dependency usage in initialization config
   * @private
   */
  validateDependencyUsage(moduleJson, errors, warnings) {
    const dependencies = Object.keys(moduleJson.dependencies || {});
    const configString = JSON.stringify(moduleJson.initialization.config);

    // Check if declared dependencies are actually used
    for (const dep of dependencies) {
      if (!configString.includes(`\${${dep}}`)) {
        warnings.push({
          path: `/dependencies/${dep}`,
          message: `Dependency '${dep}' is declared but not used in initialization config`,
          suggestion: `Remove unused dependency or reference it as '\${${dep}}' in config`
        });
      }
    }

    // Check if used environment variables are declared
    const envVarMatches = configString.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g);
    for (const match of envVarMatches) {
      const envVar = match[1];
      if (!dependencies.includes(envVar)) {
        errors.push({
          path: `/initialization/config`,
          message: `Environment variable '${envVar}' is used but not declared in dependencies`,
          suggestion: `Add '${envVar}' to the dependencies object`
        });
      }
    }
  }

  /**
   * Validate tool definitions
   * @private
   */
  validateTools(tools, errors, warnings) {
    const toolNames = new Set();
    
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const basePath = `/tools/${i}`;

      // Check for duplicate tool names
      if (toolNames.has(tool.name)) {
        errors.push({
          path: `${basePath}/name`,
          message: `Duplicate tool name '${tool.name}'`,
          suggestion: 'Tool names must be unique within a module'
        });
      } else {
        toolNames.add(tool.name);
      }

      // Validate parameter schema structure
      if (tool.parameters) {
        this.validateParameterSchema(tool.parameters, `${basePath}/parameters`, errors, warnings);
      }

      // Validate result mapping JSONPath expressions
      if (tool.resultMapping) {
        this.validateResultMapping(tool.resultMapping, `${basePath}/resultMapping`, errors, warnings);
      }

      // Check for inconsistent async/instanceMethod combinations
      if (tool.async === false && tool.instanceMethod === false) {
        warnings.push({
          path: `${basePath}`,
          message: 'Static synchronous methods are uncommon and may indicate an error',
          suggestion: 'Verify that this tool should be both static and synchronous'
        });
      }

      // Validate examples if present
      if (tool.examples) {
        this.validateToolExamples(tool.examples, tool.parameters, `${basePath}/examples`, errors, warnings);
      }
    }
  }

  /**
   * Validate parameter schema structure
   * @private
   */
  validateParameterSchema(parameters, basePath, errors, warnings) {
    // Check for common schema issues
    if (parameters.type === 'object' && !parameters.properties) {
      warnings.push({
        path: `${basePath}`,
        message: 'Object type without properties may accept any structure',
        suggestion: 'Define specific properties for better validation'
      });
    }

    // Check for missing required field validation
    if (parameters.properties && !parameters.required) {
      const hasRequiredFields = Object.values(parameters.properties).some(prop => 
        typeof prop === 'object' && prop.description && prop.description.includes('required')
      );
      
      if (hasRequiredFields) {
        warnings.push({
          path: `${basePath}`,
          message: 'Schema describes required fields but has no required array',
          suggestion: 'Add a required array to enforce parameter validation'
        });
      }
    }
  }

  /**
   * Validate result mapping JSONPath expressions
   * @private
   */
  validateResultMapping(resultMapping, basePath, errors, warnings) {
    const validateMappingObject = (obj, path) => {
      for (const [key, expression] of Object.entries(obj)) {
        if (typeof expression !== 'string') {
          errors.push({
            path: `${path}/${key}`,
            message: 'Result mapping values must be JSONPath strings',
            suggestion: 'Use JSONPath expressions like "$.property" or "$.nested.value"'
          });
        } else if (!expression.startsWith('$.')) {
          errors.push({
            path: `${path}/${key}`,
            message: `Invalid JSONPath expression '${expression}'`,
            suggestion: 'JSONPath expressions must start with "$."'
          });
        }
      }
    };

    if (resultMapping.success) {
      validateMappingObject(resultMapping.success, `${basePath}/success`);
    }
    
    if (resultMapping.error) {
      validateMappingObject(resultMapping.error, `${basePath}/error`);
    }
  }

  /**
   * Validate tool examples
   * @private
   */
  validateToolExamples(examples, parameters, basePath, errors, warnings) {
    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      const examplePath = `${basePath}/${i}`;

      // Validate example input against parameter schema
      if (parameters && example.input) {
        // Simple validation - just check that required fields are present
        if (parameters && parameters.required && Array.isArray(parameters.required)) {
          const missingFields = parameters.required.filter(field => !(field in example.input));
          if (missingFields.length > 0) {
            warnings.push({
              path: `${examplePath}/input`,
              message: `Example input is missing required fields: ${missingFields.join(', ')}`,
              suggestion: 'Ensure example inputs include all required parameters'
            });
          }
        }
      }
    }
  }

  /**
   * Validate package path
   * @private
   */
  validatePackagePath(packagePath, errors, warnings) {
    // Check for common path issues
    if (packagePath.startsWith('/')) {
      warnings.push({
        path: '/package',
        message: 'Package path is absolute - consider using relative paths',
        suggestion: 'Use relative paths like "./MyModule.js" for better portability'
      });
    }

    if (!packagePath.includes('.js') && !packagePath.includes('.mjs')) {
      warnings.push({
        path: '/package',
        message: 'Package path does not specify a JavaScript file extension',
        suggestion: 'Add .js or .mjs extension for clarity'
      });
    }
  }

  /**
   * Validate naming conventions
   * @private
   */
  validateNaming(moduleJson, errors, warnings) {
    // Check module name conventions
    if (moduleJson.name && moduleJson.name.includes('_')) {
      warnings.push({
        path: '/name',
        message: 'Module names should use kebab-case (hyphens) not snake_case (underscores)',
        suggestion: `Consider renaming to '${moduleJson.name.replace(/_/g, '-')}'`
      });
    }

    // Check initialization class name conventions
    if (moduleJson.initialization?.className) {
      const className = moduleJson.initialization.className;
      if (!/^[A-Z]/.test(className)) {
        warnings.push({
          path: '/initialization/className',
          message: 'Class names should start with a capital letter (PascalCase)',
          suggestion: `Consider renaming to '${className.charAt(0).toUpperCase() + className.slice(1)}'`
        });
      }
    }
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.validationCache.clear();
  }

  /**
   * Get validation statistics
   */
  getStats() {
    return {
      cacheSize: this.validationCache.size,
      validatorType: 'simple'
    };
  }
}