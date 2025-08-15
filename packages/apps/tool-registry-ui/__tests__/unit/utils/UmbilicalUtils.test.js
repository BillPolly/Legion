/**
 * Unit tests for UmbilicalUtils functionality
 * Phase 1.2 - Verify UmbilicalUtils functionality
 */

import { UmbilicalUtils, UmbilicalError } from '/legion/frontend-components/src/umbilical/index.js';

describe('UmbilicalUtils', () => {
  describe('validateCapabilities', () => {
    test('should pass when all required capabilities are present', () => {
      const umbilical = {
        dom: document.createElement('div'),
        onChange: () => {},
        data: { test: true }
      };

      expect(() => {
        UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'onChange'], 'TestComponent');
      }).not.toThrow();
    });

    test('should throw UmbilicalError when required capabilities are missing', () => {
      const umbilical = {
        dom: document.createElement('div')
        // onChange is missing
      };

      expect(() => {
        UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'onChange'], 'TestComponent');
      }).toThrow(UmbilicalError);
    });

    test('should include missing capabilities in error', () => {
      const umbilical = { dom: document.createElement('div') };

      try {
        UmbilicalUtils.validateCapabilities(umbilical, ['dom', 'onChange', 'data'], 'TestComponent');
        fail('Should have thrown UmbilicalError');
      } catch (error) {
        expect(error).toBeInstanceOf(UmbilicalError);
        expect(error.component).toBe('TestComponent');
        expect(error.missingCapabilities).toEqual(['onChange', 'data']);
        expect(error.message).toContain('onChange, data');
      }
    });

    test('should use generic component name when none provided', () => {
      const umbilical = {};

      try {
        UmbilicalUtils.validateCapabilities(umbilical, ['dom']);
        fail('Should have thrown UmbilicalError');
      } catch (error) {
        expect(error.message).toContain('Component missing required capabilities');
        expect(error.component).toBe('Component');
      }
    });
  });

  describe('createRequirements', () => {
    test('should create requirements object with add/get/list methods', () => {
      const requirements = UmbilicalUtils.createRequirements();

      expect(requirements.add).toBeInstanceOf(Function);
      expect(requirements.get).toBeInstanceOf(Function);
      expect(requirements.getAll).toBeInstanceOf(Function);
      expect(requirements.list).toBeInstanceOf(Function);
    });

    test('should add and retrieve requirements', () => {
      const requirements = UmbilicalUtils.createRequirements();

      requirements.add('dom', 'HTMLElement', 'Parent DOM element');
      requirements.add('onChange', 'Function', 'Change callback');

      expect(requirements.get('dom')).toEqual({
        type: 'HTMLElement',
        description: 'Parent DOM element'
      });

      expect(requirements.get('onChange')).toEqual({
        type: 'Function',
        description: 'Change callback'
      });
    });

    test('should list all requirement names', () => {
      const requirements = UmbilicalUtils.createRequirements();

      requirements.add('dom', 'HTMLElement');
      requirements.add('onChange', 'Function');
      requirements.add('data', 'Object');

      const list = requirements.list();
      expect(list).toEqual(['dom', 'onChange', 'data']);
    });

    test('should return all requirements as object', () => {
      const requirements = UmbilicalUtils.createRequirements();

      requirements.add('dom', 'HTMLElement', 'Parent element');
      requirements.add('onChange', 'Function', 'Change handler');

      const all = requirements.getAll();
      expect(all).toEqual({
        dom: { type: 'HTMLElement', description: 'Parent element' },
        onChange: { type: 'Function', description: 'Change handler' }
      });
    });
  });

  describe('createMockUmbilical', () => {
    test('should create umbilical with default no-op implementations', () => {
      const mock = UmbilicalUtils.createMockUmbilical();

      expect(mock.log).toBeInstanceOf(Function);
      expect(mock.error).toBeInstanceOf(Function);
      expect(mock.warn).toBeInstanceOf(Function);

      // Should not throw
      expect(() => {
        mock.log('test');
        mock.error('test');
        mock.warn('test');
      }).not.toThrow();
    });

    test('should merge provided capabilities', () => {
      let callCount = 0;
      const mockFn = () => { callCount++; };
      const customCapabilities = {
        dom: document.createElement('div'),
        onChange: mockFn,
        data: { test: 'value' }
      };

      const mock = UmbilicalUtils.createMockUmbilical(customCapabilities);

      expect(mock.dom).toBe(customCapabilities.dom);
      expect(mock.onChange).toBe(customCapabilities.onChange);
      expect(mock.data).toBe(customCapabilities.data);

      // Should still have default capabilities
      expect(mock.log).toBeInstanceOf(Function);
      expect(mock.error).toBeInstanceOf(Function);
      expect(mock.warn).toBeInstanceOf(Function);
    });

    test('should override default capabilities when provided', () => {
      let logCalls = [];
      const customLog = (message) => { logCalls.push(message); };
      const mock = UmbilicalUtils.createMockUmbilical({
        log: customLog
      });

      mock.log('test message');
      expect(logCalls).toEqual(['test message']);
    });
  });
});

describe('UmbilicalError', () => {
  test('should create error with component and missing capabilities', () => {
    const error = new UmbilicalError(
      'Test error message',
      'TestComponent',
      ['dom', 'onChange']
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UmbilicalError);
    expect(error.name).toBe('UmbilicalError');
    expect(error.message).toBe('Test error message');
    expect(error.component).toBe('TestComponent');
    expect(error.missingCapabilities).toEqual(['dom', 'onChange']);
  });

  test('should work with empty missing capabilities', () => {
    const error = new UmbilicalError('Test error', 'TestComponent');

    expect(error.missingCapabilities).toEqual([]);
  });
});