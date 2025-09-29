/**
 * Integration tests for HandleGlossGenerator with real LLM
 * Phase 2, Step 2.4-2.5: Generate glosses with real services
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';
import { HandleMetadataExtractor } from '../../src/HandleMetadataExtractor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('HandleGlossGenerator Integration', () => {
  let generator;
  let extractor;
  let llmClient;

  beforeAll(async () => {
    // Get ResourceManager and LLM client
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Create generator and extractor
    generator = new HandleGlossGenerator(llmClient);
    await generator.initialize();

    extractor = new HandleMetadataExtractor();
  }, 60000);

  describe('Filesystem Handle Gloss Generation', () => {
    it('should generate glosses for filesystem handle metadata', async () => {
      // Create filesystem handle metadata
      const fileHandleMetadata = {
        handleType: 'filesystem',
        path: '/test/sample-code.js',
        resourceDescription: 'JavaScript code file containing Express.js server implementation',
        capabilities: ['read', 'write'],
        metadata: {
          server: 'local',
          isFile: true
        }
      };

      // Generate glosses
      const glosses = await generator.generateGlosses(fileHandleMetadata);

      // Verify glosses were generated
      expect(glosses).toBeDefined();
      expect(Array.isArray(glosses)).toBe(true);
      expect(glosses.length).toBeGreaterThan(0);

      // Verify each gloss has required properties
      glosses.forEach(gloss => {
        expect(gloss.perspective).toBeDefined();
        expect(typeof gloss.perspective).toBe('string');
        expect(gloss.description).toBeDefined();
        expect(typeof gloss.description).toBe('string');
        expect(gloss.description.length).toBeGreaterThan(0);
        // Gloss should be descriptive (at least 20 chars)
        expect(gloss.description.length).toBeGreaterThanOrEqual(20);
        expect(gloss.keywords).toBeDefined();
        expect(Array.isArray(gloss.keywords)).toBe(true);
        expect(gloss.keywords.length).toBeGreaterThan(0);
      });
    }, 30000);

    it('should generate multiple perspectives', async () => {
      const fileHandleMetadata = {
        handleType: 'filesystem',
        path: '/config/api-settings.json',
        resourceDescription: 'JSON configuration file for API service settings',
        capabilities: ['read', 'write']
      };

      const glosses = await generator.generateGlosses(fileHandleMetadata);

      expect(glosses.length).toBeGreaterThanOrEqual(2);

      // Check for different perspectives
      const perspectives = glosses.map(g => g.perspective);
      const uniquePerspectives = new Set(perspectives);
      expect(uniquePerspectives.size).toBeGreaterThan(1);
    }, 30000);
  });

  describe('Generic Handle Gloss Generation', () => {
    it('should generate glosses for generic handle metadata', async () => {
      const genericMetadata = {
        handleType: 'custom-service',
        resourceDescription: 'Custom service handle for external API integration',
        capabilities: ['query', 'update', 'subscribe'],
        metadata: {
          server: 'remote',
          hasQueryMethod: true,
          hasUpdateMethod: true
        }
      };

      const glosses = await generator.generateGlosses(genericMetadata);

      expect(glosses).toBeDefined();
      expect(Array.isArray(glosses)).toBe(true);
      expect(glosses.length).toBeGreaterThan(0);

      glosses.forEach(gloss => {
        expect(gloss.perspective).toBeDefined();
        expect(gloss.description).toBeDefined();
        expect(gloss.keywords).toBeDefined();
      });
    }, 30000);
  });

  describe('End-to-End: Extract and Generate', () => {
    it('should extract metadata and generate glosses for simulated handle', async () => {
      // Create a simulated handle
      const mockHandle = {
        resourceType: 'filesystem',
        path: '/images/product-photo.png',
        server: 'local'
      };

      // Extract metadata
      const metadata = await extractor.extractMetadata(mockHandle);

      // Generate glosses
      const glosses = await generator.generateGlosses(metadata);

      expect(glosses).toBeDefined();
      expect(glosses.length).toBeGreaterThan(0);
      expect(glosses[0].description).toBeDefined();
      expect(glosses[0].keywords).toBeDefined();
    }, 30000);
  });
});