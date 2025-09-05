/**
 * FormatDetector - Automatic format detection for LLM responses
 * 
 * Analyzes response text to determine the most likely format
 * and provide confidence scores for format-specific parsing
 */

export class FormatDetector {
  /**
   * Create a format detector
   * @param {Object} schema - Extended JSON Schema for context
   * @param {Object} config - Detection configuration
   */
  constructor(schema, config = {}) {
    this.schema = schema;
    this.config = {
      'format-detection': {
        enabled: true,
        strategies: ['json', 'xml', 'delimited', 'tagged', 'markdown'],
        'confidence-threshold': 0.6,
        ...config['format-detection']
      },
      ...config
    };
    
    this.supportedFormats = ['json', 'xml', 'delimited', 'tagged', 'markdown'];
  }

  /**
   * Detect the most likely format of a response
   * @param {string} responseText - Response text to analyze
   * @returns {Object} Detection result {format, confidence}
   */
  detect(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return { format: 'unknown', confidence: 0 };
    }
    
    const scores = this.getConfidenceScores(responseText);
    
    // Find format with highest confidence
    let bestFormat = 'unknown';
    let bestConfidence = 0;
    
    for (const [format, confidence] of Object.entries(scores)) {
      if (confidence > bestConfidence) {
        bestFormat = format;
        bestConfidence = confidence;
      }
    }
    
    // Apply confidence threshold
    if (bestConfidence < this.config['format-detection']['confidence-threshold']) {
      return { format: 'unknown', confidence: bestConfidence };
    }
    
