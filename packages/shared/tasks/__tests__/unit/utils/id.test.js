import { describe, it, expect } from '@jest/globals';
import { generateId, generateShortId, generatePrefixedId } from '../../../src/utils/id.js';

describe('ID Generation Utilities', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with timestamp and random parts', () => {
      const id = generateId();
      const parts = id.split('-');
      
      expect(parts.length).toBe(2);
      expect(parseInt(parts[0])).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('should generate IDs that sort chronologically', async () => {
      const id1 = generateId();
      await new Promise(resolve => setTimeout(resolve, 2));
      const id2 = generateId();
      
      expect(id1 < id2).toBe(true);
    });
  });

  describe('generateShortId', () => {
    it('should generate short random IDs', () => {
      const id1 = generateShortId();
      const id2 = generateShortId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeLessThanOrEqual(9);
    });

    it('should generate IDs without hyphens', () => {
      const id = generateShortId();
      expect(id).not.toContain('-');
    });
  });

  describe('generatePrefixedId', () => {
    it('should generate IDs with prefix', () => {
      const id = generatePrefixedId('task');
      
      expect(id).toBeDefined();
      expect(id.startsWith('task-')).toBe(true);
    });

    it('should generate unique prefixed IDs', () => {
      const id1 = generatePrefixedId('test');
      const id2 = generatePrefixedId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test-')).toBe(true);
      expect(id2.startsWith('test-')).toBe(true);
    });
  });
});