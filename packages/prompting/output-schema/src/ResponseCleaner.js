/**
 * ResponseCleaner - Advanced LLM response cleaning and preprocessing
 * 
 * Handles common LLM response patterns that interfere with parsing:
 * - Explanation text before/after responses
 * - Multiple code blocks with varying quality
 * - Conversational continuations and acknowledgments
 * - Formatting artifacts and excessive whitespace
 */

export class ResponseCleaner {
  /**
   * Create a response cleaner
   * @param {Object} options - Cleaning configuration
   */
  constructor(options = {}) {
    this.cleaningRules = {
      removeExplanations: true,
      stripConversational: true,
      normalizeWhitespace: true,
      handleMultipleBlocks: true,
      aggressiveMode: false,
      preserveContext: false,
      ...options.cleaningRules
    };
  }

  /**
   * Clean LLM response to improve parsing success
   * @param {string} response - Raw LLM response
   * @param {string} expectedFormat - Expected format hint
   * @returns {string} Cleaned response
   */
  cleanResponse(response, expectedFormat = null) {
    if (!response || typeof response !== 'string') {
      return response;
    }

    let cleaned = response;

    // Apply cleaning rules in sequence
    if (this.cleaningRules.normalizeWhitespace) {
      cleaned = this.normalizeWhitespace(cleaned);
    }

    if (this.cleaningRules.removeExplanations) {
      cleaned = this.removeExplanationPatterns(cleaned);
    }

    if (this.cleaningRules.stripConversational) {
      cleaned = this.removeConversationalPatterns(cleaned);
    }

    if (this.cleaningRules.handleMultipleBlocks) {
      cleaned = this.stripCodeBlockArtifacts(cleaned, expectedFormat);
    }

    // Final cleanup
    cleaned = this.normalizeWhitespace(cleaned);

    return cleaned;
  }

