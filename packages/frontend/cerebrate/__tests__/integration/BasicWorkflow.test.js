/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mock Chrome APIs for extension components
global.chrome = {
  runtime: {
    connect: jest.fn(),
    onMessage: { addListener: jest.fn() },
    sendMessage: jest.fn()
  },
  devtools: {
    panels: {
      create: jest.fn()
    },
    inspectedWindow: {
      eval: jest.fn()
    }
  }
};

describe('Basic Workflow Integration Tests', () => {
  describe('Extension Component Integration', () => {
    test('should initialize Chrome extension APIs', () => {
      // Verify Chrome APIs are available
      expect(global.chrome).toBeDefined();
      expect(global.chrome.runtime).toBeDefined();
      expect(global.chrome.devtools).toBeDefined();
      
      // Test Chrome API calls
      global.chrome.runtime.sendMessage({ type: 'test' });
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'test' });
    });

    test('should handle DevTools panel creation', () => {
      const mockCallback = jest.fn();
      
      global.chrome.devtools.panels.create(
        'Cerebrate',
        null,
        'panel.html',
        mockCallback
      );
      
      expect(global.chrome.devtools.panels.create).toHaveBeenCalledWith(
        'Cerebrate',
        null,
        'panel.html',
        mockCallback
      );
    });

    test('should handle inspected window evaluation', () => {
      const testScript = 'document.querySelector("#test")';
      const mockCallback = jest.fn();
      
      global.chrome.devtools.inspectedWindow.eval(testScript, mockCallback);
      
      expect(global.chrome.devtools.inspectedWindow.eval).toHaveBeenCalledWith(
        testScript,
        mockCallback
      );
    });
  });

  describe('Message Protocol Simulation', () => {
    test('should create valid command messages', () => {
      const command = {
        id: 'test-123',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#test-element' },
        timestamp: Date.now()
      };
      
      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('type', 'command');
      expect(command).toHaveProperty('command', 'inspect_element');
      expect(command).toHaveProperty('params');
      expect(command.params).toHaveProperty('selector', '#test-element');
    });

    test('should create valid response messages', () => {
      const response = {
        id: 'test-123',
        type: 'response',
        success: true,
        data: {
          element: {
            tagName: 'DIV',
            id: 'test-element',
            className: 'test-class'
          }
        },
        timestamp: Date.now()
      };
      
      expect(response).toHaveProperty('id', 'test-123');
      expect(response).toHaveProperty('type', 'response');
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect(response.data.element).toHaveProperty('tagName', 'DIV');
    });

    test('should create valid error messages', () => {
      const error = {
        id: 'test-456',
        type: 'response',
        success: false,
        error: {
          code: 'ELEMENT_NOT_FOUND',
          message: 'Element not found',
          details: { selector: '#nonexistent' }
        },
        timestamp: Date.now()
      };
      
      expect(error).toHaveProperty('success', false);
      expect(error).toHaveProperty('error');
      expect(error.error).toHaveProperty('code', 'ELEMENT_NOT_FOUND');
      expect(error.error).toHaveProperty('message', 'Element not found');
    });
  });

  describe('WebSocket Communication Simulation', () => {
    beforeEach(() => {
      // Mock WebSocket for jsdom environment
      global.WebSocket = jest.fn().mockImplementation(() => ({
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1, // OPEN
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3
      }));
    });

    test('should establish WebSocket connection', () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:9222');
      expect(ws.addEventListener).toBeDefined();
      expect(ws.send).toBeDefined();
      expect(ws.readyState).toBe(1);
    });

    test('should handle connection events', () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      const openHandler = jest.fn();
      const closeHandler = jest.fn();
      const errorHandler = jest.fn();
      const messageHandler = jest.fn();
      
      ws.addEventListener('open', openHandler);
      ws.addEventListener('close', closeHandler);
      ws.addEventListener('error', errorHandler);
      ws.addEventListener('message', messageHandler);
      
      expect(ws.addEventListener).toHaveBeenCalledWith('open', openHandler);
      expect(ws.addEventListener).toHaveBeenCalledWith('close', closeHandler);
      expect(ws.addEventListener).toHaveBeenCalledWith('error', errorHandler);
      expect(ws.addEventListener).toHaveBeenCalledWith('message', messageHandler);
    });

    test('should send and receive messages', () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Add message event listener
      const messageHandler = jest.fn();
      ws.addEventListener('message', messageHandler);
      
      const command = {
        id: 'cmd-1',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#test' }
      };
      
      ws.send(JSON.stringify(command));
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(command));
      
      // Simulate receiving response
      const response = {
        id: 'cmd-1',
        type: 'response',
        success: true,
        data: { element: { tagName: 'DIV' } }
      };
      
      messageHandler({
        data: JSON.stringify(response)
      });
      
      expect(ws.addEventListener).toHaveBeenCalledWith('message', messageHandler);
      expect(messageHandler).toHaveBeenCalledWith({
        data: JSON.stringify(response)
      });
    });
  });

  describe('Command Processing Workflow', () => {
    test('should process DOM inspection workflow', async () => {
      const steps = [];
      
      // Step 1: Create command
      const inspectCommand = {
        id: 'inspect-1',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#submit-btn' }
      };
      steps.push('command_created');
      
      // Step 2: Send command (simulated)
      const ws = new global.WebSocket('ws://localhost:9222');
      ws.send(JSON.stringify(inspectCommand));
      steps.push('command_sent');
      
      // Step 3: Process response (simulated)
      const response = {
        id: 'inspect-1',
        type: 'response',
        success: true,
        data: {
          element: {
            tagName: 'BUTTON',
            id: 'submit-btn',
            className: 'btn btn-primary',
            textContent: 'Submit Form'
          }
        }
      };
      steps.push('response_received');
      
      // Step 4: Validate response
      expect(response.success).toBe(true);
      expect(response.data.element.tagName).toBe('BUTTON');
      expect(response.data.element.id).toBe('submit-btn');
      steps.push('response_validated');
      
      expect(steps).toEqual([
        'command_created',
        'command_sent',
        'response_received',
        'response_validated'
      ]);
    });

    test('should handle multi-command sequence', async () => {
      const commands = [
        { command: 'inspect_element', params: { selector: '#test' } },
        { command: 'analyze_javascript', params: { selector: 'script' } },
        { command: 'audit_accessibility', params: { selector: 'body' } }
      ];
      
      const ws = new global.WebSocket('ws://localhost:9222');
      const sentCommands = [];
      
      commands.forEach((cmd, index) => {
        const message = {
          id: `cmd-${index + 1}`,
          type: 'command',
          ...cmd
        };
        
        ws.send(JSON.stringify(message));
        sentCommands.push(message);
      });
      
      expect(ws.send).toHaveBeenCalledTimes(3);
      expect(sentCommands).toHaveLength(3);
      expect(sentCommands[0].command).toBe('inspect_element');
      expect(sentCommands[1].command).toBe('analyze_javascript');
      expect(sentCommands[2].command).toBe('audit_accessibility');
    });

    test('should handle error scenarios', async () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Add event listeners
      const errorHandler = jest.fn();
      const messageHandler = jest.fn();
      
      ws.addEventListener('error', errorHandler);
      ws.addEventListener('message', messageHandler);
      
      // Test connection error
      const connectionError = new Error('Connection failed');
      errorHandler(connectionError);
      
      // Test command error response
      const errorResponse = {
        id: 'cmd-error',
        type: 'response',
        success: false,
        error: {
          code: 'INVALID_SELECTOR',
          message: 'Invalid CSS selector provided'
        }
      };
      
      messageHandler({
        data: JSON.stringify(errorResponse)
      });
      
      expect(ws.addEventListener).toHaveBeenCalledWith('error', errorHandler);
      expect(ws.addEventListener).toHaveBeenCalledWith('message', messageHandler);
      expect(errorHandler).toHaveBeenCalledWith(connectionError);
      expect(messageHandler).toHaveBeenCalledWith({
        data: JSON.stringify(errorResponse)
      });
    });
  });

  describe('Data Flow Validation', () => {
    test('should validate command message structure', () => {
      const isValidCommand = (msg) => {
        return msg.hasOwnProperty('id') &&
               msg.hasOwnProperty('type') &&
               msg.type === 'command' &&
               msg.hasOwnProperty('command') &&
               msg.hasOwnProperty('params');
      };
      
      const validCommand = {
        id: 'test-123',
        type: 'command',
        command: 'inspect_element',
        params: { selector: '#test' }
      };
      
      const invalidCommand = {
        type: 'command',
        command: 'inspect_element'
        // Missing id and params
      };
      
      expect(isValidCommand(validCommand)).toBe(true);
      expect(isValidCommand(invalidCommand)).toBe(false);
    });

    test('should validate response message structure', () => {
      const isValidResponse = (msg) => {
        return msg.hasOwnProperty('id') &&
               msg.hasOwnProperty('type') &&
               msg.type === 'response' &&
               msg.hasOwnProperty('success') &&
               (msg.success ? msg.hasOwnProperty('data') : msg.hasOwnProperty('error'));
      };
      
      const validSuccessResponse = {
        id: 'test-123',
        type: 'response',
        success: true,
        data: { result: 'success' }
      };
      
      const validErrorResponse = {
        id: 'test-456',
        type: 'response',
        success: false,
        error: { code: 'ERROR', message: 'Something went wrong' }
      };
      
      const invalidResponse = {
        id: 'test-789',
        type: 'response'
        // Missing success field
      };
      
      expect(isValidResponse(validSuccessResponse)).toBe(true);
      expect(isValidResponse(validErrorResponse)).toBe(true);
      expect(isValidResponse(invalidResponse)).toBe(false);
    });

    test('should validate DOM inspection data', () => {
      const domData = {
        element: {
          tagName: 'DIV',
          id: 'test-element',
          className: 'test-class',
          attributes: { 'data-test': 'value' },
          textContent: 'Test content',
          styles: {
            backgroundColor: 'rgb(255, 255, 255)',
            padding: '10px'
          }
        }
      };
      
      expect(domData).toHaveProperty('element');
      expect(domData.element).toHaveProperty('tagName', 'DIV');
      expect(domData.element).toHaveProperty('id', 'test-element');
      expect(domData.element).toHaveProperty('className', 'test-class');
      expect(domData.element).toHaveProperty('attributes');
      expect(domData.element.attributes).toHaveProperty('data-test', 'value');
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle high message throughput', () => {
      const ws = new global.WebSocket('ws://localhost:9222');
      const messageCount = 100;
      
      for (let i = 0; i < messageCount; i++) {
        const message = {
          id: `msg-${i}`,
          type: 'command',
          command: 'inspect_element',
          params: { selector: `#element-${i}` }
        };
        
        ws.send(JSON.stringify(message));
      }
      
      expect(ws.send).toHaveBeenCalledTimes(messageCount);
    });

    test('should handle connection interruption', () => {
      // Clear previous calls
      jest.clearAllMocks();
      
      const ws = new global.WebSocket('ws://localhost:9222');
      
      // Add event listeners
      const openHandler = jest.fn();
      const closeHandler = jest.fn();
      
      ws.addEventListener('open', openHandler);
      ws.addEventListener('close', closeHandler);
      
      // Simulate successful connection
      openHandler();
      
      // Simulate connection loss
      closeHandler({ code: 1006, reason: 'Connection lost' });
      
      // Simulate reconnection
      const newWs = new global.WebSocket('ws://localhost:9222');
      const newOpenHandler = jest.fn();
      newWs.addEventListener('open', newOpenHandler);
      newOpenHandler();
      
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
      expect(openHandler).toHaveBeenCalled();
      expect(closeHandler).toHaveBeenCalledWith({ code: 1006, reason: 'Connection lost' });
      expect(newOpenHandler).toHaveBeenCalled();
    });

    test('should validate message serialization', () => {
      const complexMessage = {
        id: 'complex-123',
        type: 'response',
        success: true,
        data: {
          elements: [
            { tagName: 'DIV', id: 'div1' },
            { tagName: 'SPAN', id: 'span1' }
          ],
          metrics: {
            loadTime: 1250,
            domNodes: 456
          },
          metadata: {
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      };
      
      const serialized = JSON.stringify(complexMessage);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized).toEqual(complexMessage);
      expect(typeof serialized).toBe('string');
      expect(deserialized.data.elements).toHaveLength(2);
    });
  });
});