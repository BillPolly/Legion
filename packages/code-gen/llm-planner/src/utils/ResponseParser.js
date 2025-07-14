/**
 * ResponseParser - Utility for parsing LLM responses into structured data
 */

class ResponseParser {
  constructor() {
    this.parsers = {
      json: this._parseJSON.bind(this),
      markdown: this._parseMarkdown.bind(this),
      yaml: this._parseYAML.bind(this),
      xml: this._parseXML.bind(this),
      text: this._parseText.bind(this)
    };
  }

  /**
   * Parse response with options
   * @param {string} response - Response to parse
   * @param {Object} options - Parse options
   * @returns {Object|null} Parsed data
   */
  parse(response, options = {}) {
    if (!response || typeof response !== 'string') {
      return null;
    }

    try {
      let parsed;

      if (options.format) {
        // Use specific format parser
        const parser = options.format === 'custom' ? 
          this.parsers[options.format] : 
          this.parsers[options.format];
        
        if (!parser) {
          throw new Error(`Unknown format: ${options.format}`);
        }
        
        parsed = parser(response, options);
      } else if (options.startDelimiter && options.endDelimiter) {
        // Extract content between delimiters
        const start = response.indexOf(options.startDelimiter);
        const end = response.indexOf(options.endDelimiter);
        
        if (start !== -1 && end !== -1) {
          const content = response.substring(
            start + options.startDelimiter.length,
            end
          );
          parsed = this._parseJSON(content, options);
        }
      } else if (options.parsers) {
        // Chain multiple parsers
        parsed = response;
        for (const parserName of options.parsers) {
          if (parserName === 'markdown') {
            // Extract JSON from markdown code blocks
            const jsonMatch = parsed.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
              parsed = jsonMatch[1].trim();
            }
          } else if (this.parsers[parserName]) {
            parsed = this.parsers[parserName](parsed, options);
          }
        }
      } else {
        // Try to extract JSON from markdown code blocks first
        const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = this._parseJSON(jsonMatch[1].trim(), options);
        } else {
          // Direct JSON parse
          parsed = this._parseJSON(response, options);
        }
      }

      // Apply transformations
      if (options.transform && parsed) {
        parsed = options.transform(parsed);
      }

      if (options.fieldMap && parsed) {
        parsed = this._applyFieldMap(parsed, options.fieldMap);
      }

      if (options.normalize && parsed) {
        parsed = this._normalize(parsed);
      }

