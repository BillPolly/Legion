/**
 * Robust JSON parser that can handle various JSON formats and recover from common issues
 */
export class RobustJsonParser {
  /**
   * Parse JSON from text (alias for parse)
   */
  static parseFromText(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Input text is empty or not a string');
    }
    return this.parse(text);
  }

  /**
   * Parse JSON and validate it has expected keys
   */
  static parseAndValidate(text, expectedKeys = []) {
    const parsed = this.parseFromText(text);
    
    if (expectedKeys.length > 0) {
      const missingKeys = expectedKeys.filter(key => !(key in parsed));
      if (missingKeys.length > 0) {
        throw new Error(`Parsed JSON missing expected keys: ${expectedKeys.join(', ')}`);
      }
    }
    
    return parsed;
  }

  /**
   * Parse JSON with robust error handling and recovery
   */
  static parse(jsonString) {
    if (!jsonString || typeof jsonString !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    // Try direct parse first
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      // If direct parse fails, try recovery strategies
      return this.parseWithRecovery(jsonString);
    }
  }

  /**
   * Try various recovery strategies for malformed JSON
   */
  static parseWithRecovery(jsonString) {
    const strategies = [
      this.extractJsonFromText,
      this.fixCommonErrors,
      this.parseJsonLines,
      this.parsePartialJson
    ];

    let lastError;
    
    for (const strategy of strategies) {
      try {
        const result = strategy.call(this, jsonString);
        if (result !== null && result !== undefined) {
          return result;
        }
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    throw new Error(`Failed to parse JSON from text. Last error: ${lastError?.message}`);
  }

  /**
   * Extract JSON from text that contains other content
   */
  static extractJsonFromText(text) {
    // Look for JSON objects or arrays
    const patterns = [
      /\{[^{}]*\}/,           // Simple object
      /\[[^\[\]]*\]/,         // Simple array  
      /\{[\s\S]*\}/,          // Complex object (multiline)
      /\[[\s\S]*\]/           // Complex array (multiline)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Fix common JSON formatting errors
   */
  static fixCommonErrors(jsonString) {
    let fixed = jsonString.trim();

    // Remove leading/trailing non-JSON content
    fixed = fixed.replace(/^[^{\[]*/, '');
    fixed = fixed.replace(/[^}\]]*$/, '');

    // Fix trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix single quotes to double quotes
    fixed = fixed.replace(/'/g, '"');

    // Fix unquoted keys
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

    // Fix undefined/null values
    fixed = fixed.replace(/:\s*undefined/g, ': null');

    // Try to parse the fixed version
    return JSON.parse(fixed);
  }

  /**
   * Parse JSON Lines format (one JSON object per line)
   */
  static parseJsonLines(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const results = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line.trim());
        results.push(parsed);
      } catch (e) {
        // Skip invalid lines
        continue;
      }
    }

    // Don't return empty arrays - let the main function handle this as a failure
    if (results.length === 0) {
      return null;
    }

    return results.length === 1 ? results[0] : results;
  }

  /**
   * Parse partial/incomplete JSON by adding missing closing brackets
   */
  static parsePartialJson(jsonString) {
    let fixed = jsonString.trim();
    
    // Count brackets to determine what's missing
    let braceCount = 0;
    let bracketCount = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
    }

    // Add missing closing brackets
    while (braceCount > 0) {
      fixed += '}';
      braceCount--;
    }
    
    while (bracketCount > 0) {
      fixed += ']';
      bracketCount--;
    }

    return JSON.parse(fixed);
  }

  /**
   * Validate if a string is valid JSON
   */
  static isValidJson(jsonString) {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extract all JSON objects from text
   */
  static extractAllJson(text) {
    const results = [];
    let pos = 0;

    while (pos < text.length) {
      // Find next potential JSON start
      const openBrace = text.indexOf('{', pos);
      const openBracket = text.indexOf('[', pos);
      
      let nextStart = -1;
      if (openBrace !== -1 && openBracket !== -1) {
        nextStart = Math.min(openBrace, openBracket);
      } else if (openBrace !== -1) {
        nextStart = openBrace;
      } else if (openBracket !== -1) {
        nextStart = openBracket;
      }

      if (nextStart === -1) break;

      // Try to parse from this position
      try {
        const substring = text.substring(nextStart);
        const parsed = this.extractJsonFromText(substring);
        if (parsed) {
          results.push(parsed);
        }
      } catch (e) {
        // Continue searching
      }

      pos = nextStart + 1;
    }

    return results;
  }
}