/**
 * Unit tests for HandleRenderer introspection methods
 * Tests renderHeader, renderProperties, renderMethods, renderCapabilities, renderActions
 */

import { HandleRenderer } from '../../../src/renderers/HandleRenderer.js';
import { jest } from '@jest/globals';

describe('HandleRenderer - Introspection Methods', () => {
  let renderer;

  beforeEach(() => {
    renderer = new HandleRenderer();
  });

  describe('renderHeader()', () => {
    test('should extract URI, type, and server from Handle', () => {
      const handle = {
        toURI: () => 'legion://localhost/datastore/users/123',
        resourceType: 'datastore',
        server: 'localhost'
      };

      const header = renderer.renderHeader(handle);

      expect(header.uri).toBe('legion://localhost/datastore/users/123');
      expect(header.type).toBe('datastore');
      expect(header.server).toBe('localhost');
    });

    test('should default server to "local" if not provided', () => {
      const handle = {
        toURI: () => 'legion://localhost/file/document.txt',
        resourceType: 'file'
      };

      const header = renderer.renderHeader(handle);

      expect(header.server).toBe('local');
    });

    test('should handle strategy Handle', () => {
      const handle = {
        toURI: () => 'legion://localhost/strategy/path/to/strategy.js',
        resourceType: 'strategy',
        server: 'local'
      };

      const header = renderer.renderHeader(handle);

      expect(header.type).toBe('strategy');
      expect(header.uri).toContain('strategy');
    });
  });

  describe('renderProperties()', () => {
    test('should extract properties from schema', () => {
      const handle = {
        name: 'Test User',
        age: 30,
        email: 'test@example.com'
      };

      const schema = {
        properties: {
          name: { type: 'string', description: 'User name' },
          age: { type: 'number', description: 'User age' },
          email: { type: 'string', description: 'User email' }
        }
      };

      const properties = renderer.renderProperties(handle, schema);

      expect(properties).toHaveLength(3);
      expect(properties[0]).toEqual({
        name: 'name',
        value: 'Test User',
        type: 'string',
        description: 'User name'
      });
      expect(properties[1]).toEqual({
        name: 'age',
        value: 30,
        type: 'number',
        description: 'User age'
      });
    });

    test('should handle empty schema', () => {
      const handle = {
        name: 'Test'
      };

      const schema = {};

      const properties = renderer.renderProperties(handle, schema);

      expect(properties).toHaveLength(0);
    });

    test('should handle undefined schema properties', () => {
      const handle = {
        name: 'Test'
      };

      const schema = {
        properties: undefined
      };

      const properties = renderer.renderProperties(handle, schema);

      expect(properties).toHaveLength(0);
    });

    test('should handle schema with no descriptions', () => {
      const handle = {
        id: 123
      };

      const schema = {
        properties: {
          id: { type: 'number' }
        }
      };

      const properties = renderer.renderProperties(handle, schema);

      expect(properties).toHaveLength(1);
      expect(properties[0].description).toBeUndefined();
    });
  });

  describe('renderMethods()', () => {
    test('should extract callable methods from Handle', () => {
      const handle = {
        toURI: () => 'test',
        query: () => {},
        subscribe: () => {},
        _privateMethod: () => {},
        data: { value: 123 },
        resourceType: 'test'
      };

      const methods = renderer.renderMethods(handle);

      expect(methods.length).toBeGreaterThan(0);
      expect(methods).toContainEqual({ name: 'toURI', callable: true });
      expect(methods).toContainEqual({ name: 'query', callable: true });
      expect(methods).toContainEqual({ name: 'subscribe', callable: true });
    });

    test('should exclude private methods starting with _', () => {
      const handle = {
        publicMethod: () => {},
        _privateMethod: () => {},
        __veryPrivate: () => {}
      };

      const methods = renderer.renderMethods(handle);

      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('publicMethod');
      expect(methodNames).not.toContain('_privateMethod');
      expect(methodNames).not.toContain('__veryPrivate');
    });

    test('should not include non-function properties', () => {
      const handle = {
        method: () => {},
        property: 'value',
        number: 123,
        object: {}
      };

      const methods = renderer.renderMethods(handle);

      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('method');
      expect(methodNames).not.toContain('property');
      expect(methodNames).not.toContain('number');
      expect(methodNames).not.toContain('object');
    });

    test('should handle Handle with no methods', () => {
      const handle = {
        property: 'value'
      };

      const methods = renderer.renderMethods(handle);

      expect(methods).toHaveLength(0);
    });
  });

  describe('renderCapabilities()', () => {
    test('should extract capabilities from metadata', () => {
      const metadata = {
        capabilities: ['query', 'subscribe', 'update']
      };

      const capabilities = renderer.renderCapabilities(metadata);

      expect(capabilities).toEqual(['query', 'subscribe', 'update']);
    });

    test('should handle single capability as string', () => {
      const metadata = {
        capabilities: 'read-only'
      };

      const capabilities = renderer.renderCapabilities(metadata);

      expect(capabilities).toEqual(['read-only']);
    });

    test('should handle metadata without capabilities', () => {
      const metadata = {
        name: 'test'
      };

      const capabilities = renderer.renderCapabilities(metadata);

      expect(capabilities).toHaveLength(0);
    });

    test('should handle null metadata', () => {
      const capabilities = renderer.renderCapabilities(null);

      expect(capabilities).toHaveLength(0);
    });

    test('should handle undefined metadata', () => {
      const capabilities = renderer.renderCapabilities(undefined);

      expect(capabilities).toHaveLength(0);
    });

    test('should handle empty capabilities array', () => {
      const metadata = {
        capabilities: []
      };

      const capabilities = renderer.renderCapabilities(metadata);

      expect(capabilities).toHaveLength(0);
    });
  });

  describe('renderActions()', () => {
    test('should include Copy URI action', () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      const actions = renderer.renderActions(handle);

      const copyAction = actions.find(a => a.label === 'Copy URI');
      expect(copyAction).toBeDefined();
      expect(typeof copyAction.action).toBe('function');
    });

    test('should include View JSON action', () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      const actions = renderer.renderActions(handle);

      const jsonAction = actions.find(a => a.label === 'View JSON');
      expect(jsonAction).toBeDefined();
      expect(typeof jsonAction.action).toBe('function');
    });

    test('should return at least 2 common actions', () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test'
      };

      const actions = renderer.renderActions(handle);

      expect(actions.length).toBeGreaterThanOrEqual(2);
    });

    test('View JSON action should call showJSON', () => {
      const handle = {
        toURI: () => 'legion://localhost/test/resource',
        resourceType: 'test',
        toJSON: () => ({ uri: 'legion://localhost/test/resource', type: 'test' })
      };

      const showJSONSpy = jest.spyOn(renderer, 'showJSON');

      const actions = renderer.renderActions(handle);
      const jsonAction = actions.find(a => a.label === 'View JSON');

      jsonAction.action();

      expect(showJSONSpy).toHaveBeenCalled();
    });
  });
});