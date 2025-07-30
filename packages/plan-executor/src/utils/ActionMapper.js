/**
 * ActionMapper - Maps plan actions to Legion tool invocations
 * 
 * This utility converts action types from plans into actual Legion tool calls
 * with proper parameter mapping.
 */

export class ActionMapper {
  constructor() {
    // Define mappings from action types to Legion tools
    this.actionMappings = {
      // File operations
      'file_write': {
        moduleName: 'file',
        toolName: 'file_operations',
        functionName: 'file_write',
        parameterMap: {
          'filepath': 'filepath',
          'content': 'content'
        }
      },
      'file_read': {
        moduleName: 'file',
        toolName: 'file_operations',
        functionName: 'file_read',
        parameterMap: {
          'filepath': 'filepath'
        }
      },
      'directory_create': {
        moduleName: 'file',
        toolName: 'file_operations',
        functionName: 'directory_create',
        parameterMap: {
          'dirpath': 'dirpath'
        }
      },
      
      // Node runner operations
      'node_run_command': {
        moduleName: 'node-runner',
        toolName: 'node_runner',
        functionName: 'executeCommand',
        parameterMap: {
          'command': 'command',
          'cwd': 'cwd'
        },
        transform: (params) => {
          // NodeRunner expects these as direct method parameters
          return {
            command: params.command,
            options: params.cwd ? { cwd: params.cwd } : {}
          };
        }
      },
      'npm_init': {
        moduleName: 'node-runner',
        toolName: 'node_runner',
        functionName: 'executeCommand',
        parameterMap: {
          'project_name': null  // Not used directly
        },
        transform: (params) => {
          return {
            command: 'npm init -y',
            options: {}
          };
        }
      },
      'npm_install': {
        moduleName: 'node-runner',
        toolName: 'node_runner',
        functionName: 'executeCommand',
        parameterMap: {
          'packages': null,
          'dev': null
        },
        transform: (params) => {
          const packages = params.packages || [];
          const devFlag = params.dev ? '--save-dev' : '';
          const command = `npm install ${devFlag} ${packages.join(' ')}`.trim();
          return {
            command,
            options: {}
          };
        }
      },
      'run_file': {
        moduleName: 'node-runner',
        toolName: 'node_runner',
        functionName: 'executeCommand',
        parameterMap: {
          'filepath': null
        },
        transform: (params) => {
          return {
            command: `node ${params.filepath}`,
            options: {}
          };
        }
      }
    };
  }

  /**
   * Map a plan action to a Legion tool invocation
   * @param {Object} action - The plan action to map
   * @returns {Object} Tool invocation details
   */
  mapActionToTool(action) {
    const mapping = this.actionMappings[action.type];
    
    if (!mapping) {
      throw new Error(`No mapping found for action type: ${action.type}`);
    }
    
    // Build the tool invocation
    const toolInvocation = {
      moduleName: mapping.moduleName,
      toolName: mapping.toolName,
      functionName: mapping.functionName,
      parameters: {}
    };
    
    // Apply parameter transformation if defined
    if (mapping.transform) {
      const transformed = mapping.transform(action.parameters);
      toolInvocation.parameters = transformed;
    } else {
      // Direct parameter mapping
      for (const [actionParam, toolParam] of Object.entries(mapping.parameterMap)) {
        if (toolParam && action.parameters[actionParam] !== undefined) {
          toolInvocation.parameters[toolParam] = action.parameters[actionParam];
        }
      }
    }
    
    return toolInvocation;
  }

  /**
   * Create a tool call format for Legion tool invocation
   * @param {Object} action - The plan action
   * @returns {Object} Tool call in Legion format
   */
  createToolCall(action) {
    const mapping = this.mapActionToTool(action);
    
    // For file operations, we need the function call format
    if (mapping.moduleName === 'file') {
      return {
        function: {
          name: mapping.functionName,
          arguments: JSON.stringify(mapping.parameters)
        }
      };
    }
    
    // For node-runner, we can call methods directly
    // This will be handled by the executor
    return {
      moduleName: mapping.moduleName,
      methodName: mapping.functionName,
      parameters: mapping.parameters
    };
  }

  /**
   * Get required modules for a plan
   * @param {Object} plan - The plan to analyze
   * @returns {Array<string>} List of required module names
   */
  getRequiredModules(plan) {
    const modules = new Set();
    
    // Iterate through all actions in the plan
    for (const step of plan.steps) {
      for (const action of step.actions) {
        const mapping = this.actionMappings[action.type];
        if (mapping) {
          modules.add(mapping.moduleName);
        }
      }
    }
    
    return Array.from(modules);
  }

  /**
   * Validate that all actions in a plan can be mapped
   * @param {Object} plan - The plan to validate
   * @returns {Object} Validation result
   */
  validatePlan(plan) {
    const errors = [];
    const warnings = [];
    
    for (const step of plan.steps) {
      for (const action of step.actions) {
        if (!this.actionMappings[action.type]) {
          errors.push(`No mapping for action type '${action.type}' in step '${step.id}'`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}