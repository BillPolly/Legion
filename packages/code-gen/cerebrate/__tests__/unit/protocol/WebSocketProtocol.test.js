import { WebSocketProtocol } from '../../../src/shared/protocol/WebSocketProtocol.js';
import { MessageProtocol } from '../../../src/shared/protocol/MessageProtocol.js';

describe('WebSocketProtocol', () => {
  describe('Message Serialization/Deserialization', () => {
    test('should serialize message to JSON string', () => {
      const message = {
        id: 'test-id-001',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: { command: 'test_command' }
      };

      const serialized = WebSocketProtocol.serializeMessage(message);
      
      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(message);
    });

    test('should deserialize JSON string to message object', () => {
      const messageString = JSON.stringify({
        id: 'test-id-001',
        type: 'response',
        timestamp: '2024-01-01T12:00:01.000Z',
        session: 'test-session',
        payload: { status: 'success', command: 'test_command', data: {} }
      });

      const deserialized = WebSocketProtocol.deserializeMessage(messageString);
      
      expect(typeof deserialized).toBe('object');
      expect(deserialized.id).toBe('test-id-001');
      expect(deserialized.type).toBe('response');
      expect(deserialized.payload.status).toBe('success');
    });

    test('should handle serialization errors gracefully', () => {
      const circularRef = {};
      circularRef.self = circularRef;

      expect(() => {
        WebSocketProtocol.serializeMessage(circularRef);
      }).toThrow();
    });

    test('should handle deserialization of invalid JSON', () => {
      const invalidJson = '{"invalid": json}';
      
      expect(() => {
        WebSocketProtocol.deserializeMessage(invalidJson);
      }).toThrow();
    });

    test('should preserve message structure through serialization cycle', () => {
      const originalMessage = {
        id: 'cycle-test-001',
        type: 'event',
        timestamp: new Date().toISOString(),
        session: 'cycle-session',
        payload: {
          event_type: 'progress_update',
          progress: { current: 5, total: 10, percentage: 50 }
        }
      };

      const serialized = WebSocketProtocol.serializeMessage(originalMessage);
      const deserialized = WebSocketProtocol.deserializeMessage(serialized);
      
      expect(deserialized).toEqual(originalMessage);
    });
  });

  describe('Command Message Validation', () => {
    test('should validate properly formatted command message', () => {
      const commandMessage = {
        id: 'cmd-001',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: {
          command: 'inspect_element',
          parameters: {
            selector: '.my-component',
            include_styles: true,
            depth: 2
          }
        }
      };

      expect(WebSocketProtocol.validateCommandMessage(commandMessage)).toBe(true);
    });

    test('should reject command message with invalid base structure', () => {
      const invalidCommand = {
        id: 'cmd-001',
        type: 'invalid-type',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: { command: 'test_command' }
      };

      expect(WebSocketProtocol.validateCommandMessage(invalidCommand)).toBe(false);
    });

    test('should reject command message with invalid payload', () => {
      const invalidCommand = {
        id: 'cmd-001',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: { /* missing command field */ }
      };

      expect(WebSocketProtocol.validateCommandMessage(invalidCommand)).toBe(false);
    });

    test('should validate command message with optional parameters', () => {
      const commandMessage = {
        id: 'cmd-002',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: {
          command: 'ping'  // No parameters
        }
      };

      expect(WebSocketProtocol.validateCommandMessage(commandMessage)).toBe(true);
    });
  });

  describe('Response Message Formatting', () => {
    test('should format success response message correctly', () => {
      const responseData = {
        element: { tag: 'div', classes: ['component'] },
        analysis: { accessibility_score: 85 }
      };
      
      const metadata = {
        execution_time: 150,
        agent_model: 'claude-3-sonnet'
      };

      const response = WebSocketProtocol.formatSuccessResponse(
        'cmd-001',
        'inspect_element',
        responseData,
        metadata,
        'test-session'
      );

      expect(response.type).toBe('response');
      expect(response.payload.status).toBe('success');
      expect(response.payload.command).toBe('inspect_element');
      expect(response.payload.data).toEqual(responseData);
      expect(response.payload.metadata).toEqual(metadata);
      expect(response.session).toBe('test-session');
    });

    test('should format error response message correctly', () => {
      const errorDetails = {
        selector: '.invalid[',
        validation_error: 'Unclosed bracket'
      };
      
      const suggestions = ['Check selector syntax', 'Ensure proper brackets'];

      const errorResponse = WebSocketProtocol.formatErrorResponse(
        'cmd-001',
        'INVALID_SELECTOR',
        'CSS selector is invalid',
        errorDetails,
        suggestions,
        'test-session'
      );

      expect(errorResponse.type).toBe('error');
      expect(errorResponse.payload.error_code).toBe('INVALID_SELECTOR');
      expect(errorResponse.payload.error_message).toBe('CSS selector is invalid');
      expect(errorResponse.payload.details).toEqual(errorDetails);
      expect(errorResponse.payload.suggestions).toEqual(suggestions);
    });

    test('should format progress event message correctly', () => {
      const progressData = {
        command_id: 'cmd-001',
        progress: {
          current: 3,
          total: 10,
          step: 'Analyzing CSS rules',
          percentage: 30
        }
      };

      const event = WebSocketProtocol.formatProgressEvent(progressData, 'test-session');

      expect(event.type).toBe('event');
      expect(event.payload.event_type).toBe('progress_update');
      expect(event.payload.command_id).toBe('cmd-001');
      expect(event.payload.progress).toEqual(progressData.progress);
    });
  });

  describe('Error Message Structure', () => {
    test('should validate complete error message structure', () => {
      const errorMessage = {
        id: 'err-001',
        type: 'error',
        timestamp: '2024-01-01T12:00:01.000Z',
        session: 'test-session',
        payload: {
          error_code: 'TIMEOUT',
          error_message: 'Command execution timeout',
          details: { timeout_duration: 30000 },
          suggestions: ['Try simpler command', 'Check server load']
        }
      };

      expect(WebSocketProtocol.validateErrorMessage(errorMessage)).toBe(true);
    });

    test('should reject error message with missing required fields', () => {
      const incompleteError = {
        id: 'err-001',
        type: 'error',
        timestamp: '2024-01-01T12:00:01.000Z',
        session: 'test-session',
        payload: {
          error_code: 'TIMEOUT'
          // Missing error_message
        }
      };

      expect(WebSocketProtocol.validateErrorMessage(incompleteError)).toBe(false);
    });

    test('should validate error message with optional details and suggestions', () => {
      const minimalError = {
        id: 'err-002',
        type: 'error',
        timestamp: '2024-01-01T12:00:01.000Z',
        session: 'test-session',
        payload: {
          error_code: 'AGENT_ERROR',
          error_message: 'Internal agent processing error'
          // No details or suggestions
        }
      };

      expect(WebSocketProtocol.validateErrorMessage(minimalError)).toBe(true);
    });
  });

  describe('Message Size and Limits', () => {
    test('should validate message size within limits', () => {
      const smallMessage = {
        id: 'size-001',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: { command: 'ping' }
      };

      expect(WebSocketProtocol.validateMessageSize(smallMessage)).toBe(true);
    });

    test('should reject message exceeding size limit', () => {
      const largePayload = {
        command: 'analyze_large_data',
        parameters: {
          data: 'x'.repeat(2 * 1024 * 1024) // 2MB string
        }
      };

      const largeMessage = {
        id: 'size-002',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: largePayload
      };

      expect(WebSocketProtocol.validateMessageSize(largeMessage)).toBe(false);
    });

    test('should calculate correct message size in bytes', () => {
      const testMessage = {
        id: 'test-id',
        type: 'command',
        timestamp: '2024-01-01T12:00:00.000Z',
        session: 'test-session',
        payload: { command: 'test' }
      };

      const size = WebSocketProtocol.calculateMessageSize(testMessage);
      const expectedSize = JSON.stringify(testMessage).length;
      
      expect(size).toBe(expectedSize);
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Protocol Constants and Configuration', () => {
    test('should provide correct maximum message size constant', () => {
      expect(WebSocketProtocol.MAX_MESSAGE_SIZE).toBe(1024 * 1024); // 1MB
      expect(typeof WebSocketProtocol.MAX_MESSAGE_SIZE).toBe('number');
    });

    test('should provide correct supported message types', () => {
      const supportedTypes = WebSocketProtocol.SUPPORTED_MESSAGE_TYPES;
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain('command');
      expect(supportedTypes).toContain('response');
      expect(supportedTypes).toContain('event');
      expect(supportedTypes).toContain('error');
    });

    test('should provide protocol version information', () => {
      expect(WebSocketProtocol.PROTOCOL_VERSION).toBeDefined();
      expect(typeof WebSocketProtocol.PROTOCOL_VERSION).toBe('string');
    });
  });
});