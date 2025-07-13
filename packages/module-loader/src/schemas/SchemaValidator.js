/**
 * SchemaValidator - Validates module.json configurations against the schema
 */
export class SchemaValidator {
  constructor() {
    // We'll implement manual validation since we can't rely on external JSON schema validators
    this.validTypes = ['constructor', 'factory', 'singleton', 'static'];
    this.validDependencyTypes = ['string', 'number', 'boolean', 'object', 'array'];
  }

  /**
   * Validate a module configuration
   * @param {Object} config - The module configuration to validate
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validateModuleConfig(config) {
    const errors = [];

    // Check required root fields
    if (!config.name) errors.push('name is required');
    if (!config.version) errors.push('version is required');
    if (!config.description) errors.push('description is required');
    if (!config.package) errors.push('package is required');
    if (!config.type) errors.push('type is required');
    if (!config.tools) errors.push('tools is required');

    // Validate field formats if present
    if (config.name && !/^[a-z][a-z0-9-]*$/.test(config.name)) {
      errors.push('name must be lowercase with hyphens only');
    }

    if (config.version && !/^\d+\.\d+\.\d+.*$/.test(config.version)) {
      errors.push('version must be valid semver');
    }

    if (config.type && !this.validTypes.includes(config.type)) {
      errors.push(`type must be one of: ${this.validTypes.join(', ')}`);
    }

    // Validate dependencies
    if (config.dependencies) {
      this.validateDependencies(config.dependencies, errors);
    }

    // Validate initialization
    if (config.initialization) {
      this.validateInitialization(config.initialization, errors);
    }

    // Validate tools
    if (Array.isArray(config.tools)) {
      config.tools.forEach((tool, index) => {
        this.validateTool(tool, index, errors);
      });
    } else if (config.tools) {
      errors.push('tools must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate dependencies configuration
   */
  validateDependencies(dependencies, errors) {
    Object.entries(dependencies).forEach(([key, dep]) => {
      if (!dep.type) {
        errors.push(`dependencies.${key}.type is required`);
      } else if (!this.validDependencyTypes.includes(dep.type)) {
        errors.push(`dependencies.${key}.type must be one of: ${this.validDependencyTypes.join(', ')}`);
      }

      if (!dep.description) {
        errors.push(`dependencies.${key}.description is required`);
      }
    });
  }

  /**
   * Validate initialization configuration
   */
  validateInitialization(init, errors) {
    if (init.type && !this.validTypes.includes(init.type)) {
      errors.push(`initialization.type must be one of: ${this.validTypes.join(', ')}`);
    }
  }

  /**
   * Validate a single tool configuration
   */
  validateTool(tool, index, errors) {
    const prefix = `tools[${index}]`;

    // Required fields
    if (!tool.name) errors.push(`${prefix}.name is required`);
    if (!tool.description) errors.push(`${prefix}.description is required`);
    if (!tool.function) errors.push(`${prefix}.function is required`);

    // Validate name format
    if (tool.name && !/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      errors.push(`${prefix}.name must be lowercase with underscores only`);
    }

    // Validate parameters if present
    if (tool.parameters) {
      this.validateParameters(tool.parameters, `${prefix}.parameters`, errors);
    }

    // Validate output if present
    if (tool.output) {
      if (tool.output.success) {
        this.validateSchema(tool.output.success, `${prefix}.output.success`, errors);
      }
      if (tool.output.failure) {
        this.validateSchema(tool.output.failure, `${prefix}.output.failure`, errors);
      }
    }
  }

  /**
   * Validate parameter schema
   */
  validateParameters(params, path, errors) {
    if (params.type && params.type !== 'object') {
      errors.push(`${path}.type must be 'object' for function calling compatibility`);
    }

    if (params.properties) {
      Object.entries(params.properties).forEach(([key, prop]) => {
        if (!prop.type) {
          errors.push(`${path}.properties.${key} must have type`);
        }
      });
    }
  }

  /**
   * Basic schema validation
   */
  validateSchema(schema, path, errors) {
    if (schema.type === 'object' && schema.properties) {
      Object.entries(schema.properties).forEach(([key, prop]) => {
        if (!prop.type) {
          errors.push(`${path}.properties.${key} must have type`);
        }
      });
    }
  }
}

export default SchemaValidator;