/**
 * Unit tests for ActorTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { ActorTestGenerator } from '../../../src/generators/ActorTestGenerator.js';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('ActorTestGenerator', () => {
  describe('generateTests', () => {
    test('should generate actor tests for component with actor communication', () => {
      const description = {
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'actorSpace', type: 'ActorSpace', required: true }
          ]
        },
        actorCommunication: {
          sends: [
            { actorId: 'server-actor', messageType: 'request', payloadType: 'object' }
          ],
          receives: [
            { actorId: 'ui-actor', messageType: 'update', payloadType: 'object' }
          ]
        }
      };

      const tests = ActorTestGenerator.generateTests(description);

      expect(tests.length).toBeGreaterThan(0);
      
      // Should have all types of actor tests
      const sendTests = tests.filter(t => t.type === 'actor-send');
      const receiveTests = tests.filter(t => t.type === 'actor-receive');
      const protocolTests = tests.filter(t => t.type === 'actor-protocol');
      const patternTests = tests.filter(t => t.type === 'communication-patterns');

      expect(sendTests.length).toBe(1);
      expect(receiveTests.length).toBe(1);
      expect(protocolTests.length).toBe(1);
      expect(patternTests.length).toBe(1);
    });

    test('should return empty array for component without actor communication', () => {
      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: { total: 1, elements: [{ type: 'creates', selector: '.widget' }] }
      };

      const tests = ActorTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate tests for component with only ActorSpace dependency', () => {
      const description = {
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'actorSpace', type: 'ActorSpace', required: true }
          ]
        }
      };

      const tests = ActorTestGenerator.generateTests(description);
      expect(tests.length).toBe(2); // protocol and pattern tests
    });
  });

  describe('hasActorCommunication', () => {
    test('should detect ActorSpace dependency', () => {
      const description = {
        dependencies: {
          dependencies: [
            { name: 'actorSpace', type: 'ActorSpace', required: true }
          ]
        }
      };

      expect(ActorTestGenerator.hasActorCommunication(description)).toBe(true);
    });

    test('should detect actor communication specification', () => {
      const description = {
        actorCommunication: {
          sends: [{ actorId: 'test-actor', messageType: 'test' }]
        }
      };

      expect(ActorTestGenerator.hasActorCommunication(description)).toBe(true);
    });

    test('should return false for component without actor communication', () => {
      const description = {
        dependencies: {
          dependencies: [
            { name: 'dom', type: 'HTMLElement', required: true }
          ]
        }
      };

      expect(ActorTestGenerator.hasActorCommunication(description)).toBe(false);
    });
  });

  describe('generateMessageSendingTests', () => {
    test('should generate message sending test', () => {
      const sends = [
        { actorId: 'server-actor', messageType: 'request', payloadType: 'object' }
      ];

      const tests = ActorTestGenerator.generateMessageSendingTests(sends);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Actor Communication');
      expect(tests[0].type).toBe('actor-send');
      expect(tests[0].name).toContain('request');
      expect(tests[0].name).toContain('server-actor');
    });

    test('should execute message sending test successfully', async () => {
      const sends = [
        { actorId: 'test-actor', messageType: 'test-message', payloadType: 'object' }
      ];

      const tests = ActorTestGenerator.generateMessageSendingTests(sends);
      const sendTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          send: async (actorId, messageType, payload) => {
            return deps.actorSpace.sendMessage(actorId, messageType, payload);
          },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await sendTest.execute(mockComponent, testEnvironment);

      expect(result.sent).toBe(true);
      expect(result.messageType).toBe('test-message');
      expect(result.actorId).toBe('test-actor');
      expect(result.messageValid).toBe(true);
      expect(result.protocolCompliant).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('generateMessageReceivingTests', () => {
    test('should generate message receiving test', () => {
      const receives = [
        { actorId: 'ui-actor', messageType: 'update', payloadType: 'object' }
      ];

      const tests = ActorTestGenerator.generateMessageReceivingTests(receives);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Actor Communication');
      expect(tests[0].type).toBe('actor-receive');
      expect(tests[0].name).toContain('update');
      expect(tests[0].name).toContain('ui-actor');
    });

    test('should execute message receiving test successfully', async () => {
      const receives = [
        { actorId: 'test-actor', messageType: 'test-message', payloadType: 'object' }
      ];

      const tests = ActorTestGenerator.generateMessageReceivingTests(receives);
      const receiveTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          receive: async (message) => {
            return { status: 'processed', messageId: message.timestamp };
          },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await receiveTest.execute(mockComponent, testEnvironment);

      expect(result.received).toBe(true);
      expect(result.handled).toBe(true);
      expect(result.messageType).toBe('test-message');
      expect(result.actorId).toBe('test-actor');
      expect(result.response).toBeDefined();
      expect(result.handlingTime).toBeGreaterThanOrEqual(0);
      expect(result.issues).toEqual([]);
    });

    test('should handle component without receive method', async () => {
      const receives = [
        { actorId: 'test-actor', messageType: 'test-message', payloadType: 'object' }
      ];

      const tests = ActorTestGenerator.generateMessageReceivingTests(receives);
      const receiveTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          // No receive method
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await receiveTest.execute(mockComponent, testEnvironment);

      expect(result.received).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('does not have receive method');
    });
  });

  describe('generateProtocolComplianceTests', () => {
    test('should generate protocol compliance test', () => {
      const description = {
        dependencies: {
          dependencies: [{ name: 'actorSpace', type: 'ActorSpace' }]
        }
      };

      const tests = ActorTestGenerator.generateProtocolComplianceTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Actor Communication');
      expect(tests[0].type).toBe('actor-protocol');
      expect(tests[0].name).toContain('protocol');
    });

    test('should execute protocol compliance test successfully', async () => {
      const description = {};
      const tests = ActorTestGenerator.generateProtocolComplianceTests(description);
      const protocolTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          actorId: 'test-component',
          send: (actorId, messageType, payload) => deps.actorSpace.sendMessage(actorId, messageType, payload),
          receive: (message) => ({ status: 'received' }),
          registerWithActorSpace: function() {
            this.dependencies.actorSpace.registerActor(this.actorId, this);
          },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await protocolTest.execute(mockComponent, testEnvironment);

      expect(result.protocolVersion).toBe('1.0');
      expect(result.compliance).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('generateCommunicationPatternTests', () => {
    test('should generate communication pattern test', () => {
      const description = {};
      const tests = ActorTestGenerator.generateCommunicationPatternTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Actor Communication');
      expect(tests[0].type).toBe('communication-patterns');
      expect(tests[0].name).toContain('communication patterns');
    });

    test('should execute communication pattern test successfully', async () => {
      const description = {};
      const tests = ActorTestGenerator.generateCommunicationPatternTests(description);
      const patternTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          actorId: 'test-component',
          send: (actorId, messageType, payload) => deps.actorSpace.sendMessage(actorId, messageType, payload),
          receive: (message) => ({ status: 'received', timestamp: Date.now() }),
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await patternTest.execute(mockComponent, testEnvironment);

      expect(result.patterns).toBeDefined();
      expect(result.patterns.requestResponse).toBeDefined();
      expect(result.patterns.publishSubscribe).toBeDefined();
      expect(result.patterns.fireAndForget).toBeDefined();
      expect(result.messagingStats).toBeDefined();
      expect(result.messagingStats.totalSent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createComponentForTesting', () => {
    test('should create component with create method', async () => {
      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          send: (actorId, messageType, payload) => deps.actorSpace.sendMessage(actorId, messageType, payload),
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(typeof result.send).toBe('function');
    });

    test('should create mock component with actor capabilities', async () => {
      const mockComponent = {}; // No create method

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(typeof result.send).toBe('function');
      expect(typeof result.receive).toBe('function');
      expect(typeof result.registerWithActorSpace).toBe('function');
      expect(result.actorId).toBe('test-component');
      expect(Array.isArray(result.messageHistory)).toBe(true);
    });
  });

  describe('triggerMessageSending', () => {
    test('should trigger message sending with send method', async () => {
      const mockComponent = {
        send: async (actorId, messageType, payload) => {
          return { to: actorId, type: messageType, payload, timestamp: Date.now() };
        }
      };

      const sendSpec = {
        actorId: 'test-actor',
        messageType: 'test-message',
        payloadType: 'object'
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.triggerMessageSending(
        mockComponent, sendSpec, testEnvironment
      );

      expect(result.triggered).toBe(true);
      expect(result.method).toBe('send');
    });

    test('should handle component without send capability', async () => {
      const mockComponent = {}; // No send methods

      const sendSpec = {
        actorId: 'test-actor',
        messageType: 'test-message',
        payloadType: 'object'
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.triggerMessageSending(
        mockComponent, sendSpec, testEnvironment
      );

      expect(result.triggered).toBe(false);
      expect(result.method).toBeNull();
    });
  });

  describe('validateMessageStructure', () => {
    test('should validate correct message structure', () => {
      const message = {
        to: 'test-actor',
        type: 'test-message',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.validateMessageStructure(message, spec);
      expect(result).toBe(true);
    });

    test('should reject message with missing fields', () => {
      const message = {
        to: 'test-actor',
        type: 'test-message'
        // Missing payload and timestamp
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.validateMessageStructure(message, spec);
      expect(result).toBe(false);
    });

    test('should reject message with wrong type', () => {
      const message = {
        to: 'test-actor',
        type: 'wrong-message',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.validateMessageStructure(message, spec);
      expect(result).toBe(false);
    });

    test('should reject message with wrong recipient', () => {
      const message = {
        to: 'wrong-actor',
        type: 'test-message',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.validateMessageStructure(message, spec);
      expect(result).toBe(false);
    });
  });

  describe('checkProtocolCompliance', () => {
    test('should pass for compliant message', () => {
      const message = {
        to: 'test-actor',
        type: 'test-message',
        payload: { data: 'test' },
        timestamp: Date.now()
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.checkProtocolCompliance(message, spec);
      expect(result).toBe(true);
    });

    test('should fail for message with old timestamp', () => {
      const message = {
        to: 'test-actor',
        type: 'test-message',
        payload: { data: 'test' },
        timestamp: Date.now() - 120000 // 2 minutes ago
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message'
      };

      const result = ActorTestGenerator.checkProtocolCompliance(message, spec);
      expect(result).toBe(false);
    });

    test('should fail for oversized message', () => {
      const message = {
        to: 'test-actor',
        type: 'test-message',
        payload: { data: 'x'.repeat(1000) },
        timestamp: Date.now()
      };

      const spec = {
        actorId: 'test-actor',
        messageType: 'test-message',
        maxSize: 100
      };

      const result = ActorTestGenerator.checkProtocolCompliance(message, spec);
      expect(result).toBe(false);
    });
  });

  describe('pattern testing methods', () => {
    test('should test request-response pattern', async () => {
      const mockComponent = {
        actorId: 'test-component',
        send: async () => ({ sent: true }),
        receive: async () => ({ received: true })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testRequestResponsePattern(
        mockComponent, testEnvironment
      );

      expect(result.supported).toBe(true);
      expect(result.messagesSent).toBe(1);
      expect(result.messagesReceived).toBe(1);
      expect(result.totalResponseTime).toBeGreaterThan(0);
    });

    test('should test publish-subscribe pattern', async () => {
      const mockComponent = {
        receive: async () => ({ received: true })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testPublishSubscribePattern(
        mockComponent, testEnvironment
      );

      expect(result.supported).toBe(true);
    });

    test('should test fire-and-forget pattern', async () => {
      const mockComponent = {
        send: async () => ({ sent: true })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testFireAndForgetPattern(
        mockComponent, testEnvironment
      );

      expect(result.supported).toBe(true);
    });
  });

  describe('compliance testing methods', () => {
    test('should test message format compliance', async () => {
      const mockComponent = {
        send: async () => ({ timestamp: Date.now() })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testMessageFormatCompliance(
        mockComponent, testEnvironment
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toEqual([]);
    });

    test('should test actor registration compliance', async () => {
      const mockComponent = {
        actorId: 'test-component',
        registerWithActorSpace: function() {
          // Mock registration
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testActorRegistrationCompliance(
        mockComponent, testEnvironment
      );

      expect(result.compliant).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });

    test('should test error handling compliance', async () => {
      const mockComponent = {
        receive: async (message) => {
          if (!message.type) {
            throw new Error('Invalid message');
          }
          return { received: true };
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await ActorTestGenerator.testErrorHandlingCompliance(
        mockComponent, testEnvironment
      );

      expect(result.compliant).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });

  describe('helper methods', () => {
    test('should validate payload structure', () => {
      const payload = { name: 'test', value: 42 };
      const structure = { name: 'string', value: 'number' };

      const result = ActorTestGenerator.validatePayloadStructure(payload, structure);
      expect(result).toBe(true);
    });

    test('should reject invalid payload structure', () => {
      const payload = { name: 'test', value: 'not-a-number' };
      const structure = { name: 'string', value: 'number' };

      const result = ActorTestGenerator.validatePayloadStructure(payload, structure);
      expect(result).toBe(false);
    });

    test('should generate test payloads', () => {
      expect(typeof ActorTestGenerator.generateTestPayload('string')).toBe('string');
      expect(typeof ActorTestGenerator.generateTestPayload('number')).toBe('number');
      expect(typeof ActorTestGenerator.generateTestPayload('boolean')).toBe('boolean');
      expect(typeof ActorTestGenerator.generateTestPayload('object')).toBe('object');
      expect(Array.isArray(ActorTestGenerator.generateTestPayload('array'))).toBe(true);
    });
  });
});