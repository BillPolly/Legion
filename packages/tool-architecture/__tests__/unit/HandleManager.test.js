/**
 * Tests for Handle Management System
 * RED phase: Write failing tests first
 */

import { describe, test, expect } from '@jest/globals';
import { 
  HandleManager,
  generateHandle,
  validateHandleStructure,
  isHandle
} from '../../src/utils/HandleManager.js';

describe('Handle Management System', () => {
  describe('generateHandle', () => {
    test('should generate valid handle with type and id', () => {
      const handle = generateHandle('test_resource', { data: 'test' });
      
      expect(handle).toHaveProperty('_id');
      expect(handle).toHaveProperty('_type');
      expect(handle._type).toBe('test_resource');
      expect(typeof handle._id).toBe('string');
      expect(handle._id.length).toBeGreaterThan(0);
    });

    test('should include additional properties in handle', () => {
      const additionalData = { 
        path: '/test/path', 
        created: Date.now(),
        metadata: { version: '1.0' }
      };
      
      const handle = generateHandle('file_handle', additionalData);
      
      expect(handle._type).toBe('file_handle');
      expect(handle.path).toBe('/test/path');
      expect(handle.created).toBe(additionalData.created);
      expect(handle.metadata).toEqual({ version: '1.0' });
    });

    test('should generate unique IDs for different handles', () => {
      const handle1 = generateHandle('test', {});
      const handle2 = generateHandle('test', {});
      
      expect(handle1._id).not.toBe(handle2._id);
    });

    test('should not allow overriding _id and _type', () => {
      const handle = generateHandle('correct_type', { 
        _id: 'custom_id', 
        _type: 'wrong_type',
        data: 'test'
      });
      
      expect(handle._type).toBe('correct_type');
      expect(handle._id).not.toBe('custom_id');
      expect(handle.data).toBe('test');
    });
  });

  describe('validateHandleStructure', () => {
    test('should validate correct handle structure', () => {
      const handle = { _id: 'test_123', _type: 'test_handle', data: 'test' };
      
      expect(() => validateHandleStructure(handle)).not.toThrow();
    });

    test('should throw error for missing _id', () => {
      const handle = { _type: 'test_handle', data: 'test' };
      
      expect(() => validateHandleStructure(handle))
        .toThrow('Invalid handle structure: missing _id');
    });

    test('should throw error for missing _type', () => {
      const handle = { _id: 'test_123', data: 'test' };
      
      expect(() => validateHandleStructure(handle))
        .toThrow('Invalid handle structure: missing _type');
    });

    test('should throw error for non-string _id', () => {
      const handle = { _id: 123, _type: 'test_handle' };
      
      expect(() => validateHandleStructure(handle))
        .toThrow('Invalid handle structure: _id must be a string');
    });

    test('should throw error for non-string _type', () => {
      const handle = { _id: 'test_123', _type: 123 };
      
      expect(() => validateHandleStructure(handle))
        .toThrow('Invalid handle structure: _type must be a string');
    });
  });

  describe('isHandle', () => {
    test('should return true for valid handle', () => {
      const handle = { _id: 'test_123', _type: 'test_handle' };
      expect(isHandle(handle)).toBe(true);
    });

    test('should return false for invalid handle', () => {
      expect(isHandle({})).toBe(false);
      expect(isHandle(null)).toBe(false);
      expect(isHandle('string')).toBe(false);
      expect(isHandle({ id: 'no_underscore' })).toBe(false);
    });

    test('should return false for object with only _id', () => {
      expect(isHandle({ _id: 'test_123' })).toBe(false);
    });

    test('should return false for object with only _type', () => {
      expect(isHandle({ _type: 'test_handle' })).toBe(false);
    });
  });

  describe('HandleManager', () => {
    let manager;

    beforeEach(() => {
      manager = new HandleManager();
    });

    test('should register and retrieve handles', () => {
      const handle = generateHandle('test_resource', { data: 'test' });
      
      manager.register(handle);
      const retrieved = manager.get(handle._id);
      
      expect(retrieved).toEqual(handle);
    });

    test('should return null for non-existent handle', () => {
      const result = manager.get('non_existent_id');
      expect(result).toBeNull();
    });

    test('should check if handle exists', () => {
      const handle = generateHandle('test_resource', { data: 'test' });
      
      expect(manager.exists(handle._id)).toBe(false);
      manager.register(handle);
      expect(manager.exists(handle._id)).toBe(true);
    });

    test('should list handles by type', () => {
      const handle1 = generateHandle('type_a', { data: '1' });
      const handle2 = generateHandle('type_b', { data: '2' });
      const handle3 = generateHandle('type_a', { data: '3' });
      
      manager.register(handle1);
      manager.register(handle2);
      manager.register(handle3);
      
      const typeAHandles = manager.listByType('type_a');
      expect(typeAHandles).toHaveLength(2);
      expect(typeAHandles.map(h => h.data)).toContain('1');
      expect(typeAHandles.map(h => h.data)).toContain('3');
    });

    test('should unregister handles', () => {
      const handle = generateHandle('test_resource', { data: 'test' });
      
      manager.register(handle);
      expect(manager.exists(handle._id)).toBe(true);
      
      manager.unregister(handle._id);
      expect(manager.exists(handle._id)).toBe(false);
    });

    test('should clear all handles', () => {
      const handle1 = generateHandle('type_a', { data: '1' });
      const handle2 = generateHandle('type_b', { data: '2' });
      
      manager.register(handle1);
      manager.register(handle2);
      
      expect(manager.size()).toBe(2);
      manager.clear();
      expect(manager.size()).toBe(0);
    });

    test('should get all handles', () => {
      const handle1 = generateHandle('type_a', { data: '1' });
      const handle2 = generateHandle('type_b', { data: '2' });
      
      manager.register(handle1);
      manager.register(handle2);
      
      const allHandles = manager.getAll();
      expect(allHandles).toHaveLength(2);
      expect(allHandles).toContainEqual(handle1);
      expect(allHandles).toContainEqual(handle2);
    });

    test('should validate handles before registration', () => {
      const invalidHandle = { id: 'no_underscore', data: 'test' };
      
      expect(() => manager.register(invalidHandle))
        .toThrow('Invalid handle structure: missing _id');
    });
  });
});