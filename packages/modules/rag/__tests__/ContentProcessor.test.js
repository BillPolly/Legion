import { describe, it, expect, beforeEach } from '@jest/globals';
import ContentProcessor from '../src/processors/ContentProcessor.js';
import ChunkingStrategy from '../src/processors/ChunkingStrategy.js';

describe('ContentProcessor', () => {
  let contentProcessor;

  beforeEach(() => {
    contentProcessor = new ContentProcessor({
      defaultChunkSize: 800,
      defaultOverlap: 0.2,
      maxFileSize: 1024 * 1024  // 1MB
    });
  });

  describe('constructor', () => {
    it('should create instance with correct properties', () => {
      expect(contentProcessor.options.defaultChunkSize).toBe(800);
      expect(contentProcessor.options.defaultOverlap).toBe(0.2);
      expect(contentProcessor.chunkingStrategy).toBeInstanceOf(ChunkingStrategy);
    });

    it('should throw error without options', () => {
      expect(() => {
        new ContentProcessor();
      }).toThrow('Configuration options are required');
    });
  });

  describe('file type detection', () => {
    it('should detect file types by extension', () => {
      expect(contentProcessor.detectFileType('document.txt')).toBe('text/plain');
      expect(contentProcessor.detectFileType('readme.md')).toBe('text/markdown');
      expect(contentProcessor.detectFileType('config.json')).toBe('application/json');
      expect(contentProcessor.detectFileType('script.js')).toBe('text/javascript');
      expect(contentProcessor.detectFileType('app.py')).toBe('text/python');
      expect(contentProcessor.detectFileType('page.html')).toBe('text/html');
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(contentProcessor.detectFileType('file.xyz')).toBe('application/octet-stream');
      expect(contentProcessor.detectFileType('noextension')).toBe('application/octet-stream');
    });

    it('should handle case insensitive extensions', () => {
      expect(contentProcessor.detectFileType('README.MD')).toBe('text/markdown');
      expect(contentProcessor.detectFileType('Script.JS')).toBe('text/javascript');
    });
  });

  describe('content type support', () => {
    it('should identify supported content types', () => {
      expect(contentProcessor.isSupported('text/plain')).toBe(true);
      expect(contentProcessor.isSupported('text/markdown')).toBe(true);
      expect(contentProcessor.isSupported('application/json')).toBe(true);
      expect(contentProcessor.isSupported('text/javascript')).toBe(true);
      
      expect(contentProcessor.isSupported('image/png')).toBe(false);
      expect(contentProcessor.isSupported('application/pdf')).toBe(false);
    });
  });

  describe('content processing', () => {
    it('should process plain text content', async () => {
      const content = 'This is plain text content. It has multiple sentences. Each sentence should be processed correctly.';
      
      const result = await contentProcessor.processContent(content, 'text/plain', {
        source: 'file:///test.txt'
      });
      
      expect(result.document).toBeDefined();
      expect(result.document.title).toBe('test.txt');
      expect(result.document.contentType).toBe('text/plain');
      expect(result.document.contentHash).toBeDefined();
      
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Each chunk should have required properties
      result.chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.chunkIndex).toBeDefined();
        expect(chunk.contentHash).toBeDefined();
        expect(chunk.charStart).toBeDefined();
        expect(chunk.charEnd).toBeDefined();
        expect(chunk.tokenCount).toBeGreaterThan(0);
      });
    });

    it('should process markdown content with structure preservation', async () => {
      const markdown = `# Main Title

This is introduction content.

## Section One

Content for section one with details.

### Subsection

More detailed content here.`;

      const result = await contentProcessor.processContent(markdown, 'text/markdown', {
        source: 'file:///readme.md'
      });
      
      expect(result.document.contentType).toBe('text/markdown');
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Check that headings are preserved in metadata
      const chunkWithSubsection = result.chunks.find(chunk => 
        chunk.content.includes('detailed content')
      );
      
      if (chunkWithSubsection) {
        expect(chunkWithSubsection.metadata.headings).toContain('Main Title');
      }
    });

    it('should process JSON content', async () => {
      const jsonContent = `{
  "name": "test-config",
  "version": "1.0.0",
  "description": "A test configuration file",
  "settings": {
    "database": {
      "host": "localhost",
      "port": 27017
    }
  }
}`;

      const result = await contentProcessor.processContent(jsonContent, 'application/json', {
        source: 'file:///config.json'
      });
      
      expect(result.document.contentType).toBe('application/json');
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // JSON should be processed as structured text
      expect(result.chunks[0].content).toContain('test-config');
    });

    it('should process code content with syntax awareness', async () => {
      const codeContent = `function calculateSum(a, b) {
  // Add two numbers together
  return a + b;
}

function calculateProduct(a, b) {
  // Multiply two numbers
  return a * b;
}

export { calculateSum, calculateProduct };`;

      const result = await contentProcessor.processContent(codeContent, 'text/javascript', {
        source: 'file:///math.js'
      });
      
      expect(result.document.contentType).toBe('text/javascript');
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Code chunks should preserve function boundaries when possible
      const functionChunk = result.chunks.find(chunk => 
        chunk.content.includes('function calculateSum')
      );
      
      if (functionChunk) {
        expect(functionChunk.content).toContain('return a + b');
      }
    });
  });

  describe('content cleaning and normalization', () => {
    it('should normalize whitespace', async () => {
      const messyContent = `This  has   irregular\t\tspaces.


Multiple   blank    lines.`;

      const result = await contentProcessor.processContent(messyContent, 'text/plain', {
        source: 'file:///messy.txt'
      });
      
      result.chunks.forEach(chunk => {
        // Should not have excessive whitespace
        expect(chunk.content).not.toMatch(/\s{3,}/);
        expect(chunk.content).not.toMatch(/\n{3,}/);
      });
    });

    it('should handle different encodings', async () => {
      const content = 'Content with special characters: café, naïve, résumé';
      
      const result = await contentProcessor.processContent(content, 'text/plain', {
        source: 'file:///special.txt',
        encoding: 'utf-8'
      });
      
      expect(result.chunks[0].content).toContain('café');
      expect(result.chunks[0].content).toContain('naïve');
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported content type', async () => {
      await expect(
        contentProcessor.processContent('content', 'image/png', {
          source: 'file:///image.png'
        })
      ).rejects.toThrow('Unsupported content type: image/png');
    });

    it('should throw error for empty content', async () => {
      await expect(
        contentProcessor.processContent('', 'text/plain', {
          source: 'file:///empty.txt'
        })
      ).rejects.toThrow('Content cannot be empty');
    });

    it('should throw error for missing metadata', async () => {
      await expect(
        contentProcessor.processContent('content', 'text/plain')
      ).rejects.toThrow('Metadata with source is required');
    });

    it('should throw error for content exceeding size limit', async () => {
      const hugeSizeProcessor = new ContentProcessor({
        defaultChunkSize: 800,
        maxFileSize: 100  // Very small limit
      });

      const largeContent = 'x'.repeat(200);
      
      await expect(
        hugeSizeProcessor.processContent(largeContent, 'text/plain', {
          source: 'file:///large.txt'
        })
      ).rejects.toThrow('Content size exceeds maximum allowed');
    });
  });

  describe('metadata extraction', () => {
    it('should extract basic metadata from content', async () => {
      const content = 'Test content with multiple sentences. Each sentence is meaningful.';
      
      const result = await contentProcessor.processContent(content, 'text/plain', {
        source: 'file:///test.txt'
      });
      
      expect(result.document.fileSize).toBe(content.length);
      expect(result.document.totalChunks).toBe(result.chunks.length);
      expect(result.document.title).toBe('test.txt');
      expect(result.document.sourceType).toBe('file');
    });

    it('should extract title from different source types', async () => {
      const content = 'Test content';
      
      // File source
      const fileResult = await contentProcessor.processContent(content, 'text/plain', {
        source: 'file:///docs/readme.md'
      });
      expect(fileResult.document.title).toBe('readme.md');
      
      // URL source
      const urlResult = await contentProcessor.processContent(content, 'text/html', {
        source: 'https://example.com/docs/guide.html'
      });
      expect(urlResult.document.title).toBe('guide.html');
    });
  });

  describe('chunk validation', () => {
    it('should validate chunk data before processing', () => {
      const validChunks = [
        {
          content: 'Valid chunk content',
          chunkIndex: 0,
          charStart: 0,
          charEnd: 18,
          contentHash: 'abc123'
        }
      ];
      
      expect(() => {
        contentProcessor.validateChunks(validChunks);
      }).not.toThrow();
    });

    it('should throw error for invalid chunk data', () => {
      const invalidChunks = [
        {
          // Missing content
          chunkIndex: 0,
          charStart: 0,
          charEnd: 10,
          contentHash: 'abc123'
        }
      ];
      
      expect(() => {
        contentProcessor.validateChunks(invalidChunks);
      }).toThrow('Chunk 0 missing required property: content');
    });
  });
});