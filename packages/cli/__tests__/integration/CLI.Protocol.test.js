/**
 * CLI Protocol Integration Tests
 *
 * Comprehensive tests for CLISessionActor and MainPageActor using:
 * - ProtocolTestSuite for auto-generated protocol tests
 * - ActorTestHarness for full integration testing
 * - JSDOM for browser environment simulation
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { ActorTestHarness } from '@legion/actor-testing';
import { CLISessionActor } from '../../src/actors/CLISessionActorProtocol.js';
import { MainPageActor } from '../../apps/cli-ui/src/client/MainPageActorProtocol.js';
import { ResourceManager } from '@legion/resource-manager';
import { ShowMeController } from '@legion/showme';

// ===================================================================
// 1. Protocol Tests
// ===================================================================

// Note: Both actors require specific setup (services, DOM), so we use
// manual tests below instead of auto-generated protocol tests

// ===================================================================
// 2. Unit Tests for CLISessionActor
// ===================================================================

describe('CLISessionActor Unit Tests', () => {
  let actor;
  let resourceManager;
  let showme;
  let toolRegistry;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Get REAL ToolRegistry - NO MOCKS!
    const { getToolRegistry } = await import('@legion/tools-registry');
    toolRegistry = await getToolRegistry();
  }, 60000);

  afterAll(async () => {
    // ToolRegistry cleanup handled by global teardown
  });

  beforeEach(async () => {
    // Create ShowMe controller for tests
    showme = new ShowMeController({
      port: 5050,  // Use different port for tests
      resourceManager
    });
    await showme.initialize();

    // Create session actor
    actor = new CLISessionActor({
      showme,
      resourceManager,
      toolRegistry,
      sessionId: 'test-session-1'
    });

    // Mark as connected
    actor.state.connected = true;
  });

  afterEach(async () => {
    if (actor) {
      actor.cleanup();
    }
    if (showme) {
      await showme.stop();
    }
  });

  test('should initialize with correct state', () => {
    expect(actor.state.sessionId).toBe('test-session-1');
    expect(actor.state.connected).toBe(true);
    expect(actor.state.commandCount).toBe(0);
    expect(actor.state.hasClaudeTask).toBe(false);
  });

  test('should handle get-status message', async () => {
    const result = await actor.receive('get-status', {});

    expect(result.success).toBe(true);
    expect(result.status.sessionId).toBe('test-session-1');
    expect(result.status.commandCount).toBe(0);
    expect(result.status.connected).toBe(true);
  });

  test('should handle ping message', async () => {
    const timestamp = Date.now();
    const result = await actor.receive('ping', { timestamp });

    expect(result.success).toBe(true);
    expect(result.pong).toBe(true);
    expect(result.received).toBe(timestamp);
    expect(result.timestamp).toBeGreaterThanOrEqual(timestamp);
  });

  test('should handle get-history message', async () => {
    const result = await actor.receive('get-history', {});

    expect(result.success).toBe(true);
    expect(result.history).toBeInstanceOf(Array);
    expect(result.history.length).toBe(0);
  });

  test('should execute /help command', async () => {
    const result = await actor.receive('execute-command', {
      command: '/help'
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('/help');
    expect(actor.state.commandCount).toBe(1);
  });

  test('should track command history', async () => {
    await actor.receive('execute-command', { command: '/help' });
    await actor.receive('execute-command', { command: '/windows' });

    const historyResult = await actor.receive('get-history', {});

    expect(historyResult.history.length).toBe(2);
    expect(historyResult.history[0].command).toBe('/help');
    expect(historyResult.history[1].command).toBe('/windows');
    expect(actor.state.commandCount).toBe(2);
  });

  test('should validate command schema', async () => {
    const result = await actor.receive('execute-command', { command: '' });

    // Should return error result, not throw
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should enforce preconditions', () => {
    // Set connected to false
    actor.state.connected = false;

    // Should fail precondition check
    expect(
      () => actor.receive('execute-command', { command: '/help' })
    ).toThrow('Precondition failed');
  });

  test('should validate postconditions after command', async () => {
    await actor.receive('execute-command', { command: '/help' });

    // Postcondition: commandCount > 0
    expect(actor.state.commandCount).toBeGreaterThan(0);
  });
});

// ===================================================================
// 3. Integration Tests with ActorTestHarness
// ===================================================================

describe('CLI System Integration Tests with ActorTestHarness', () => {
  let harness;
  let resourceManager;
  let showme;
  let toolRegistry;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Get REAL ToolRegistry - NO MOCKS!
    const { getToolRegistry } = await import('@legion/tools-registry');
    toolRegistry = await getToolRegistry();

    // Create ShowMe controller
    showme = new ShowMeController({
      port: 5051,
      resourceManager
    });
    await showme.initialize();
  }, 60000);

  afterAll(async () => {
    if (showme) {
      await showme.stop();
    }
    // ToolRegistry cleanup handled by global teardown
  });

  beforeEach(async () => {
    harness = new ActorTestHarness({
      serverActor: CLISessionActor,
      serverActorOptions: {
        showme,
        resourceManager,
        toolRegistry,
        sessionId: `harness-test-${Date.now()}`
      },
      clientActor: MainPageActor,
      clientActorOptions: {
        container: null,  // Will use JSDOM
        serverUrl: 'ws://test-cli'
      },
      useDom: true,
      domOptions: {
        html: '<div id="app"></div>'
      }
    });

    await harness.setup();

    // Mark server actor as connected
    harness.serverActor.state.connected = true;

  }, 10000);

  afterEach(async () => {
    if (harness) {
      await harness.teardown();
    }
  });

  test('harness should be setup correctly', () => {
    expect(harness.serverActor).toBeInstanceOf(CLISessionActor);
    expect(harness.clientActor).toBeInstanceOf(MainPageActor);
    expect(harness.serverWs).toBeDefined();
    expect(harness.clientWs).toBeDefined();
  });

  test('should handle session-ready message', async () => {
    const result = await harness.clientActor.receive('session-ready', {
      sessionId: 'test-session',
      serverActor: harness.serverActor.guid || 'server-guid',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(harness.clientActor.state.connected).toBe(true);
    expect(harness.clientActor.state.sessionId).toBe('test-session');
  });

  test('should execute command end-to-end', async () => {
    // First establish session
    await harness.clientActor.receive('session-ready', {
      sessionId: 'test-session',
      serverActor: harness.serverActor.guid || 'server-guid',
      timestamp: Date.now()
    });

    // Execute command on server
    const result = await harness.serverActor.receive('execute-command', {
      command: '/help'
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(harness.serverActor.state.commandCount).toBe(1);
  });

  test('should handle ping-pong', async () => {
    const timestamp = Date.now();
    const result = await harness.serverSend('ping', { timestamp });

    expect(result.success).toBe(true);
    expect(result.pong).toBe(true);
    expect(result.received).toBe(timestamp);
  });

  test('should get status from server', async () => {
    const result = await harness.serverSend('get-status', {});

    expect(result.success).toBe(true);
    expect(result.status).toBeDefined();
    expect(result.status.sessionId).toBeDefined();
  });

  test('should handle command result on client', async () => {
    // Setup session first
    await harness.clientActor.receive('session-ready', {
      sessionId: 'test-session',
      serverActor: 'server-guid',
      timestamp: Date.now()
    });

    // Handle command result
    const result = await harness.clientActor.receive('command-result', {
      success: true,
      output: 'Test output'
    });

    expect(result.success).toBe(true);
  });

  test('should track command history', async () => {
    // Execute multiple commands
    await harness.serverSend('execute-command', { command: '/help' });
    await harness.serverSend('execute-command', { command: '/windows' });

    // Get history
    const historyResult = await harness.serverSend('get-history', {});

    expect(historyResult.success).toBe(true);
    expect(historyResult.history.length).toBe(2);
  });

  test('should handle WebSocket message flow', async () => {
    // Send ping command to server
    const timestamp = Date.now();
    const result = await harness.serverSend('ping', { timestamp });

    // Check that server responded correctly
    expect(result.success).toBe(true);
    expect(result.pong).toBe(true);
    expect(result.received).toBe(timestamp);
  });

  test.skip('should handle full chat flow: client sends message, server processes with Claude, client receives response', async () => {
    // 1. Client establishes session with server
    await harness.clientActor.receive('session-ready', {
      sessionId: 'chat-test-session',
      serverActor: harness.serverActor.guid || 'server-guid',
      timestamp: Date.now()
    });

    expect(harness.clientActor.state.connected).toBe(true);
    expect(harness.clientActor.state.sessionId).toBe('chat-test-session');

    // 2. Client sends a natural language question to server
    // Use a simple factual question that doesn't require tools
    const chatMessage = 'What is the capital of France? Reply with just the city name.';

    const serverResponse = await harness.serverActor.receive('execute-command', {
      command: chatMessage
    });

    // 3. Verify server processed the command successfully
    expect(harness.serverActor.state.commandCount).toBeGreaterThan(0);
    expect(serverResponse).toBeDefined();

    // Log the response for debugging
    if (!serverResponse.success) {
      console.log('Server error:', JSON.stringify(serverResponse, null, 2));
    }

    expect(serverResponse.success).toBe(true);
    expect(serverResponse.output).toBeDefined();

    // 4. Verify Claude gave the correct answer
    expect(serverResponse.output.toLowerCase()).toContain('paris');

    // 5. Client receives the command result
    const clientResult = await harness.clientActor.receive('command-result', {
      success: true,
      output: serverResponse.output
    });

    expect(clientResult.success).toBe(true);

    // 6. Verify the command was added to server history
    const historyResult = await harness.serverActor.receive('get-history', {});
    expect(historyResult.success).toBe(true);
    expect(historyResult.history).toContainEqual(
      expect.objectContaining({ command: chatMessage })
    );
  }, 30000);
});

// ===================================================================
// 4. Browser Environment Tests
// ===================================================================

describe('CLI Web UI Browser Tests', () => {
  let harness;
  let resourceManager;
  let showme;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    showme = new ShowMeController({
      port: 5052,
      resourceManager
    });
    await showme.initialize();
  }, 30000);

  afterAll(async () => {
    if (showme) {
      await showme.stop();
    }
  });

  beforeEach(async () => {
    harness = new ActorTestHarness({
      clientActor: MainPageActor,
      clientActorOptions: {
        container: null,
        serverUrl: 'ws://test'
      },
      useDom: true,
      domOptions: {
        html: `
          <!DOCTYPE html>
          <html>
            <body>
              <div id="app"></div>
            </body>
          </html>
        `
      }
    });

    await harness.setup();
  });

  afterEach(async () => {
    if (harness) {
      await harness.teardown();
    }
  });

  test('should have DOM available', () => {
    const doc = harness.getDocument();
    expect(doc).toBeDefined();

    const app = doc.getElementById('app');
    expect(app).toBeDefined();
  });

  test('should initialize MainPageActor with DOM', async () => {
    const container = harness.getDocument().getElementById('app');
    harness.clientActor.config.container = container;

    // Note: Full initialization requires WebSocket which is already mocked by harness
    expect(harness.clientActor.state.connected).toBe(false);
    expect(harness.clientActor.state.sessionId).toBe(null);
  });

  test('should handle session-ready and update state', async () => {
    const result = await harness.clientActor.receive('session-ready', {
      sessionId: 'browser-test-session',
      serverActor: 'server-guid',
      timestamp: Date.now()
    });

    expect(result.success).toBe(true);
    expect(harness.clientActor.state.connected).toBe(true);
    expect(harness.clientActor.state.sessionId).toBe('browser-test-session');
  });
});

// ===================================================================
// 5. Protocol Validation Tests
// ===================================================================

describe('Protocol Validation Tests', () => {
  let resourceManager;
  let showme;
  let toolRegistry;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();

    // Get REAL ToolRegistry - NO MOCKS!
    const { getToolRegistry } = await import('@legion/tools-registry');
    toolRegistry = await getToolRegistry();

    showme = new ShowMeController({
      port: 5053,
      resourceManager
    });
    await showme.initialize();
  }, 60000);

  afterAll(async () => {
    if (showme) {
      await showme.stop();
    }
    // ToolRegistry cleanup handled by global teardown
  });

  test('CLISessionActor should have valid protocol', () => {
    const actor = new CLISessionActor({
      showme,
      resourceManager,
      toolRegistry,
      sessionId: 'validation-test'
    });

    const protocol = actor.getProtocol();

    expect(protocol.name).toBe('CLISessionActor');
    expect(protocol.version).toBe('1.0.0');
    expect(protocol.state).toBeDefined();
    expect(protocol.messages).toBeDefined();
    expect(protocol.messages.receives).toBeDefined();
    expect(protocol.messages.sends).toBeDefined();
  });

  test('MainPageActor should have valid protocol', () => {
    const actor = new MainPageActor();

    const protocol = actor.getProtocol();

    expect(protocol.name).toBe('MainPageActor');
    expect(protocol.version).toBe('1.0.0');
    expect(protocol.state).toBeDefined();
    expect(protocol.messages).toBeDefined();
  });

  test('should validate message schemas', async () => {
    const actor = new CLISessionActor({
      showme,
      resourceManager,
      toolRegistry,
      sessionId: 'schema-test'
    });

    actor.state.connected = true;

    // Valid message
    const validResult = await actor.receive('execute-command', { command: '/help' });
    expect(validResult).toBeDefined();
    expect(validResult.success).toBe(true);

    // Invalid message - missing required field (returns error, doesn't throw)
    const missingResult = await actor.receive('execute-command', {});
    expect(missingResult.success).toBe(false);
    expect(missingResult.error).toBeDefined();

    // Invalid message - wrong type (schema validation should throw synchronously)
    try {
      actor.receive('execute-command', { command: 123 });
      // If we get here, validation didn't catch it - check it returns error
      const wrongTypeResult = await actor.receive('execute-command', { command: 123 });
      expect(wrongTypeResult.success).toBe(false);
    } catch (error) {
      // Schema validation threw - this is also valid
      expect(error).toBeDefined();
    }
  });
});
