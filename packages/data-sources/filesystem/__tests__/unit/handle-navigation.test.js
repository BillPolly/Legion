/**
 * Unit tests for Handle Navigation operations
 * Tests parent/child traversal, root access, and path utilities
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FileSystemDataSource } from '../../src/FileSystemDataSource.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Handle Navigation', () => {
  const testRoot = path.join(__dirname, '../tmp/navigation-test');
  let dataSource;
  
  beforeAll(() => {
    // Create test directory structure
    fs.mkdirSync(testRoot, { recursive: true });
    
    // Create nested directories
    fs.mkdirSync(path.join(testRoot, 'parent'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'parent/child'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'parent/child/grandchild'), { recursive: true });
    
    // Create files
    fs.writeFileSync(path.join(testRoot, 'root-file.txt'), 'root content');
    fs.writeFileSync(path.join(testRoot, 'parent/parent-file.txt'), 'parent content');
    fs.writeFileSync(path.join(testRoot, 'parent/child/child-file.txt'), 'child content');
    fs.writeFileSync(path.join(testRoot, 'parent/child/grandchild/deep-file.txt'), 'deep content');
    
    dataSource = new FileSystemDataSource({ rootPath: testRoot });
  });
  
  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testRoot, { recursive: true, force: true });
  });
  
  beforeEach(() => {
    // Reset any state if needed
  });
  
  describe('ServerFileHandle navigation', () => {
    it('should get parent directory handle', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const parentHandle = fileHandle.parent();
      
      expect(parentHandle).toBeDefined();
      expect(parentHandle.path).toBe('parent/child');
      expect(parentHandle.name()).toBe('child');
    });
    
    it('should get root handle from deep file', () => {
      const fileHandle = dataSource.file('parent/child/grandchild/deep-file.txt');
      const rootHandle = fileHandle.root();
      
      expect(rootHandle).toBeDefined();
      expect(rootHandle.path).toBe('');
      expect(rootHandle.name()).toBe(path.basename(testRoot));
    });
    
    it('should navigate to sibling file', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const siblingHandle = fileHandle.sibling('another-file.txt');
      
      expect(siblingHandle).toBeDefined();
      expect(siblingHandle.path).toBe('parent/child/another-file.txt');
    });
    
    it('should get basename without extension', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const basename = fileHandle.basename();
      
      expect(basename).toBe('child-file');
    });
    
    it('should get file extension', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const extension = fileHandle.extension();
      
      expect(extension).toBe('.txt');
    });
    
    it('should get directory name', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const dirname = fileHandle.dirname();
      
      expect(dirname).toBe('parent/child');
    });
    
    it('should get path segments', () => {
      const fileHandle = dataSource.file('parent/child/grandchild/deep-file.txt');
      const segments = fileHandle.pathSegments();
      
      expect(segments).toEqual(['parent', 'child', 'grandchild', 'deep-file.txt']);
    });
    
    it('should calculate depth from root', () => {
      const fileHandle = dataSource.file('parent/child/grandchild/deep-file.txt');
      const depth = fileHandle.depth();
      
      expect(depth).toBe(4); // parent/child/grandchild/deep-file.txt = 4 segments
    });
    
    it('should check if path is descendant', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      
      expect(fileHandle.isDescendantOf('parent')).toBe(true);
      expect(fileHandle.isDescendantOf('parent/child')).toBe(false); // Direct parent, not ancestor
      expect(fileHandle.isDescendantOf('other')).toBe(false);
    });
    
    it('should check if path is ancestor', () => {
      const fileHandle = dataSource.file('parent/parent-file.txt');
      
      expect(fileHandle.isAncestorOf('parent/child')).toBe(true);
      expect(fileHandle.isAncestorOf('parent/child/child-file.txt')).toBe(true);
      expect(fileHandle.isAncestorOf('other')).toBe(false);
    });
    
    it('should get relative path from another path', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const relativePath = fileHandle.relativeTo('parent');
      
      expect(relativePath).toBe('child/child-file.txt');
    });
    
    it('should get absolute path', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      const absolutePath = fileHandle.absolutePath();
      
      expect(absolutePath).toBe(path.join(testRoot, 'parent/child/child-file.txt'));
    });
  });
  
  describe('ServerDirectoryHandle navigation', () => {
    it('should get parent directory handle', () => {
      const dirHandle = dataSource.directory('parent/child');
      const parentHandle = dirHandle.parent();
      
      expect(parentHandle).toBeDefined();
      expect(parentHandle.path).toBe('parent');
      expect(parentHandle.name()).toBe('parent');
    });
    
    it('should handle root directory parent', () => {
      const rootHandle = dataSource.directory('');
      const parentHandle = rootHandle.parent();
      
      expect(parentHandle).toBeNull(); // Root has no parent
    });
    
    it('should get child directory by name', () => {
      const parentHandle = dataSource.directory('parent');
      const childHandle = parentHandle.child('child');
      
      expect(childHandle).toBeDefined();
      expect(childHandle.path).toBe('parent/child');
    });
    
    it('should list all child directories', () => {
      const parentHandle = dataSource.directory('parent/child');
      const children = parentHandle.children();
      
      expect(children).toHaveLength(1);
      expect(children[0].name()).toBe('grandchild');
    });
    
    it('should get descendant by relative path', () => {
      const rootHandle = dataSource.directory('');
      const descendantHandle = rootHandle.descendant('parent/child/grandchild');
      
      expect(descendantHandle).toBeDefined();
      expect(descendantHandle.path).toBe('parent/child/grandchild');
    });
    
    it('should get all descendants recursively', () => {
      const parentHandle = dataSource.directory('parent');
      const descendants = parentHandle.descendants();
      
      expect(descendants.length).toBeGreaterThan(0);
      const paths = descendants.map(d => d.path);
      expect(paths).toContain('parent/child');
      expect(paths).toContain('parent/child/grandchild');
    });
    
    it('should get ancestors up to root', () => {
      const deepHandle = dataSource.directory('parent/child/grandchild');
      const ancestors = deepHandle.ancestors();
      
      expect(ancestors).toHaveLength(3);
      expect(ancestors.map(a => a.path)).toEqual(['parent/child', 'parent', '']);
    });
    
    it('should find common ancestor', () => {
      const handle1 = dataSource.directory('parent/child');
      const handle2 = dataSource.directory('parent/child/grandchild');
      const commonAncestor = handle1.commonAncestor(handle2);
      
      expect(commonAncestor).toBeDefined();
      expect(commonAncestor.path).toBe('parent');
    });
    
    it('should calculate path distance', () => {
      const handle1 = dataSource.directory('parent/child');
      const handle2 = dataSource.directory('parent/child/grandchild');
      const distance = handle1.pathDistance(handle2);
      
      expect(distance).toBe(1); // One level apart
    });
    
    it('should get path depth', () => {
      const deepHandle = dataSource.directory('parent/child/grandchild');
      const depth = deepHandle.depth();
      
      expect(depth).toBe(3);
    });
    
    it('should resolve relative paths', () => {
      const childHandle = dataSource.directory('parent/child');
      const resolvedHandle = childHandle.resolve('../..');
      
      expect(resolvedHandle.path).toBe('');
    });
    
    it('should join paths correctly', () => {
      const parentHandle = dataSource.directory('parent');
      const joinedHandle = parentHandle.join('child', 'grandchild');
      
      expect(joinedHandle.path).toBe('parent/child/grandchild');
    });
  });
  
  describe('path utilities', () => {
    it('should normalize paths', () => {
      const dirHandle = dataSource.directory('parent/child/../child/./grandchild');
      const normalized = dirHandle.normalize();
      
      expect(normalized.path).toBe('parent/child/grandchild');
    });
    
    it('should handle path separators consistently', () => {
      const dirHandle = dataSource.directory('parent\\child'); // Windows-style
      const normalized = dirHandle.normalize();
      
      expect(normalized.path).toBe('parent/child'); // Always use forward slashes
    });
    
    it('should match against glob patterns', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      
      expect(fileHandle.matches('**/*.txt')).toBe(true);
      expect(fileHandle.matches('**/child-*')).toBe(true);
      expect(fileHandle.matches('**/*.js')).toBe(false);
    });
    
    it('should match against regex patterns', () => {
      const fileHandle = dataSource.file('parent/child/child-file.txt');
      
      expect(fileHandle.matches(/child.*\.txt$/)).toBe(true);
      expect(fileHandle.matches(/\.js$/)).toBe(false);
    });
    
    it('should find paths by pattern', () => {
      const rootHandle = dataSource.directory('');
      const matches = rootHandle.find('**/*-file.txt');
      
      expect(matches.length).toBeGreaterThanOrEqual(3);
      const filenames = matches.map(m => path.basename(m.path));
      expect(filenames).toContain('root-file.txt');
      expect(filenames).toContain('parent-file.txt');
      expect(filenames).toContain('child-file.txt');
    });
  });
  
  describe('error handling', () => {
    it('should handle invalid parent navigation', () => {
      const rootHandle = dataSource.directory('');
      const parent = rootHandle.parent();
      
      expect(parent).toBeNull();
    });
    
    it('should handle non-existent paths gracefully', () => {
      const dirHandle = dataSource.directory('non-existent');
      const children = dirHandle.children();
      
      expect(children).toEqual([]);
    });
    
    it('should validate path traversal attempts', () => {
      expect(() => {
        const fileHandle = dataSource.file('parent/child/child-file.txt');
        fileHandle.resolve('../../../../../etc/passwd');
      }).toThrow('Path traversal not allowed');
    });
  });
});