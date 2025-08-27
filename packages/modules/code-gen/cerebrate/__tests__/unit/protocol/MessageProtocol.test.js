import { MessageProtocol } from '../../../src/shared/protocol/MessageProtocol.js';
import { v4 as uuidv4 } from 'uuid';

describe('MessageProtocol', () => {
  describe('Message Format Validation', () => {
    test('should validate base message structure with required fields', () => {
      const validMessage = {
        id: uuidv4(),
        type: 'command',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(validMessage)).toBe(true);
    });

    test('should reject message missing required id field', () => {
      const invalidMessage = {
        type: 'command',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should reject message missing required type field', () => {
      const invalidMessage = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should reject message with invalid type field', () => {
      const invalidMessage = {
        id: uuidv4(),
        type: 'invalid_type',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should validate all allowed message types', () => {
      const allowedTypes = ['command', 'response', 'event', 'error'];
      
      allowedTypes.forEach(type => {
        const message = {
          id: uuidv4(),
          type,
          timestamp: new Date().toISOString(),
          session: 'test-session-001',
          payload: { test: 'data' }
        };

        expect(MessageProtocol.validateMessage(message)).toBe(true);
      });
    });

    test('should reject message missing timestamp field', () => {
      const invalidMessage = {
        id: uuidv4(),
        type: 'command',
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should reject message with invalid timestamp format', () => {
      const invalidMessage = {
        id: uuidv4(),
        type: 'command',
        timestamp: 'invalid-timestamp',
        session: 'test-session-001',
        payload: { command: 'test_command' }
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should reject message missing payload field', () => {
      const invalidMessage = {
        id: uuidv4(),
        type: 'command',
        timestamp: new Date().toISOString(),
        session: 'test-session-001'
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });

    test('should reject message with non-object payload', () => {
      const invalidMessage = {
        id: uuidv4(),
        type: 'command',
        timestamp: new Date().toISOString(),
        session: 'test-session-001',
        payload: 'string-payload'
      };

      expect(MessageProtocol.validateMessage(invalidMessage)).toBe(false);
    });
  });

  describe('Message ID Generation', () => {
    test('should generate unique message IDs', () => {
      const id1 = MessageProtocol.generateMessageId();
      const id2 = MessageProtocol.generateMessageId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    test('should generate valid UUID v4 format IDs', () => {
      const id = MessageProtocol.generateMessageId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(id).toMatch(uuidRegex);
    });

    test('should generate 100 unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(MessageProtocol.generateMessageId());
      }
      
      expect(ids.size).toBe(100);
    });
  });

  describe('Timestamp Format Validation', () => {
    test('should validate ISO 8601 timestamp format', () => {
      const validTimestamps = [
        '2024-01-01T12:00:00.000Z',
        '2024-12-31T23:59:59.999Z',
        new Date().toISOString()
      ];

      validTimestamps.forEach(timestamp => {
        expect(MessageProtocol.validateTimestamp(timestamp)).toBe(true);
      });
    });

    test('should reject invalid timestamp formats', () => {
      const invalidTimestamps = [
        '2024-01-01 12:00:00',
        '01/01/2024',
        '2024-1-1',
        'invalid-date',
        null,
        undefined,
        123456789
      ];

      invalidTimestamps.forEach(timestamp => {
        expect(MessageProtocol.validateTimestamp(timestamp)).toBe(false);
      });
    });

    test('should generate current timestamp in ISO 8601 format', () => {
      const timestamp = MessageProtocol.generateTimestamp();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      
      expect(timestamp).toMatch(isoRegex);
      expect(MessageProtocol.validateTimestamp(timestamp)).toBe(true);
    });
  });

  describe('Payload Structure Validation', () => {
    test('should validate command payload structure', () => {
      const commandPayload = {
        command: 'inspect_element',
        parameters: {
          selector: '.my-component',
          include_styles: true
        }
      };

      expect(MessageProtocol.validateCommandPayload(commandPayload)).toBe(true);
    });

    test('should reject command payload missing command field', () => {
      const invalidPayload = {
        parameters: {
          selector: '.my-component'
        }
      };

      expect(MessageProtocol.validateCommandPayload(invalidPayload)).toBe(false);
    });

    test('should validate response payload structure', () => {
      const responsePayload = {
        status: 'success',
        command: 'inspect_element',
        data: { element: { tag: 'div' } },
        metadata: { execution_time: 150 }
      };

      expect(MessageProtocol.validateResponsePayload(responsePayload)).toBe(true);
    });

    test('should reject response payload missing status field', () => {
      const invalidPayload = {
        command: 'inspect_element',
        data: { element: { tag: 'div' } }
      };

      expect(MessageProtocol.validateResponsePayload(invalidPayload)).toBe(false);
    });

    test('should validate error payload structure', () => {
      const errorPayload = {
        error_code: 'INVALID_SELECTOR',
        error_message: 'CSS selector is invalid',
        details: { selector: '.invalid[' },
        suggestions: ['Check selector syntax']
      };

      expect(MessageProtocol.validateErrorPayload(errorPayload)).toBe(true);
    });

    test('should validate event payload structure', () => {
      const eventPayload = {
        event_type: 'progress_update',
        command_id: 'cmd-001',
        progress: {
          current: 3,
          total: 10,
          step: 'Analyzing CSS rules',
          percentage: 30
        }
      };

      expect(MessageProtocol.validateEventPayload(eventPayload)).toBe(true);
    });
  });
});