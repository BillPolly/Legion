import { describe, it, expect } from '@jest/globals';
import ChunkingStrategy from '../src/processors/ChunkingStrategy.js';

describe('ChunkingStrategy', () => {
  let chunkingStrategy;

  beforeEach(() => {
    chunkingStrategy = new ChunkingStrategy();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      expect(chunkingStrategy.options.defaultChunkSize).toBe(800);
      expect(chunkingStrategy.options.defaultOverlap).toBe(0.2);
      expect(chunkingStrategy.options.minChunkSize).toBe(200);
      expect(chunkingStrategy.options.maxChunkSize).toBe(2000);
    });

    it('should accept custom options', () => {
      const customStrategy = new ChunkingStrategy({
        defaultChunkSize: 1000,
        defaultOverlap: 0.3
      });
      
      expect(customStrategy.options.defaultChunkSize).toBe(1000);
      expect(customStrategy.options.defaultOverlap).toBe(0.3);
    });
  });

  describe('basic chunking', () => {
    it('should chunk simple text into appropriately sized pieces', () => {
      const text = 'This is a simple sentence. This is another sentence. This is a third sentence. This is a fourth sentence. This is a fifth sentence. This is a sixth sentence.';
      
      const chunks = chunkingStrategy.chunk(text, { chunkSize: 100 });
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should be reasonably sized
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(150); // Some flexibility
        expect(chunk.content.length).toBeGreaterThan(50); // Minimum size
      });
    });

    it('should preserve sentence boundaries', () => {
      const text = 'First sentence here. Second sentence here. Third sentence here.';
      
      const chunks = chunkingStrategy.chunk(text, { chunkSize: 40 });
      
      // Check that sentences aren't broken mid-word
      chunks.forEach(chunk => {
        const content = chunk.content.trim();
        if (content.includes('.')) {
          // If chunk contains periods, it should end with complete sentences
          expect(content).toMatch(/\.$|\.\s+\w/); // Ends with period or period + space + word
        }
      });
    });

    it('should handle overlap between chunks', () => {
      const text = 'Sentence one here. Sentence two here. Sentence three here. Sentence four here. Sentence five here.';
      
      const chunks = chunkingStrategy.chunk(text, { 
        chunkSize: 60, 
        overlap: 0.3 
      });
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Check for content overlap between adjacent chunks
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentChunk = chunks[i].content;
        const nextChunk = chunks[i + 1].content;
        
        // Find overlapping words
        const currentWords = currentChunk.split(/\s+/);
        const nextWords = nextChunk.split(/\s+/);
        
        // Should have some overlapping words
        const hasOverlap = currentWords.some(word => 
          nextWords.includes(word) && word.length > 3
        );
        expect(hasOverlap).toBe(true);
      }
    });
  });

  describe('content structure preservation', () => {
    it('should preserve markdown headings in context', () => {
      const markdown = `# Main Heading
      
This is introduction text.

## Subsection

This is subsection content with details.

### Sub-subsection

More detailed content here.`;

      const chunks = chunkingStrategy.chunk(markdown, { chunkSize: 80 });
      
      // Each chunk should include heading context
      chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        if (chunk.content.includes('introduction text')) {
          expect(chunk.metadata.headings).toContain('Main Heading');
        }
        if (chunk.content.includes('subsection content')) {
          expect(chunk.metadata.headings).toContain('Subsection');
        }
      });
    });

    it('should handle code blocks appropriately', () => {
      const textWithCode = `Here's some documentation.

\`\`\`javascript
function example() {
  return "code";
}
\`\`\`

More documentation here.`;

      const chunks = chunkingStrategy.chunk(textWithCode, { chunkSize: 100 });
      
      // Code blocks should be preserved intact when possible
      const codeChunk = chunks.find(chunk => 
        chunk.content.includes('function example')
      );
      
      if (codeChunk) {
        expect(codeChunk.metadata.codeBlocks).toBe(true);
        // Code block should be complete if it fits in chunk size
        expect(codeChunk.content).toContain('function example');
        expect(codeChunk.content).toContain('return "code"');
      }
    });

    it('should handle list items intelligently', () => {
      const textWithList = `Here are the steps:

1. First step item
2. Second step item  
3. Third step item

End of list.`;

      const chunks = chunkingStrategy.chunk(textWithList, { chunkSize: 80 });
      
      const listChunk = chunks.find(chunk => 
        chunk.content.includes('First step')
      );
      
      if (listChunk) {
        expect(listChunk.metadata.listItems).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty text', () => {
      const chunks = chunkingStrategy.chunk('', { chunkSize: 100 });
      expect(chunks).toEqual([]);
    });

    it('should handle very short text', () => {
      const chunks = chunkingStrategy.chunk('Short.', { chunkSize: 100 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Short.');
    });

    it('should handle text shorter than chunk size', () => {
      const shortText = 'This is short text.';
      const chunks = chunkingStrategy.chunk(shortText, { chunkSize: 1000 });
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(shortText);
    });

    it('should handle very long sentences', () => {
      const longSentence = 'This is a very long sentence that goes on and on and contains many words and clauses and should be handled appropriately by the chunking algorithm even though it exceeds the target chunk size significantly.';
      
      const chunks = chunkingStrategy.chunk(longSentence, { chunkSize: 100 });
      
      expect(chunks.length).toBeGreaterThan(0);
      // Long sentence should be split even if it breaks sentence boundary
      if (chunks.length > 1) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
        expect(totalLength).toBeGreaterThanOrEqual(longSentence.length * 0.8); // Account for overlap
      }
    });
  });

  describe('chunk metadata', () => {
    it('should include character positions in chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      
      const chunks = chunkingStrategy.chunk(text, { chunkSize: 30 });
      
      chunks.forEach((chunk, index) => {
        expect(chunk.charStart).toBeDefined();
        expect(chunk.charEnd).toBeDefined();
        expect(chunk.charEnd).toBeGreaterThan(chunk.charStart);
        
        // Verify character positions are accurate
        const extractedContent = text.substring(chunk.charStart, chunk.charEnd);
        expect(extractedContent).toContain(chunk.content.trim());
      });
    });

    it('should estimate token counts', () => {
      const text = 'This is a test sentence with multiple words for token counting.';
      
      const chunks = chunkingStrategy.chunk(text, { chunkSize: 100 });
      
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeDefined();
        expect(chunk.tokenCount).toBeGreaterThan(0);
        // Rough estimate: 1 token per 4 characters
        const expectedTokens = Math.ceil(chunk.content.length / 4);
        expect(chunk.tokenCount).toBeLessThanOrEqual(expectedTokens * 1.5); // Allow some variance
      });
    });

    it('should include chunk index in metadata', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      
      const chunks = chunkingStrategy.chunk(text, { chunkSize: 40 });
      
      chunks.forEach((chunk, index) => {
        expect(chunk.chunkIndex).toBe(index);
      });
    });
  });

  describe('customization options', () => {
    it('should respect custom chunk size', () => {
      const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here. Sixth sentence here.';
      
      const smallChunks = chunkingStrategy.chunk(text, { chunkSize: 50 });
      const largeChunks = chunkingStrategy.chunk(text, { chunkSize: 200 });
      
      expect(smallChunks.length).toBeGreaterThan(largeChunks.length);
    });

    it('should respect custom overlap settings', () => {
      const text = 'Sentence one here. Sentence two here. Sentence three here. Sentence four here.';
      
      const noOverlap = chunkingStrategy.chunk(text, { 
        chunkSize: 50, 
        overlap: 0 
      });
      
      const withOverlap = chunkingStrategy.chunk(text, { 
        chunkSize: 50, 
        overlap: 0.3 
      });
      
      // With overlap should produce more chunks due to repeated content
      expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
    });
  });
});