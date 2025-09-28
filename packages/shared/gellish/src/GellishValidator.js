/**
 * GellishValidator - Validates expressions against vocabulary
 * 
 * Validates Gellish expressions against the standard vocabulary,
 * provides helpful error messages and suggestions for corrections.
 * 
 * CRITICAL: All operations are synchronous following Handle pattern
 */

export class GellishValidator {
  constructor(dictionary) {
    if (!dictionary) {
      throw new Error('GellishDictionary is required');
    }
    
    this.dictionary = dictionary;
  }

  /**
   * Validate a Gellish expression
   * CRITICAL: Synchronous operation - no await!
   * 
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
   * Validate multiple expressions
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {Array<string>} expressions - Array of expressions to validate
   * @returns {Array<Object>} - Array of validation results
   */
  validateMultiple(expressions) {
    if (!expressions || expressions.length === 0) {
      return [];
    }
    
    return expressions.map(expr => this.validate(expr));
  }

  /**
   * Find any valid relation phrase in the token array
   * CRITICAL: Synchronous operation - no await!
   * 
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
   * CRITICAL: Synchronous operation - no await!
   * 
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
   * CRITICAL: Synchronous operation - no await!
   * 
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
  
  /**
   * Validate query syntax
   * CRITICAL: Synchronous operation - no await!
   * 
   * @param {string} query - The query to validate
   * @returns {Object} - Validation result for query
   */
  validateQuery(query) {
    try {
      if (!query || query.trim().length === 0) {
        return {
          valid: false,
          error: "Query cannot be empty"
        };
      }
      
      const cleanQuery = query.replace(/\?+$/, '').trim();
      const tokens = this.tokenize(cleanQuery);
      
      // Check for question words
      const questionWords = ['what', 'which', 'who', 'how', 'where', 'when'];
      const hasQuestionWord = tokens.some(token => 
        questionWords.includes(token.toLowerCase())
      );
      
      if (!hasQuestionWord) {
        return {
          valid: false,
          error: "Query must contain a question word (what, which, who, etc.)"
        };
      }
      
      // Check for relation phrase
      const relationFound = this.findAnyRelationPhrase(tokens);
      if (!relationFound) {
        return {
          valid: false,
          error: "No valid Gellish relation found in query",
          suggestions: this.suggestSimilarRelations(query)
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
}