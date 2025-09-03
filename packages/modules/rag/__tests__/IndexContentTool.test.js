import { describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import IndexContentTool from '../src/tools/IndexContentTool.js';
import RAGModule from '../src/RAGModule.js';
import { ResourceManager } from '@legion/resource-manager';
import { promises as fs } from 'fs';
import path from 'path';

describe('IndexContentTool', () => {
  let indexContentTool;
  let semanticSearchModule;
  let resourceManager;
  let testDir;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    
    // Create test directory structure
    testDir = '/tmp/semantic-search-index-tool-test';
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    await fs.writeFile(path.join(testDir, 'guide.md'), `# User Guide

## Getting Started
This guide will help you get started with the system.

## Configuration
Set up your configuration files properly.

## Advanced Usage
Learn about advanced features and capabilities.`);

    await fs.writeFile(path.join(testDir, 'api.md'), `# API Documentation

## Endpoints
### GET /users
Retrieve user information.

### POST /users
Create new users.

## Authentication
Use API keys for authentication.`);

    await fs.writeFile(path.join(testDir, 'config.json'), JSON.stringify({
      database: {
        host: 'localhost',
        port: 27017,
        name: 'myapp'
      },
      server: {
        port: 3000,
        host: '0.0.0.0'
      }
    }, null, 2));
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    semanticSearchModule = await RAGModule.create(resourceManager);
    indexContentTool = semanticSearchModule.getTool('index_content');
    
    // Use unique database for workspace testing to avoid constraint issues
    semanticSearchModule.config.mongodb.database = 'semantic-index-tool-workspace-test';
  });

  afterEach(async () => {
    if (semanticSearchModule) {
      await semanticSearchModule.cleanup();
    }
  });

  describe('constructor and setup', () => {
    it('should create tool instance with correct metadata', () => {
      expect(indexContentTool).toBeDefined();
      expect(indexContentTool.name).toBe('index_content');
      expect(indexContentTool.description).toContain('Index content');
      expect(indexContentTool.semanticSearchModule).toBe(semanticSearchModule);
    });

    it('should have proper input schema validation', () => {
      const metadata = indexContentTool.getMetadata();
      expect(metadata.inputSchema).toBeDefined();
      expect(metadata.inputSchema.properties.source).toBeDefined();
      expect(metadata.inputSchema.properties.sourceType).toBeDefined();
      expect(metadata.inputSchema.required).toContain('source');
      expect(metadata.inputSchema.required).toContain('sourceType');
    });
  });

  describe('input validation', () => {
    it('should validate valid input', () => {
      const validInput = {
        workspace: 'test-docs',
        source: 'file:///test/directory',
        sourceType: 'directory',
        options: {
          recursive: true,
          fileTypes: ['.md', '.txt']
        }
      };

      const validation = indexContentTool.validateInput(validInput);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject input without workspace', () => {
      const invalidInput = {
        source: 'file:///test',
        sourceType: 'directory'
      };

      const validation = indexContentTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid sourceType', () => {
      const invalidInput = {
        workspace: 'test',
        source: '/test/path',
        sourceType: 'invalid-type'
      };

      const validation = indexContentTool.validateInput(invalidInput);
      expect(validation.valid).toBe(false);
    });
  });

  describe('single file indexing', () => {
    it('should index a single markdown file', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-docs',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file'
      });

      expect(result.success).toBe(true);
      expect(result.data.documentsIndexed).toBe(1);
      expect(result.data.chunksCreated).toBeGreaterThan(0);
      expect(result.data.vectorsIndexed).toBe(result.data.chunksCreated);
      expect(result.data.processingTime).toBeGreaterThan(0);
      expect(result.data.errors).toHaveLength(0);
    });

    it('should index a JSON file', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-json',
        source: path.join(testDir, 'config.json'),
        sourceType: 'file'
      });

      expect(result.success).toBe(true);
      expect(result.data.documentsIndexed).toBe(1);
      expect(result.data.summary.totalFiles).toBe(1);
    });
  });

  describe('directory indexing', () => {
    it('should index all files in a directory', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-directory',
        source: testDir,
        sourceType: 'directory',
        options: {
          recursive: false,
          fileTypes: ['.md', '.json']
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.documentsIndexed).toBe(3); // guide.md, api.md, config.json
      expect(result.data.chunksCreated).toBeGreaterThan(0);
      expect(result.data.vectorsIndexed).toBe(result.data.chunksCreated);
      expect(result.data.summary.totalFiles).toBe(3);
    });

    it('should filter files by type', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-filter',
        source: testDir,
        sourceType: 'directory',
        options: {
          recursive: false,
          fileTypes: ['.md'] // Only markdown files
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.documentsIndexed).toBe(2); // Only guide.md and api.md
      expect(result.data.summary.totalFiles).toBe(2);
    });

    it('should handle custom chunking options', async () => {
      const smallChunkResult = await indexContentTool.execute({
        workspace: 'test-small',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file',
        options: {
          chunkSize: 200, // Small chunks
          overlap: 0.3
        }
      });

      const largeChunkResult = await indexContentTool.execute({
        workspace: 'test-large',
        source: path.join(testDir, 'api.md'),
        sourceType: 'file',
        options: {
          chunkSize: 800, // Large chunks
          overlap: 0.1
        }
      });

      expect(smallChunkResult.success).toBe(true);
      expect(largeChunkResult.success).toBe(true);
      
      // Small chunks should typically create more chunks than large chunks for similar content
      expect(smallChunkResult.data.chunksCreated).toBeGreaterThan(0);
      expect(largeChunkResult.data.chunksCreated).toBeGreaterThan(0);
    });
  });

  describe('URL indexing', () => {
    it('should handle URL indexing attempt', async () => {
      // For MVP, we can test that it attempts URL processing
      const result = await indexContentTool.execute({
        workspace: 'test-web',
        source: 'https://httpbin.org/html',
        sourceType: 'url'
      });

      // Should either succeed or fail gracefully with proper error message
      if (result.success) {
        expect(result.data.documentsIndexed).toBe(1);
        expect(result.data.chunksCreated).toBeGreaterThan(0);
      } else {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });
  });

  describe('duplicate handling', () => {
    it('should detect and handle duplicate content', async () => {
      // Index the same file twice in same workspace
      const firstResult = await indexContentTool.execute({
        workspace: 'test-duplicates',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file'
      });

      const secondResult = await indexContentTool.execute({
        workspace: 'test-duplicates',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file'
      });

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);
      
      // Second indexing should detect duplicate
      expect(secondResult.data.documentsIndexed).toBe(1);
      expect(secondResult.data.summary.duplicatesSkipped).toBeGreaterThan(0);
    });

    it('should update existing content when requested', async () => {
      // First indexing
      await indexContentTool.execute({
        workspace: 'test-updates',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file'
      });

      // Update with updateExisting flag
      const updateResult = await indexContentTool.execute({
        workspace: 'test-updates',
        source: path.join(testDir, 'guide.md'),
        sourceType: 'file',
        options: {
          updateExisting: true
        }
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.documentsIndexed).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle missing source gracefully', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-errors',
        source: '/nonexistent/path',
        sourceType: 'file'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should handle invalid directory gracefully', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-errors',
        source: '/nonexistent/directory',
        sourceType: 'directory'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide detailed error information', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-errors',
        source: '/dev/null',
        sourceType: 'file'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeDefined(); // Should still provide partial data
    });
  });

  describe('progress tracking', () => {
    it('should emit progress events during indexing', async () => {
      const progressEvents = [];
      
      indexContentTool.on('progress', (data) => {
        progressEvents.push(data);
      });

      await indexContentTool.execute({
        workspace: 'test-progress',
        source: testDir,
        sourceType: 'directory',
        options: {
          fileTypes: ['.md']
        }
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Should have progress events for different stages
      const messages = progressEvents.map(e => e.message);
      expect(messages.some(m => m.includes('Starting'))).toBe(true);
    });
  });

  describe('indexing statistics', () => {
    it('should provide comprehensive indexing statistics', async () => {
      const result = await indexContentTool.execute({
        workspace: 'test-stats',
        source: testDir,
        sourceType: 'directory',
        options: {
          fileTypes: ['.md', '.json']
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalFiles).toBeGreaterThan(0);
      expect(result.data.summary.totalSize).toBeGreaterThan(0);
      expect(result.data.summary.avgChunksPerDoc).toBeGreaterThan(0);
      
      expect(result.data.processingTime).toBeGreaterThan(0);
      expect(result.data.errors).toBeDefined();
      expect(Array.isArray(result.data.errors)).toBe(true);
    });
  });
});