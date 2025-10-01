/**
 * Unit tests for TextFileHandle
 * Tests generic text file handling for code, markup, and style assets
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TextFileHandle } from '../../../src/handles/TextFileHandle.js';

describe('TextFileHandle', () => {
  describe('Constructor', () => {
    it('should create a code file handle', () => {
      const handle = new TextFileHandle({
        id: 'test-code-1',
        title: 'example.js',
        content: 'const x = 42;',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      expect(handle).toBeDefined();
      expect(handle._handleType).toBe('TextFileHandle');
    });

    it('should create a markup file handle', () => {
      const handle = new TextFileHandle({
        id: 'test-markup-1',
        title: 'example.html',
        content: '<h1>Hello</h1>',
        language: 'html',
        viewerType: 'markup',
        lineCount: 1
      });

      expect(handle).toBeDefined();
      expect(handle._handleType).toBe('TextFileHandle');
    });

    it('should create a style file handle', () => {
      const handle = new TextFileHandle({
        id: 'test-style-1',
        title: 'example.css',
        content: 'body { color: red; }',
        language: 'css',
        viewerType: 'style',
        lineCount: 1
      });

      expect(handle).toBeDefined();
      expect(handle._handleType).toBe('TextFileHandle');
    });

    it('should throw error if content is missing', () => {
      expect(() => {
        new TextFileHandle({
          id: 'test-1',
          title: 'test.js',
          language: 'javascript',
          viewerType: 'code'
        });
      }).toThrow('TextFileHandle requires content');
    });

    it('should throw error if language is missing', () => {
      expect(() => {
        new TextFileHandle({
          id: 'test-1',
          title: 'test.js',
          content: 'code',
          viewerType: 'code'
        });
      }).toThrow('TextFileHandle requires language');
    });

    it('should throw error if viewerType is missing', () => {
      expect(() => {
        new TextFileHandle({
          id: 'test-1',
          title: 'test.js',
          content: 'code',
          language: 'javascript'
        });
      }).toThrow('TextFileHandle requires viewerType');
    });
  });

  describe('getData()', () => {
    it('should return file content', async () => {
      const content = 'const greeting = "Hello, World!";';
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'hello.js',
        content: content,
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      const data = await handle.getData();
      expect(data).toBe(content);
    });

    it('should return multi-line content', async () => {
      const content = 'line1\nline2\nline3';
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'multi.txt',
        content: content,
        language: 'text',
        viewerType: 'code',
        lineCount: 3
      });

      const data = await handle.getData();
      expect(data).toBe(content);
    });
  });

  describe('getMetadata()', () => {
    it('should return complete metadata', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'const x = 1;',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1,
        metadata: { author: 'test', version: '1.0' }
      });

      const metadata = await handle.getMetadata();

      expect(metadata.id).toBe('test-1');
      expect(metadata.title).toBe('example.js');
      expect(metadata.language).toBe('javascript');
      expect(metadata.viewerType).toBe('code');
      expect(metadata.lineCount).toBe(1);
      expect(metadata.metadata.author).toBe('test');
      expect(metadata.metadata.version).toBe('1.0');
    });

    it('should return empty metadata object if not provided', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'const x = 1;',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      const metadata = await handle.getMetadata();
      expect(metadata.metadata).toEqual({});
    });
  });

  describe('getLanguage()', () => {
    it('should return language identifier', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.py',
        content: 'print("hello")',
        language: 'python',
        viewerType: 'code',
        lineCount: 1
      });

      const language = await handle.getLanguage();
      expect(language).toBe('python');
    });
  });

  describe('getViewerType()', () => {
    it('should return code viewer type', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'code',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      const viewerType = await handle.getViewerType();
      expect(viewerType).toBe('code');
    });

    it('should return markup viewer type', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.svg',
        content: '<svg></svg>',
        language: 'svg',
        viewerType: 'markup',
        lineCount: 1
      });

      const viewerType = await handle.getViewerType();
      expect(viewerType).toBe('markup');
    });

    it('should return style viewer type', async () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.css',
        content: 'body {}',
        language: 'css',
        viewerType: 'style',
        lineCount: 1
      });

      const viewerType = await handle.getViewerType();
      expect(viewerType).toBe('style');
    });
  });

  describe('toJSON()', () => {
    it('should serialize to JSON correctly', () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'const x = 1;',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1,
        metadata: { test: true }
      });

      const json = handle.toJSON();

      expect(json._handleType).toBe('TextFileHandle');
      expect(json.id).toBe('test-1');
      expect(json.title).toBe('example.js');
      expect(json.language).toBe('javascript');
      expect(json.viewerType).toBe('code');
      expect(json.lineCount).toBe(1);
      expect(json.metadata.test).toBe(true);
      expect(json.resourceType).toBe('code');
    });

    it('should set resourceType to viewerType in JSON', () => {
      const markupHandle = new TextFileHandle({
        id: 'test-1',
        title: 'example.html',
        content: '<html></html>',
        language: 'html',
        viewerType: 'markup',
        lineCount: 1
      });

      const json = markupHandle.toJSON();
      expect(json.resourceType).toBe('markup');
    });

    it('should handle missing metadata in JSON', () => {
      const handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'code',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      const json = handle.toJSON();
      expect(json.metadata).toEqual({});
    });
  });

  describe('DataSource query', () => {
    let handle;

    beforeEach(() => {
      handle = new TextFileHandle({
        id: 'test-1',
        title: 'example.js',
        content: 'const x = 1;',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });
    });

    it('should query content with read flag', async () => {
      const result = await handle.dataSource.query({ read: true });
      expect(result).toEqual(['const x = 1;']);
    });

    it('should query metadata without read flag', async () => {
      const result = await handle.dataSource.query({});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-1');
      expect(result[0].title).toBe('example.js');
      expect(result[0].language).toBe('javascript');
      expect(result[0].viewerType).toBe('code');
    });

    it('should throw error for subscribe', () => {
      expect(() => {
        handle.dataSource.subscribe();
      }).toThrow('TextFileHandle does not support subscriptions');
    });

    it('should throw error for queryBuilder', () => {
      expect(() => {
        handle.dataSource.queryBuilder();
      }).toThrow('TextFileHandle does not support queryBuilder');
    });

    it('should return schema', () => {
      const schema = handle.dataSource.getSchema();

      expect(schema.type).toBe('text-file');
      expect(schema.properties.id).toBeDefined();
      expect(schema.properties.title).toBeDefined();
      expect(schema.properties.language).toBeDefined();
      expect(schema.properties.viewerType).toBeDefined();
      expect(schema.properties.viewerType.enum).toEqual(['code', 'markup', 'style']);
      expect(schema.properties.content).toBeDefined();
      expect(schema.properties.lineCount).toBeDefined();
      expect(schema.properties.metadata).toBeDefined();
    });
  });

  describe('Different file types', () => {
    it('should handle JavaScript files', async () => {
      const handle = new TextFileHandle({
        id: 'test-js',
        title: 'app.js',
        content: 'function greet() { return "Hello"; }',
        language: 'javascript',
        viewerType: 'code',
        lineCount: 1
      });

      expect(await handle.getLanguage()).toBe('javascript');
      expect(await handle.getViewerType()).toBe('code');
    });

    it('should handle TypeScript files', async () => {
      const handle = new TextFileHandle({
        id: 'test-ts',
        title: 'app.ts',
        content: 'const x: number = 42;',
        language: 'typescript',
        viewerType: 'code',
        lineCount: 1
      });

      expect(await handle.getLanguage()).toBe('typescript');
      expect(await handle.getViewerType()).toBe('code');
    });

    it('should handle HTML files', async () => {
      const handle = new TextFileHandle({
        id: 'test-html',
        title: 'index.html',
        content: '<!DOCTYPE html><html><body>Hello</body></html>',
        language: 'html',
        viewerType: 'markup',
        lineCount: 1
      });

      expect(await handle.getLanguage()).toBe('html');
      expect(await handle.getViewerType()).toBe('markup');
    });

    it('should handle SVG files', async () => {
      const handle = new TextFileHandle({
        id: 'test-svg',
        title: 'icon.svg',
        content: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
        language: 'svg',
        viewerType: 'markup',
        lineCount: 1
      });

      expect(await handle.getLanguage()).toBe('svg');
      expect(await handle.getViewerType()).toBe('markup');
    });

    it('should handle CSS files', async () => {
      const handle = new TextFileHandle({
        id: 'test-css',
        title: 'styles.css',
        content: 'body { margin: 0; padding: 0; }',
        language: 'css',
        viewerType: 'style',
        lineCount: 1
      });

      expect(await handle.getLanguage()).toBe('css');
      expect(await handle.getViewerType()).toBe('style');
    });

    it('should handle Python files', async () => {
      const handle = new TextFileHandle({
        id: 'test-py',
        title: 'script.py',
        content: 'def hello():\n    print("Hello")',
        language: 'python',
        viewerType: 'code',
        lineCount: 2
      });

      expect(await handle.getLanguage()).toBe('python');
      expect(await handle.getViewerType()).toBe('code');
    });
  });
});