      return parsed;
    } catch (error) {
      if (options.throwOnError) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Parse all JSON blocks in response
   * @param {string} response - Response to parse
   * @returns {Array} Array of parsed objects
   */
  parseAll(response) {
    const jsonBlocks = [];
    const regex = /```json\s*([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        jsonBlocks.push(parsed);
      } catch (e) {
        // Skip invalid JSON blocks
      }
    }

    return jsonBlocks;
  }

  /**
   * Parse response as plan structure
   * @param {string} response - Response to parse
   * @returns {Object} Parsed plan
   */
  parsePlan(response) {
    return this.parse(response, {
      validate: true,
      normalize: true
    });
  }

  /**
   * Extract steps from text
   * @param {string} response - Response text
   * @returns {Array} Extracted steps
   */
  extractSteps(response) {
    const steps = [];
    
    // Match numbered steps with descriptions
    const stepRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*-\s*(.+)/g;
    let match;

    while ((match = stepRegex.exec(response)) !== null) {
      steps.push({
        order: parseInt(match[1]),
        name: match[2].trim(),
        description: match[3].trim()
      });
    }

    return steps;
  }

  /**
   * Parse file/directory structure
   * @param {string} response - Structure text
   * @returns {Array} Parsed structure
   */
  parseStructure(response) {
    const lines = response.split('\n');
    const structure = [];
    const stack = [{ children: structure, level: -1 }];

    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;

      const match = line.match(/^(\s*)[-*]\s*(.+)/);
      if (!match) continue;

      const level = match[1].length / 2;
      const name = match[2].trim();

      const item = {
        name,
        children: []
      };

      // Find parent level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // Add to parent's children
      stack[stack.length - 1].children.push(item);
      
      // Add to stack for potential children
      stack.push({ ...item, level });
    }

    return structure;
  }

  /**
   * Validate data against schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @returns {boolean} Validation result
   */
  validate(data, schema) {
    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && !(field in data)) {
        return false;
      }

      if (field in data) {
        const value = data[field];

        if (rules.type && typeof value !== rules.type) {
          if (!(rules.type === 'array' && Array.isArray(value))) {
            return false;
          }
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          return false;
        }

        if (rules.validator && !rules.validator(value)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get validation errors
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @returns {Array} Validation errors
   */
  getValidationErrors(data, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      if (rules.required && !(field in data)) {
        errors.push({
          field,
          error: `Field '${field}' is required`
        });
      }

      if (field in data) {
        const value = data[field];

        if (rules.type && typeof value !== rules.type) {
          if (!(rules.type === 'array' && Array.isArray(value))) {
            errors.push({
              field,
              error: `Field '${field}' must be of type ${rules.type}`
            });
          }
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push({
            field,
            error: `Field '${field}' does not match pattern`
          });
        }

        if (rules.validator && !rules.validator(value)) {
          errors.push({
            field,
            error: `Field '${field}' failed custom validation`
          });
        }
      }
    }

    return errors;
  }

  /**
   * Parse with error handling
   * @param {string} response - Response to parse
   * @returns {Object} Result with success/error info
   */
  parseWithErrors(response) {
    try {
      const data = this.parse(response, { throwOnError: true });
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.name
        }
      };
    }
  }

  /**
   * Merge multiple responses
   * @param {Array} responses - Responses to merge
   * @returns {Object} Merged data
   */
  mergeResponses(responses) {
    const merged = {};

    for (const response of responses) {
      // Try to parse as JSON first
      let parsed = null;
      try {
        parsed = JSON.parse(response);
      } catch (e) {
        // Try to extract steps from text
        const steps = this.extractSteps(response);
        if (steps.length > 0) {
          parsed = { steps };
        } else {
          // Try to parse numbered list
          const lines = response.split('\n');
          const listSteps = [];
          for (const line of lines) {
            const match = line.match(/^(\d+)\.\s+(.+)/);
            if (match) {
              listSteps.push({
                order: parseInt(match[1]),
                name: match[2].trim()
              });
            }
          }
          if (listSteps.length > 0) {
            parsed = { steps: listSteps };
          }
        }
      }

      if (parsed) {
        // Merge arrays properly
        for (const [key, value] of Object.entries(parsed)) {
          if (Array.isArray(value) && Array.isArray(merged[key])) {
            merged[key] = [...merged[key], ...value];
          } else {
            merged[key] = value;
          }
        }
      }
    }

    return merged;
  }

  /**
   * Extract code blocks from response
   * @param {string} response - Response text
   * @returns {Array} Code blocks
   */
  extractCodeBlocks(response) {
    const blocks = [];
    const regex = /```(\w+)?\s*([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
      blocks.push({
        language: match[1] || 'plaintext',
        code: match[2].trim()
      });
    }

    return blocks;
  }

  /**
   * Create streaming parser
   * @returns {Object} Stream parser
   */
  createStreamParser() {
    let buffer = '';

    return {
      parse: async (chunk) => {
        buffer += chunk;

        // Try to parse complete JSON
        try {
          const parsed = JSON.parse(buffer);
          buffer = ''; // Clear buffer on successful parse
          return parsed;
        } catch (e) {
          // Check if we have a complete JSON object
          const openBraces = (buffer.match(/{/g) || []).length;
          const closeBraces = (buffer.match(/}/g) || []).length;

          if (openBraces === closeBraces && openBraces > 0) {
            // Should be complete, but invalid JSON
            throw e;
          }

          // Not complete yet
          return null;
        }
      },
      reset: () => {
        buffer = '';
      }
    };
  }

  /**
   * Detect response format
   * @param {string} response - Response to analyze
   * @returns {string} Detected format
   */
  detectFormat(response) {
    const trimmed = response.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }

    if (trimmed.startsWith('#') || trimmed.includes('```')) {
      return 'markdown';
    }

    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'xml';
    }

    if (trimmed.includes(':') && /^[\w-]+:\s*.+$/m.test(trimmed)) {
      return 'yaml';
    }

    return 'text';
  }

  /**
   * Parse automatically based on format
   * @param {string} response - Response to parse
   * @returns {Object} Parsed data
   */
  parseAuto(response) {
    const format = this.detectFormat(response);
    return this.parse(response, { format });
  }

  /**
   * Register custom parser
   * @param {string} name - Parser name
   * @param {Function} parser - Parser function
   */
  registerParser(name, parser) {
    this.parsers[name] = parser;
  }

  // Private methods

  _parseJSON(text, options) {
    return JSON.parse(text);
  }

  _parseMarkdown(text, options) {
    // Simple markdown parsing - extract JSON blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return this._parseJSON(jsonMatch[1].trim(), options);
    }
    return { content: text };
  }

  _parseYAML(text, options) {
    // Simple YAML parsing
    const result = {};
    const lines = text.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([\w-]+):\s*(.+)$/);
      if (match) {
        result[match[1]] = match[2].trim();
      }
    }
    
    return result;
  }

  _parseXML(text, options) {
    // Simple XML parsing - just extract text content
    const match = text.match(/<(\w+)>([^<]+)<\/\1>/);
    if (match) {
      return { [match[1]]: match[2] };
    }
    return { content: text };
  }

  _parseText(text, options) {
    return { content: text };
  }

  _applyFieldMap(data, fieldMap) {
    const mapped = {};
    
    for (const [oldKey, newKey] of Object.entries(fieldMap)) {
      if (oldKey in data) {
        mapped[newKey] = data[oldKey];
      }
    }
    
    // Include unmapped fields
    for (const [key, value] of Object.entries(data)) {
      if (!(key in fieldMap)) {
        mapped[key] = value;
      }
    }
    
    return mapped;
  }

  _normalize(data) {
    if (typeof data === 'string') {
      return data.trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this._normalize(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const normalized = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (key === 'name' && typeof value === 'string') {
          // Capitalize names
          normalized[key] = value.trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        } else if (key === 'id' && typeof value === 'string') {
          // Lowercase and hyphenate IDs
          normalized[key] = value.toLowerCase().replace(/[_\s]+/g, '-');
        } else {
          normalized[key] = this._normalize(value);
        }
      }
      
      return normalized;
    }
    
    return data;
  }
}

export { ResponseParser };