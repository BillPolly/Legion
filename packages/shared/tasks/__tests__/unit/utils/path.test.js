import { describe, it, expect } from '@jest/globals';
import { 
  joinPath, 
  dirname, 
  basename, 
  extname, 
  isAbsolute, 
  resolve 
} from '../../../src/utils/path.js';

describe('Path Utilities', () => {
  describe('joinPath', () => {
    it('should join path segments', () => {
      expect(joinPath('a', 'b', 'c')).toBe('a/b/c');
      expect(joinPath('/a', 'b', 'c')).toBe('/a/b/c');
      expect(joinPath('a', '/b', 'c')).toBe('a/b/c');
    });

    it('should handle empty segments', () => {
      expect(joinPath('a', '', 'b')).toBe('a/b');
      expect(joinPath('', 'a', 'b')).toBe('a/b');
      expect(joinPath('a', null, 'b')).toBe('a/b');
      expect(joinPath('a', undefined, 'b')).toBe('a/b');
    });

    it('should normalize multiple slashes', () => {
      expect(joinPath('a/', '/b')).toBe('a/b');
      expect(joinPath('a//', '//b')).toBe('a/b');
      expect(joinPath('a', '///', 'b')).toBe('a/b');
    });

    it('should remove trailing slash except for root', () => {
      expect(joinPath('a', 'b/')).toBe('a/b');
      expect(joinPath('a/', 'b/')).toBe('a/b');
      expect(joinPath('/')).toBe('/');
    });

    it('should handle single segment', () => {
      expect(joinPath('test')).toBe('test');
      expect(joinPath('/test')).toBe('/test');
    });

    it('should handle no arguments', () => {
      expect(joinPath()).toBe('/');
    });
  });

  describe('dirname', () => {
    it('should return directory name', () => {
      expect(dirname('/a/b/c.txt')).toBe('/a/b');
      expect(dirname('a/b/c.txt')).toBe('a/b');
      expect(dirname('/test.txt')).toBe('/');
      expect(dirname('test.txt')).toBe('.');
    });

    it('should handle directories', () => {
      expect(dirname('/a/b/c/')).toBe('/a/b');
      expect(dirname('/a/b/c')).toBe('/a/b');
      expect(dirname('/')).toBe('/');
    });

    it('should handle edge cases', () => {
      expect(dirname('')).toBe('.');
      expect(dirname('.')).toBe('.');
      expect(dirname('..')).toBe('.');
    });
  });

  describe('basename', () => {
    it('should return file name', () => {
      expect(basename('/a/b/c.txt')).toBe('c.txt');
      expect(basename('a/b/c.txt')).toBe('c.txt');
      expect(basename('/test.txt')).toBe('test.txt');
      expect(basename('test.txt')).toBe('test.txt');
    });

    it('should handle directories', () => {
      expect(basename('/a/b/c/')).toBe('c');
      expect(basename('/a/b/c')).toBe('c');
      expect(basename('/')).toBe('');
    });

    it('should handle extension parameter', () => {
      expect(basename('/a/b/c.txt', '.txt')).toBe('c');
      expect(basename('test.js', '.js')).toBe('test');
      expect(basename('test.txt', '.js')).toBe('test.txt');
    });

    it('should handle edge cases', () => {
      expect(basename('')).toBe('');
      expect(basename('.')).toBe('.');
      expect(basename('..')).toBe('..');
    });
  });

  describe('extname', () => {
    it('should return file extension', () => {
      expect(extname('test.txt')).toBe('.txt');
      expect(extname('/a/b/c.js')).toBe('.js');
      expect(extname('file.tar.gz')).toBe('.gz');
    });

    it('should handle no extension', () => {
      expect(extname('test')).toBe('');
      expect(extname('/a/b/c')).toBe('');
      expect(extname('.gitignore')).toBe('');
    });

    it('should handle edge cases', () => {
      expect(extname('')).toBe('');
      expect(extname('.')).toBe('');
      expect(extname('..')).toBe(''); // '..' has no extension
      expect(extname('test.')).toBe('.'); 
    });
  });

  describe('isAbsolute', () => {
    it('should identify absolute paths', () => {
      expect(isAbsolute('/')).toBe(true);
      expect(isAbsolute('/test')).toBe(true);
      expect(isAbsolute('/a/b/c')).toBe(true);
    });

    it('should identify relative paths', () => {
      expect(isAbsolute('test')).toBe(false);
      expect(isAbsolute('./test')).toBe(false);
      expect(isAbsolute('../test')).toBe(false);
      expect(isAbsolute('a/b/c')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isAbsolute('')).toBe(false);
      expect(isAbsolute('.')).toBe(false);
      expect(isAbsolute('..')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should resolve absolute paths', () => {
      expect(resolve('/a', 'b', 'c')).toBe('/a/b/c');
      expect(resolve('/a', '/b', 'c')).toBe('/b/c');
      expect(resolve('/', 'a', 'b')).toBe('/a/b');
    });

    it('should resolve relative paths from base', () => {
      expect(resolve('/workspace', 'a', 'b')).toBe('/workspace/a/b');
      expect(resolve('/base', './a', 'b')).toBe('/base/a/b');
      expect(resolve('/base', '../a')).toBe('/a');
    });

    it('should handle .. segments', () => {
      expect(resolve('/a/b', '..', 'c')).toBe('/a/c');
      expect(resolve('/a/b/c', '../..')).toBe('/a');
      expect(resolve('/a/b', '../../c')).toBe('/c');
    });

    it('should handle . segments', () => {
      expect(resolve('/a', '.', 'b')).toBe('/a/b');
      expect(resolve('/a', './b', '.', 'c')).toBe('/a/b/c');
    });

    it('should not go above root', () => {
      expect(resolve('/', '..')).toBe('/');
      expect(resolve('/a', '../..')).toBe('/');
      expect(resolve('/a', '../../..')).toBe('/');
    });

    it('should handle empty and single arguments', () => {
      expect(resolve()).toBe('/workspace');
      expect(resolve('/test')).toBe('/test');
      expect(resolve('test')).toBe('/workspace/test');
    });
  });
});