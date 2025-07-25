import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import { SessionManager } from '../../src/server/SessionManager.js';
import { RequestHandler } from '../../src/server/RequestHandler.js';
import { WebDebugServer } from '../../src/debug/WebDebugServer.js';
import { LogManager } from '../../src/core/LogManager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WebDebugServer Tools Issue Investigation', () => {
  let resourceManager;
  let sessionManager;
  let requestHandler;
  let webDebugServer;
  let logManager;
  let testLogDir;
  let mockWs;
  let sentMessages;

  beforeEach(async () => {
    // Create test log directory
    testLogDir = path.join(os.tmpdir(), `aiur-test-${Date.now()}`);
    await fs.mkdir(testLogDir, { recursive: true });

    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create LogManager
    logManager = new LogManager({
      enableFileLogging: true,
      logDirectory: testLogDir,
      logRetentionDays: 1,
      maxLogFileSize: 10 * 1024 * 1024
    });
    await logManager.initialize();
    resourceManager.register('logManager', logManager);

    // Create SessionManager
    sessionManager = new SessionManager({
      resourceManager,
      logManager
    });
    await sessionManager.initialize();
    resourceManager.register('sessionManager', sessionManager);

    // Create RequestHandler
    requestHandler = new RequestHandler({
      sessionManager,
      resourceManager,
      logManager
    });
    await requestHandler.initialize();
    resourceManager.register('requestHandler', requestHandler);

    // Create WebDebugServer
    webDebugServer = await WebDebugServer.create(resourceManager);

    // Create mock WebSocket
    sentMessages = [];
    mockWs = {
      send: jest.fn((message) => {
        sentMessages.push(JSON.parse(message));
        console.log('Mock WS sent:', JSON.parse(message));
      }),
      readyState: 1, // OPEN
      on: jest.fn(),
      close: jest.fn()
    };
  });

  afterEach(async () => {
    // Cleanup
    if (webDebugServer && webDebugServer.isRunning) {
      await webDebugServer.stop();
    }
    if (sessionManager) {
      // Destroy all sessions
      const sessions = sessionManager.getActiveSessions();
      for (const session of sessions) {
        await sessionManager.destroySession(session.id);
      }
    }
    if (requestHandler) {
      await requestHandler.cleanup();
    }
    await fs.rm(testLogDir, { recursive: true, force: true });
  });

  test('should send tools when session is selected', async () => {
    // Create a session first
    const sessionResult = await sessionManager.createSession();
    const sessionId = sessionResult.sessionId;
    const session = sessionManager.getSession(sessionId);
    console.log('Created session:', sessionId);

    // Simulate WebSocket connection
    webDebugServer.clients.add(mockWs);
    webDebugServer.clientSessions.set(mockWs, null);

    // Manually create welcome message
    const welcomeData = {
      serverId: webDebugServer.serverId,
      version: '1.0.0',
      capabilities: ['tool-execution', 'context-management', 'event-streaming', 'error-tracking', 'log-streaming', 'session-management'],
      sessionMode: true,
      sessions: webDebugServer._getSessionList(),
      availableTools: []
    };
    
    mockWs.send(JSON.stringify({
      type: 'welcome',
      data: welcomeData
    }));

    // Check welcome message
    const welcomeMsg = sentMessages.find(m => m.type === 'welcome');
    expect(welcomeMsg).toBeDefined();
    expect(welcomeMsg.data.sessionMode).toBe(true);
    console.log('Welcome message sessions:', welcomeMsg.data.sessions);

    // Clear messages
    sentMessages.length = 0;

    // Send session selection message
    const selectMessage = {
      type: 'select-session',
      id: 'test-req-1',
      data: { sessionId: sessionId }
    };

    console.log('\nSelecting session:', sessionId);
    await webDebugServer._handleSessionSelection(mockWs, selectMessage);

    // Check response
    const response = sentMessages.find(m => m.type === 'session-selected');
    console.log('\nSession selected response:', JSON.stringify(response, null, 2));

    expect(response).toBeDefined();
    expect(response.data.sessionId).toBe(sessionId);
    expect(response.data.tools).toBeDefined();
    expect(Array.isArray(response.data.tools)).toBe(true);
    
    console.log('\nTools received:', response.data.tools.length);
    console.log('Tool names:', response.data.tools.map(t => t.name));

    // Check tool types
    const contextTools = response.data.tools.filter(t => t.name.startsWith('context_'));
    const planTools = response.data.tools.filter(t => t.name.startsWith('plan_'));
    const debugTools = response.data.tools.filter(t => t.name.startsWith('web_debug_'));
    const fileTools = response.data.tools.filter(t => t.name.startsWith('file_') || t.name.startsWith('directory_'));
    
    console.log('\nTool breakdown:');
    console.log('- Context tools:', contextTools.length, contextTools.map(t => t.name));
    console.log('- Plan tools:', planTools.length, planTools.map(t => t.name));
    console.log('- Debug tools:', debugTools.length, debugTools.map(t => t.name));
    console.log('- File tools:', fileTools.length, fileTools.map(t => t.name));

    // Verify we have all expected tool types
    expect(contextTools.length).toBeGreaterThan(0);
    expect(planTools.length).toBeGreaterThan(0);
    expect(debugTools.length).toBeGreaterThan(0);
    expect(fileTools.length).toBeGreaterThan(0);

    // Total should be at least 20 tools
    expect(response.data.tools.length).toBeGreaterThanOrEqual(20);
  });

  test('debug tool provider flow', async () => {
    // Create a session
    const sessionResult = await sessionManager.createSession();
    const sessionId = sessionResult.sessionId;
    const session = sessionManager.getSession(sessionId);
    console.log('\nTesting tool provider flow for session:', sessionId);

    // Check initial tools
    console.log('\n1. Initial tools from session.toolProvider:');
    let tools = session.toolProvider.getAllToolDefinitions();
    console.log('   Tool count:', tools.length);
    console.log('   Tool names:', tools.map(t => t.name));

    // Ensure debug tools are initialized
    console.log('\n2. Calling requestHandler.ensureDebugTools...');
    await requestHandler.ensureDebugTools(session);

    // Check tools after debug initialization
    console.log('\n3. Tools after ensureDebugTools:');
    tools = session.toolProvider.getAllToolDefinitions();
    console.log('   Tool count:', tools.length);
    console.log('   Tool names:', tools.map(t => t.name));

    // Check if debug tools were added
    const hasDebugTools = tools.some(t => t.name.startsWith('web_debug_'));
    console.log('\n4. Has debug tools?', hasDebugTools);

    expect(tools.length).toBeGreaterThanOrEqual(20);
    expect(hasDebugTools).toBe(true);
  });

  test('check RequestHandler availability in WebDebugServer', async () => {
    console.log('\nChecking RequestHandler availability:');
    console.log('webDebugServer.requestHandler:', !!webDebugServer.requestHandler);
    console.log('RequestHandler from resourceManager:', !!resourceManager.get('requestHandler'));
    
    expect(webDebugServer.requestHandler).toBeDefined();
    expect(webDebugServer.requestHandler).toBe(requestHandler);
  });
});