  /**
   * Extract best content from response using multiple strategies
   * @param {string} response - Response to process
   * @param {string} expectedFormat - Expected format
   * @returns {string} Best extracted content
   */
  extractBestContent(response, expectedFormat) {
    if (!response) return response;

    const candidates = [];

    // Try multiple cleaning strategies
    const strategies = [
      { name: 'original', content: response },
      { name: 'basic_clean', content: this.cleanResponse(response, expectedFormat) },
      { name: 'aggressive_clean', content: this._aggressiveClean(response, expectedFormat) },
      { name: 'code_block_only', content: this._extractOnlyCodeBlocks(response) }
    ];

    // Score each candidate
    for (const strategy of strategies) {
      const score = this.scoreContent(strategy.content, expectedFormat);
      candidates.push({ ...strategy, score });
    }

    // Return highest scoring candidate
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].content;
  }

  /**
   * Remove common explanation patterns
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  removeExplanationPatterns(text) {
    const patterns = [
      /^.*(?:here\s+is|here's)\s+(?:the\s+)?(?:json|xml|response|result|answer|analysis).*?[:\n]/im,
      /^.*based\s+on.*?[:\n]/im,
      /^.*(?:to\s+answer|in\s+response|as\s+requested).*?[:\n]/im,
      /^.*(?:the\s+result\s+is|my\s+response\s+is|the\s+answer\s+is).*?[:\n]/im,
      /^.*(?:here's\s+what|this\s+is\s+what).*?[:\n]/im,
      /^.*(?:let\s+me\s+provide|i'll\s+provide).*?[:\n]/im
    ];

    let result = text;
    
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }

    return result.trim();
  }

  /**
   * Remove conversational patterns
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  removeConversationalPatterns(text) {
    const patterns = [
      /^.*(?:let\s+me\s+continue|additionally|furthermore|moreover).*?\n/gim,
      /^.*(?:i\s+apologize|i\s+notice|i\s+should\s+mention).*?\n/gim,
      /^.*(?:to\s+summarize|in\s+conclusion|finally).*?\n/gim,
      /\n.*(?:i\s+hope\s+this|this\s+should\s+work|does\s+this\s+help).*$/gim
    ];

    let result = text;
    
    for (const pattern of patterns) {
      result = result.replace(pattern, '');
    }

    return result.trim();
  }

  /**
   * Handle multiple code blocks intelligently
   * @param {string} text - Text with potential multiple blocks
   * @param {string} expectedFormat - Expected format
   * @returns {string} Cleaned text with best block
   */
  stripCodeBlockArtifacts(text, expectedFormat) {
    // Find all code blocks
    const codeBlockPattern = /```(?:[\w]*\s*)?\n?([\s\S]*?)\n?```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockPattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.length > 0) {
        blocks.push({
          content: content,
          score: this.scoreContent(content, expectedFormat),
          fullMatch: match[0]
        });
      }
    }

    if (blocks.length === 0) {
      return text; // No code blocks found
    }

    if (blocks.length === 1) {
      return text; // Single block, leave as-is
    }

    // Multiple blocks - choose the best one
    blocks.sort((a, b) => b.score - a.score);
    const bestBlock = blocks[0];

    // Replace all blocks with just the best one
    let result = text;
    for (const block of blocks) {
      if (block !== bestBlock) {
        result = result.replace(block.fullMatch, '');
      }
    }

    return result.trim();
  }

  /**
   * Normalize excessive whitespace
   * @param {string} text - Text to normalize
   * @returns {string} Normalized text
   */
  normalizeWhitespace(text) {
    if (!text) return text;

    return text
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces on lines
      .trim();
  }

  /**
   * Score content quality for format matching
   * @param {string} content - Content to score
   * @param {string} expectedFormat - Expected format
   * @returns {number} Quality score (0-1)
   */
  scoreContent(content, expectedFormat) {
    if (!content || typeof content !== 'string') {
      return 0;
    }

    let score = 0;

    // Base score for having content
    score += 0.1;

    // Format-specific scoring
    switch (expectedFormat) {
      case 'json':
        if (content.includes('{') && content.includes('}')) score += 0.3;
        if (content.startsWith('{') || content.startsWith('[')) score += 0.2;
        if (content.endsWith('}') || content.endsWith(']')) score += 0.2;
        try {
          JSON.parse(content);
          score += 0.5; // Valid JSON gets high score
        } catch (e) {
          // Not valid JSON, but might still be parseable
        }
        break;

      case 'xml':
        if (content.includes('<') && content.includes('>')) score += 0.3;
        if (content.match(/<\w+>/)) score += 0.2;
        if (content.match(/<\/\w+>/)) score += 0.2;
        break;

      case 'yaml':
        if (content.includes(':')) score += 0.2;
        if (content.match(/^\w+:\s*.+$/m)) score += 0.3;
        break;

      default:
        score += 0.2; // Generic content gets modest score
    }

    // Penalty for common issues
    if (content.includes('```') && !content.match(/```[\w]*\n[\s\S]*?\n```/)) {
      score *= 0.8; // Malformed code blocks
    }

    if (content.length < 10) {
      score *= 0.5; // Very short content
    }

    if (content.includes('error') || content.includes('failed')) {
      score *= 0.7; // Error indicators
    }

    return Math.min(score, 1);
  }

  /**
   * Aggressive cleaning mode
   * @private
   */
  _aggressiveClean(response, expectedFormat) {
    let cleaned = response;

    // More aggressive pattern removal
    const aggressivePatterns = [
      /^[^{<]*(?=\{)/m, // Remove everything before first JSON/XML
      /[^}\]]+$/m, // Remove trailing text after JSON/XML
      /^.*?(?=<\w+>)/m, // Remove everything before first XML tag
      /^.*?(?=---\w+---)/m // Remove everything before first delimiter
    ];

    for (const pattern of aggressivePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  /**
   * Extract only content from code blocks
   * @private
   */
  _extractOnlyCodeBlocks(response) {
    const codeBlockPattern = /```(?:[\w]*\s*)?\n?([\s\S]*?)\n?```/g;
    const blocks = [];
    let match;

    while ((match = codeBlockPattern.exec(response)) !== null) {
      const content = match[1].trim();
      if (content.length > 0) {
        blocks.push(content);
      }
    }

    if (blocks.length === 0) {
      return response; // No blocks found
    }

    // Return the longest block (likely most complete)
    return blocks.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    );
  }
}