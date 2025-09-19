/**
 * ArtifactRegistry - Manages artifacts with proper structure and formatting
 */
export default class ArtifactRegistry {
  constructor() {
    this.artifacts = new Map();
  }

  /**
   * Store an artifact with full metadata
   * @param {string} name - The artifact name (used for @references)
   * @param {*} value - The actual value
   * @param {string} description - Human-readable description
   * @param {string} type - The type (derived from tool output or specified)
   */
  store(name, value, description, type = null) {
    const artifact = {
      name,
      value,
      description: description || `Artifact ${name}`,
      type: type || this._inferType(value),
      createdAt: new Date().toISOString()
    };
    
    this.artifacts.set(name, artifact);
    return artifact;
  }

  /**
   * Get an artifact by name
   */
  get(name) {
    return this.artifacts.get(name);
  }

  /**
   * Get the value of an artifact
   */
  getValue(name) {
    const artifact = this.artifacts.get(name);
    return artifact ? artifact.value : undefined;
  }

  /**
   * Check if an artifact exists
   */
  has(name) {
    return this.artifacts.has(name);
  }

  /**
   * Get all artifact names
   */
  list() {
    return Array.from(this.artifacts.keys());
  }

  /**
   * Get all artifacts with their metadata
   */
  getAll() {
    return Array.from(this.artifacts.entries()).map(([name, artifact]) => ({
      name,
      ...artifact
    }));
  }

  /**
   * Get the number of artifacts
   */
  size() {
    return this.artifacts.size;
  }

  /**
   * Clear all artifacts
   */
  clear() {
    this.artifacts.clear();
  }

  /**
   * Resolve artifact references in any object/string
   * Replaces @artifact_name with the actual value
   */
  resolveReferences(input) {
    if (typeof input === 'string') {
      // Replace @artifact_name references
      return input.replace(/@(\w+)/g, (match, name) => {
        const artifact = this.artifacts.get(name);
        if (artifact) {
          const value = artifact.value;
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return match; // Keep unchanged if not found
      });
    }
    
    if (typeof input === 'object' && input !== null) {
      // Recursively resolve in objects
      const resolved = Array.isArray(input) ? [] : {};
      for (const [key, value] of Object.entries(input)) {
        resolved[key] = this.resolveReferences(value);
      }
      return resolved;
    }
    
    return input;
  }

  /**
   * Format artifacts for prompt inclusion (deprecated - use PromptBuilder instead)
   * @deprecated Use PromptBuilder.formatArtifactsSection() instead
   */
  formatForPrompt() {
    // This method is kept for backwards compatibility but should not be used
    // Use PromptBuilder.formatArtifactsSection() instead
    if (this.artifacts.size === 0) {
      return 'No artifacts available.';
    }

    const lines = [];
    for (const [name, artifact] of this.artifacts.entries()) {
      lines.push(`@${name} (${artifact.type}): ${artifact.description}`);
    }
    return lines.join('\n');
  }

  /**
   * Create an artifact from a tool result
   * @param {string} name - Artifact name
   * @param {object} toolResult - Result from tool execution
   * @param {object} toolMetadata - Tool metadata (for type info)
   */
  storeToolResult(name, toolResult, toolMetadata = {}) {
    // Extract the actual value from tool result
    const value = toolResult.result !== undefined ? toolResult.result : toolResult;
    
    // Build description from tool info
    const description = toolResult.message || 
                       toolMetadata.description || 
                       `Result from ${toolMetadata.name || 'tool'}`;
    
    // Infer type from tool output schema if available
    const type = this._inferTypeFromSchema(toolMetadata.outputSchema) || 
                 this._inferType(value);
    
    return this.store(name, value, description, type);
  }

  /**
   * Export all artifacts as a plain object (for serialization)
   */
  toJSON() {
    const obj = {};
    for (const [name, artifact] of this.artifacts.entries()) {
      obj[name] = artifact;
    }
    return obj;
  }

  /**
   * Import artifacts from a plain object
   */
  fromJSON(obj) {
    this.artifacts.clear();
    for (const [name, artifact] of Object.entries(obj)) {
      this.artifacts.set(name, artifact);
    }
  }

  // Private helper methods

  _inferType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    if (type !== 'object') return type;
    
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (value instanceof RegExp) return 'regexp';
    
    // Check for file-like objects
    if (value.path && (value.content !== undefined || value.data !== undefined)) {
      return 'file';
    }
    
    return 'object';
  }

  _inferTypeFromSchema(schema) {
    if (!schema) return null;
    
    // Handle JSON Schema format
    if (schema.type) {
      if (schema.type === 'object' && schema.properties) {
        // Check if it looks like a file schema
        if (schema.properties.path && schema.properties.content) {
          return 'file';
        }
      }
      return schema.type;
    }
    
    // Handle other schema formats
    if (schema.$type) return schema.$type;
    if (schema.dataType) return schema.dataType;
    
    return null;
  }
}