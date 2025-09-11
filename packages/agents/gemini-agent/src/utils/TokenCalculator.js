class TokenCalculator {
  static estimateTokens(text) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  static validateTokenLimit(text, maxTokens) {
    const estimatedTokens = this.estimateTokens(text);
    return estimatedTokens <= maxTokens;
  }

  static truncateToTokenLimit(text, maxTokens) {
    if (this.validateTokenLimit(text, maxTokens)) {
      return text;
    }
    
    // Approximate truncation point
    const charLimit = maxTokens * 4;
    return text.substring(0, charLimit) + '...';
  }
}

export default TokenCalculator;
