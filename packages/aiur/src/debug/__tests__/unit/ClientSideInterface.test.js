/**
 * Unit tests for client-side DebugInterface WebSocket communication
 */

import { JSDOM } from 'jsdom';
import { WebSocket } from 'ws';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';

// Mock WebSocket for browser environment
global.WebSocket = WebSocket;

describe('Client-Side DebugInterface', () => {
  let dom;
  let window;
  let document;
  let DebugInterface;
  let webDebugServer;

  beforeAll(async () => {
    // Get shared server for testing
    webDebugServer = await getSharedWebDebugServer();

    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Debug Interface</title></head>
        <body>
          <!-- Command Panel -->
          <div id="commandPanel">
            <input type="text" id="toolName" placeholder="Tool name" />
            <textarea id="toolArgs" placeholder="Arguments (JSON)"></textarea>
            <button id="executeBtn">Execute</button>
            <button id="clearCommand">Clear</button>
            <button id="formatArgs">Format JSON</button>
            <div id="toolSuggestions"></div>
            <div id="commandResult" class="result-display"></div>
          </div>

          <!-- Context Browser -->
          <div id="contextPanel">
            <input type="text" id="contextFilter" placeholder="Filter context..." />
            <button id="refreshContext">Refresh</button>
            <div id="contextList"></div>
          </div>

          <!-- Event Stream -->
          <div id="eventPanel">
            <select id="eventFilter">
              <option value="">All Events</option>
              <option value="tool-executed">Tool Executed</option>
              <option value="metric-recorded">Metrics</option>
            </select>
            <button id="clearEvents">Clear</button>
            <button id="pauseEvents">Pause</button>
            <div id="eventStream"></div>
          </div>

          <!-- System Status -->
          <div id="statusPanel">
            <div id="connectionStatus" class="status disconnected">Disconnected</div>
            <button id="refreshStatus">Refresh</button>
            <div id="serverInfo"></div>
            <div id="serverHealth">Unknown</div>
            <div id="connectedClients">0</div>
            <div id="toolCount">0</div>
            <div id="contextCount">0</div>
            <div id="availableTools"></div>
          </div>

          <!-- Log Viewer -->
          <div id="logPanel">
            <select id="logLevel">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
            <button id="clearLogs">Clear</button>
            <div id="logViewer"></div>
          </div>

          <!-- Toast Container -->
          <div id="toastContainer"></div>
        </body>
      </html>
    `, {
      url: `http://localhost:${webDebugServer.port}`,
      pretendToBeVisual: true,
      resources: "usable"
    });

    window = dom.window;
    document = window.document;

    // Make globals available
    global.window = window;
    global.document = document;
    global.WebSocket = WebSocket;

    // Load the DebugInterface class by reading and executing the script
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.join(__dirname, '../../web/script.js');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Modify script to export DebugInterface for testing
    scriptContent = scriptContent.replace(
      '// Initialize the debug interface\nnew DebugInterface();',
      '// Export DebugInterface for testing\nif (typeof module !== "undefined" && module.exports) {\n  module.exports = DebugInterface;\n} else if (typeof window !== "undefined") {\n  window.DebugInterface = DebugInterface;\n}\n\n// Initialize the debug interface only in browser\nif (typeof window !== "undefined" && !window.isTestEnvironment) {\n  new DebugInterface();\n}'
    );
    
    // Execute the modified script in our JSDOM environment
    window.isTestEnvironment = true;
    const vm = await import('vm');
    const script = new vm.Script(scriptContent);
    const context = vm.createContext(window);
    script.runInContext(context);
    
    DebugInterface = window.DebugInterface;
  });

  afterAll(() => {
    if (dom) {
      dom.window.close();
    }
  });

  describe('WebSocket connection and reconnection logic', () => {
    test('should initialize with correct default values', () => {
      const debugInterface = new DebugInterface();
      
      expect(debugInterface.isConnected).toBe(false);
      expect(debugInterface.reconnectAttempts).toBe(0);
      expect(debugInterface.maxReconnectAttempts).toBe(10);
      expect(debugInterface.reconnectInterval).toBe(5000);
      expect(debugInterface.requestId).toBe(0);
      expect(debugInterface.pendingRequests.size).toBe(0);
      expect(debugInterface.eventsPaused).toBe(false);
      expect(Array.isArray(debugInterface.availableTools)).toBe(true);
    });

    test('should construct correct WebSocket URL', () => {
      const debugInterface = new DebugInterface();
      
      // Mock the connect method to capture WebSocket URL
      let capturedUrl = null;
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class MockWebSocket {
        constructor(url) {
          capturedUrl = url;
          this.onopen = null;
          this.onmessage = null;
          this.onclose = null;
          this.onerror = null;
        }
      };

      debugInterface.connect();
      
      expect(capturedUrl).toBe(`ws://localhost:${webDebugServer.port}/ws`);
      
      // Restore original WebSocket
      global.WebSocket = originalWebSocket;
    });

    test('should handle connection establishment', () => {
      const debugInterface = new DebugInterface();
      
      // Mock showToast method
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      debugInterface.onConnected();
      
      expect(debugInterface.isConnected).toBe(true);
      expect(debugInterface.reconnectAttempts).toBe(0);
      expect(toastMessages).toContainEqual({
        message: 'Connected to debug server',
        type: 'success'
      });
    });

    test('should handle disconnection and attempt reconnection', async () => {
      const debugInterface = new DebugInterface();
      debugInterface.reconnectAttempts = 2;
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      let connectCalled = false;
      debugInterface.connect = () => {
        connectCalled = true;
      };

      debugInterface.onDisconnected();
      
      expect(debugInterface.isConnected).toBe(false);
      expect(debugInterface.reconnectAttempts).toBe(3);
      
      // Wait for timeout to trigger reconnection attempt
      await waitForAsync(100);
      
      expect(connectCalled).toBe(true);
      expect(toastMessages.some(t => t.message.includes('Reconnecting'))).toBe(true);
    });

    test('should stop reconnecting after max attempts', () => {
      const debugInterface = new DebugInterface();
      debugInterface.reconnectAttempts = debugInterface.maxReconnectAttempts;
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      let connectCalled = false;
      debugInterface.connect = () => {
        connectCalled = true;
      };

      debugInterface.onDisconnected();
      
      expect(connectCalled).toBe(false);
      expect(toastMessages).toContainEqual({
        message: 'Connection lost. Max reconnection attempts reached.',
        type: 'error'
      });
    });
  });

  describe('message parsing and handling', () => {
    test('should parse and route welcome messages', () => {
      const debugInterface = new DebugInterface();
      
      const welcomeData = {
        serverId: 'test-server-123',
        version: '1.0.0',
        capabilities: ['tool-execution', 'context-management'],
        availableTools: ['context_list', 'plan_execute']
      };

      let refreshStatusCalled = false;
      let refreshContextCalled = false;
      debugInterface.refreshStatus = () => { refreshStatusCalled = true; };
      debugInterface.refreshContext = () => { refreshContextCalled = true; };

      debugInterface.handleWelcome(welcomeData);
      
      expect(debugInterface.availableTools).toEqual(welcomeData.availableTools);
      expect(document.getElementById('serverInfo').textContent).toContain('test-server-123');
      expect(refreshStatusCalled).toBe(true);
      expect(refreshContextCalled).toBe(true);
    });

    test('should handle tool execution results', () => {
      const debugInterface = new DebugInterface();
      
      const requestId = 'test-req-123';
      debugInterface.pendingRequests.set(requestId, {
        toolName: 'context_list',
        args: {},
        startTime: Date.now() - 100
      });

      const toolResult = {
        id: requestId,
        data: {
          success: true,
          result: { content: [{ type: 'text', text: '{"items": []}' }] },
          executionTime: 95
        }
      };

      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      debugInterface.handleToolResult(toolResult);
      
      expect(debugInterface.pendingRequests.has(requestId)).toBe(false);
      expect(document.getElementById('commandResult').textContent).toContain('content');
      expect(toastMessages).toContainEqual({
        message: 'context_list: Success in 95ms',
        type: 'success'
      });
    });

    test('should handle real-time events', () => {
      const debugInterface = new DebugInterface();
      
      const eventData = {
        eventType: 'tool-executed',
        timestamp: new Date().toISOString(),
        source: 'debug-server',
        payload: { tool: 'context_add', success: true }
      };

      debugInterface.handleEvent(eventData);
      
      const eventStream = document.getElementById('eventStream');
      expect(eventStream.children.length).toBe(1);
      
      const eventElement = eventStream.firstChild;
      expect(eventElement.classList.contains('event-item')).toBe(true);
      expect(eventElement.classList.contains('tool_executed')).toBe(true);
      expect(eventElement.textContent).toContain('tool-executed');
      expect(eventElement.textContent).toContain('context_add');
    });

    test('should ignore events when paused', () => {
      const debugInterface = new DebugInterface();
      debugInterface.eventsPaused = true;
      
      const eventData = {
        eventType: 'test-event',
        timestamp: new Date().toISOString(),
        payload: { test: 'data' }
      };

      debugInterface.handleEvent(eventData);
      
      const eventStream = document.getElementById('eventStream');
      expect(eventStream.children.length).toBe(0);
    });

    test('should handle server info updates', () => {
      const debugInterface = new DebugInterface();
      
      const serverInfo = {
        status: 'running',
        connectedClients: 3
      };

      debugInterface.handleServerInfo(serverInfo);
      
      expect(document.getElementById('serverHealth').textContent).toBe('running');
      expect(document.getElementById('connectedClients').textContent).toBe('3');
    });

    test('should handle error messages', () => {
      const debugInterface = new DebugInterface();
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      const errorData = { message: 'Tool not found' };
      debugInterface.handleError(errorData);
      
      expect(toastMessages).toContainEqual({
        message: 'Server error: Tool not found',
        type: 'error'
      });
    });
  });

  describe('tool execution request formatting', () => {
    test('should format tool execution requests correctly', () => {
      const debugInterface = new DebugInterface();
      debugInterface.isConnected = true;
      
      let sentMessage = null;
      debugInterface.sendMessage = (message) => {
        sentMessage = message;
        return true;
      };

      // Set up form values
      document.getElementById('toolName').value = 'context_list';
      document.getElementById('toolArgs').value = '{"filter": "test*"}';

      debugInterface.executeCommand();
      
      expect(sentMessage).toBeDefined();
      expect(sentMessage.type).toBe('execute-tool');
      expect(sentMessage.data.name).toBe('context_list');
      expect(sentMessage.data.arguments).toEqual({ filter: 'test*' });
      expect(typeof sentMessage.id).toBe('string');
      expect(sentMessage.id.startsWith('req_')).toBe(true);
    });

    test('should handle empty arguments', () => {
      const debugInterface = new DebugInterface();
      debugInterface.isConnected = true;
      
      let sentMessage = null;
      debugInterface.sendMessage = (message) => {
        sentMessage = message;
        return true;
      };

      document.getElementById('toolName').value = 'web_debug_status';
      document.getElementById('toolArgs').value = '';

      debugInterface.executeCommand();
      
      expect(sentMessage.data.arguments).toEqual({});
    });

    test('should validate JSON arguments', () => {
      const debugInterface = new DebugInterface();
      debugInterface.isConnected = true;
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      document.getElementById('toolName').value = 'context_add';
      document.getElementById('toolArgs').value = '{ invalid json }';

      debugInterface.executeCommand();
      
      expect(toastMessages).toContainEqual({
        message: 'Invalid JSON in arguments',
        type: 'error'
      });
    });

    test('should require tool name', () => {
      const debugInterface = new DebugInterface();
      debugInterface.isConnected = true;
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      document.getElementById('toolName').value = '';
      document.getElementById('toolArgs').value = '{}';

      debugInterface.executeCommand();
      
      expect(toastMessages).toContainEqual({
        message: 'Please enter a tool name',
        type: 'warning'
      });
    });
  });

  describe('UI state management', () => {
    test('should update connection status display', () => {
      const debugInterface = new DebugInterface();
      
      debugInterface.updateConnectionStatus('connected');
      
      const statusElement = document.getElementById('connectionStatus');
      expect(statusElement.classList.contains('connected')).toBe(true);
      expect(statusElement.textContent).toBe('Connected');
    });

    test('should show tool suggestions for autocomplete', () => {
      const debugInterface = new DebugInterface();
      debugInterface.availableTools = ['context_add', 'context_list', 'plan_execute'];
      
      debugInterface.showToolSuggestions('context');
      
      const suggestions = document.getElementById('toolSuggestions');
      expect(suggestions.children.length).toBe(1);
      
      const suggestionList = suggestions.firstChild;
      expect(suggestionList.children.length).toBe(2); // context_add, context_list
    });

    test('should clear suggestions for short input', () => {
      const debugInterface = new DebugInterface();
      debugInterface.availableTools = ['context_add', 'context_list'];
      
      debugInterface.showToolSuggestions('c');
      
      const suggestions = document.getElementById('toolSuggestions');
      expect(suggestions.innerHTML).toBe('');
    });

    test('should format JSON in arguments textarea', () => {
      const debugInterface = new DebugInterface();
      
      const textarea = document.getElementById('toolArgs');
      textarea.value = '{"key":"value","nested":{"item":true}}';

      debugInterface.formatJSON();
      
      const expected = JSON.stringify({ key: 'value', nested: { item: true } }, null, 2);
      expect(textarea.value).toBe(expected);
    });

    test('should handle invalid JSON in format function', () => {
      const debugInterface = new DebugInterface();
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      const textarea = document.getElementById('toolArgs');
      textarea.value = '{ invalid json }';

      debugInterface.formatJSON();
      
      expect(toastMessages).toContainEqual({
        message: 'Invalid JSON - cannot format',
        type: 'warning'
      });
    });

    test('should toggle events pause state', () => {
      const debugInterface = new DebugInterface();
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      expect(debugInterface.eventsPaused).toBe(false);
      
      debugInterface.toggleEventsPause();
      
      expect(debugInterface.eventsPaused).toBe(true);
      expect(document.getElementById('pauseEvents').textContent).toBe('Resume');
      expect(toastMessages).toContainEqual({
        message: 'Event stream paused',
        type: 'info'
      });
    });

    test('should clear command form', () => {
      const debugInterface = new DebugInterface();
      
      // Set some values
      document.getElementById('toolName').value = 'test_tool';
      document.getElementById('toolArgs').value = '{"test": true}';
      document.getElementById('commandResult').textContent = 'Previous result';
      document.getElementById('commandResult').className = 'result-display success';

      debugInterface.clearCommand();
      
      expect(document.getElementById('toolName').value).toBe('');
      expect(document.getElementById('toolArgs').value).toBe('');
      expect(document.getElementById('commandResult').textContent).toBe('');
      expect(document.getElementById('commandResult').className).toBe('result-display');
    });
  });

  describe('toast notifications and error handling', () => {
    test('should create toast notifications', () => {
      const debugInterface = new DebugInterface();
      
      debugInterface.showToast('Test message', 'success');
      
      const toastContainer = document.getElementById('toastContainer');
      expect(toastContainer.children.length).toBe(1);
      
      const toast = toastContainer.firstChild;
      expect(toast.classList.contains('toast')).toBe(true);
      expect(toast.classList.contains('success')).toBe(true);
      expect(toast.textContent).toBe('Test message');
    });

    test('should auto-remove toast notifications', async () => {
      const debugInterface = new DebugInterface();
      
      debugInterface.showToast('Test message', 'info');
      
      const toastContainer = document.getElementById('toastContainer');
      expect(toastContainer.children.length).toBe(1);
      
      // Mock setTimeout to immediately execute callback
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (callback) => callback();
      
      debugInterface.showToast('Another message', 'info');
      
      // Should have removed the first toast
      expect(toastContainer.children.length).toBe(1);
      expect(toastContainer.firstChild.textContent).toBe('Another message');
      
      global.setTimeout = originalSetTimeout;
    });

    test('should handle WebSocket send errors gracefully', () => {
      const debugInterface = new DebugInterface();
      debugInterface.isConnected = true;
      debugInterface.ws = {
        send: () => {
          throw new Error('Connection lost');
        }
      };
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      const result = debugInterface.sendMessage({ type: 'test' });
      
      expect(result).toBe(false);
      expect(toastMessages).toContainEqual({
        message: 'Error sending message to server',
        type: 'error'
      });
    });

    test('should handle malformed JSON in onMessage', () => {
      const debugInterface = new DebugInterface();
      
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      const mockEvent = { data: '{ invalid json }' };
      debugInterface.onMessage(mockEvent);
      
      expect(toastMessages).toContainEqual({
        message: 'Error parsing server message',
        type: 'error'
      });
    });
  });
});