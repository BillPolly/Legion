/**
 * Tests for NamedArtifactRegistry
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { 
  NamedArtifact, 
  NamedArtifactRegistry 
} from '../../src/core/storage/artifacts/NamedArtifactRegistry.js';

describe('NamedArtifactRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new NamedArtifactRegistry();
  });

  describe('Basic operations', () => {
    test('should save and retrieve artifacts', () => {
      registry.save(
        'testFile',
        'string',
        'Path to the test file',
        '/path/to/test.txt',
        'writeFile'
      );

      expect(registry.has('testFile')).toBe(true);
      expect(registry.has('@testFile')).toBe(true);
      
      const artifact = registry.get('testFile');
      expect(artifact).toBeDefined();
      expect(artifact.name).toBe('testFile');
      expect(artifact.type).toBe('string');
      expect(artifact.description).toBe('Path to the test file');
      expect(artifact.value).toBe('/path/to/test.txt');
      expect(artifact.source).toBe('writeFile');
    });

    test('should resolve artifact references', () => {
      registry.save(
        'configFile',
        'string',
        'Configuration file path',
        '/config/app.json',
        'writeFile'
      );

      expect(registry.resolve('@configFile')).toBe('/config/app.json');
      expect(registry.resolve('not-a-reference')).toBe('not-a-reference');
      expect(registry.resolve('@nonexistent')).toBe('@nonexistent');
    });

    test('should resolve nested references in objects', () => {
      registry.save('htmlFile', 'string', 'HTML file', '/index.html', 'writeFile');
      registry.save('cssFile', 'string', 'CSS file', '/style.css', 'writeFile');

      const params = {
        html: '@htmlFile',
        css: '@cssFile',
        options: {
          input: '@htmlFile',
          nested: ['@cssFile', 'literal']
        }
      };

      const resolved = registry.resolveAll(params);
      expect(resolved.html).toBe('/index.html');
      expect(resolved.css).toBe('/style.css');
      expect(resolved.options.input).toBe('/index.html');
      expect(resolved.options.nested[0]).toBe('/style.css');
      expect(resolved.options.nested[1]).toBe('literal');
    });

    test('should track access counts', () => {
      registry.save('data', 'object', 'Test data', { value: 42 }, 'tool');
      
      const artifact = registry.get('data');
      expect(artifact.accessCount).toBe(0);

      registry.resolve('@data');
      expect(artifact.accessCount).toBe(1);

      registry.resolve('@data');
      expect(artifact.accessCount).toBe(2);
    });
  });

  describe('Context generation', () => {
    test('should generate context string for LLM', () => {
      registry.save(
        'websiteHTML',
        'string',
        'Main HTML page with navigation',
        '/site/index.html',
        'writeFile'
      );
      registry.save(
        'serverConfig',
        'object',
        'Express server configuration',
        { port: 3000 },
        'createConfig'
      );

      const context = registry.getContextString();
      expect(context).toContain('Available Artifacts:');
      expect(context).toContain('@websiteHTML (string): Main HTML page with navigation');
      expect(context).toContain('@serverConfig (object): Express server configuration');
      expect(context).toContain('You can reference these artifacts');
    });

    test('should handle empty registry', () => {
      const context = registry.getContextString();
      expect(context).toBe('No artifacts available yet.');
    });
  });

  describe('Cleanup and limits', () => {
    test('should cleanup old artifacts when limit exceeded', () => {
      const limitedRegistry = new NamedArtifactRegistry({ maxArtifacts: 3 });

      // Add artifacts with delays to ensure different access times
      limitedRegistry.save('old1', 'string', 'Old 1', 'value1', 'tool');
      limitedRegistry.save('old2', 'string', 'Old 2', 'value2', 'tool');
      limitedRegistry.save('old3', 'string', 'Old 3', 'value3', 'tool');
      
      // Access middle one to update its access time
      limitedRegistry.resolve('@old2');

      // Add one more to trigger cleanup
      limitedRegistry.save('new', 'string', 'New', 'value4', 'tool');

      // Should have removed the least recently accessed
      expect(limitedRegistry.size()).toBeLessThanOrEqual(3);
      expect(limitedRegistry.has('new')).toBe(true);
      expect(limitedRegistry.has('old2')).toBe(true); // Was accessed
    });

    test('should clear all artifacts', () => {
      registry.save('artifact1', 'string', 'Test 1', 'value1', 'tool');
      registry.save('artifact2', 'string', 'Test 2', 'value2', 'tool');
      
      expect(registry.size()).toBe(2);
      
      registry.clear();
      
      expect(registry.size()).toBe(0);
      expect(registry.has('artifact1')).toBe(false);
      expect(registry.has('artifact2')).toBe(false);
    });
  });

  describe('Export and import', () => {
    test('should export and import registry', () => {
      registry.save(
        'testArtifact',
        'string',
        'Test artifact for export',
        'test-value',
        'testTool'
      );

      const exported = registry.toJSON();
      expect(exported.testArtifact).toBeDefined();
      expect(exported.testArtifact.type).toBe('string');
      expect(exported.testArtifact.value).toBe('test-value');

      const newRegistry = new NamedArtifactRegistry();
      newRegistry.fromJSON(exported);

      expect(newRegistry.has('testArtifact')).toBe(true);
      expect(newRegistry.resolve('@testArtifact')).toBe('test-value');
    });
  });

  describe('NamedArtifact', () => {
    test('should create artifact with metadata', () => {
      const artifact = new NamedArtifact(
        'myArtifact',
        'string',
        'A test artifact',
        'artifact-value',
        'sourceTool'
      );

      expect(artifact.name).toBe('myArtifact');
      expect(artifact.type).toBe('string');
      expect(artifact.description).toBe('A test artifact');
      expect(artifact.value).toBe('artifact-value');
      expect(artifact.source).toBe('sourceTool');
      expect(artifact.created).toBeInstanceOf(Date);
      expect(artifact.accessCount).toBe(0);
    });

    test('should format for context display', () => {
      const artifact = new NamedArtifact(
        'configFile',
        'object',
        'Application configuration',
        { key: 'value' },
        'tool'
      );

      const contextString = artifact.toContextString();
      expect(contextString).toBe('@configFile (object): Application configuration');
    });

    test('should provide detailed summary', () => {
      const artifact = new NamedArtifact(
        'dataFile',
        'string',
        'Data file path',
        '/data/file.json',
        'readFile'
      );

      const detailed = artifact.toDetailedString();
      expect(detailed.name).toBe('dataFile');
      expect(detailed.type).toBe('string');
      expect(detailed.description).toBe('Data file path');
      expect(detailed.source).toBe('readFile');
      expect(detailed.created).toBeDefined();
      expect(detailed.accessed).toBe(0);
    });
  });
});