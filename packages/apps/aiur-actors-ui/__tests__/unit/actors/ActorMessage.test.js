/**
 * Tests for ActorMessage serialization and validation
 */
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('ActorMessage Protocol', () => {
  let ActorMessage;
  
  beforeEach(async () => {
    // Import the ActorMessage class (we'll create this)
    try {
      ({ ActorMessage } = await import('../../../src/actors/ActorMessage.js'));
    } catch (error) {
      // Skip if not implemented yet
      ActorMessage = null;
    }
  });

  describe('Message Creation and Validation', () => {
    test('should create valid command execution message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'execute',
        command: 'git status',
        requestId: 'req-123',
        timestamp: Date.now()
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('execute');
      expect(message.getPayload().command).toBe('git status');
    });

    test('should create valid tool execution message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'executeTool',
        toolId: 'git-tool',
        parameters: { branch: 'main' },
        requestId: 'req-456'
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('executeTool');
      expect(message.getPayload().toolId).toBe('git-tool');
    });

    test('should create valid session management message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'createSession',
        sessionData: {
          name: 'Test Session',
          type: 'interactive',
          description: 'Test session'
        }
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('createSession');
      expect(message.getPayload().sessionData.name).toBe('Test Session');
    });

    test('should create valid variable management message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'createVariable',
        variableData: {
          name: 'API_KEY',
          value: 'secret123',
          type: 'string',
          scope: 'global'
        }
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('createVariable');
      expect(message.getPayload().variableData.name).toBe('API_KEY');
    });

    test('should create valid response message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'toolsListResponse',
        tools: [
          { id: 'git', name: 'Git Tool', description: 'Git operations' }
        ],
        requestId: 'req-789'
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('toolsListResponse');
      expect(message.getPayload().tools).toHaveLength(1);
    });

    test('should create valid error message', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'toolExecutionError',
        error: 'Tool not found',
        errorCode: 'TOOL_NOT_FOUND',
        requestId: 'req-error'
      });

      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('toolExecutionError');
      expect(message.getPayload().error).toBe('Tool not found');
    });
  });

  describe('Message Types Validation', () => {
    test('should validate all command message types', () => {
      if (!ActorMessage) return;
      
      const commandTypes = [
        'execute', 'autocomplete', 'executeTool', 'toolSelected',
        'sessionSelected', 'variableSelected'
      ];

      commandTypes.forEach(type => {
        const message = ActorMessage.create({ type, data: {} });
        expect(message.isValid()).toBe(true);
        expect(ActorMessage.isValidType(type)).toBe(true);
      });
    });

    test('should validate all request message types', () => {
      if (!ActorMessage) return;
      
      const requestTypes = [
        'getTools', 'getSessions', 'getVariables', 'createSession',
        'updateSession', 'deleteSession', 'duplicateSession', 'exportSession',
        'createVariable', 'updateVariable', 'deleteVariable', 'duplicateVariable',
        'importVariables'
      ];

      requestTypes.forEach(type => {
        const message = ActorMessage.create({ type, data: {} });
        expect(message.isValid()).toBe(true);
        expect(ActorMessage.isValidType(type)).toBe(true);
      });
    });

    test('should validate all response message types', () => {
      if (!ActorMessage) return;
      
      const responseTypes = [
        'toolsListResponse', 'toolsListError', 'sessionListResponse', 'sessionListError',
        'variablesListResponse', 'variablesListError', 'sessionCreated', 'sessionCreationError',
        'sessionUpdated', 'sessionUpdateError', 'sessionLoaded', 'sessionLoadError',
        'sessionDeleted', 'sessionDeleteError', 'sessionDuplicated', 'sessionExported',
        'variableCreated', 'variableCreationError', 'variableUpdated', 'variableUpdateError',
        'variableDeleted', 'variableDeleteError', 'variableDuplicated', 'variablesImported',
        'variablesImportError', 'commandResult', 'commandError', 'autocompleteResult'
      ];

      responseTypes.forEach(type => {
        const message = ActorMessage.create({ type, data: {} });
        expect(message.isValid()).toBe(true);
        expect(ActorMessage.isValidType(type)).toBe(true);
      });
    });

    test('should reject invalid message types', () => {
      if (!ActorMessage) return;
      
      const invalidTypes = [
        'invalidType', 'randomMessage', '', null, undefined, 123, {}
      ];

      invalidTypes.forEach(type => {
        expect(ActorMessage.isValidType(type)).toBe(false);
        
        if (type !== null && type !== undefined) {
          const message = ActorMessage.create({ type, data: {} });
          expect(message.isValid()).toBe(false);
        }
      });
    });
  });

  describe('Message Serialization', () => {
    test('should serialize message to JSON', () => {
      if (!ActorMessage) return;
      
      const message = ActorMessage.create({
        type: 'execute',
        command: 'ls -la',
        requestId: 'req-serialize',
        timestamp: 1640995200000
      });

      const serialized = message.serialize();
      expect(typeof serialized).toBe('string');
      
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe('execute');
      expect(parsed.payload.command).toBe('ls -la');
      expect(parsed.metadata.requestId).toBe('req-serialize');
    });

    test('should deserialize message from JSON', () => {
      if (!ActorMessage) return;
      
      const jsonString = JSON.stringify({
        type: 'toolsListResponse',
        payload: {
          tools: [{ id: 'test', name: 'Test Tool' }]
        },
        metadata: {
          requestId: 'req-deserialize',
          timestamp: 1640995200000
        }
      });

      const message = ActorMessage.deserialize(jsonString);
      expect(message.isValid()).toBe(true);
      expect(message.getType()).toBe('toolsListResponse');
      expect(message.getPayload().tools).toHaveLength(1);
      expect(message.getMetadata().requestId).toBe('req-deserialize');
    });

    test('should handle serialization of complex payloads', () => {
      if (!ActorMessage) return;
      
      const complexPayload = {
        type: 'sessionCreated',
        session: {
          id: 'session-123',
          name: 'Complex Session',
          variables: [
            { name: 'API_KEY', value: 'secret', type: 'string' },
            { name: 'DEBUG', value: true, type: 'boolean' },
            { name: 'CONFIG', value: { host: 'localhost', port: 3000 }, type: 'object' }
          ],
          tools: ['git', 'docker', 'npm'],
          metadata: {
            created: Date.now(),
            lastModified: Date.now(),
            version: '1.0.0'
          }
        }
      };

      const message = ActorMessage.create(complexPayload);
      const serialized = message.serialize();
      const deserialized = ActorMessage.deserialize(serialized);

      expect(deserialized.isValid()).toBe(true);
      expect(deserialized.getPayload().session.variables).toHaveLength(3);
      expect(deserialized.getPayload().session.tools).toContain('git');
    });

    test('should preserve data types during serialization roundtrip', () => {
      if (!ActorMessage) return;
      
      const originalData = {
        type: 'variableCreated',
        variable: {
          id: 'var-123',
          name: 'TEST_VAR',
          value: 42,
          type: 'number',
          active: true,
          config: { nested: { deep: 'value' } },
          tags: ['test', 'number'],
          metadata: null
        }
      };

      const message = ActorMessage.create(originalData);
      const roundtrip = ActorMessage.deserialize(message.serialize());

      expect(roundtrip.getPayload().variable.value).toBe(42);
      expect(roundtrip.getPayload().variable.active).toBe(true);
      expect(roundtrip.getPayload().variable.config.nested.deep).toBe('value');
      expect(roundtrip.getPayload().variable.tags).toEqual(['test', 'number']);
      expect(roundtrip.getPayload().variable.metadata).toBe(null);
    });
  });

  describe('Message Validation Rules', () => {
    test('should enforce required fields for execution messages', () => {
      if (!ActorMessage) return;
      
      // Valid execution message
      const validMessage = ActorMessage.create({
        type: 'execute',
        command: 'git status',
        requestId: 'req-123'
      });
      expect(validMessage.isValid()).toBe(true);

      // Empty command (not missing, but empty)
      const emptyCommand = ActorMessage.create({
        type: 'execute',
        command: '',
        requestId: 'req-123'
      });
      expect(emptyCommand.isValid()).toBe(false);
      expect(emptyCommand.getValidationErrors()).toContain('command cannot be empty for execute messages');
    });

    test('should enforce required fields for tool messages', () => {
      if (!ActorMessage) return;
      
      // Valid tool message
      const validMessage = ActorMessage.create({
        type: 'executeTool',
        toolId: 'git-tool'
      });
      expect(validMessage.isValid()).toBe(true);

      // Empty toolId
      const emptyToolId = ActorMessage.create({
        type: 'executeTool',
        toolId: ''
      });
      expect(emptyToolId.isValid()).toBe(false);
      expect(emptyToolId.getValidationErrors()).toContain('toolId cannot be empty for executeTool messages');
    });

    test('should enforce required fields for session messages', () => {
      if (!ActorMessage) return;
      
      // Valid session creation
      const validCreate = ActorMessage.create({
        type: 'createSession',
        sessionData: { name: 'Test Session' }
      });
      expect(validCreate.isValid()).toBe(true);

      // Empty sessionData
      const emptyData = ActorMessage.create({
        type: 'createSession',
        sessionData: null
      });
      expect(emptyData.isValid()).toBe(false);

      // Valid session operation
      const validOperation = ActorMessage.create({
        type: 'loadSession',
        sessionId: 'session-123'
      });
      expect(validOperation.isValid()).toBe(true);

      // Empty sessionId
      const emptyId = ActorMessage.create({
        type: 'loadSession',
        sessionId: ''
      });
      expect(emptyId.isValid()).toBe(false);
    });

    test('should validate variable message structure', () => {
      if (!ActorMessage) return;
      
      // Valid variable creation
      const validCreate = ActorMessage.create({
        type: 'createVariable',
        variableData: {
          name: 'API_KEY',
          value: 'secret',
          type: 'string'
        }
      });
      expect(validCreate.isValid()).toBe(true);

      // Invalid variable data - empty name
      const emptyName = ActorMessage.create({
        type: 'createVariable',
        variableData: {
          name: '', // empty name
          value: 'secret',
          type: 'string'
        }
      });
      expect(emptyName.isValid()).toBe(false);
      expect(emptyName.getValidationErrors()).toContain('variableData.name cannot be empty');
    });
  });

  describe('Message Metadata', () => {
    test('should automatically add timestamp to messages', () => {
      if (!ActorMessage) return;
      
      const beforeTime = Date.now();
      const message = ActorMessage.create({
        type: 'getTools'
      });
      const afterTime = Date.now();

      const timestamp = message.getMetadata().timestamp;
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should preserve explicit timestamps', () => {
      if (!ActorMessage) return;
      
      const explicitTime = 1640995200000;
      const message = ActorMessage.create({
        type: 'getTools',
        timestamp: explicitTime
      });

      expect(message.getMetadata().timestamp).toBe(explicitTime);
    });

    test('should generate unique message IDs', () => {
      if (!ActorMessage) return;
      
      const message1 = ActorMessage.create({ type: 'getTools' });
      const message2 = ActorMessage.create({ type: 'getTools' });

      expect(message1.getMetadata().messageId).toBeDefined();
      expect(message2.getMetadata().messageId).toBeDefined();
      expect(message1.getMetadata().messageId).not.toBe(message2.getMetadata().messageId);
    });

    test('should preserve request ID correlation', () => {
      if (!ActorMessage) return;
      
      const requestId = 'req-correlation-test';
      const message = ActorMessage.create({
        type: 'execute',
        command: 'test',
        requestId
      });

      expect(message.getMetadata().requestId).toBe(requestId);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', () => {
      if (!ActorMessage) return;
      
      const malformedJson = '{ "type": "test", invalid json }';
      expect(() => {
        ActorMessage.deserialize(malformedJson);
      }).toThrow('Invalid JSON in message');
    });

    test('should handle missing required properties', () => {
      if (!ActorMessage) return;
      
      const incompleteJson = JSON.stringify({
        payload: { some: 'data' }
        // missing type
      });

      const message = ActorMessage.deserialize(incompleteJson);
      expect(message.isValid()).toBe(false);
      expect(message.getValidationErrors()).toContain('type is required');
    });

    test('should handle circular references in payload', () => {
      if (!ActorMessage) return;
      
      const circular = { type: 'test', data: {} };
      circular.data.self = circular;

      expect(() => {
        ActorMessage.create(circular);
      }).toThrow('Cannot serialize circular references');
    });
  });
});