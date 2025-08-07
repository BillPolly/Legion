/**
 * Unit tests for KindUtils
 * ES6 JavaScript version
 */

import { KindUtils } from '../src-js/utils/KindUtils.js';

describe('KindUtils', () => {
  describe('parse', () => {
    it('should parse a simple kind path', () => {
      const info = KindUtils.parse('action.execute');
      
      expect(info).toEqual({
        path: ['action', 'execute'],
        leaf: 'execute',
        parent: 'action',
        depth: 2,
        root: 'action'
      });
    });

    it('should parse a deep kind path', () => {
      const info = KindUtils.parse('resource.tool.database.mongodb');
      
      expect(info).toEqual({
        path: ['resource', 'tool', 'database', 'mongodb'],
        leaf: 'mongodb',
        parent: 'resource.tool.database',
        depth: 4,
        root: 'resource'
      });
    });

    it('should handle single level path', () => {
      const info = KindUtils.parse('action');
      
      expect(info).toEqual({
        path: ['action'],
        leaf: 'action',
        parent: null,
        depth: 1,
        root: 'action'
      });
    });
  });

  describe('isValidKindPath', () => {
    it('should accept valid kind paths', () => {
      expect(KindUtils.isValidKindPath('action.execute')).toBe(true);
      expect(KindUtils.isValidKindPath('resource.tool.database')).toBe(true);
      expect(KindUtils.isValidKindPath('knowledge.constraint')).toBe(true);
      expect(KindUtils.isValidKindPath('organization.team')).toBe(true);
      expect(KindUtils.isValidKindPath('metadata.version')).toBe(true);
    });

    it('should reject paths without dots', () => {
      expect(KindUtils.isValidKindPath('action')).toBe(false);
      expect(KindUtils.isValidKindPath('resource')).toBe(false);
    });

    it('should reject paths with invalid characters', () => {
      expect(KindUtils.isValidKindPath('action.Execute')).toBe(false); // Capital letter
      expect(KindUtils.isValidKindPath('action.execute-task')).toBe(false); // Hyphen
      expect(KindUtils.isValidKindPath('action.execute_task')).toBe(false); // Underscore
      expect(KindUtils.isValidKindPath('action.execute1')).toBe(false); // Number
    });

    it('should reject paths that are too shallow', () => {
      expect(KindUtils.isValidKindPath('a')).toBe(false);
    });

    it('should reject paths that are too deep', () => {
      expect(KindUtils.isValidKindPath('a.b.c.d.e.f')).toBe(false); // 6 levels
    });

    it('should reject paths with invalid root', () => {
      expect(KindUtils.isValidKindPath('invalid.root.path')).toBe(false);
      expect(KindUtils.isValidKindPath('task.execute')).toBe(false);
    });
  });

  describe('isChildOf', () => {
    it('should identify direct children', () => {
      expect(KindUtils.isChildOf('action.execute', 'action')).toBe(true);
      expect(KindUtils.isChildOf('resource.tool.database', 'resource.tool')).toBe(true);
    });

    it('should reject non-children', () => {
      expect(KindUtils.isChildOf('action.execute', 'resource')).toBe(false);
      expect(KindUtils.isChildOf('action', 'action')).toBe(false); // Same path
    });

    it('should reject grandchildren', () => {
      expect(KindUtils.isChildOf('resource.tool.database', 'resource')).toBe(false);
    });

    it('should handle unrelated paths', () => {
      expect(KindUtils.isChildOf('knowledge.constraint', 'action.execute')).toBe(false);
    });
  });

  describe('isDescendantOf', () => {
    it('should identify direct children as descendants', () => {
      expect(KindUtils.isDescendantOf('action.execute', 'action')).toBe(true);
    });

    it('should identify grandchildren as descendants', () => {
      expect(KindUtils.isDescendantOf('resource.tool.database', 'resource')).toBe(true);
    });

    it('should consider same path as descendant', () => {
      expect(KindUtils.isDescendantOf('action', 'action')).toBe(true);
    });

    it('should reject non-descendants', () => {
      expect(KindUtils.isDescendantOf('action.execute', 'resource')).toBe(false);
      expect(KindUtils.isDescendantOf('knowledge', 'action.execute')).toBe(false);
    });
  });

  describe('getDirectChildren', () => {
    const allKinds = [
      'action',
      'action.execute',
      'action.execute.async',
      'action.query',
      'resource',
      'resource.tool',
      'resource.tool.database',
      'resource.data'
    ];

    it('should find direct children', () => {
      const children = KindUtils.getDirectChildren('action', allKinds);
      expect(children).toEqual(['action.execute', 'action.query']);
    });

    it('should find children at deeper levels', () => {
      const children = KindUtils.getDirectChildren('action.execute', allKinds);
      expect(children).toEqual(['action.execute.async']);
    });

    it('should return empty array for leaves', () => {
      const children = KindUtils.getDirectChildren('action.query', allKinds);
      expect(children).toEqual([]);
    });

    it('should handle non-existent parents', () => {
      const children = KindUtils.getDirectChildren('nonexistent', allKinds);
      expect(children).toEqual([]);
    });
  });

  describe('getAllDescendants', () => {
    const allKinds = [
      'action',
      'action.execute',
      'action.execute.async',
      'action.execute.sync',
      'action.query',
      'resource.tool'
    ];

    it('should find all descendants', () => {
      const descendants = KindUtils.getAllDescendants('action', allKinds);
      expect(descendants).toEqual([
        'action.execute',
        'action.execute.async',
        'action.execute.sync',
        'action.query'
      ]);
    });

    it('should find descendants at deeper levels', () => {
      const descendants = KindUtils.getAllDescendants('action.execute', allKinds);
      expect(descendants).toEqual([
        'action.execute.async',
        'action.execute.sync'
      ]);
    });

    it('should return empty array for leaves', () => {
      const descendants = KindUtils.getAllDescendants('action.query', allKinds);
      expect(descendants).toEqual([]);
    });

    it('should not include the ancestor itself', () => {
      const descendants = KindUtils.getAllDescendants('action', allKinds);
      expect(descendants).not.toContain('action');
    });
  });

  describe('buildTree', () => {
    it('should build tree from flat list', () => {
      const paths = [
        'action.execute',
        'action.query',
        'resource.tool',
        'resource.data'
      ];

      const tree = KindUtils.buildTree(paths);
      
      expect(tree).toEqual({
        action: {
          path: 'action',
          children: {
            execute: {
              path: 'action.execute',
              children: {}
            },
            query: {
              path: 'action.query',
              children: {}
            }
          }
        },
        resource: {
          path: 'resource',
          children: {
            tool: {
              path: 'resource.tool',
              children: {}
            },
            data: {
              path: 'resource.data',
              children: {}
            }
          }
        }
      });
    });

    it('should handle deep nesting', () => {
      const paths = ['action.execute.async.parallel'];
      const tree = KindUtils.buildTree(paths);
      
      expect(tree.action.children.execute.children.async.children.parallel).toEqual({
        path: 'action.execute.async.parallel',
        children: {}
      });
    });

    it('should handle empty list', () => {
      const tree = KindUtils.buildTree([]);
      expect(tree).toEqual({});
    });
  });

  describe('findCommonAncestor', () => {
    it('should find common ancestor of siblings', () => {
      const ancestor = KindUtils.findCommonAncestor(
        'action.execute.async',
        'action.execute.sync'
      );
      expect(ancestor).toBe('action.execute');
    });

    it('should find common root', () => {
      const ancestor = KindUtils.findCommonAncestor(
        'action.execute',
        'action.query'
      );
      expect(ancestor).toBe('action');
    });

    it('should handle identical paths', () => {
      const ancestor = KindUtils.findCommonAncestor(
        'action.execute',
        'action.execute'
      );
      expect(ancestor).toBe('action.execute');
    });

    it('should return null for completely different paths', () => {
      const ancestor = KindUtils.findCommonAncestor(
        'action.execute',
        'resource.tool'
      );
      expect(ancestor).toBeNull();
    });

    it('should handle paths of different lengths', () => {
      const ancestor = KindUtils.findCommonAncestor(
        'action.execute.async.parallel',
        'action.execute'
      );
      expect(ancestor).toBe('action.execute');
    });
  });
});