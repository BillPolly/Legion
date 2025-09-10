import TokenCalculator from '../../src/utils/TokenCalculator.js';

describe('TokenCalculator', () => {
  test('should estimate tokens based on text length', () => {
    const text = 'Hello, world!';
    const tokens = TokenCalculator.estimateTokens(text);
    expect(tokens).toBe(4); // 13 chars / 4 rounded up
  });

  test('should validate text against token limit', () => {
    const shortText = 'Brief text';
    const longText = 'A'.repeat(401); // Will be ~100 tokens
    
    expect(TokenCalculator.validateTokenLimit(shortText, 50)).toBeTruthy();
    expect(TokenCalculator.validateTokenLimit(longText, 50)).toBeFalsy();
  });

  test('should truncate text to meet token limit', () => {
    const longText = 'A'.repeat(401);
    const truncated = TokenCalculator.truncateToTokenLimit(longText, 50);
    
    expect(truncated.length).toBeLessThan(longText.length);
    expect(truncated.endsWith('...')).toBeTruthy();
  });
});
