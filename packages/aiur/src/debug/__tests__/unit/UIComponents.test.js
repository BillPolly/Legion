/**
 * Unit tests for UI component functionality
 */

import { JSDOM } from 'jsdom';
import { getSharedWebDebugServer, waitForAsync } from '../fixtures/testSetup.js';

describe('UI Components', () => {
  let dom;
  let window;
  let document;
  let DebugInterface;
  let webDebugServer;

  beforeAll(async () => {
    // Get shared server for testing
    webDebugServer = await getSharedWebDebugServer();

    // Setup JSDOM environment with complete UI structure
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Debug Interface</title></head>
        <body>
          <!-- Command Panel -->
          <div id="commandPanel" class="panel">
            <div class="header">
              <h3>Command Execution</h3>
            </div>
            <div class="form-group">
              <label>Tool Name:</label>
              <input type="text" id="toolName" placeholder="Tool name" autocomplete="off" />
              <div id="toolSuggestions" class="suggestions"></div>
            </div>
            <div class="form-group">
              <label>Arguments (JSON):</label>
              <textarea id="toolArgs" rows="4" placeholder="Arguments in JSON format"></textarea>
            </div>
            <div class="button-group">
              <button id="executeBtn" class="btn primary">Execute</button>
              <button id="clearCommand" class="btn secondary">Clear</button>
              <button id="formatArgs" class="btn secondary">Format JSON</button>
            </div>
            <div class="result-container">
              <label>Result:</label>
              <div id="commandResult" class="result-display"></div>
            </div>
          </div>

          <!-- Context Browser -->
          <div id="contextPanel" class="panel">
            <div class="header">
              <h3>Context Browser</h3>
              <div class="controls">
                <input type="text" id="contextFilter" placeholder="Filter context..." />
                <button id="refreshContext" class="btn secondary">Refresh</button>
              </div>
            </div>
            <div id="contextList" class="context-list"></div>
          </div>

          <!-- Event Stream -->
          <div id="eventPanel" class="panel">
            <div class="header">
              <h3>Event Stream</h3>
              <div class="controls">
                <select id="eventFilter">
                  <option value="">All Events</option>
                  <option value="tool-executed">Tool Executed</option>
                  <option value="metric-recorded">Metrics</option>
                  <option value="alert-triggered">Alerts</option>
                </select>
                <button id="clearEvents" class="btn secondary">Clear</button>
                <button id="pauseEvents" class="btn secondary">Pause</button>
              </div>
            </div>
            <div id="eventStream" class="event-stream"></div>
          </div>

          <!-- System Status -->
          <div id="statusPanel" class="panel">
            <div class="header">
              <h3>System Status</h3>
              <button id="refreshStatus" class="btn secondary">Refresh</button>
            </div>
            <div class="status-grid">
              <div class="status-item">
                <label>Connection:</label>
                <div id="connectionStatus" class="status disconnected">Disconnected</div>
              </div>
              <div class="status-item">
                <label>Server Health:</label>
                <div id="serverHealth">Unknown</div>
              </div>
              <div class="status-item">
                <label>Connected Clients:</label>
                <div id="connectedClients">0</div>
              </div>
              <div class="status-item">
                <label>Available Tools:</label>
                <div id="toolCount">0</div>
              </div>
              <div class="status-item">
                <label>Context Items:</label>
                <div id="contextCount">0</div>
              </div>
            </div>
            <div id="serverInfo" class="server-info"></div>
            <div class="available-tools">
              <label>Tools:</label>
              <div id="availableTools" class="tool-tags"></div>
            </div>
          </div>

          <!-- Log Viewer -->
          <div id="logPanel" class="panel">
            <div class="header">
              <h3>Logs</h3>
              <div class="controls">
                <select id="logLevel">
                  <option value="">All</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
                <button id="clearLogs" class="btn secondary">Clear</button>
              </div>
            </div>
            <div id="logViewer" class="log-viewer"></div>
          </div>

          <!-- Toast Container -->
          <div id="toastContainer" class="toast-container"></div>
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

    // Load DebugInterface class
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const scriptPath = path.join(__dirname, '../../web/script.js');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Modify script to export DebugInterface and prevent auto-initialization
    scriptContent = scriptContent.replace(
      '// Initialize the debug interface\nnew DebugInterface();',
      'if (typeof window !== "undefined") { window.DebugInterface = DebugInterface; }'
    );
    
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

  describe('Command Panel Functionality', () => {
    let debugInterface;

    beforeEach(() => {
      // Clear the DOM state
      document.getElementById('toolName').value = '';
      document.getElementById('toolArgs').value = '';
      document.getElementById('commandResult').textContent = '';
      document.getElementById('commandResult').className = 'result-display';
      document.getElementById('toolSuggestions').innerHTML = '';
      
      debugInterface = new DebugInterface();
      debugInterface.isConnected = true; // Mock connection
    });

    test('should show autocomplete suggestions when typing tool names', () => {
      debugInterface.availableTools = ['context_add', 'context_get', 'context_list', 'plan_execute'];
      
      // Simulate typing 'context'
      const toolNameInput = document.getElementById('toolName');
      toolNameInput.value = 'context';
      debugInterface.showToolSuggestions('context');
      
      const suggestions = document.getElementById('toolSuggestions');
      const suggestionList = suggestions.querySelector('.suggestion-list');
      
      expect(suggestionList).toBeTruthy();
      expect(suggestionList.children.length).toBe(3); // context_add, context_get, context_list
      
      // Test suggestion click
      const firstSuggestion = suggestionList.firstChild;
      expect(firstSuggestion.textContent).toBe('context_add');
      
      firstSuggestion.click();
      expect(toolNameInput.value).toBe('context_add');
      expect(suggestions.innerHTML).toBe(''); // Suggestions should be cleared
    });

    test('should validate and format JSON arguments', () => {
      const textarea = document.getElementById('toolArgs');
      const toastMessages = [];
      
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      // Test valid JSON formatting
      textarea.value = '{"name":"test","data":{"nested":true}}';
      debugInterface.formatJSON();
      
      const expectedFormatted = JSON.stringify({
        name: 'test',
        data: { nested: true }
      }, null, 2);
      
      expect(textarea.value).toBe(expectedFormatted);

      // Test invalid JSON
      textarea.value = '{ invalid json }';
      debugInterface.formatJSON();
      
      expect(toastMessages).toContainEqual({
        message: 'Invalid JSON - cannot format',
        type: 'warning'
      });
    });

    test('should clear command form completely', () => {
      // Set up form with data
      document.getElementById('toolName').value = 'context_add';
      document.getElementById('toolArgs').value = '{"test": true}';
      document.getElementById('commandResult').textContent = 'Previous result';
      document.getElementById('commandResult').className = 'result-display success';

      debugInterface.clearCommand();

      expect(document.getElementById('toolName').value).toBe('');
      expect(document.getElementById('toolArgs').value).toBe('');
      expect(document.getElementById('commandResult').textContent).toBe('');
      expect(document.getElementById('commandResult').className).toBe('result-display');
    });

    test('should display tool execution results with appropriate styling', () => {
      const requestId = 'test-request-123';
      debugInterface.pendingRequests.set(requestId, {
        toolName: 'context_list',
        args: {},
        startTime: Date.now() - 150
      });

      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      // Test successful result
      const successResult = {
        id: requestId,
        data: {
          success: true,
          result: { content: [{ type: 'text', text: '{"contexts": []}' }] },
          executionTime: 142
        }
      };

      debugInterface.handleToolResult(successResult);

      const resultDisplay = document.getElementById('commandResult');
      expect(resultDisplay.className).toContain('success');
      expect(resultDisplay.textContent).toContain('contexts');
      expect(toastMessages).toContainEqual({
        message: 'context_list: Success in 142ms',
        type: 'success'
      });

      // Test error result
      const errorRequestId = 'error-request-456';
      debugInterface.pendingRequests.set(errorRequestId, {
        toolName: 'invalid_tool',
        args: {},
        startTime: Date.now() - 50
      });

      const errorResult = {
        id: errorRequestId,
        data: {
          success: false,
          error: 'Tool not found',
          executionTime: 45
        }
      };

      debugInterface.handleToolResult(errorResult);

      expect(resultDisplay.className).toContain('error');
      expect(toastMessages).toContainEqual({
        message: 'invalid_tool: Error in 45ms',
        type: 'error'
      });
    });
  });

  describe('Context Browser Functionality', () => {
    let debugInterface;

    beforeEach(() => {
      document.getElementById('contextList').innerHTML = '';
      document.getElementById('contextFilter').value = '';
      
      debugInterface = new DebugInterface();
    });

    test('should display context items in organized format', () => {
      const contextData = {
        contexts: [
          {
            name: 'user_config',
            description: 'User configuration settings',
            data: { theme: 'dark', language: 'en' }
          },
          {
            name: 'deployment_settings',
            description: 'Production deployment configuration',
            data: { env: 'production', replicas: 3 }
          }
        ]
      };

      const mockResult = {
        content: [{ type: 'text', text: JSON.stringify(contextData) }]
      };

      debugInterface.updateContextDisplay(mockResult);

      const contextList = document.getElementById('contextList');
      expect(contextList.children.length).toBe(2);

      const firstContext = contextList.firstChild;
      expect(firstContext.classList.contains('context-item')).toBe(true);
      expect(firstContext.querySelector('.context-name').textContent).toBe('user_config');
      expect(firstContext.querySelector('.context-description').textContent).toBe('User configuration settings');
      expect(firstContext.querySelector('.context-data').textContent).toContain('theme');

      // Check context count update
      expect(document.getElementById('contextCount').textContent).toBe('2');
    });

    test('should filter context items by name', () => {
      // Setup context items
      const contextList = document.getElementById('contextList');
      contextList.innerHTML = `
        <div class="context-item">
          <div class="context-name">user_config</div>
          <div class="context-description">User settings</div>
        </div>
        <div class="context-item">
          <div class="context-name">deployment_settings</div>
          <div class="context-description">Deploy config</div>
        </div>
        <div class="context-item">
          <div class="context-name">api_keys</div>
          <div class="context-description">API configuration</div>
        </div>
      `;

      // Filter by 'user'
      debugInterface.filterContext('user');

      const contextItems = document.querySelectorAll('.context-item');
      expect(contextItems[0].style.display).toBe('block'); // user_config
      expect(contextItems[1].style.display).toBe('none');  // deployment_settings
      expect(contextItems[2].style.display).toBe('none');  // api_keys

      // Filter by 'config'
      debugInterface.filterContext('config');
      expect(contextItems[0].style.display).toBe('block'); // user_config
      expect(contextItems[1].style.display).toBe('none');  // deployment_settings  
      expect(contextItems[2].style.display).toBe('none');  // api_keys

      // Clear filter
      debugInterface.filterContext('');
      expect(contextItems[0].style.display).toBe('block');
      expect(contextItems[1].style.display).toBe('block');
      expect(contextItems[2].style.display).toBe('block');
    });

    test('should handle empty context list gracefully', () => {
      const emptyContextData = { contexts: [] };
      const mockResult = {
        content: [{ type: 'text', text: JSON.stringify(emptyContextData) }]
      };

      debugInterface.updateContextDisplay(mockResult);

      const contextList = document.getElementById('contextList');
      expect(contextList.innerHTML).toContain('No context items found');
      expect(document.getElementById('contextCount').textContent).toBe('0');
    });
  });

  describe('Event Stream Display and Filtering', () => {
    let debugInterface;

    beforeEach(() => {
      document.getElementById('eventStream').innerHTML = '';
      debugInterface = new DebugInterface();
    });

    test('should display events with proper formatting and timestamps', () => {
      const eventData = {
        eventType: 'tool-executed',
        timestamp: '2024-01-15T10:30:45.123Z',
        source: 'debug-server',
        payload: {
          tool: 'context_add',
          success: true,
          executionTime: 25
        }
      };

      debugInterface.handleEvent(eventData);

      const eventStream = document.getElementById('eventStream');
      expect(eventStream.children.length).toBe(1);

      const eventElement = eventStream.firstChild;
      expect(eventElement.classList.contains('event-item')).toBe(true);
      expect(eventElement.classList.contains('tool_executed')).toBe(true);
      expect(eventElement.querySelector('.event-type').textContent).toBe('tool-executed');
      expect(eventElement.querySelector('.event-data').textContent).toContain('context_add');
      expect(eventElement.querySelector('.event-timestamp')).toBeTruthy();
    });

    test('should filter events by type', () => {
      // Add multiple event types
      const events = [
        { eventType: 'tool-executed', timestamp: new Date().toISOString(), payload: { tool: 'test1' } },
        { eventType: 'metric-recorded', timestamp: new Date().toISOString(), payload: { metric: 'cpu' } },
        { eventType: 'alert-triggered', timestamp: new Date().toISOString(), payload: { alert: 'high_cpu' } },
        { eventType: 'tool-executed', timestamp: new Date().toISOString(), payload: { tool: 'test2' } }
      ];

      events.forEach(event => debugInterface.handleEvent(event));

      const eventStream = document.getElementById('eventStream');
      expect(eventStream.children.length).toBe(4);

      // Filter to show only tool-executed events
      debugInterface.filterEvents('tool-executed');

      const eventItems = document.querySelectorAll('.event-item');
      expect(eventItems[0].style.display).toBe('block'); // tool-executed
      expect(eventItems[1].style.display).toBe('none');  // metric-recorded
      expect(eventItems[2].style.display).toBe('none');  // alert-triggered
      expect(eventItems[3].style.display).toBe('block'); // tool-executed

      // Show all events
      debugInterface.filterEvents('');
      eventItems.forEach(item => {
        expect(item.style.display).toBe('block');
      });
    });

    test('should pause and resume event stream', () => {
      const toastMessages = [];
      debugInterface.showToast = (message, type) => {
        toastMessages.push({ message, type });
      };

      // Initially not paused
      expect(debugInterface.eventsPaused).toBe(false);

      // Pause events
      debugInterface.toggleEventsPause();
      expect(debugInterface.eventsPaused).toBe(true);
      expect(document.getElementById('pauseEvents').textContent).toBe('Resume');
      expect(toastMessages).toContainEqual({
        message: 'Event stream paused',
        type: 'info'
      });

      // Events should be ignored when paused
      const eventData = {
        eventType: 'test-event',
        timestamp: new Date().toISOString(),
        payload: { test: 'data' }
      };

      debugInterface.handleEvent(eventData);
      expect(document.getElementById('eventStream').children.length).toBe(0);

      // Resume events
      debugInterface.toggleEventsPause();
      expect(debugInterface.eventsPaused).toBe(false);
      expect(document.getElementById('pauseEvents').textContent).toBe('Pause');
      expect(toastMessages).toContainEqual({
        message: 'Event stream resumed',
        type: 'info'
      });

      // Events should work again
      debugInterface.handleEvent(eventData);
      expect(document.getElementById('eventStream').children.length).toBe(1);
    });

    test('should limit event buffer size', () => {
      const eventStream = document.getElementById('eventStream');
      
      // Add more events than the max limit (500)
      for (let i = 0; i < 505; i++) {
        const eventData = {
          eventType: 'test-event',
          timestamp: new Date().toISOString(),
          payload: { index: i }
        };
        debugInterface.handleEvent(eventData);
      }

      // Should be limited to 500 events
      expect(eventStream.children.length).toBe(500);
      
      // The oldest events should be removed
      const firstEvent = eventStream.firstChild;
      expect(firstEvent.textContent).toContain('"index": 5'); // Should start from index 5
    });
  });

  describe('System Status Display', () => {
    let debugInterface;

    beforeEach(() => {
      debugInterface = new DebugInterface();
    });

    test('should update connection status with appropriate styling', () => {
      const statusElement = document.getElementById('connectionStatus');

      // Test connecting status
      debugInterface.updateConnectionStatus('connecting');
      expect(statusElement.classList.contains('connecting')).toBe(true);
      expect(statusElement.textContent).toBe('Connecting...');

      // Test connected status
      debugInterface.updateConnectionStatus('connected');
      expect(statusElement.classList.contains('connected')).toBe(true);
      expect(statusElement.textContent).toBe('Connected');

      // Test disconnected status
      debugInterface.updateConnectionStatus('disconnected');
      expect(statusElement.classList.contains('disconnected')).toBe(true);
      expect(statusElement.textContent).toBe('Disconnected');
    });

    test('should display available tools as clickable tags', () => {
      const tools = ['context_add', 'context_get', 'context_list', 'plan_execute', 'web_debug_start'];
      
      debugInterface.updateAvailableTools(tools);

      const toolsContainer = document.getElementById('availableTools');
      expect(toolsContainer.children.length).toBe(5);

      // Check first tool tag
      const firstTag = toolsContainer.firstChild;
      expect(firstTag.classList.contains('tool-tag')).toBe(true);
      expect(firstTag.classList.contains('context')).toBe(true); // context tools get special class
      expect(firstTag.textContent).toBe('context_add');

      // Test tool tag click functionality
      const toolNameInput = document.getElementById('toolName');
      firstTag.click();
      expect(toolNameInput.value).toBe('context_add');
    });

    test('should update server information display', () => {
      const serverInfo = {
        status: 'running',
        connectedClients: 5,
        uptime: 12345
      };

      debugInterface.handleServerInfo(serverInfo);

      expect(document.getElementById('serverHealth').textContent).toBe('running');
      expect(document.getElementById('connectedClients').textContent).toBe('5');
    });

    test('should handle welcome message and update displays', () => {
      const welcomeData = {
        serverId: 'aiur-mcp-12345',
        version: '1.0.0',
        capabilities: ['tool-execution', 'context-management', 'event-streaming'],
        availableTools: ['context_add', 'plan_execute']
      };

      // Mock refresh methods
      let refreshStatusCalled = false;
      let refreshContextCalled = false;
      debugInterface.refreshStatus = () => { refreshStatusCalled = true; };
      debugInterface.refreshContext = () => { refreshContextCalled = true; };

      debugInterface.handleWelcome(welcomeData);

      // Check server info display
      const serverInfoText = document.getElementById('serverInfo').textContent;
      expect(serverInfoText).toContain('aiur-mcp-12345');
      expect(serverInfoText).toContain('1.0.0');
      expect(serverInfoText).toContain('tool-execution');

      // Check available tools are stored
      expect(debugInterface.availableTools).toEqual(welcomeData.availableTools);

      // Check refresh methods were called
      expect(refreshStatusCalled).toBe(true);
      expect(refreshContextCalled).toBe(true);
    });
  });

  describe('Toast Notification System', () => {
    let debugInterface;

    beforeEach(() => {
      document.getElementById('toastContainer').innerHTML = '';
      debugInterface = new DebugInterface();
    });

    test('should create toast notifications with correct styling', () => {
      debugInterface.showToast('Success message', 'success');
      debugInterface.showToast('Error message', 'error');
      debugInterface.showToast('Warning message', 'warning');
      debugInterface.showToast('Info message', 'info');

      const toastContainer = document.getElementById('toastContainer');
      expect(toastContainer.children.length).toBe(4);

      const toasts = Array.from(toastContainer.children);
      expect(toasts[0].classList.contains('toast')).toBe(true);
      expect(toasts[0].classList.contains('success')).toBe(true);
      expect(toasts[0].textContent).toBe('Success message');

      expect(toasts[1].classList.contains('error')).toBe(true);
      expect(toasts[2].classList.contains('warning')).toBe(true);
      expect(toasts[3].classList.contains('info')).toBe(true);
    });

    test('should auto-remove toasts after timeout', async () => {
      const toastContainer = document.getElementById('toastContainer');
      
      debugInterface.showToast('Test message', 'info');
      expect(toastContainer.children.length).toBe(1);

      // Mock setTimeout to immediately execute callback
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (callback, delay) => {
        if (delay === 5000) { // Toast removal timeout
          callback();
        } else {
          originalSetTimeout(callback, delay);
        }
      };

      debugInterface.showToast('Another message', 'info');
      
      // First toast should be removed, second should remain
      expect(toastContainer.children.length).toBe(1);
      expect(toastContainer.firstChild.textContent).toBe('Another message');

      global.setTimeout = originalSetTimeout;
    });
  });
});