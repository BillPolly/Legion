import TokenManagementService from '../../src/services/TokenManagementService.js';

describe('TokenManagementService', () => {
  let tokenService;

  beforeEach(() => {
    tokenService = new TokenManagementService();
  });

  test('should track token usage for a conversation', () => {
    const conversationId = 'test-convo-1';
    tokenService.trackTokenUsage(conversationId, 100);
    expect(tokenService.getTokenUsage(conversationId)).toBe(100);
  });

  test('should accumulate tokens for multiple calls', () => {
    const conversationId = 'test-convo-2';
    tokenService.trackTokenUsage(conversationId, 50);
    tokenService.trackTokenUsage(conversationId, 75);
    expect(tokenService.getTokenUsage(conversationId)).toBe(125);
  });

  test('should reset tokens for a conversation', () => {
    const conversationId = 'test-convo-3';
    tokenService.trackTokenUsage(conversationId, 200);
    tokenService.resetTokens(conversationId);
    expect(tokenService.getTokenUsage(conversationId)).toBe(0);
  });
});
