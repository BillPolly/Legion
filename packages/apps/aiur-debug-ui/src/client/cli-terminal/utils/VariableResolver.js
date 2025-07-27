/**
 * VariableResolver - Handles @variable resolution and variable management
 */

export class VariableResolver {
  constructor(aiurConnection) {
    this.aiur = aiurConnection;
    this.localVariables = new Map();
  }

  /**
   * Set a local variable
   */
  setVariable(name, value) {
    this.localVariables.set(name, value);
  }

  /**
   * Get a local variable
   */
  getVariable(name) {
    return this.localVariables.get(name);
  }

  /**
   * Clear all local variables
   */
  clearVariables() {
    this.localVariables.clear();
  }

  /**
   * Get all variables (local and context)
   */
  async getAllVariables() {
    const variables = {
      local: Array.from(this.localVariables.entries()).map(([name, value]) => ({
        name,
        value,
        type: 'local'
      })),
      context: []
    };

    // Fetch context variables
    try {
      const result = await this.aiur.sendMcpRequest('tools/call', {
        name: 'context_list',
        arguments: {}
      });

      if (result?.items) {
        variables.context = result.items.map(item => ({
          name: '@' + item.name,
          value: item.data,
          type: 'context',
          description: item.description
        }));
      }
    } catch (error) {
      console.error('Failed to fetch context variables:', error);
    }

    return variables;
  }

  /**
   * Resolve @variable references in an object
   */
  async resolve(obj) {
    return this._resolveRecursive(obj);
  }

  /**
   * Recursive resolution of variables
   */
  async _resolveRecursive(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle strings
    if (typeof obj === 'string') {
      return await this._resolveString(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this._resolveRecursive(item)));
    }

    // Handle objects
    if (typeof obj === 'object') {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = await this._resolveRecursive(value);
      }
      return resolved;
    }

    // Return primitives as-is
    return obj;
  }

  /**
   * Resolve a string that might contain @variable references
   */
  async _resolveString(str) {
    // Check if entire string is a variable reference
    if (str.startsWith('@') && /^@[\w_]+$/.test(str)) {
      const varName = str.substring(1);
      
      // Check local variables first (with $ prefix)
      const localVar = '$' + varName;
      if (this.localVariables.has(localVar)) {
        return this.localVariables.get(localVar);
      }

      // Fetch from context
      try {
        const result = await this.aiur.sendMcpRequest('tools/call', {
          name: 'context_get',
          arguments: { name: varName }
        });
        
        return result?.data !== undefined ? result.data : str;
      } catch (error) {
        console.warn(`Failed to resolve @${varName}:`, error.message);
        return str;
      }
    }

    // Handle string interpolation (future feature)
    // For now, return as-is
    return str;
  }

  /**
   * Check if a value contains variable references
   */
  hasVariableReferences(obj) {
    if (typeof obj === 'string') {
      return obj.startsWith('@');
    }

    if (Array.isArray(obj)) {
      return obj.some(item => this.hasVariableReferences(item));
    }

    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => this.hasVariableReferences(value));
    }

    return false;
  }
}