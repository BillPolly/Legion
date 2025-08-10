/**
 * DynamicJsonModule - Handles JSON modules with inline JavaScript functions
 * 
 * This class creates modules dynamically from JSON definitions where
 * the tool functions are defined as JavaScript code strings.
 */

export class DynamicJsonModule {
  constructor(name, metadata) {
    this.name = name;
    this.metadata = metadata;
    this.tools = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    // If metadata contains the full module definition, use it
    // Otherwise, try to load the module.json file
    let moduleDefinition = this.metadata;
    
    if (!moduleDefinition.tools && this.metadata.path) {
      // Load module.json from file path
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const modulePath = path.resolve(this.metadata.path, 'module.json');
        const content = await fs.readFile(modulePath, 'utf-8');
        moduleDefinition = JSON.parse(content);
      } catch (error) {
        console.error(`Failed to load module.json for ${this.name}:`, error.message);
        throw error;
      }
    }
    
    // Create tools from the definition
    if (moduleDefinition.tools && Array.isArray(moduleDefinition.tools)) {
      for (const toolDef of moduleDefinition.tools) {
        const tool = this.createDynamicTool(toolDef);
        this.tools.set(toolDef.name, tool);
      }
    }
    
    this.initialized = true;
  }

  /**
   * Create a dynamic tool from its definition with inline JavaScript
   */
  createDynamicTool(toolDef) {
    // Create an executable function from the string
    let executeFunction;
    
    if (typeof toolDef.function === 'string') {
      try {
        // Use Function constructor to create the function from string
        // The function string should be like: "async function name(params) { ... }"
        // We need to extract just the function body and parameters
        
        // Try to parse as a complete function definition
        const funcMatch = toolDef.function.match(/^(?:async\s+)?function\s*\w*\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/);
        
        if (funcMatch) {
          const [, params, body] = funcMatch;
          // Create an async function with the extracted parameters and body
          executeFunction = new Function(params || 'params', `
            return (async function() {
              ${body}
            }).apply(this, arguments);
          `);
        } else {
          // Fallback: treat the entire string as the function body
          executeFunction = new Function('params', `
            return (async function() {
              ${toolDef.function}
            }).call(this, params);
          `);
        }
      } catch (error) {
        console.error(`Failed to create function for tool ${toolDef.name}:`, error.message);
        // Create a function that returns an error
        executeFunction = async (params) => {
          return {
            success: false,
            error: `Failed to execute tool: ${error.message}`
          };
        };
      }
    } else {
      // If function is not a string, create an error function
      executeFunction = async (params) => {
        return {
          success: false,
          error: 'Tool function is not properly defined'
        };
      };
    }
    
    // Wrap the execute function to ensure proper error handling
    const wrappedExecute = async (params) => {
      try {
        const result = await executeFunction(params);
        
        // Ensure result is in standard format
        if (result && typeof result === 'object' && 'success' in result) {
          return result;
        }
        
        // Wrap non-standard results
        return {
          success: true,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || 'Unknown error occurred'
        };
      }
    };
    
    // Return a tool-like object
    return {
      name: toolDef.name,
      description: toolDef.description || `Tool ${toolDef.name}`,
      parameters: toolDef.parameters,
      inputSchema: toolDef.parameters, // Alias for compatibility
      execute: wrappedExecute
    };
  }

  /**
   * Get a specific tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Get all tools from this module
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: 'dynamic-json',
      tools: Array.from(this.tools.keys()),
      ...this.metadata
    };
  }
}