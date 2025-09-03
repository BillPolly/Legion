/**
 * Unit tests for ResourceTypeRegistry
 * TDD: Test-first implementation of extension-to-viewer mapping system
 */

import { jest } from '@jest/globals';

describe('ResourceTypeRegistry', () => {
  let registry;
  
  beforeEach(async () => {
    const { ResourceTypeRegistry } = await import('../../../src/shared/resources/ResourceTypeRegistry.js');
    registry = new ResourceTypeRegistry();
  });

  describe('Extension to Viewer Mapping', () => {
    test('should map text file extensions to CodeEditor', () => {
      expect(registry.getViewerForExtension('.txt')).toBe('CodeEditor');
      expect(registry.getViewerForExtension('.js')).toBe('CodeEditor'); 
      expect(registry.getViewerForExtension('.json')).toBe('CodeEditor');
      expect(registry.getViewerForExtension('.md')).toBe('CodeEditor');
    });

    test('should map image extensions to ImageViewer', () => {
      expect(registry.getViewerForExtension('.png')).toBe('ImageViewer');
      expect(registry.getViewerForExtension('.jpg')).toBe('ImageViewer');
      expect(registry.getViewerForExtension('.gif')).toBe('ImageViewer');
      expect(registry.getViewerForExtension('.webp')).toBe('ImageViewer');
    });

    test('should map directory to DirectoryBrowser', () => {
      expect(registry.getViewerForPath('/')).toBe('DirectoryBrowser');
      expect(registry.getViewerForPath('/some/directory')).toBe('DirectoryBrowser');
    });

    test('should default to CodeEditor for unknown extensions', () => {
      expect(registry.getViewerForExtension('.unknown')).toBe('CodeEditor');
      expect(registry.getViewerForExtension('.xyz')).toBe('CodeEditor');
    });

    test('should handle case insensitive extensions', () => {
      expect(registry.getViewerForExtension('.PNG')).toBe('ImageViewer');
      expect(registry.getViewerForExtension('.JS')).toBe('CodeEditor');
      expect(registry.getViewerForExtension('.JPG')).toBe('ImageViewer');
    });
  });

  describe('Resource Type to Handle Mapping', () => {
    test('should map file paths to FileHandle type', () => {
      expect(registry.getResourceTypeForPath('/test/file.txt')).toBe('FileHandle');
      expect(registry.getResourceTypeForPath('/script.js')).toBe('FileHandle');
    });

    test('should map image paths to ImageHandle type', () => {
      expect(registry.getResourceTypeForPath('/image.png')).toBe('ImageHandle');
      expect(registry.getResourceTypeForPath('/photo.jpg')).toBe('ImageHandle');
    });

    test('should map directory paths to DirectoryHandle type', () => {
      expect(registry.getResourceTypeForPath('/')).toBe('DirectoryHandle');
      expect(registry.getResourceTypeForPath('/some/dir')).toBe('DirectoryHandle');
    });
  });

  describe('Language Detection', () => {
    test('should detect programming languages from extensions', () => {
      expect(registry.getLanguageForExtension('.js')).toBe('javascript');
      expect(registry.getLanguageForExtension('.ts')).toBe('typescript');
      expect(registry.getLanguageForExtension('.py')).toBe('python');
      expect(registry.getLanguageForExtension('.html')).toBe('html');
      expect(registry.getLanguageForExtension('.css')).toBe('css');
      expect(registry.getLanguageForExtension('.json')).toBe('json');
    });

    test('should default to javascript for unknown code files', () => {
      expect(registry.getLanguageForExtension('.unknown')).toBe('javascript');
    });
  });

  describe('Registry Extension', () => {
    test('should allow registering new extension mappings', () => {
      registry.registerExtension('.custom', 'CustomViewer');
      
      expect(registry.getViewerForExtension('.custom')).toBe('CustomViewer');
    });

    test('should allow registering new resource type mappings', () => {
      registry.registerResourceType('.db', 'DatabaseHandle');
      
      expect(registry.getResourceTypeForPath('/data.db')).toBe('DatabaseHandle');
    });

    test('should throw error for duplicate extension registration', () => {
      registry.registerExtension('.test', 'Viewer1');
      
      expect(() => {
        registry.registerExtension('.test', 'Viewer2');
      }).toThrow('Extension .test already registered');
    });
  });

  describe('Path Utilities', () => {
    test('should check if path is directory', () => {
      expect(registry.isDirectoryPath('/')).toBe(true);
      expect(registry.isDirectoryPath('/some/path')).toBe(true);
      expect(registry.isDirectoryPath('/file.txt')).toBe(false);
      expect(registry.isDirectoryPath('/image.png')).toBe(false);
    });

    test('should extract clean extension from paths', () => {
      expect(registry.extractExtension('/path/file.txt')).toBe('.txt');
      expect(registry.extractExtension('/image.PNG')).toBe('.png');
      expect(registry.extractExtension('/no-extension')).toBe('');
      expect(registry.extractExtension('/path.with.dots/file.js')).toBe('.js');
    });
  });
});