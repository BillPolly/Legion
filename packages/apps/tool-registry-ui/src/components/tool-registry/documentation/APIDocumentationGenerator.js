/**
 * APIDocumentationGenerator
 * Generates API documentation for planning components
 * Updated for ToolRegistry singleton pattern
 */

export class APIDocumentationGenerator {
  constructor() {
    this.componentDocs = new Map();
    this.generatedDocs = new Map();
  }

  /**
   * Generate documentation for a component
   * @param {Object} component - The component instance
   * @param {Object} api - The component's API object
   * @returns {Object} Documentation object
   */
  generateComponentDocumentation(component, api) {
    if (!component || !api) {
      return null;
    }

    const componentName = component.constructor.name || 'UnknownComponent';
    
    const doc = {
      name: componentName,
      description: this.getComponentDescription(component),
      methods: this.extractMethods(api),
      properties: this.extractProperties(api),
      events: this.extractEvents(component),
      lifecycle: this.extractLifecycleMethods(api),
      timestamp: new Date().toISOString()
    };

    this.componentDocs.set(componentName, doc);
    return doc;
  }

  /**
   * Extract component description
   * @param {Object} component - Component instance
   * @returns {string} Description
   */
  getComponentDescription(component) {
    if (component.constructor.name.includes('Goal')) {
      return 'Interface for capturing and managing user goals';
    } else if (component.constructor.name.includes('Plan')) {
      return 'Component for planning and plan management operations';
    } else if (component.constructor.name.includes('Execution')) {
      return 'Component for controlling and monitoring plan execution';
    } else if (component.constructor.name.includes('Visualization')) {
      return 'Component for visualizing plans and execution progress';
    } else if (component.constructor.name.includes('Library')) {
      return 'Component for managing plan libraries and templates';
    } else if (component.constructor.name.includes('Decomposition')) {
      return 'Component for task decomposition and hierarchy management';
    }
    return 'Planning system component';
  }

