/**
 * show_all Command Unit Tests
 * 
 * Test individual methods of show_all command in isolation
 * Uses mocks for dependencies to focus on specific functionality
 */

import { jest } from '@jest/globals';
import { SlashCommandAgent } from '../SlashCommandAgent.js';

describe('show_all Command Unit Tests', () => {
  let slashAgent;

  beforeEach(() => {
    slashAgent = new SlashCommandAgent();
  });

  describe('parseShowAllCommand', () => {
    test('should parse basic command correctly', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myObject');
      
      expect(result).toEqual({
        object: 'myObject'
      });
    });

    test('should parse command with introspection flag', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myHandle --introspection');
      
      expect(result).toEqual({
        object: 'myHandle',
        includeIntrospection: true
      });
    });

    test('should parse command with format flag', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myData --format=json');
      
      expect(result).toEqual({
        object: 'myData',
        format: 'json'
      });
    });

    test('should parse command with multiple flags', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myHandle --introspection --format=detailed');
      
      expect(result).toEqual({
        object: 'myHandle',
        includeIntrospection: true,
        format: 'detailed'
      });
    });

    test('should throw error for command without object reference', () => {
      expect(() => {
        slashAgent.parseShowAllCommand('/show_all');
      }).toThrow('show_all command requires an object reference');
      
      expect(() => {
        slashAgent.parseShowAllCommand('/show_all   '); // Only whitespace
      }).toThrow('show_all command requires an object reference');
    });

    test('should handle malformed flag syntax gracefully', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myObject --invalid-flag --format=');
      
      expect(result.object).toBe('myObject');
      expect(result.format).toBe(''); // Empty format value
      expect(result.includeIntrospection).toBeUndefined();
    });
  });

  describe('_analyzeObject', () => {
    test('should detect BaseHandle/Actor objects correctly', () => {
      const mockHandle = {
        isActor: true,
        handleType: 'TestHandle',
        serialize: jest.fn(),
        type: {
          listMethods: jest.fn().mockReturnValue(['read', 'write', 'delete']),
          listAttributes: jest.fn().mockReturnValue(['path', 'size'])
        }
      };
      
      const analysis = slashAgent._analyzeObject(mockHandle);
      
      expect(analysis).toEqual({
        type: 'handle',
        handleType: 'TestHandle',
        hasIntrospection: true,
        methods: ['read', 'write', 'delete'],
        attributes: ['path', 'size']
      });
    });

    test('should detect handle without introspection', () => {
      const mockHandle = {
        isActor: true,
        handleType: 'SimpleHandle',
        serialize: jest.fn()
        // No type property
      };
      
      const analysis = slashAgent._analyzeObject(mockHandle);
      
      expect(analysis).toEqual({
        type: 'handle',
        handleType: 'SimpleHandle',
        hasIntrospection: false,
        methods: [],
        attributes: []
      });
    });

    test('should detect plain serializable objects', () => {
      const plainObject = {
        name: 'test',
        value: 123,
        nested: { data: 'deep' }
      };
      
      const analysis = slashAgent._analyzeObject(plainObject);
      
      expect(analysis).toEqual({
        type: 'serializable',
        keys: ['name', 'value', 'nested'],
        size: 3
      });
    });

    test('should detect arrays as complex objects', () => {
      const arrayObject = [1, 2, { item: 'test' }];
      
      const analysis = slashAgent._analyzeObject(arrayObject);
      
      expect(analysis).toEqual({
        type: 'complex',
        constructor: 'Array',
        isArray: true,
        keys: ['0', '1', '2']
      });
    });

    test('should detect custom class instances as complex objects', () => {
      class CustomClass {
        constructor() {
          this.property = 'value';
        }
      }
      
      const customInstance = new CustomClass();
      const analysis = slashAgent._analyzeObject(customInstance);
      
      expect(analysis).toEqual({
        type: 'complex',
        constructor: 'CustomClass',
        isArray: false,
        keys: ['property']
      });
    });

    test('should detect primitive values correctly', () => {
      const testCases = [
        { value: 'hello world', expected: { type: 'primitive', valueType: 'string', value: 'hello world' } },
        { value: 42, expected: { type: 'primitive', valueType: 'number', value: 42 } },
        { value: true, expected: { type: 'primitive', valueType: 'boolean', value: true } },
        { value: null, expected: { type: 'primitive', valueType: 'object', value: null } },
        { value: undefined, expected: { type: 'primitive', valueType: 'undefined', value: undefined } }
      ];
      
      testCases.forEach(({ value, expected }) => {
        const analysis = slashAgent._analyzeObject(value);
        expect(analysis).toEqual(expected);
      });
    });

    test('should handle edge cases gracefully', () => {
      // Function
      const func = () => 'test';
      const funcAnalysis = slashAgent._analyzeObject(func);
      expect(funcAnalysis.type).toBe('primitive');
      expect(funcAnalysis.valueType).toBe('function');
      
      // Date object
      const date = new Date();
      const dateAnalysis = slashAgent._analyzeObject(date);
      expect(dateAnalysis.type).toBe('complex');
      expect(dateAnalysis.constructor).toBe('Date');
      
      // RegExp object
      const regex = /test/g;
      const regexAnalysis = slashAgent._analyzeObject(regex);
      expect(regexAnalysis.type).toBe('complex');
      expect(regexAnalysis.constructor).toBe('RegExp');
    });
  });

  describe('Object Type Detection Edge Cases', () => {
    test('should distinguish between handles and actor-like objects', () => {
      const fakeHandle = {
        isActor: true,
        handleType: 'FakeHandle'
        // Missing serialize method
      };
      
      const analysis = slashAgent._analyzeObject(fakeHandle);
      
      // Should not be detected as handle without serialize method - will be serializable since it's a plain object
      expect(analysis.type).toBe('serializable');
      expect(analysis.keys).toContain('isActor');
      expect(analysis.keys).toContain('handleType');
    });

    test('should handle objects with isActor but no handleType', () => {
      const actorLikeObject = {
        isActor: true,
        serialize: jest.fn()
        // Missing handleType
      };
      
      const analysis = slashAgent._analyzeObject(actorLikeObject);
      
      expect(analysis.type).toBe('serializable');
      expect(analysis.keys).toContain('isActor');
      expect(analysis.keys).toContain('serialize');
    });

    test('should handle objects with all handle properties but isActor false', () => {
      const notAnActor = {
        isActor: false,
        handleType: 'NotReallyHandle',
        serialize: jest.fn()
      };
      
      const analysis = slashAgent._analyzeObject(notAnActor);
      
      expect(analysis.type).toBe('serializable');
      expect(analysis.keys).toContain('isActor');
      expect(analysis.keys).toContain('handleType');
    });
  });

  describe('Command Argument Processing', () => {
    test('should handle different object reference formats', () => {
      const testCases = [
        '/show_all file_handle',
        '/show_all user.profile',
        '/show_all config-data',
        '/show_all data_123'
      ];
      
      testCases.forEach(command => {
        const parsed = slashAgent.parseShowAllCommand(command);
        expect(parsed.object).toBeDefined();
        expect(typeof parsed.object).toBe('string');
      });
    });

    test('should handle quoted object references', () => {
      // Note: Current implementation doesn't support quotes, but should handle gracefully
      const result = slashAgent.parseShowAllCommand('/show_all "my object"');
      
      expect(result.object).toBe('"my');
      // This shows the limitation - could be enhanced to support quoted references
    });

    test('should ignore unknown flags', () => {
      const result = slashAgent.parseShowAllCommand('/show_all myObject --unknown --also-unknown=value');
      
      expect(result).toEqual({
        object: 'myObject'
      });
      // Unknown flags are ignored, not throwing errors
    });
  });

  describe('Error Conditions and Validation', () => {
    test('should validate command structure', () => {
      const invalidCommands = [
        '',
        '   ',
        '/show_all',
        '/show_all   ',
        'show_all object' // Missing slash
      ];
      
      invalidCommands.forEach(command => {
        if (command.includes('/show_all') && command.trim().split(/\s+/).length < 2) {
          expect(() => slashAgent.parseShowAllCommand(command))
            .toThrow('show_all command requires an object reference');
        }
      });
    });

    test('should handle very long object references', () => {
      const longRef = 'a'.repeat(1000);
      const command = `/show_all ${longRef}`;
      
      const result = slashAgent.parseShowAllCommand(command);
      
      expect(result.object).toBe(longRef);
      expect(result.object.length).toBe(1000);
    });

    test('should handle special characters in object references', () => {
      const specialRefs = [
        'object-with-dashes',
        'object_with_underscores', 
        'object.with.dots',
        'object123with456numbers'
      ];
      
      specialRefs.forEach(ref => {
        const result = slashAgent.parseShowAllCommand(`/show_all ${ref}`);
        expect(result.object).toBe(ref);
      });
    });
  });
});