    return { format: bestFormat, confidence: bestConfidence };
  }

  /**
   * Get confidence scores for all supported formats
   * @param {string} responseText - Response text to analyze
   * @returns {Object} Confidence scores by format
   */
  getConfidenceScores(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      return this._createEmptyScores();
    }
    
    const trimmed = responseText.trim();
    
    return {
      json: this._detectJSON(trimmed),
      xml: this._detectXML(trimmed),
      delimited: this._detectDelimited(trimmed),
      tagged: this._detectTagged(trimmed),
      markdown: this._detectMarkdown(trimmed)
    };
  }

  /**
   * Check if a format is supported
   * @param {string} format - Format name to check
   * @returns {boolean} True if supported
   */
  isFormatSupported(format) {
    return this.supportedFormats.includes(format);
  }

  /**
   * Detect JSON format
   * @private
   */
  _detectJSON(text) {
    let score = 0;
    
    // Check for JSON-like structure patterns
    if (text.startsWith('{') && text.endsWith('}')) {
      score += 0.4;
    } else if (text.startsWith('[') && text.endsWith(']')) {
      score += 0.4;
    }
    
    // Check for JSON in markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      const innerContent = codeBlockMatch[1].trim();
      if (innerContent.startsWith('{') || innerContent.startsWith('[')) {
        score += 0.3;
      }
    }
    
    // Look for JSON patterns: quoted keys, colons, braces
    const jsonPatterns = [
      /"[\w\s]+"\s*:/, // quoted key followed by colon
      /:\s*"[^"]*"/, // colon followed by quoted value
      /:\s*\d+/, // colon followed by number
      /:\s*true|false|null/, // colon followed by boolean/null
      /\{\s*"/, // opening brace with quoted key
      /"\s*\}/ // quoted value with closing brace
    ];
    
    let patternMatches = 0;
    for (const pattern of jsonPatterns) {
      if (pattern.test(text)) {
        patternMatches++;
      }
    }
    
    score += (patternMatches / jsonPatterns.length) * 0.4;
    
    // Validate JSON structure with basic parsing
    try {
      // Try to extract and parse JSON
      let jsonContent = text;
      
      // Extract from code block if present
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
      }
      
      JSON.parse(jsonContent);
      score += 0.3; // Valid JSON gets bonus
    } catch (error) {
      // Check if it looks like JSON but is malformed
      if (text.includes('{') && text.includes('"') && text.includes(':')) {
        score += 0.1; // Partial credit for JSON-like structure
      }
    }
    
    return Math.min(score, 1);
  }

  /**
   * Detect XML format
   * @private
   */
  _detectXML(text) {
    let score = 0;
    
    // Basic XML structure check
    if (text.startsWith('<') && text.endsWith('>')) {
      score += 0.3;
    }
    
    // Count opening and closing tags
    const openingTags = (text.match(/<[^\/!?][^>]*>/g) || []).length;
    const closingTags = (text.match(/<\/[^>]+>/g) || []).length;
    const selfClosingTags = (text.match(/<[^>]+\/>/g) || []).length;
    
    // Well-formed XML should have balanced tags
    if (openingTags > 0 && (closingTags + selfClosingTags) > 0) {
      score += 0.4;
      
      // Bonus for balanced tags
      if (openingTags === closingTags || selfClosingTags > 0) {
        score += 0.2;
      }
    }
    
    // Look for XML-like patterns
    const xmlPatterns = [
      /<[a-zA-Z][^>]*>.*?<\/[a-zA-Z][^>]*>/, // opening and closing tag pair
      /<[a-zA-Z][^>]*\/>/, // self-closing tag
      /<[a-zA-Z][^>]*\s+[^>]*="[^"]*"[^>]*>/, // tag with attributes
    ];
    
    let patternMatches = 0;
    for (const pattern of xmlPatterns) {
      if (pattern.test(text)) {
        patternMatches++;
      }
    }
    
    score += (patternMatches / xmlPatterns.length) * 0.3;
    
    // Penalty for too simple structure (might be tagged format)
    if (openingTags <= 3 && !text.includes(' ')) {
      score *= 0.8; // Reduce confidence
    }
    
    return Math.min(score, 1);
  }

  /**
   * Detect delimited sections format
   * @private
   */
  _detectDelimited(text) {
    let score = 0;
    
    // Common delimiter patterns
    const delimiterPatterns = [
      /---[A-Z_][A-Z0-9_]*---/g, // ---FIELD---
      /===[A-Z_][A-Z0-9_]*===/g, // ===FIELD===
      /\*\*\*[A-Z_][A-Z0-9_]*\*\*\*/g, // ***FIELD***
      /#{3,}[A-Z_][A-Z0-9_]*#{3,}/g, // ###FIELD###
    ];
    
    let maxMatches = 0;
    for (const pattern of delimiterPatterns) {
      const matches = text.match(pattern) || [];
      maxMatches = Math.max(maxMatches, matches.length);
    }
    
    if (maxMatches >= 2) {
      score += 0.6; // Multiple sections found
    } else if (maxMatches === 1) {
      score += 0.3; // Single section found
    }
    
    // Look for END markers
    if (/---END-[A-Z_][A-Z0-9_]*---/.test(text)) {
      score += 0.2;
    }
    
    // Check for section-like structure
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    let delimiterLines = 0;
    
    for (const line of lines) {
      if (/^[-=*#]{3,}[A-Z_]/.test(line.trim())) {
        delimiterLines++;
      }
    }
    
    if (delimiterLines >= 2) {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Detect tagged content format
   * @private
   */
  _detectTagged(text) {
    let score = 0;
    
    // Look for simple tag patterns (not full XML)
    const tagPattern = /<([A-Z_][A-Z0-9_]*)>([^<]*)<\/\1>/g;
    const matches = text.match(tagPattern) || [];
    
    if (matches.length >= 2) {
      score += 0.5; // Multiple tagged fields
    } else if (matches.length === 1) {
      score += 0.3; // Single tagged field
    }
    
    // Look for uppercase tag names (common in tagged format)
    const uppercaseTags = (text.match(/<[A-Z_][A-Z0-9_]*>/g) || []).length;
    if (uppercaseTags > 0) {
      score += 0.3;
    }
    
    // Penalize complex XML structure
    const complexXmlPatterns = [
      /<[^>]+\s+[^>]*=/, // attributes
      /<[a-z]/, // lowercase tags (more XML-like)
      /<[^>]*>[^<]*<[^>]*>[^<]*</, // nested structure
    ];
    
    let complexityPenalty = 0;
    for (const pattern of complexXmlPatterns) {
      if (pattern.test(text)) {
        complexityPenalty += 0.1;
      }
    }
    
    score = Math.max(0, score - complexityPenalty);
    
    return Math.min(score, 1);
  }

  /**
   * Detect markdown format
   * @private
   */
  _detectMarkdown(text) {
    let score = 0;
    
    // Look for markdown headers
    const headerPattern = /^#{1,6}\s+.+$/gm;
    const headers = text.match(headerPattern) || [];
    
    if (headers.length >= 2) {
      score += 0.4; // Multiple headers
    } else if (headers.length === 1) {
      score += 0.2; // Single header
    }
    
    // Look for other markdown patterns
    const markdownPatterns = [
      /^\s*[-*+]\s+/gm, // unordered lists
      /^\s*\d+\.\s+/gm, // ordered lists
      /```[\s\S]*?```/, // code blocks
      /`[^`]+`/, // inline code
      /\*\*[^*]+\*\*/, // bold text
      /\*[^*]+\*/, // italic text
    ];
    
    let patternMatches = 0;
    for (const pattern of markdownPatterns) {
      if (pattern.test(text)) {
        patternMatches++;
      }
    }
    
    score += (patternMatches / markdownPatterns.length) * 0.4;
    
    // Bonus for structured content
    const lines = text.split('\n');
    let structuredLines = 0;
    
    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line) || /^\s*[-*+\d+\.]\s+/.test(line)) {
        structuredLines++;
      }
    }
    
    if (structuredLines >= 2) {
      score += 0.2;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Create empty confidence scores object
   * @private
   */
  _createEmptyScores() {
    return {
      json: 0,
      xml: 0,
      delimited: 0,
      tagged: 0,
      markdown: 0
    };
  }
}