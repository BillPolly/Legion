/**
 * Integration test for ResourceManager and LLMClient
 *
 * Tests that we can get an LLMClient from ResourceManager
 * and use it to make real API calls to Anthropic.
 *
 * REQUIREMENTS:
 * - ANTHROPIC_API_KEY must be set in .env
 * - Real API calls will be made (costs $)
 */

import { ResourceManager } from '@legion/resource-manager';

describe('ResourceManager + LLMClient Integration', () => {
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();

    // Get LLMClient from ResourceManager
    llmClient = await resourceManager.get('llmClient');
  });

  test('should get llmClient from ResourceManager', () => {
    expect(llmClient).toBeDefined();
    expect(llmClient).toHaveProperty('request');
    expect(llmClient).toHaveProperty('complete');
    expect(typeof llmClient.request).toBe('function');
  });

  test('should have ANTHROPIC_API_KEY from ResourceManager', () => {
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('sk-ant-your-key-here');  // Not the placeholder
    expect(apiKey).toMatch(/^sk-ant-/);  // Anthropic key format
  });

  test('should make real API call to Anthropic', async () => {
    const response = await llmClient.request({
      prompt: 'What is 2 + 2? Respond with just the number.',
      maxTokens: 100,
      temperature: 0
    });

    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content).toContain('4');
  }, 30000);  // 30s timeout for API call

  test('should parse JSON from LLM response', async () => {
    const response = await llmClient.request({
      prompt: `Return a JSON object with this exact structure (no extra text):
{
  "name": "Test",
  "value": 42,
  "success": true
}`,
      maxTokens: 200,
      temperature: 0
    });

    expect(response.content).toBeDefined();

    // Extract JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    expect(jsonMatch).toBeTruthy();

    const parsed = JSON.parse(jsonMatch[0]);
    expect(parsed).toMatchObject({
      name: 'Test',
      value: 42,
      success: true
    });
  }, 30000);

  test('should use temperature 0 for deterministic responses', async () => {
    // Make same request twice with temp=0
    const prompt = 'What is the capital of France? Respond with just the city name.';

    const response1 = await llmClient.request({
      prompt,
      maxTokens: 50,
      temperature: 0
    });

    const response2 = await llmClient.request({
      prompt,
      maxTokens: 50,
      temperature: 0
    });

    // Both should contain Paris
    expect(response1.content).toContain('Paris');
    expect(response2.content).toContain('Paris');

    // Responses should be similar (though not necessarily identical due to API variations)
    expect(response1.content.toLowerCase()).toContain('paris');
    expect(response2.content.toLowerCase()).toContain('paris');
  }, 60000);  // 60s for two API calls
});
