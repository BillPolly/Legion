/**
 * Tokenizer for the Declarative Components DSL
 * Converts raw DSL text into a stream of tokens
 */

export class Tokenizer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
  }

  /**
   * Get all tokens from the input
   * @returns {Array} Array of tokens
   */
  tokenize() {
    const tokens = [];
    
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;
      
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    
    tokens.push({ type: 'EOF', value: '', line: this.line, column: this.column });
    return tokens;
  }

  /**
   * Get the next token
   * @returns {Object} Token object
   */
  nextToken() {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.peek();

    // Operators and punctuation
    if (char === ':' && this.peek(1) === ':') {
      this.advance(2);
      return { type: 'DOUBLE_COLON', value: '::', line: startLine, column: startColumn };
    }
    
    if (char === '=' && this.peek(1) === '>') {
      this.advance(2);
      return { type: 'ARROW', value: '=>', line: startLine, column: startColumn };
    }
    
    // Comparison operators
    if (char === '=' && this.peek(1) === '=' && this.peek(2) === '=') {
      this.advance(3);
      return { type: 'TRIPLE_EQUALS', value: '===', line: startLine, column: startColumn };
    }
    
    if (char === '!' && this.peek(1) === '=' && this.peek(2) === '=') {
      this.advance(3);
      return { type: 'NOT_TRIPLE_EQUALS', value: '!==', line: startLine, column: startColumn };
    }
    
    if (char === '=' && this.peek(1) === '=') {
      this.advance(2);
      return { type: 'DOUBLE_EQUALS', value: '==', line: startLine, column: startColumn };
    }
    
    if (char === '!' && this.peek(1) === '=') {
      this.advance(2);
      return { type: 'NOT_EQUALS', value: '!=', line: startLine, column: startColumn };
    }
    
    if (char === '<' && this.peek(1) === '=') {
      this.advance(2);
      return { type: 'LESS_EQUALS', value: '<=', line: startLine, column: startColumn };
    }
    
    if (char === '>' && this.peek(1) === '=') {
      this.advance(2);
      return { type: 'GREATER_EQUALS', value: '>=', line: startLine, column: startColumn };
    }
    
    if (char === '<') {
      this.advance();
      return { type: 'LESS', value: '<', line: startLine, column: startColumn };
    }
    
    if (char === '>') {
      this.advance();
      return { type: 'GREATER', value: '>', line: startLine, column: startColumn };
    }
    
    if (char === '{') {
      this.advance();
      return { type: 'LBRACE', value: '{', line: startLine, column: startColumn };
    }
    
    if (char === '}') {
      this.advance();
      return { type: 'RBRACE', value: '}', line: startLine, column: startColumn };
    }
    
    if (char === '[') {
      this.advance();
      return { type: 'LBRACKET', value: '[', line: startLine, column: startColumn };
    }
    
    if (char === ']') {
      this.advance();
      return { type: 'RBRACKET', value: ']', line: startLine, column: startColumn };
    }
    
    if (char === '(') {
      this.advance();
      return { type: 'LPAREN', value: '(', line: startLine, column: startColumn };
    }
    
    if (char === ')') {
      this.advance();
      return { type: 'RPAREN', value: ')', line: startLine, column: startColumn };
    }
    
    if (char === '.') {
      this.advance();
      return { type: 'DOT', value: '.', line: startLine, column: startColumn };
    }
    
    if (char === '#') {
      this.advance();
      return { type: 'HASH', value: '#', line: startLine, column: startColumn };
    }
    
    if (char === '@') {
      this.advance();
      return { type: 'AT', value: '@', line: startLine, column: startColumn };
    }
    
    if (char === '=') {
      this.advance();
      return { type: 'EQUALS', value: '=', line: startLine, column: startColumn };
    }
    
    if (char === '+') {
      this.advance();
      return { type: 'PLUS', value: '+', line: startLine, column: startColumn };
    }
    
    if (char === '?') {
      this.advance();
      return { type: 'QUESTION', value: '?', line: startLine, column: startColumn };
    }
    
    if (char === ':') {
      this.advance();
      return { type: 'COLON', value: ':', line: startLine, column: startColumn };
    }
    
    if (char === '!') {
      // Check for != and !==
      if (this.peek() === '=') {
        this.advance(2);
        if (this.current < this.input.length && this.input[this.current] === '=') {
          this.advance();
          return { type: 'NOT_TRIPLE_EQUALS', value: '!==', line: startLine, column: startColumn };
        }
        return { type: 'NOT_EQUALS', value: '!=', line: startLine, column: startColumn };
      }
      // Just negation operator
      this.advance();
      return { type: 'NOT', value: '!', line: startLine, column: startColumn };
    }
    
    if (char === ',') {
      this.advance();
      return { type: 'COMMA', value: ',', line: startLine, column: startColumn };
    }
    
    // String literals
    if (char === '"' || char === "'") {
      return this.scanString(char);
    }
    
    // Keywords and identifiers
    if (this.isAlpha(char)) {
      return this.scanIdentifierOrKeyword();
    }
    
    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber();
    }
    
    // Unknown character
    this.advance();
    return { type: 'UNKNOWN', value: char, line: startLine, column: startColumn };
  }

  /**
   * Scan a string literal
   * @param {string} quoteChar - The quote character used
   * @returns {Object} String token
   */
  scanString(quoteChar) {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    
    this.advance(); // Skip opening quote
    
    while (!this.isAtEnd() && this.peek() !== quoteChar) {
      if (this.peek() === '\\' && this.peek(1) === quoteChar) {
        // Escaped quote
        value += quoteChar;
        this.advance(2);
      } else {
        value += this.peek();
        this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`);
    }
    
    this.advance(); // Skip closing quote
    
    return { type: 'STRING', value, line: startLine, column: startColumn };
  }

  /**
   * Scan an identifier or keyword
   * @returns {Object} Identifier or keyword token
   */
  scanIdentifierOrKeyword() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_' || this.peek() === '-')) {
      value += this.peek();
      this.advance();
    }
    
    // Check for keywords - these get uppercase token types
    const controlKeywords = {
      'if': 'IF',
      'for': 'FOR',
      'in': 'IN'
    };
    
    // Attribute keywords that can also be used as regular identifiers
    const attributeKeywords = ['class', 'type', 'value', 'checked', 'required', 'rows'];
    
    if (controlKeywords[value]) {
      return { type: controlKeywords[value], value, line: startLine, column: startColumn };
    } else if (attributeKeywords.includes(value)) {
      // These are returned as uppercase for parser to handle as attribute names
      return { type: value.toUpperCase(), value, line: startLine, column: startColumn };
    } else {
      return { type: 'IDENTIFIER', value, line: startLine, column: startColumn };
    }
  }

  /**
   * Scan a number
   * @returns {Object} Number token
   */
  scanNumber() {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.peek();
      this.advance();
    }
    
    // Handle decimal numbers
    if (this.peek() === '.' && this.isDigit(this.peek(1))) {
      value += '.';
      this.advance();
      
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.peek();
        this.advance();
      }
    }
    
    return { type: 'NUMBER', value: parseFloat(value), line: startLine, column: startColumn };
  }

  /**
   * Skip whitespace characters
   */
  skipWhitespace() {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\r' || char === '\t' || char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }

  /**
   * Check if at end of input
   * @returns {boolean}
   */
  isAtEnd() {
    return this.position >= this.input.length;
  }

  /**
   * Peek at current character(s)
   * @param {number} offset - How many characters ahead to look
   * @returns {string}
   */
  peek(offset = 0) {
    const pos = this.position + offset;
    if (pos >= this.input.length) return '\0';
    return this.input[pos];
  }

  /**
   * Advance position by n characters
   * @param {number} count - Number of characters to advance
   */
  advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.position < this.input.length) {
        if (this.input[this.position] === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.position++;
      }
    }
  }

  /**
   * Check if character is alphabetic
   * @param {string} char
   * @returns {boolean}
   */
  isAlpha(char) {
    return /[a-zA-Z]/.test(char);
  }

  /**
   * Check if character is digit
   * @param {string} char
   * @returns {boolean}
   */
  isDigit(char) {
    return /[0-9]/.test(char);
  }

  /**
   * Check if character is alphanumeric
   * @param {string} char
   * @returns {boolean}
   */
  isAlphaNumeric(char) {
    return this.isAlpha(char) || this.isDigit(char);
  }
}