/**
 * Advanced Components Import Test
 *
 * Verifies that HierarchyEditor and TreeScribe can be imported and follow
 * the umbilical protocol pattern.
 */

import { describe, test, expect } from '@jest/globals';
import { HierarchyEditor, TreeScribe } from '../../src/index.js';

describe('Advanced Components', () => {
  describe('HierarchyEditor', () => {
    test('should import successfully', () => {
      expect(HierarchyEditor).toBeDefined();
      expect(HierarchyEditor.create).toBeDefined();
      expect(typeof HierarchyEditor.create).toBe('function');
    });

    test('should support introspection mode', () => {
      let requirements = null;
      HierarchyEditor.create({
        describe: (reqs) => {
          requirements = reqs;
        }
      });

      expect(requirements).not.toBeNull();
      const allReqs = requirements.getAll();
      expect(allReqs.dom).toBeDefined();
      expect(allReqs.content).toBeDefined();
      expect(allReqs.format).toBeDefined();
    });

    test('should support validation mode', () => {
      const container = document.createElement('div');

      const result = HierarchyEditor.create({
        dom: container,
        content: '{"test": "data"}',
        format: 'json',
        validate: (checks) => checks
      });

      expect(result).toBeDefined();
      expect(result.hasDomElement).toBe(true);
      expect(result.hasValidContent).toBe(true);
      expect(result.hasValidFormat).toBe(true);
    });
  });

  describe('TreeScribe', () => {
    test('should import successfully', () => {
      expect(TreeScribe).toBeDefined();
      expect(TreeScribe.create).toBeDefined();
      expect(typeof TreeScribe.create).toBe('function');
    });

    test('should support introspection mode', () => {
      let requirements = null;
      TreeScribe.create({
        describe: (reqs) => {
          requirements = reqs;
        }
      });

      expect(requirements).not.toBeNull();
      const allReqs = requirements.getAll();
      expect(allReqs.dom).toBeDefined();
      expect(allReqs.yamlContent).toBeDefined();
      expect(allReqs.theme).toBeDefined();
    });

    test('should support validation mode', () => {
      const container = document.createElement('div');

      const result = TreeScribe.create({
        dom: container,
        theme: 'light',
        validate: (checks) => checks
      });

      expect(result).toBeDefined();
      expect(result.hasDomElement).toBe(true);
      expect(result.hasValidTheme).toBe(true);
    });
  });
});
