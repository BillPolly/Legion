// Note: Using native JSON parsing instead of JSON5

/**
 * Robust parser for LLM responses that handles various formats and common issues
 */
class ResponseParser {
  constructor() {
    // Regex patterns for extraction
    this.patterns = {
      // Matches ```json or ``` code blocks
      codeBlock: /```(?:json)?\s*\n?([\s\S]*?)\n?```/g,
      // Matches JSON-like structures
      jsonObject: /\{[\s\S]*\}/,
      jsonArray: /\[[\s\S]*\]/,
      // Matches common LLM response patterns
      jsonInText: /(?:response|result|output|json)[\s:]*(\{[\s\S]*\})/i
    };
  }

  /**
   * Main parse method that tries various strategies to extract and parse JSON
   * @param {string} input - The raw input string from LLM
   * @returns {{success: boolean, data: any, error: string|null}}
   */
  parse(input) {
    if (!input || typeof input !== 'string') {
      return {
        success: false,
        data: null,
        error: 'Empty input or invalid type'
      };
    }

    // Try multiple strategies in order of preference
    const strategies = [
      () => this.tryDirectParse(input),
      () => this.tryCodeBlockExtraction(input),
      () => this.tryJSONExtraction(input),
      () => this.tryCleanAndParse(input)
    ];

    let lastError = null;
    for (const strategy of strategies) {
      try {
        const result = strategy();
        if (result !== null) {
          return {
            success: true,
            data: result,
            error: null
          };
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    // If we have a specific parsing error, report it
    if (lastError) {
      return {
        success: false,
        data: null,
        error: `Failed to parse: ${lastError}`
      };
    }

    return {
      success: false,
      data: null,
      error: 'No valid JSON found in input'
    };
  }

  /**
   * Try to parse the input directly as JSON
   */
  tryDirectParse(input) {
    try {
      return JSON.parse(input.trim());
    } catch (e) {
      // Re-throw to capture the error in main parse method
      if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
        throw e;
      }
      return null;
    }
  }

  /**
   * Extract JSON from code blocks
   */
  tryCodeBlockExtraction(input) {
    const blocks = this.extractCodeBlocks(input);
    
    for (const block of blocks) {
      const parsed = this.tryParse(block);
      if (parsed !== null) {
        return parsed;
      }
    }
    
    return null;
  }

  /**
   * Extract JSON objects from mixed text
   */
  tryJSONExtraction(input) {
    const extracted = this.extractJSON(input);
    if (extracted) {
      return this.tryParse(extracted);
    }
    return null;
  }

  /**
   * Clean the input and try parsing again
   */
  tryCleanAndParse(input) {
    const cleaned = this.cleanInput(input);
    return this.tryParse(cleaned);
  }

  /**
   * Extract code blocks from markdown
   */
  extractCodeBlocks(input) {
    const blocks = [];
    let match;
    
    while ((match = this.patterns.codeBlock.exec(input)) !== null) {
      blocks.push(match[1].trim());
    }
    
    return blocks;
  }

  /**
   * Extract JSON-like structures from text
   */
  extractJSON(input) {
    // First try to find JSON after common keywords
    const keywordMatch = input.match(this.patterns.jsonInText);
    if (keywordMatch) {
      return this.extractFirstCompleteJSON(keywordMatch[1]);
    }

    // Look for JSON objects
    const objectMatch = input.match(this.patterns.jsonObject);
    if (objectMatch) {
      return this.extractFirstCompleteJSON(objectMatch[0]);
    }

    // Look for JSON arrays
    const arrayMatch = input.match(this.patterns.jsonArray);
    if (arrayMatch) {
      return this.extractFirstCompleteJSON(arrayMatch[0]);
    }

    return null;
  }

  /**
   * Extract the first complete JSON object/array from a string
   * This handles cases where there might be multiple JSON objects
   */
  extractFirstCompleteJSON(input) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let start = -1;
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if ((char === '{' || char === '[') && start === -1) {
          start = i;
          depth = 1;
        } else if (start !== -1) {
          if (char === '{' || char === '[') {
            depth++;
          } else if (char === '}' || char === ']') {
            depth--;
            if (depth === 0) {
              return input.substring(start, i + 1);
            }
          }
        }
      }
    }
    
    return input; // Return the whole thing if we can't find a complete JSON
  }

  /**
   * Clean input by removing code blocks and extra text
   */
  cleanInput(input) {
    // Remove code blocks but keep their content
    let cleaned = this.cleanCodeBlocks(input);
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // If it doesn't start with { or [, try to find JSON
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const extracted = this.extractJSON(cleaned);
      if (extracted) {
        cleaned = extracted;
      }
    }
    
    return cleaned;
  }

  /**
   * Remove code block markers but keep content
   */
  cleanCodeBlocks(input) {
    return input.replace(this.patterns.codeBlock, '$1');
  }

  /**
   * Safe parse that returns null instead of throwing
   */
  tryParse(input) {
    if (!input) return null;
    
    try {
      return JSON.parse(input);
    } catch (e) {
      return null;
    }
  }
}

export default ResponseParser;