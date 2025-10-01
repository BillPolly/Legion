/**
 * Integration Test - CLISessionActor with Real Claude API
 *
 * Tests complete CLI session with REAL Claude API
 * NO MOCKS - test fails if API key missing or API unavailable
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { CLISessionActor } from '../../src/actors/CLISessionActor.js';
import ResourceManager from '@legion/resource-manager';
import { ShowMeController } from '@legion/showme';

describe('CLISessionActor - Claude Integration (REAL API)', () => {
  let resourceManager;
  let apiKey;
  let showme;

  beforeAll(async () => {
    // Get ResourceManager singleton - NO FALLBACKS
    resourceManager = await ResourceManager.getInstance();

    // Verify ANTHROPIC_API_KEY exists - FAIL FAST if missing
    apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found in ResourceManager. ' +
        'Set ANTHROPIC_API_KEY in .env file to run integration tests.'
      );
    }

    // Create real ShowMeController
    showme = new ShowMeController();
  }, 10000);

  test('should handle non-slash command with real Claude API', async () => {
    // Create actor with real services
    const actor = new CLISessionActor({
      showme: showme,
      resourceManager: resourceManager,
      sessionId: 'integration-test-session',
      useColors: false
    });

    // Execute a simple math question
    const result = await actor.handleExecuteCommand({
      command: 'What is 7 + 5? Just give me the number.'
    });

    // Verify successful response
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('integration-test-session');
    expect(result.result).toBeDefined();
    expect(result.result.message).toBeDefined();

    // Verify Claude's response contains the answer (12)
    expect(result.result.message).toMatch(/12/);

    console.log('✅ Real Claude API integration test passed');
    console.log('Claude response:', result.result.message);
  }, 30000); // 30 second timeout for real API call

  test('should maintain conversation context across commands', async () => {
    // Create actor
    const actor = new CLISessionActor({
      showme: showme,
      resourceManager: resourceManager,
      sessionId: 'context-test-session',
      useColors: false
    });

    // First command - set context
    const result1 = await actor.handleExecuteCommand({
      command: 'My favorite color is blue. Remember this.'
    });
    expect(result1.success).toBe(true);

    // Second command - test context retention
    const result2 = await actor.handleExecuteCommand({
      command: 'What is my favorite color?'
    });
    expect(result2.success).toBe(true);
    expect(result2.result.message.toLowerCase()).toContain('blue');

    console.log('✅ Context retention test passed');
    console.log('Context response:', result2.result.message);
  }, 60000); // 60 second timeout for two API calls

  test('should handle slash commands normally (not routed to Claude)', async () => {
    // Create actor
    const actor = new CLISessionActor({
      showme: showme,
      resourceManager: resourceManager,
      sessionId: 'slash-command-test',
      useColors: false
    });

    // Execute slash command
    const result = await actor.handleExecuteCommand({
      command: '/help'
    });

    // Verify slash command processed correctly
    expect(result.success).toBe(true);
    // Claude task should NOT be initialized for slash commands
    expect(actor.claudeTask).toBeNull();

    console.log('✅ Slash command routing test passed');
  }, 10000);
});