  /**
   * Extract API methods
   * @param {Object} api - API object
   * @returns {Array} Array of method documentation
   */
  extractMethods(api) {
    const methods = [];
    
    for (const [key, value] of Object.entries(api)) {
      if (typeof value === 'function') {
        methods.push({
          name: key,
          type: 'function',
          description: this.getMethodDescription(key),
          parameters: this.guessParameters(key),
          returns: this.guessReturnType(key)
        });
      }
    }

    return methods.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Extract API properties
   * @param {Object} api - API object
   * @returns {Array} Array of property documentation
   */
  extractProperties(api) {
    const properties = [];
    
    for (const [key, value] of Object.entries(api)) {
      if (typeof value !== 'function') {
        properties.push({
          name: key,
          type: typeof value,
          value: this.sanitizeValue(value),
          description: this.getPropertyDescription(key)
        });
      }
    }

    return properties.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Extract lifecycle methods
   * @param {Object} api - API object
   * @returns {Array} Array of lifecycle methods
   */
  extractLifecycleMethods(api) {
    const lifecycleMethods = [
      'isReady', 'getState', 'setState', 'reset', 'destroy',
      'hasError', 'getLastError', 'clearError'
    ];

    return lifecycleMethods.filter(method => 
      typeof api[method] === 'function'
    ).map(method => ({
      name: method,
      description: this.getLifecycleDescription(method)
    }));
  }

  /**
   * Extract events (placeholder)
   * @param {Object} component - Component instance
   * @returns {Array} Array of events
   */
  extractEvents(component) {
    // Placeholder for event extraction
    return [];
  }

  /**
   * Get method description based on name
   * @param {string} methodName - Method name
   * @returns {string} Description
   */
  getMethodDescription(methodName) {
    const descriptions = {
      // Goal methods
      setGoal: 'Set the current goal text',
      getGoal: 'Get the current goal text',
      clearGoal: 'Clear the current goal',
      
      // Plan methods
      createPlan: 'Create a new plan from the current goal',
      savePlan: 'Save a plan to storage',
      loadPlan: 'Load a plan from storage',
      deletePlan: 'Delete a plan from storage',
      getCurrentPlan: 'Get the currently active plan',
      setCurrentPlan: 'Set the currently active plan',
      
      // Execution methods
      startExecution: 'Start executing the current plan',
      pauseExecution: 'Pause plan execution',
      resumeExecution: 'Resume paused execution',
      stopExecution: 'Stop plan execution',
      stepExecution: 'Execute one step of the plan',
      getExecutionStatus: 'Get current execution status',
      
      // Library methods
      getPlans: 'Get all stored plans',
      duplicatePlan: 'Create a duplicate of a plan',
      importPlan: 'Import a plan from external source',
      
      // Visualization methods
      renderPlan: 'Render the plan visualization',
      updateVisualization: 'Update the visualization display'
    };

    return descriptions[methodName] || 'Component method';
  }

  /**
   * Get property description based on name
   * @param {string} propertyName - Property name
   * @returns {string} Description
   */
  getPropertyDescription(propertyName) {
    const descriptions = {
      ready: 'Component ready state',
      error: 'Last error encountered',
      state: 'Current component state'
    };

    return descriptions[propertyName] || 'Component property';
  }

  /**
   * Get lifecycle method description
   * @param {string} methodName - Method name
   * @returns {string} Description
   */
  getLifecycleDescription(methodName) {
    const descriptions = {
      isReady: 'Check if component is ready for use',
      getState: 'Get current component state',
      setState: 'Set component state',
      reset: 'Reset component to initial state',
      destroy: 'Clean up component resources',
      hasError: 'Check if component has an error',
      getLastError: 'Get the last error encountered',
      clearError: 'Clear the current error state'
    };

    return descriptions[methodName] || 'Lifecycle method';
  }

  /**
   * Guess method parameters based on name
   * @param {string} methodName - Method name
   * @returns {Array} Parameter documentation
   */
  guessParameters(methodName) {
    const parameterMaps = {
      setGoal: [{ name: 'goal', type: 'string', description: 'The goal text' }],
      savePlan: [{ name: 'plan', type: 'Object', description: 'Plan to save' }],
      loadPlan: [{ name: 'planId', type: 'string', description: 'ID of plan to load' }],
      deletePlan: [{ name: 'planId', type: 'string', description: 'ID of plan to delete' }],
      setCurrentPlan: [{ name: 'plan', type: 'Object', description: 'Plan to set as current' }],
      setState: [{ name: 'state', type: 'Object', description: 'New state object' }]
    };

    return parameterMaps[methodName] || [];
  }

  /**
   * Guess return type based on method name
   * @param {string} methodName - Method name
   * @returns {string} Return type
   */
  guessReturnType(methodName) {
    if (methodName.startsWith('get')) return 'any';
    if (methodName.startsWith('is') || methodName.startsWith('has')) return 'boolean';
    if (methodName.includes('save') || methodName.includes('create')) return 'Object';
    return 'void';
  }

  /**
   * Sanitize value for documentation
   * @param {any} value - Value to sanitize
   * @returns {string} Sanitized value
   */
  sanitizeValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') return '[Object]';
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  }

  /**
   * Generate markdown documentation
   * @param {string} componentName - Component name
   * @returns {string} Markdown documentation
   */
  generateMarkdown(componentName) {
    const doc = this.componentDocs.get(componentName);
    if (!doc) {
      return `# ${componentName} API Documentation\n\nNo documentation available.`;
    }

    let markdown = `# ${doc.name} API Documentation\n\n`;
    markdown += `${doc.description}\n\n`;
    markdown += `*Generated: ${doc.timestamp}*\n\n`;

    if (doc.lifecycle.length > 0) {
      markdown += `## Lifecycle Methods\n\n`;
      doc.lifecycle.forEach(method => {
        markdown += `### ${method.name}()\n${method.description}\n\n`;
      });
    }

    if (doc.methods.length > 0) {
      markdown += `## Methods\n\n`;
      doc.methods.forEach(method => {
        markdown += `### ${method.name}(`;
        if (method.parameters.length > 0) {
          markdown += method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        }
        markdown += `): ${method.returns}\n\n${method.description}\n\n`;
        
        if (method.parameters.length > 0) {
          markdown += `**Parameters:**\n`;
          method.parameters.forEach(param => {
            markdown += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
          });
          markdown += `\n`;
        }
      });
    }

    if (doc.properties.length > 0) {
      markdown += `## Properties\n\n`;
      doc.properties.forEach(prop => {
        markdown += `### ${prop.name}: ${prop.type}\n${prop.description}\n\n`;
      });
    }

    return markdown;
  }

  /**
   * Generate HTML documentation
   * @param {string} componentName - Component name
   * @returns {string} HTML documentation
   */
  generateHTML(componentName) {
    const doc = this.componentDocs.get(componentName);
    if (!doc) {
      return `<!DOCTYPE html><html><head><title>${componentName} API</title></head><body><h1>${componentName} API Documentation</h1><p>No documentation available.</p></body></html>`;
    }

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${doc.name} API Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    h3 { color: #888; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    .timestamp { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <h1>${doc.name} API Documentation</h1>
  <p>${doc.description}</p>
  <p class="timestamp">Generated: ${doc.timestamp}</p>`;

    if (doc.lifecycle.length > 0) {
      html += `<h2>Lifecycle Methods</h2>`;
      doc.lifecycle.forEach(method => {
        html += `<h3>${method.name}()</h3><p>${method.description}</p>`;
      });
    }

    if (doc.methods.length > 0) {
      html += `<h2>Methods</h2>`;
      doc.methods.forEach(method => {
        html += `<h3>${method.name}(`;
        if (method.parameters.length > 0) {
          html += method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        }
        html += `): ${method.returns}</h3><p>${method.description}</p>`;
      });
    }

    if (doc.properties.length > 0) {
      html += `<h2>Properties</h2>`;
      doc.properties.forEach(prop => {
        html += `<h3>${prop.name}: ${prop.type}</h3><p>${prop.description}</p>`;
      });
    }

    html += `</body></html>`;
    return html;
  }

  /**
   * Get all component documentation
   * @returns {Map} All documentation
   */
  getAllDocumentation() {
    return this.componentDocs;
  }

  /**
   * Clear all documentation
   */
  clearDocumentation() {
    this.componentDocs.clear();
    this.generatedDocs.clear();
  }
}