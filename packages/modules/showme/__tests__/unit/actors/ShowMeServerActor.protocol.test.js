/**
 * Unit tests for ShowMeServerActor protocol schema updates
 * Tests new 'display-resource' message type for Handles
 */

import { jest } from '@jest/globals';
import { ShowMeServerActor } from '../../../src/server/actors/ShowMeServerActor.js';

describe('ShowMeServerActor Protocol Schema', () => {
  let actor;
  let mockActorSpace;
  let mockServer;

  beforeEach(() => {
    mockActorSpace = {
      send: jest.fn(),
      broadcast: jest.fn(),
      subscribe: jest.fn()
    };

    mockServer = {
      assetStorage: new Map()
    };

    actor = new ShowMeServerActor(mockActorSpace, { server: mockServer });
  });

  describe('Protocol Version', () => {
    test('should have updated protocol version 2.0.0', () => {
      const protocol = actor.getProtocol();

      expect(protocol.version).toBe('2.0.0');
    });

    test('should maintain protocol name', () => {
      const protocol = actor.getProtocol();

      expect(protocol.name).toBe('ShowMeServer');
    });
  });

  describe('display-resource Message Schema', () => {
    test('should include display-resource in receives messages', () => {
      const protocol = actor.getProtocol();

      expect(protocol.messages.receives['display-resource']).toBeDefined();
    });

    test('should have handleURI field in display-resource schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      expect(schema.handleURI).toBeDefined();
      expect(schema.handleURI.type).toBe('string');
      expect(schema.handleURI.required).toBe(true);
    });

    test('should have handleType field in display-resource schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      expect(schema.handleType).toBeDefined();
      expect(schema.handleType.type).toBe('string');
      expect(schema.handleType.required).toBe(true);
    });

    test('should have title field in display-resource schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      expect(schema.title).toBeDefined();
      expect(schema.title.type).toBe('string');
      expect(schema.title.required).toBe(false); // Optional
    });

    test('should have options field in display-resource schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      expect(schema.options).toBeDefined();
      expect(schema.options.type).toBe('object');
      expect(schema.options.required).toBe(false); // Optional
    });
  });

  describe('resource-ready Message Schema', () => {
    test('should include resource-ready in sends messages', () => {
      const protocol = actor.getProtocol();

      expect(protocol.messages.sends['resource-ready']).toBeDefined();
    });

    test('should have handleURI field in resource-ready schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.sends['resource-ready'].schema;

      expect(schema.handleURI).toBeDefined();
      expect(schema.handleURI.type).toBe('string');
      expect(schema.handleURI.required).toBe(true);
    });

    test('should have rendererType field in resource-ready schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.sends['resource-ready'].schema;

      expect(schema.rendererType).toBeDefined();
      expect(schema.rendererType.type).toBe('string');
      expect(schema.rendererType.required).toBe(true);
    });

    test('should have title field in resource-ready schema', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.sends['resource-ready'].schema;

      expect(schema.title).toBeDefined();
      expect(schema.title.type).toBe('string');
      expect(schema.title.required).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain display-asset message type', () => {
      const protocol = actor.getProtocol();

      expect(protocol.messages.receives['display-asset']).toBeDefined();
    });

    test('should maintain asset-ready message type', () => {
      const protocol = actor.getProtocol();

      expect(protocol.messages.sends['asset-ready']).toBeDefined();
    });

    test('should maintain all original message types', () => {
      const protocol = actor.getProtocol();
      const receives = protocol.messages.receives;

      // Original message types
      expect(receives['client-connect']).toBeDefined();
      expect(receives['client-disconnect']).toBeDefined();
      expect(receives['display-asset']).toBeDefined();
      expect(receives['request-asset']).toBeDefined();
      expect(receives['close-window']).toBeDefined();
    });

    test('should maintain all original send types', () => {
      const protocol = actor.getProtocol();
      const sends = protocol.messages.sends;

      // Original send types
      expect(sends['asset-ready']).toBeDefined();
      expect(sends['asset-data']).toBeDefined();
      expect(sends['asset-deleted']).toBeDefined();
      expect(sends['server-status']).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    test('should validate required fields for display-resource', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      const requiredFields = Object.keys(schema).filter(
        key => schema[key].required === true
      );

      expect(requiredFields).toContain('handleURI');
      expect(requiredFields).toContain('handleType');
    });

    test('should allow optional fields for display-resource', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      const optionalFields = Object.keys(schema).filter(
        key => schema[key].required === false
      );

      expect(optionalFields).toContain('title');
      expect(optionalFields).toContain('options');
    });

    test('should validate required fields for resource-ready', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.sends['resource-ready'].schema;

      const requiredFields = Object.keys(schema).filter(
        key => schema[key].required === true
      );

      expect(requiredFields).toContain('handleURI');
      expect(requiredFields).toContain('rendererType');
      expect(requiredFields).toContain('title');
    });
  });

  describe('Handle Type Support', () => {
    test('should support strategy handle type', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      // handleType field should accept strategy
      expect(schema.handleType.type).toBe('string');
      // Any string value is valid for handleType
    });

    test('should support filesystem handle type', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      // handleType field should accept filesystem
      expect(schema.handleType.type).toBe('string');
    });

    test('should support any handle type string', () => {
      const protocol = actor.getProtocol();
      const schema = protocol.messages.receives['display-resource'].schema;

      // handleType is a generic string, supports any Handle type
      expect(schema.handleType.type).toBe('string');
      expect(schema.handleType.required).toBe(true);
    });
  });
});