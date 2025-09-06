/**
 * GellishValidator - Validates expressions against vocabulary
 * 
 * Validates Gellish expressions against the standard vocabulary,
 * provides helpful error messages and suggestions for corrections.
 */

export class GellishValidator {
  constructor(dictionary) {
    this.dictionary = dictionary;
  }

  /**
   * Validate a Gellish expression
   * @param {string} expression - The expression to validate
   * @returns {Object} - Validation result with valid flag, error message, and suggestions
   */
  validate(expression) {
    try {
      // Handle empty or whitespace-only expressions
      if (!expression || expression.trim().length === 0) {
        return {
          valid: false,
          error: "Expression cannot be empty. Expected format: 'Object relation Object'"
        };
      }

      const tokens = this.tokenize(expression);
      
      // Check for minimum length
      if (tokens.length < 3) {
        return {
          valid: false,
          error: "Expression too short. Expected format: 'Object relation Object'"
        };
      }
      
      // Try to find a relation phrase
      const relationFound = this.findAnyRelationPhrase(tokens);
      if (!relationFound) {
        return {
          valid: false,
          error: "No valid Gellish relation found in expression",
          suggestions: this.suggestSimilarRelations(expression)
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Find any valid relation phrase in the token array
   * @param {Array<string>} tokens - Array of tokens to search
   * @returns {string|null} - Found relation phrase or null
   */
  findAnyRelationPhrase(tokens) {
    // Try to match relation phrases of different lengths (1-5 words)
    for (let length = 1; length <= 5; length++) {
      for (let i = 0; i <= tokens.length - length; i++) {
        const phrase = tokens.slice(i, i + length).join(' ');
        if (this.dictionary.findRelation(phrase)) {
          return phrase;
        }
      }
    }
    return null;
  }

  /**
   * Suggest similar relations for invalid expressions
   * @param {string} expression - The invalid expression
   * @returns {Array<string>} - Array of suggested relations
   */
  suggestSimilarRelations(expression) {
    // Return common relations as suggestions
    const commonRelations = [
      "is part of", "contains", "is connected to", 
      "is manufactured by", "is owned by", "is operated by"
    ];
    
    return commonRelations.slice(0, 3);
  }

  /**
   * Tokenize expression into array of words
   * @param {string} expression - Expression to tokenize
   * @returns {Array<string>} - Array of tokens
   */
  tokenize(expression) {
    if (!expression || expression.trim().length === 0) return [];
    
    // Clean up the expression - remove extra punctuation but keep entity structure
    const cleaned = expression
      .replace(/[.!?]+$/, '') // Remove trailing punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleaned.split(/\s+/).filter(token => token.length > 0);
  }
}
