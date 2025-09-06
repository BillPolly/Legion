/**
 * SizeManager - Token counting and prompt size optimization
 */

export class SizeManager {
  constructor(maxTokens = 4000, reserveTokens = 500) {
    this.maxTokens = maxTokens;
    this.reserveTokens = reserveTokens;
    this.availableTokens = maxTokens - reserveTokens;
  }

  estimateTokens(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // Basic token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  canFit(content, currentSize) {
    const contentSize = this.estimateTokens(content);
    return (currentSize + contentSize) <= this.availableTokens;
  }

  getAvailableSpace(currentSize) {
    return Math.max(0, this.availableTokens - currentSize);
  }
}