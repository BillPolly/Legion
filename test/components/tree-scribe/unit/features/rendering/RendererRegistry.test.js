/**
 * RendererRegistry Tests
 * 
 * Testing RendererRegistry singleton for renderer registration, selection, and content type detection
 */

import { RendererRegistry } from '../../../../../../src/components/tree-scribe/features/rendering/RendererRegistry.js';
import { PlaintextRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/PlaintextRenderer.js';
import { MarkdownRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/MarkdownRenderer.js';
import { YamlRenderer } from '../../../../../../src/components/tree-scribe/features/rendering/renderers/YamlRenderer.js';

describe('RendererRegistry', () => {
  let registry;
  let mockRenderer1;
  let mockRenderer2;

  beforeEach(() => {
    // Get fresh registry instance
    registry = RendererRegistry.getInstance();
    registry.clear(); // Clear any existing renderers
    
    // Create mock renderers
    mockRenderer1 = {
      getName: () => 'MockRenderer1',
      getVersion: () => '1.0.0',
      getSupportedTypes: () => ['mock1', 'test1'],
      getDescription: () => 'Mock renderer for testing',
      canRender: (contentType) => ['mock1', 'test1'].includes(contentType?.toLowerCase()),
      render: () => 'mock1 rendered'
    };
    
    mockRenderer2 = {
      getName: () => 'MockRenderer2', 
      getVersion: () => '2.0.0',
      getSupportedTypes: () => ['mock2', 'test2', 'shared'],
      getDescription: () => 'Second mock renderer',
      canRender: (contentType) => ['mock2', 'test2', 'shared'].includes(contentType?.toLowerCase()),
      render: () => 'mock2 rendered'
    };
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = RendererRegistry.getInstance();
      const instance2 = RendererRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    test('should maintain state across getInstance calls', () => {
      const instance1 = RendererRegistry.getInstance();
      instance1.register(mockRenderer1);
      
      const instance2 = RendererRegistry.getInstance();
      const registeredRenderers = instance2.getRegisteredRenderers();
      
      expect(registeredRenderers).toContain('MockRenderer1');
    });
  });

  describe('Renderer Registration', () => {
    test('should register a valid renderer', () => {
      const success = registry.register(mockRenderer1);
      
      expect(success).toBe(true);
      expect(registry.isRegistered('MockRenderer1')).toBe(true);
    });

    test('should register multiple renderers', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      expect(registry.isRegistered('MockRenderer1')).toBe(true);
      expect(registry.isRegistered('MockRenderer2')).toBe(true);
    });

    test('should prevent duplicate renderer registration', () => {
      registry.register(mockRenderer1);
      const success = registry.register(mockRenderer1);
      
      expect(success).toBe(false);
      
      const renderers = registry.getRegisteredRenderers();
      expect(renderers.filter(name => name === 'MockRenderer1').length).toBe(1);
    });

    test('should validate renderer interface before registration', () => {
      const invalidRenderer = {
        getName: () => 'Invalid',
        // Missing required methods
      };
      
      const success = registry.register(invalidRenderer);
      expect(success).toBe(false);
    });

    test('should handle renderer registration errors gracefully', () => {
      const faultyRenderer = {
        getName: () => { throw new Error('Name error'); },
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['test'],
        getDescription: () => 'Faulty',
        canRender: () => true,
        render: () => 'test'
      };
      
      const success = registry.register(faultyRenderer);
      expect(success).toBe(false);
    });

    test('should validate required renderer methods', () => {
      const requiredMethods = ['getName', 'getVersion', 'getSupportedTypes', 'getDescription', 'canRender', 'render'];
      
      requiredMethods.forEach(methodName => {
        const incompleteRenderer = { ...mockRenderer1 };
        delete incompleteRenderer[methodName];
        
        const success = registry.register(incompleteRenderer);
        expect(success).toBe(false);
      });
    });
  });

  describe('Renderer Selection', () => {
    beforeEach(() => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
    });

    test('should select renderer by content type', () => {
      const renderer = registry.getRenderer('mock1');
      
      expect(renderer).toBe(mockRenderer1);
    });

    test('should return null for unknown content types', () => {
      const renderer = registry.getRenderer('unknown');
      
      expect(renderer).toBeNull();
    });

    test('should handle case insensitive content type matching', () => {
      const renderer1 = registry.getRenderer('MOCK1');
      const renderer2 = registry.getRenderer('Mock1');
      
      expect(renderer1).toBe(mockRenderer1);
      expect(renderer2).toBe(mockRenderer1);
    });

    test('should select first available renderer for shared content types', () => {
      const sharedMockRenderer = {
        getName: () => 'SharedMock',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['shared'],
        getDescription: () => 'Shared mock',
        canRender: (contentType) => contentType?.toLowerCase() === 'shared',
        render: () => 'shared rendered'
      };
      
      registry.register(sharedMockRenderer);
      
      // Should return the first registered renderer for 'shared' type
      const renderer = registry.getRenderer('shared');
      expect(renderer).toBe(mockRenderer2); // Registered before sharedMockRenderer
    });

    test('should return renderer by name', () => {
      const renderer = registry.getRendererByName('MockRenderer1');
      
      expect(renderer).toBe(mockRenderer1);
    });

    test('should return null for unknown renderer names', () => {
      const renderer = registry.getRendererByName('UnknownRenderer');
      
      expect(renderer).toBeNull();
    });
  });

  describe('Content Type Detection', () => {
    beforeEach(() => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
    });

    test('should detect supported content types', () => {
      expect(registry.canRender('mock1')).toBe(true);
      expect(registry.canRender('mock2')).toBe(true);
      expect(registry.canRender('test1')).toBe(true);
      expect(registry.canRender('test2')).toBe(true);
    });

    test('should reject unsupported content types', () => {
      expect(registry.canRender('unsupported')).toBe(false);
      expect(registry.canRender('random')).toBe(false);
    });

    test('should get all supported content types', () => {
      const supportedTypes = registry.getSupportedContentTypes();
      
      expect(supportedTypes).toContain('mock1');
      expect(supportedTypes).toContain('mock2');
      expect(supportedTypes).toContain('test1');
      expect(supportedTypes).toContain('test2');
      expect(supportedTypes).toContain('shared');
    });

    test('should not duplicate content types in supported list', () => {
      const duplicateRenderer = {
        getName: () => 'DuplicateRenderer',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['mock1', 'duplicate'], // mock1 already supported
        getDescription: () => 'Duplicate support',
        canRender: (contentType) => ['mock1', 'duplicate'].includes(contentType?.toLowerCase()),
        render: () => 'duplicate rendered'
      };
      
      registry.register(duplicateRenderer);
      
      const supportedTypes = registry.getSupportedContentTypes();
      const mock1Count = supportedTypes.filter(type => type === 'mock1').length;
      
      expect(mock1Count).toBe(1); // Should not be duplicated
    });

    test('should handle null and undefined content types', () => {
      expect(registry.canRender(null)).toBe(false);
      expect(registry.canRender(undefined)).toBe(false);
      expect(registry.canRender('')).toBe(false);
    });
  });

  describe('Fallback Renderer', () => {
    test('should set and use fallback renderer', () => {
      registry.register(mockRenderer1);
      registry.setFallbackRenderer(mockRenderer1);
      
      const renderer = registry.getRenderer('unsupported-type');
      expect(renderer).toBe(mockRenderer1);
    });

    test('should return null when no fallback is set', () => {
      const renderer = registry.getRenderer('unsupported-type');
      expect(renderer).toBeNull();
    });

    test('should override fallback renderer', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      registry.setFallbackRenderer(mockRenderer1);
      registry.setFallbackRenderer(mockRenderer2);
      
      const renderer = registry.getRenderer('unsupported-type');
      expect(renderer).toBe(mockRenderer2);
    });

    test('should clear fallback renderer', () => {
      registry.register(mockRenderer1);
      registry.setFallbackRenderer(mockRenderer1);
      registry.setFallbackRenderer(null);
      
      const renderer = registry.getRenderer('unsupported-type');
      expect(renderer).toBeNull();
    });
  });

  describe('Registry Management', () => {
    test('should unregister a renderer', () => {
      registry.register(mockRenderer1);
      expect(registry.isRegistered('MockRenderer1')).toBe(true);
      
      const success = registry.unregister('MockRenderer1');
      expect(success).toBe(true);
      expect(registry.isRegistered('MockRenderer1')).toBe(false);
    });

    test('should handle unregistering non-existent renderer', () => {
      const success = registry.unregister('NonExistent');
      expect(success).toBe(false);
    });

    test('should get list of registered renderer names', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      const names = registry.getRegisteredRenderers();
      expect(names).toContain('MockRenderer1');
      expect(names).toContain('MockRenderer2');
      expect(names.length).toBe(2);
    });

    test('should clear all renderers', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      registry.clear();
      
      expect(registry.getRegisteredRenderers().length).toBe(0);
      expect(registry.isRegistered('MockRenderer1')).toBe(false);
      expect(registry.isRegistered('MockRenderer2')).toBe(false);
    });

    test('should get registry statistics', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      const stats = registry.getStatistics();
      
      expect(stats.totalRenderers).toBe(2);
      expect(stats.totalContentTypes).toBe(5); // mock1, test1, mock2, test2, shared
      expect(Array.isArray(stats.renderers)).toBe(true);
      expect(stats.renderers.length).toBe(2);
    });
  });

  describe('Renderer Caching', () => {
    test('should cache renderer lookups for performance', () => {
      registry.register(mockRenderer1);
      
      // First lookup (should cache)
      const renderer1 = registry.getRenderer('mock1');
      
      // Second lookup (should use cache)
      const renderer2 = registry.getRenderer('mock1');
      
      expect(renderer1).toBe(renderer2);
      expect(renderer1).toBe(mockRenderer1);
    });

    test('should invalidate cache when registering new renderer', () => {
      registry.register(mockRenderer1);
      registry.getRenderer('mock1'); // Prime cache
      
      // Register new renderer for same content type
      const newMockRenderer = {
        getName: () => 'NewMockRenderer',
        getVersion: () => '2.0.0',
        getSupportedTypes: () => ['mock1'],
        getDescription: () => 'New mock',
        canRender: (contentType) => contentType?.toLowerCase() === 'mock1',
        render: () => 'new mock rendered'
      };
      
      registry.register(newMockRenderer);
      
      // Should return first registered renderer (cache updated)
      const renderer = registry.getRenderer('mock1');
      expect(renderer).toBe(mockRenderer1); // First registered wins
    });

    test('should invalidate cache when unregistering renderer', () => {
      registry.register(mockRenderer1);
      registry.register(mockRenderer2);
      
      registry.getRenderer('mock1'); // Prime cache
      registry.unregister('MockRenderer1');
      
      const renderer = registry.getRenderer('mock1');
      expect(renderer).toBeNull(); // Should be null after unregistration
    });

    test('should clear cache when clearing registry', () => {
      registry.register(mockRenderer1);
      registry.getRenderer('mock1'); // Prime cache
      
      registry.clear();
      
      const renderer = registry.getRenderer('mock1');
      expect(renderer).toBeNull();
    });
  });

  describe('Built-in Renderer Integration', () => {
    test('should register and use PlaintextRenderer', () => {
      const plaintextRenderer = new PlaintextRenderer();
      registry.register(plaintextRenderer);
      
      expect(registry.isRegistered('PlaintextRenderer')).toBe(true);
      expect(registry.canRender('plaintext')).toBe(true);
      
      const renderer = registry.getRenderer('plaintext');
      expect(renderer).toBe(plaintextRenderer);
    });

    test('should register and use MarkdownRenderer', () => {
      const markdownRenderer = new MarkdownRenderer();
      registry.register(markdownRenderer);
      
      expect(registry.isRegistered('MarkdownRenderer')).toBe(true);
      expect(registry.canRender('markdown')).toBe(true);
      
      const renderer = registry.getRenderer('markdown');
      expect(renderer).toBe(markdownRenderer);
    });

    test('should register and use YamlRenderer', () => {
      const yamlRenderer = new YamlRenderer();
      registry.register(yamlRenderer);
      
      expect(registry.isRegistered('YamlRenderer')).toBe(true);
      expect(registry.canRender('yaml')).toBe(true);
      
      const renderer = registry.getRenderer('yaml');
      expect(renderer).toBe(yamlRenderer);
    });

    test('should handle multiple built-in renderers', () => {
      const plaintextRenderer = new PlaintextRenderer();
      const markdownRenderer = new MarkdownRenderer();
      const yamlRenderer = new YamlRenderer();
      
      registry.register(plaintextRenderer);
      registry.register(markdownRenderer);
      registry.register(yamlRenderer);
      
      expect(registry.getRegisteredRenderers().length).toBe(3);
      
      const supportedTypes = registry.getSupportedContentTypes();
      expect(supportedTypes).toContain('plaintext');
      expect(supportedTypes).toContain('markdown');
      expect(supportedTypes).toContain('yaml');
    });
  });

  describe('Error Handling', () => {
    test('should handle renderer errors during canRender check', () => {
      const faultyRenderer = {
        getName: () => 'FaultyRenderer',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => ['faulty'],
        getDescription: () => 'Faulty renderer',
        canRender: () => { throw new Error('canRender failed'); },
        render: () => 'faulty rendered'
      };
      
      registry.register(faultyRenderer);
      
      // Should handle error gracefully
      expect(registry.canRender('faulty')).toBe(false);
    });

    test('should handle renderer errors during getSupportedTypes', () => {
      const faultyRenderer = {
        getName: () => 'FaultyRenderer2',
        getVersion: () => '1.0.0',
        getSupportedTypes: () => { throw new Error('getSupportedTypes failed'); },
        getDescription: () => 'Faulty renderer 2',
        canRender: () => true,
        render: () => 'faulty rendered'
      };
      
      // Should fail registration due to error
      const success = registry.register(faultyRenderer);
      expect(success).toBe(false);
    });

    test('should validate renderer methods return correct types', () => {
      const invalidRenderer = {
        getName: () => 123, // Should return string
        getVersion: () => '1.0.0',
        getSupportedTypes: () => 'not-array', // Should return array
        getDescription: () => 'Invalid',
        canRender: () => 'not-boolean', // Should return boolean
        render: () => 'rendered'
      };
      
      const success = registry.register(invalidRenderer);
      expect(success).toBe(false);
    });
  });

  describe('Performance', () => {
    test('should handle large numbers of renderers efficiently', () => {
      const renderers = [];
      
      // Create 100 mock renderers
      for (let i = 0; i < 100; i++) {
        const renderer = {
          getName: () => `MockRenderer${i}`,
          getVersion: () => '1.0.0',
          getSupportedTypes: () => [`type${i}`],
          getDescription: () => `Mock renderer ${i}`,
          canRender: (contentType) => contentType === `type${i}`,
          render: () => `rendered ${i}`
        };
        renderers.push(renderer);
        registry.register(renderer);
      }
      
      const startTime = Date.now();
      
      // Perform lookups
      for (let i = 0; i < 100; i++) {
        const renderer = registry.getRenderer(`type${i}`);
        expect(renderer).toBe(renderers[i]);
      }
      
      const endTime = Date.now();
      
      // Should complete lookups quickly (less than 50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });

    test('should cache lookups to improve repeated access performance', () => {
      registry.register(mockRenderer1);
      
      // First lookup (no cache)
      const startTime1 = Date.now();
      registry.getRenderer('mock1');
      const endTime1 = Date.now();
      
      // Second lookup (cached)
      const startTime2 = Date.now();
      registry.getRenderer('mock1');
      const endTime2 = Date.now();
      
      // Cached lookup should be faster or equal
      expect(endTime2 - startTime2).toBeLessThanOrEqual(endTime1 - startTime1);
    });
  });
});