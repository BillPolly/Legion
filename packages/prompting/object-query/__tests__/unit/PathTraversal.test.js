/**
 * Unit tests for PathTraversal core class
 * Tests object navigation, array access, wildcards, and conditional filtering
 */

import { PathTraversal } from '../../src/PathTraversal.js';

describe('PathTraversal', () => {
  const testObject = {
    user: {
      profile: {
        name: 'John Doe',
        role: 'developer',
        settings: {
          theme: 'dark',
          notifications: true
        }
      },
      activity: [
        { action: 'login', timestamp: '2024-01-15T10:00:00Z' },
        { action: 'commit', timestamp: '2024-01-15T11:30:00Z' },
        { action: 'review', timestamp: '2024-01-15T14:20:00Z' }
      ]
    },
    project: {
      name: 'Test Project',
      files: [
        { name: 'index.js', type: 'javascript', size: 1024 },
        { name: 'style.css', type: 'css', size: 512 },
        { name: 'app.js', type: 'javascript', size: 2048 }
      ],
      dependencies: ['react', 'lodash', 'axios']
    },
    conversation: {
      messages: [
        { role: 'user', content: 'Hello', timestamp: '2024-01-15T09:00:00Z' },
        { role: 'assistant', content: 'Hi there!', timestamp: '2024-01-15T09:01:00Z' },
        { role: 'user', content: 'Can you help?', timestamp: '2024-01-15T09:02:00Z' }
      ]
    }
  };

  describe('traverse', () => {
    test('should traverse simple object paths', () => {
      expect(PathTraversal.traverse(testObject, 'user.profile.name')).toBe('John Doe');
      expect(PathTraversal.traverse(testObject, 'user.profile.role')).toBe('developer');
      expect(PathTraversal.traverse(testObject, 'project.name')).toBe('Test Project');
    });

    test('should traverse nested object paths', () => {
      expect(PathTraversal.traverse(testObject, 'user.profile.settings.theme')).toBe('dark');
      expect(PathTraversal.traverse(testObject, 'user.profile.settings.notifications')).toBe(true);
    });

    test('should handle array index access', () => {
      expect(PathTraversal.traverse(testObject, 'user.activity[0].action')).toBe('login');
      expect(PathTraversal.traverse(testObject, 'user.activity[1].timestamp')).toBe('2024-01-15T11:30:00Z');
      expect(PathTraversal.traverse(testObject, 'project.dependencies[2]')).toBe('axios');
    });

    test('should handle negative array indices', () => {
      expect(PathTraversal.traverse(testObject, 'user.activity[-1].action')).toBe('review');
      expect(PathTraversal.traverse(testObject, 'project.dependencies[-1]')).toBe('axios');
    });

    test('should return undefined for non-existent paths', () => {
      expect(PathTraversal.traverse(testObject, 'user.nonexistent')).toBeUndefined();
      expect(PathTraversal.traverse(testObject, 'user.profile.missing.path')).toBeUndefined();
      expect(PathTraversal.traverse(testObject, 'user.activity[10]')).toBeUndefined();
    });

    test('should handle null and undefined objects gracefully', () => {
      expect(PathTraversal.traverse(null, 'any.path')).toBeUndefined();
      expect(PathTraversal.traverse(undefined, 'any.path')).toBeUndefined();
      expect(PathTraversal.traverse({}, 'missing.path')).toBeUndefined();
    });

    test('should handle empty path', () => {
      expect(PathTraversal.traverse(testObject, '')).toBe(testObject);
      expect(PathTraversal.traverse(testObject, null)).toBe(testObject);
    });
  });

  describe('applySlicing', () => {
    test('should apply basic array slicing', () => {
      const arr = ['a', 'b', 'c', 'd', 'e'];
      
      expect(PathTraversal.applySlicing(arr, '0:3')).toEqual(['a', 'b', 'c']);
      expect(PathTraversal.applySlicing(arr, '1:4')).toEqual(['b', 'c', 'd']);
      expect(PathTraversal.applySlicing(arr, '2:')).toEqual(['c', 'd', 'e']);
    });

    test('should handle negative indices in slicing', () => {
      const arr = ['a', 'b', 'c', 'd', 'e'];
      
      expect(PathTraversal.applySlicing(arr, '-3:')).toEqual(['c', 'd', 'e']);
      expect(PathTraversal.applySlicing(arr, '-2:-1')).toEqual(['d']);
      expect(PathTraversal.applySlicing(arr, ':-2')).toEqual(['a', 'b', 'c']);
    });

    test('should handle single index selection', () => {
      const arr = ['a', 'b', 'c', 'd', 'e'];
      
      expect(PathTraversal.applySlicing(arr, '2')).toBe('c');
      expect(PathTraversal.applySlicing(arr, '-1')).toBe('e');
    });

    test('should handle invalid slicing gracefully', () => {
      const arr = ['a', 'b', 'c'];
      
      expect(PathTraversal.applySlicing(arr, '10:20')).toEqual([]);
      expect(PathTraversal.applySlicing(arr, 'invalid')).toBe(arr);
    });
  });

  describe('expandWildcards', () => {
    test('should expand simple wildcards', () => {
      const obj = {
        files: [
          { name: 'file1.js', content: 'code1' },
          { name: 'file2.js', content: 'code2' }
        ]
      };
      
      const result = PathTraversal.expandWildcards(obj, 'files.*.name');
      expect(result).toEqual(['file1.js', 'file2.js']);
    });

    test('should expand wildcards on objects', () => {
      const obj = {
        users: {
          user1: { name: 'John', role: 'admin' },
          user2: { name: 'Jane', role: 'user' }
        }
      };
      
      const result = PathTraversal.expandWildcards(obj, 'users.*.name');
      expect(result).toEqual(['John', 'Jane']);
    });

    test('should handle nested wildcard expansion', () => {
      const result = PathTraversal.expandWildcards(testObject, 'project.files.*.name');
      expect(result).toEqual(['index.js', 'style.css', 'app.js']);
    });

    test('should handle wildcards with filtering', () => {
      const obj = {
        items: [
          { type: 'js', value: 'code1' },
          { type: 'css', value: 'style1' },
          { type: 'js', value: 'code2' }
        ]
      };
      
      const result = PathTraversal.expandWildcards(obj, 'items[type=js].value');
      expect(result).toEqual([['code1', 'code2']]);
    });
  });

  describe('conditionalFilter', () => {
    test('should filter array by simple conditions', () => {
      const arr = [
        { type: 'user', name: 'John' },
        { type: 'admin', name: 'Jane' },
        { type: 'user', name: 'Bob' }
      ];
      
      const result = PathTraversal.conditionalFilter(arr, 'type=user');
      expect(result).toEqual([
        { type: 'user', name: 'John' },
        { type: 'user', name: 'Bob' }
      ]);
    });

    test('should filter by comparison conditions', () => {
      const arr = [
        { score: 10, name: 'item1' },
        { score: 25, name: 'item2' },
        { score: 5, name: 'item3' }
      ];
      
      const result = PathTraversal.conditionalFilter(arr, 'score>10');
      expect(result).toEqual([{ score: 25, name: 'item2' }]);
    });

    test('should filter by contains conditions', () => {
      const arr = [
        { content: 'error in processing' },
        { content: 'success message' },
        { content: 'error in validation' }
      ];
      
      const result = PathTraversal.conditionalFilter(arr, 'content~error');
      expect(result).toEqual([
        { content: 'error in processing' },
        { content: 'error in validation' }
      ]);
    });

    test('should handle invalid conditions gracefully', () => {
      const arr = [{ name: 'test' }];
      
      expect(PathTraversal.conditionalFilter(arr, 'invalid')).toEqual(arr);
      expect(PathTraversal.conditionalFilter(null, 'any')).toEqual([]);
    });
  });

  describe('validatePath', () => {
    test('should validate correct path syntax', () => {
      expect(() => PathTraversal.validatePath('user.profile.name')).not.toThrow();
      expect(() => PathTraversal.validatePath('items[0]')).not.toThrow();
      expect(() => PathTraversal.validatePath('files[-3:]')).not.toThrow();
      expect(() => PathTraversal.validatePath('data.*.value')).not.toThrow();
    });

    test('should reject invalid path syntax', () => {
      expect(() => PathTraversal.validatePath('user.[invalid]'))
        .toThrow('Invalid path syntax');
      expect(() => PathTraversal.validatePath('user..name'))
        .toThrow('Invalid path syntax');
      expect(() => PathTraversal.validatePath('user[invalid_bracket'))
        .toThrow('Invalid path syntax');
    });

    test('should handle empty or null paths', () => {
      expect(() => PathTraversal.validatePath('')).not.toThrow();
      expect(() => PathTraversal.validatePath(null))
        .toThrow('Path must be a string');
    });
  });

  describe('complex path scenarios', () => {
    test('should handle complex real-world paths', () => {
      const complexObject = {
        workspace: {
          projects: [
            {
              name: 'ProjectA',
              files: [
                { path: 'src/index.js', modified: '2024-01-15' },
                { path: 'src/utils.js', modified: '2024-01-14' }
              ]
            },
            {
              name: 'ProjectB', 
              files: [
                { path: 'app.py', modified: '2024-01-15' },
                { path: 'config.json', modified: '2024-01-13' }
              ]
            }
          ]
        }
      };

      // Test complex nested access
      expect(PathTraversal.traverse(complexObject, 'workspace.projects[0].name')).toBe('ProjectA');
      expect(PathTraversal.traverse(complexObject, 'workspace.projects[1].files[0].path')).toBe('app.py');
      
      // Test wildcard expansion
      const projectNames = PathTraversal.expandWildcards(complexObject, 'workspace.projects.*.name');
      expect(projectNames).toEqual(['ProjectA', 'ProjectB']);
    });

    test('should handle array slicing with real data', () => {
      const messages = testObject.conversation.messages;
      
      // Recent messages
      const recent = PathTraversal.traverse(testObject, 'conversation.messages[-2:]');
      expect(recent).toHaveLength(2);
      expect(recent[0].content).toBe('Hi there!');
      
      // First message
      const first = PathTraversal.traverse(testObject, 'conversation.messages[0:1]');
      expect(first).toHaveLength(1);
      expect(first[0].content).toBe('Hello');
    });
  });
});