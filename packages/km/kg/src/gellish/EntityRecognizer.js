/**
 * EntityRecognizer - Identifies entities in Gellish text
 * 
 * Recognizes entities, relation phrases, and question words in Gellish expressions.
 * Classifies entities as individuals, persons, or concepts and generates appropriate IDs.
 */

export class EntityRecognizer {
  constructor(dictionary) {
    this.dictionary = dictionary;
    this.entityPatterns = [
      /^[A-Z][a-zA-Z0-9\s]*[A-Z0-9][0-9]+$/, // "Pump P101", "System S200"
      /^[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+$/, // "John Smith"
      /^[A-Z][a-zA-Z]+$/ // "Water", "Siemens"
    ];
  }

  /**
   * Recognize entities and relations in a Gellish expression
   * @param {string} text - The Gellish expression to analyze
   * @returns {Object} - Recognition result with leftObject, relation, rightObject
   */
  recognize(text) {
    if (!text || text.trim().length === 0) {
      return {
        leftObject: null,
        relation: null,
        rightObject: null
      };
    }

    const tokens = this.tokenize(text);
    const result = {
      leftObject: null,
      relation: null,
      rightObject: null
    };

    // Find relation phrase in tokens
    const relationMatch = this.findRelationPhrase(tokens);
    if (relationMatch) {
      result.relation = relationMatch;
      
      // Extract entities before and after the relation
      const leftTokens = tokens.slice(0, relationMatch.startIndex);
      const rightTokens = tokens.slice(relationMatch.endIndex);
      
      if (leftTokens.length > 0) {
        result.leftObject = this.extractEntity(leftTokens);
      }
      
      if (rightTokens.length > 0) {
        result.rightObject = this.extractEntity(rightTokens);
      }
    }

    return result;
  }

  /**
   * Recognize question words, relations, and objects in queries
   * @param {string} query - The Gellish query to analyze
   * @returns {Object} - Recognition result with questionWord, relation, object
   */
  recognizeQuery(query) {
    if (!query || query.trim().length === 0) {
      return {
        questionWord: null,
        relation: null,
        object: null
      };
    }

    const tokens = this.tokenize(query.replace(/\?$/, '')); // Remove trailing ?
    const result = {
      questionWord: null,
      relation: null,
      object: null
    };

    // Detect question words
    const questionWords = ['what', 'which', 'who', 'how', 'where', 'when'];
    const firstToken = tokens[0].toLowerCase();
    
    if (questionWords.includes(firstToken)) {
      // Handle "which pumps" type questions
      if (firstToken === 'which' && tokens.length > 1) {
        result.questionWord = {
          text: `${tokens[0]} ${tokens[1]}`,
          type: 'variable'
        };
        
        // Look for relation starting from token 2
        const relationMatch = this.findRelationPhrase(tokens.slice(2));
        if (relationMatch) {
          result.relation = {
            text: relationMatch.text,
            uid: relationMatch.uid,
            startIndex: relationMatch.startIndex + 2,
            endIndex: relationMatch.endIndex + 2
          };
          
          // Extract object after relation
          const objectTokens = tokens.slice(result.relation.endIndex);
          if (objectTokens.length > 0) {
            result.object = this.extractEntity(objectTokens);
          }
        }
      } else {
        result.questionWord = {
          text: tokens[0],
          type: 'variable'
        };
        
        // Look for relation starting from token 1
        const relationMatch = this.findRelationPhrase(tokens.slice(1));
        if (relationMatch) {
          result.relation = {
            text: relationMatch.text,
            uid: relationMatch.uid,
            startIndex: relationMatch.startIndex + 1,
            endIndex: relationMatch.endIndex + 1
          };
          
          // Extract object after relation
          const objectTokens = tokens.slice(result.relation.endIndex);
          if (objectTokens.length > 0) {
            result.object = this.extractEntity(objectTokens);
          }
        }
      }
    }

    // Check for inverse patterns like "System S200 consists of what?"
    if (!result.relation) {
      const whatIndex = tokens.findIndex(token => ['what', 'who'].includes(token.toLowerCase()));
      if (whatIndex > 0) {
        // Try to find relation phrase in the entire sequence before "what"
        const beforeWhat = tokens.slice(0, whatIndex);
        
        // Look for relation phrase anywhere in the tokens before "what"
        const relationMatch = this.findRelationPhrase(beforeWhat);
        if (relationMatch) {
          // Extract subject (tokens before the relation)
          const subjectTokens = beforeWhat.slice(0, relationMatch.startIndex);
          
          if (subjectTokens.length > 0) {
            result.questionWord = {
              text: tokens[whatIndex],
              type: 'variable'
            };
            result.relation = relationMatch;
            result.object = this.extractEntity(subjectTokens);
          }
        }
      }
    }

    return result;
  }

  /**
   * Find relation phrase in token array
   * @param {Array<string>} tokens - Array of tokens to search
   * @returns {Object|null} - Relation match with text, uid, startIndex, endIndex
   */
  findRelationPhrase(tokens) {
    // Try to match relation phrases of different lengths (1-5 words)
    for (let length = 1; length <= 5; length++) {
      for (let i = 0; i <= tokens.length - length; i++) {
        const phrase = tokens.slice(i, i + length).join(' ');
        const uid = this.dictionary.findRelation(phrase);
        if (uid) {
          return {
            text: phrase,
            uid: uid,
            startIndex: i,
            endIndex: i + length
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract entity from token array
   * @param {Array<string>} tokens - Array of tokens representing an entity
   * @returns {Object|null} - Entity object with text, type, id
   */
  extractEntity(tokens) {
    if (tokens.length === 0) return null;
    
    const text = tokens.join(' ');
    const type = this.classifyEntity(text);
    
    return {
      text: text,
      type: type,
      id: this.generateEntityId(text)
    };
  }

  /**
   * Classify entity type based on text patterns
   * @param {string} text - Entity text to classify
   * @returns {string} - Entity type: 'individual', 'person', or 'concept'
   */
  classifyEntity(text) {
    if (this.entityPatterns[0].test(text)) return 'individual'; // "Pump P101"
    if (this.entityPatterns[1].test(text)) return 'person'; // "John Smith"
    return 'concept'; // "Water", "Siemens"
  }

  /**
   * Generate consistent entity ID from text
   * @param {string} text - Entity text
   * @returns {string} - Generated entity ID
   */
  generateEntityId(text) {
    return text.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Tokenize text into array of words
   * @param {string} text - Text to tokenize
   * @returns {Array<string>} - Array of tokens
   */
  tokenize(text) {
    if (!text || text.trim().length === 0) return [];
    return text.split(/\s+/).filter(token => token.length > 0);
  }
}
