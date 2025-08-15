/**
 * Test ResourceManager loading environment variables
 */

import { describe, test, expect } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';

describe('ResourceManager Environment Loading', () => {
  test('should load ANTHROPIC_API_KEY from .env file', async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.env.ANTHROPIC_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    expect(typeof apiKey).toBe('string');
    console.log('API Key loaded successfully, length:', apiKey.length);
  });
});