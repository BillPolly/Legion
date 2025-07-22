/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { LegionAgentMock } from '../../../src/testing/mocks/LegionAgentMock.js';
import { WebSocketConnectionMock } from '../../../src/testing/mocks/WebSocketConnectionMock.js';
import { ChromeAPIMock } from '../../../src/testing/mocks/ChromeAPIMock.js';
import { TestDataGenerator } from '../../../src/testing/mocks/TestDataGenerator.js';

describe('Mock and Stub Systems', () => {
  describe('Legion Agent Mock', () => {
    let agentMock;

    beforeEach(() => {
      agentMock = new LegionAgentMock();
    });

    test('should create mock agent with default configuration', () => {
      expect(agentMock).toBeDefined();
      expect(agentMock.isConnected()).toBe(true);
      expect(agentMock.getConfiguration()).toEqual(
        expect.objectContaining({
          model: 'claude-3-sonnet',
          maxTokens: 4096,
          temperature: 0.1
        })
      );
    });

    test('should execute DOM inspection commands', async () => {
      const command = {
        name: 'inspect_element',
        params: { selector: '#test-element' }
      };

      const result = await agentMock.executeCommand(command);
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          element: expect.objectContaining({
            tagName: expect.any(String),
            id: expect.any(String),
            className: expect.any(String),
            attributes: expect.any(Object)
          })
        })
      });
    });

    test('should execute JavaScript analysis commands', async () => {
      const command = {
        name: 'analyze_javascript',
        params: { code: 'console.log("test");' }
      };

      const result = await agentMock.executeCommand(command);
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          syntax: 'valid',
          complexity: expect.any(String),
          issues: expect.any(Array),
          suggestions: expect.any(Array)
        })
      });
    });

    test('should execute accessibility audit commands', async () => {
      const command = {
        name: 'audit_accessibility',
        params: { selector: 'body' }
      };

      const result = await agentMock.executeCommand(command);
      
      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({
          score: expect.any(Number),
          issues: expect.any(Array),
          recommendations: expect.any(Array),
          wcagLevel: expect.any(String)
        })
      });
    });

    test('should simulate command failures', async () => {
      agentMock.setFailureRate(1.0); // 100% failure rate
      
      const command = {
        name: 'inspect_element',
        params: { selector: '#nonexistent' }
      };

      const result = await agentMock.executeCommand(command);
      
      expect(result).toEqual({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String)
        })
      });
    });

    test('should simulate network delays', async () => {
      agentMock.setNetworkDelay(200);
      
      const startTime = Date.now();
      await agentMock.executeCommand({
        name: 'inspect_element',
        params: { selector: '#test' }
      });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });

    test('should track command history', async () => {
      await agentMock.executeCommand({
        name: 'inspect_element',
        params: { selector: '#test1' }
      });
      
      await agentMock.executeCommand({
        name: 'analyze_javascript',
        params: { code: 'var x = 1;' }
      });
      
      const history = agentMock.getCommandHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(expect.objectContaining({
        name: 'inspect_element',
        params: { selector: '#test1' },
        timestamp: expect.any(Number)
      }));
    });
  });

  describe('WebSocket Connection Mock', () => {
    let wsMock;

    beforeEach(() => {
      wsMock = new WebSocketConnectionMock('ws://localhost:9222');
    });

    test('should create mock WebSocket connection', () => {
      expect(wsMock).toBeDefined();
      expect(wsMock.url).toBe('ws://localhost:9222');
      expect(wsMock.readyState).toBe(wsMock.CLOSED); // autoConnect: false by default in this setup
    });

    test('should simulate connection establishment', async () => {
      const connectedPromise = new Promise((resolve) => {
        wsMock.addEventListener('open', resolve);
      });
      
      wsMock.connect();
      await connectedPromise;
      
      expect(wsMock.readyState).toBe(WebSocket.OPEN);
    });

    test('should handle message sending and receiving', async () => {
      wsMock.connect();
      
      const message = {
        id: 'test-123',
        type: 'command',
        command: 'inspect_element'
      };
      
      const messagePromise = new Promise((resolve) => {
        wsMock.addEventListener('message', (event) => {
          resolve(JSON.parse(event.data));
        });
      });
      
      wsMock.send(JSON.stringify(message));
      
      // Mock should auto-respond
      const response = await messagePromise;
      expect(response).toEqual(expect.objectContaining({
        id: 'test-123',
        type: 'response',
        success: expect.any(Boolean)
      }));
    });

    test('should simulate connection failures', async () => {
      wsMock.setFailureMode(true);
      
      const errorPromise = new Promise((resolve) => {
        wsMock.addEventListener('error', resolve);
      });
      
      wsMock.connect();
      const error = await errorPromise;
      
      expect(error).toBeInstanceOf(Error);
      expect(wsMock.readyState).toBe(WebSocket.CLOSED);
    });

    test('should simulate intermittent disconnections', async () => {
      wsMock.connect();
      wsMock.setInstabilityMode(true, 0.5); // 50% chance of disconnect
      
      const disconnectPromise = new Promise((resolve) => {
        wsMock.addEventListener('close', resolve);
      });
      
      // Send multiple messages to trigger instability
      for (let i = 0; i < 10; i++) {
        wsMock.send(JSON.stringify({ id: `msg-${i}`, type: 'ping' }));
      }
      
      const closeEvent = await disconnectPromise;
      expect(closeEvent.code).toBe(1006); // Connection lost
    });

    test('should handle message queuing during disconnection', async () => {
      const messages = [
        { id: '1', type: 'command' },
        { id: '2', type: 'command' },
        { id: '3', type: 'command' }
      ];
      
      // Send messages while disconnected
      messages.forEach(msg => wsMock.send(JSON.stringify(msg)));
      
      const queuedMessages = wsMock.getMessageQueue();
      expect(queuedMessages).toHaveLength(3);
      
      // Connect and wait for connection
      const connectedPromise = new Promise((resolve) => {
        wsMock.addEventListener('open', resolve);
      });
      
      wsMock.connect();
      await connectedPromise;
      
      // Messages should now be sent and queue cleared
      expect(wsMock.getMessageQueue()).toHaveLength(0);
    });
  });

  describe('Chrome API Mock', () => {
    let chromeMock;

    beforeEach(() => {
      chromeMock = new ChromeAPIMock();
      global.chrome = chromeMock.getAPI();
    });

    afterEach(() => {
      delete global.chrome;
    });

    test('should provide complete Chrome extension API', () => {
      expect(global.chrome).toBeDefined();
      expect(global.chrome.runtime).toBeDefined();
      expect(global.chrome.devtools).toBeDefined();
      expect(global.chrome.tabs).toBeDefined();
      expect(global.chrome.storage).toBeDefined();
    });

    test('should handle runtime messaging', () => {
      const message = { type: 'test', data: 'hello' };
      const mockCallback = jest.fn();
      
      global.chrome.runtime.sendMessage(message, mockCallback);
      
      expect(chromeMock.getMessageHistory()).toContainEqual(
        expect.objectContaining({
          message,
          options: mockCallback,
          timestamp: expect.any(Number)
        })
      );
    });

    test('should simulate DevTools panel creation', async () => {
      const mockCallback = jest.fn();
      
      global.chrome.devtools.panels.create(
        'Test Panel',
        'icon.png',
        'panel.html',
        mockCallback
      );
      
      // Wait for callback to be called
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Panel',
          iconPath: 'icon.png',
          pagePath: 'panel.html'
        })
      );
    });

    test('should handle inspected window evaluation', async () => {
      const script = 'document.title';
      const mockCallback = jest.fn();
      
      global.chrome.devtools.inspectedWindow.eval(script, mockCallback);
      
      // Wait for callback to be called
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockCallback).toHaveBeenCalledWith(
        'Mock Page Title', // Mock result
        null // No error
      );
    });

    test('should simulate storage operations', async () => {
      const testData = { key1: 'value1', key2: 'value2' };
      
      // Set data
      await new Promise((resolve) => {
        global.chrome.storage.local.set(testData, resolve);
      });
      
      // Get data
      const result = await new Promise((resolve) => {
        global.chrome.storage.local.get(['key1', 'key2'], resolve);
      });
      
      expect(result).toEqual(testData);
    });

    test('should handle tab operations', async () => {
      const mockCallback = jest.fn();
      
      global.chrome.tabs.query({ active: true, currentWindow: true }, mockCallback);
      
      // Wait for callback to be called
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockCallback).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(Number),
          url: expect.any(String),
          title: expect.any(String),
          active: true
        })
      ]);
    });
  });

  describe('Test Data Generator', () => {
    let dataGenerator;

    beforeEach(() => {
      dataGenerator = new TestDataGenerator();
    });

    test('should generate realistic DOM elements', () => {
      const element = dataGenerator.generateDOMElement();
      
      expect(element).toEqual(expect.objectContaining({
        tagName: expect.any(String),
        id: expect.any(String),
        className: expect.any(String),
        attributes: expect.any(Object),
        textContent: expect.any(String),
        styles: expect.any(Object)
      }));
      
      expect(['DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'SECTION', 'ARTICLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN', 'UL', 'OL', 'LI', 'A', 'IMG', 'TABLE', 'TR', 'TD']).toContain(element.tagName);
    });

    test('should generate JavaScript code samples', () => {
      const samples = dataGenerator.generateJavaScriptSamples(5);
      
      expect(samples).toHaveLength(5);
      samples.forEach(sample => {
        expect(sample).toEqual(expect.objectContaining({
          code: expect.any(String),
          complexity: expect.any(String),
          issues: expect.any(Array),
          type: expect.any(String)
        }));
      });
    });

    test('should generate accessibility test scenarios', () => {
      const scenarios = dataGenerator.generateAccessibilityScenarios();
      
      expect(scenarios).toBeInstanceOf(Array);
      expect(scenarios.length).toBeGreaterThan(0);
      
      scenarios.forEach(scenario => {
        expect(scenario).toEqual(expect.objectContaining({
          name: expect.any(String),
          html: expect.any(String),
          expectedIssues: expect.any(Array),
          wcagLevel: expect.any(String)
        }));
      });
    });

    test('should generate performance test data', () => {
      const perfData = dataGenerator.generatePerformanceData();
      
      expect(perfData).toEqual(expect.objectContaining({
        metrics: expect.objectContaining({
          loadTime: expect.any(Number),
          domContentLoaded: expect.any(Number),
          firstPaint: expect.any(Number),
          largestContentfulPaint: expect.any(Number)
        }),
        resources: expect.any(Array),
        bottlenecks: expect.any(Array),
        recommendations: expect.any(Array)
      }));
    });

    test('should generate error scenarios', () => {
      const errors = dataGenerator.generateErrorScenarios(3);
      
      expect(errors).toHaveLength(3);
      errors.forEach(error => {
        expect(error).toEqual(expect.objectContaining({
          type: expect.any(String),
          code: expect.any(String),
          message: expect.any(String),
          stack: expect.any(String),
          recoverable: expect.any(Boolean)
        }));
      });
    });

    test('should generate command response data', () => {
      const commands = ['inspect_element', 'analyze_javascript', 'audit_accessibility'];
      
      commands.forEach(command => {
        const response = dataGenerator.generateCommandResponse(command);
        
        expect(response).toHaveProperty('success');
        
        if (response.success) {
          expect(response).toHaveProperty('data');
          
          if (command === 'inspect_element') {
            expect(response.data).toHaveProperty('element');
          } else if (command === 'analyze_javascript') {
            expect(response.data).toHaveProperty('complexity');
          } else if (command === 'audit_accessibility') {
            expect(response.data).toHaveProperty('score');
            expect(response.data).toHaveProperty('issues');
          }
        } else {
          expect(response).toHaveProperty('error');
        }
      });
    });

    test('should generate realistic user interactions', () => {
      const interactions = dataGenerator.generateUserInteractions(10);
      
      expect(interactions).toHaveLength(10);
      interactions.forEach(interaction => {
        expect(interaction).toEqual(expect.objectContaining({
          type: expect.any(String),
          target: expect.any(String),
          timestamp: expect.any(Number),
          data: expect.any(Object)
        }));
      });
    });
  });

  describe('Mock System Integration', () => {
    test('should work together seamlessly', async () => {
      const agentMock = new LegionAgentMock();
      const wsMock = new WebSocketConnectionMock('ws://localhost:9222');
      const chromeMock = new ChromeAPIMock();
      const dataGenerator = new TestDataGenerator();
      
      // Setup Chrome API
      global.chrome = chromeMock.getAPI();
      
      // Connect WebSocket and wait for connection
      const connectedPromise = new Promise((resolve) => {
        wsMock.addEventListener('open', resolve);
      });
      
      wsMock.connect();
      await connectedPromise;
      
      // Generate test data
      const element = dataGenerator.generateDOMElement();
      
      // Execute command through agent
      const result = await agentMock.executeCommand({
        name: 'inspect_element',
        params: { selector: `#${element.id}` }
      });
      
      expect(result.success).toBe(true);
      expect(global.chrome.devtools).toBeDefined();
      expect(wsMock.readyState).toBe(wsMock.OPEN);
    });

    test('should support configuration and customization', () => {
      const agentMock = new LegionAgentMock({
        model: 'custom-model',
        failureRate: 0.1,
        networkDelay: 100
      });
      
      const wsMock = new WebSocketConnectionMock('ws://test:8080', {
        autoConnect: false,
        messageDelay: 50
      });
      
      const dataGenerator = new TestDataGenerator({
        seed: 12345,
        complexity: 'high'
      });
      
      expect(agentMock.getConfiguration().model).toBe('custom-model');
      expect(wsMock.url).toBe('ws://test:8080');
      expect(wsMock.readyState).toBe(WebSocket.CLOSED);
      expect(dataGenerator.getSeed()).toBe(12345);
    });
  });
});