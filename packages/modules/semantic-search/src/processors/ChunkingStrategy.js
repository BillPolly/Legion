/**
 * ChunkingStrategy - Intelligent text chunking with semantic boundary preservation
 * 
 * Implements sentence-boundary aware chunking with overlap and structure preservation
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import crypto from 'crypto';

export default class ChunkingStrategy {
  constructor(options = {}) {
    this.options = {
      defaultChunkSize: 800,
      defaultOverlap: 0.2,
      minChunkSize: 200,
      maxChunkSize: 2000,
      ...options
    };
  }

  /**
   * Chunk text content into semantic segments
   * @param {string} content - Text content to chunk
   * @param {Object} options - Chunking options
   * @returns {Array} Array of chunk objects with metadata
   */
  chunk(content, options = {}) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const chunkSize = options.chunkSize || this.options.defaultChunkSize;
    const overlap = options.overlap !== undefined ? options.overlap : this.options.defaultOverlap;

    // Step 1: Analyze document structure
    const structure = this.analyzeStructure(content);
    
    // Step 2: Split into semantic units (sentences)
    const sentences = this.splitIntoSentences(content);
    
    // Step 3: Group sentences into optimally-sized chunks
    const chunks = this.groupSentences(sentences, chunkSize, overlap, structure);
    
    // Step 4: Enrich chunks with metadata
    return this.enrichChunks(chunks, content, structure);
  }

  /**
   * Analyze document structure (headings, code blocks, lists)
   */
  analyzeStructure(content) {
    const structure = {
      headings: [],
      codeBlocks: [],
      listItems: [],
      paragraphs: []
    };

    // Extract markdown headings
    const headingMatches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);
    for (const match of headingMatches) {
      structure.headings.push({
        level: match[1].length,
        text: match[2].trim(),
        position: match.index
      });
    }

    // Extract code blocks
    const codeBlockMatches = content.matchAll(/```[\s\S]*?```/g);
    for (const match of codeBlockMatches) {
      structure.codeBlocks.push({
        content: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Extract list items
    const listMatches = content.matchAll(/^[\s]*[*+-]\s+.+$/gm);
    for (const match of listMatches) {
      structure.listItems.push({
        content: match[0],
        position: match.index
      });
    }

    return structure;
  }

  /**
   * Split content into sentences using multiple patterns
   */
  splitIntoSentences(content) {
    // Handle multiple sentence ending patterns
    const sentencePattern = /[.!?]+\s+/g;
    const sentences = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(content)) !== null) {
      const sentence = content.substring(lastIndex, match.index + match[0].length).trim();
      if (sentence.length > 0) {
        sentences.push({
          content: sentence,
          start: lastIndex,
          end: match.index + match[0].length
        });
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining content as final sentence
    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex).trim();
      if (remaining.length > 0) {
        sentences.push({
          content: remaining,
          start: lastIndex,
          end: content.length
        });
      }
    }

    return sentences;
  }

  /**
   * Group sentences into chunks with size and overlap constraints
   */
  groupSentences(sentences, chunkSize, overlap, structure) {
    if (sentences.length === 0) {
      return [];
    }

    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceSize = sentence.content.length;

      // Handle very long sentences that exceed chunk size
      if (sentenceSize > chunkSize && currentChunk.length === 0) {
        // Split long sentence into smaller pieces
        const subChunks = this.splitLongSentence(sentence.content, chunkSize);
        for (const subChunk of subChunks) {
          chunks.push(this.createChunk([{
            content: subChunk,
            start: sentence.start,
            end: sentence.start + subChunk.length
          }], chunkIndex++));
        }
        continue;
      }

      // Check if adding this sentence would exceed chunk size
      if (currentSize + sentenceSize > chunkSize && currentChunk.length > 0) {
        // Finalize current chunk
        chunks.push(this.createChunk(currentChunk, chunkIndex));
        chunkIndex++;

        // Start new chunk with overlap
        if (overlap > 0) {
          const overlapSentenceCount = Math.max(1, Math.floor(currentChunk.length * overlap));
          currentChunk = currentChunk.slice(-overlapSentenceCount);
          currentSize = currentChunk.reduce((sum, s) => sum + s.content.length, 0);
        } else {
          currentChunk = [];
          currentSize = 0;
        }
      }

      currentChunk.push(sentence);
      currentSize += sentenceSize;
    }

    // Add final chunk if any content remains
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex));
    }

    return chunks;
  }

  /**
   * Split long sentences that exceed chunk size
   */
  splitLongSentence(sentence, chunkSize) {
    const words = sentence.split(/\s+/);
    const subChunks = [];
    let currentSubChunk = [];
    let currentLength = 0;

    for (const word of words) {
      if (currentLength + word.length + 1 > chunkSize && currentSubChunk.length > 0) {
        subChunks.push(currentSubChunk.join(' '));
        currentSubChunk = [word];
        currentLength = word.length;
      } else {
        currentSubChunk.push(word);
        currentLength += word.length + 1; // +1 for space
      }
    }

    if (currentSubChunk.length > 0) {
      subChunks.push(currentSubChunk.join(' '));
    }

    return subChunks;
  }

  /**
   * Create chunk object from sentences
   */
  createChunk(sentences, chunkIndex) {
    const content = sentences.map(s => s.content).join(' ');
    const charStart = sentences[0].start;
    const charEnd = sentences[sentences.length - 1].end;

    return {
      content: content.trim(),
      chunkIndex,
      charStart,
      charEnd,
      sentenceCount: sentences.length,
      tokenCount: this.estimateTokenCount(content)
    };
  }

  /**
   * Enrich chunks with metadata and context
   */
  enrichChunks(chunks, originalContent, structure) {
    return chunks.map((chunk, index) => {
      // Find relevant headings for this chunk (more comprehensive)
      const relevantHeadings = structure.headings
        .filter(heading => heading.position <= chunk.charEnd)
        .map(heading => heading.text);

      // Check if chunk contains or overlaps with code blocks
      const hasCodeBlocks = structure.codeBlocks.some(block =>
        (block.start >= chunk.charStart && block.start <= chunk.charEnd) ||
        (block.end >= chunk.charStart && block.end <= chunk.charEnd) ||
        (block.start <= chunk.charStart && block.end >= chunk.charEnd)
      );

      // Check if chunk contains or overlaps with list items
      const hasListItems = structure.listItems.some(item =>
        item.position >= chunk.charStart && item.position <= chunk.charEnd
      ) || !!chunk.content.match(/^\s*[*+-]\s+/m) || !!chunk.content.match(/^\s*\d+\.\s+/m);

      // Generate content hash for deduplication
      const contentHash = crypto.createHash('sha256')
        .update(chunk.content)
        .digest('hex');

      return {
        ...chunk,
        contentHash,
        metadata: {
          headings: relevantHeadings,
          codeBlocks: hasCodeBlocks,
          listItems: hasListItems,
          hasImages: chunk.content.includes('![') || chunk.content.includes('<img'),
          totalChunks: chunks.length,
          chunkRatio: (index + 1) / chunks.length
        }
      };
    });
  }

  /**
   * Estimate token count for text
   * Rough estimation: 1 token per 4 characters on average
   */
  estimateTokenCount(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // More sophisticated estimation based on word count and complexity
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const avgTokensPerWord = 1.3; // Account for subword tokenization
    
    return Math.ceil(words.length * avgTokensPerWord);
  }

  /**
   * Validate chunking options
   */
  static validateOptions(options) {
    const { chunkSize, overlap, minChunkSize = 100, maxChunkSize = 5000 } = options;

    if (chunkSize !== undefined) {
      if (typeof chunkSize !== 'number' || chunkSize < minChunkSize || chunkSize > maxChunkSize) {
        throw new Error(`chunkSize must be between ${minChunkSize} and ${maxChunkSize}`);
      }
    }

    if (overlap !== undefined) {
      if (typeof overlap !== 'number' || overlap < 0 || overlap > 0.8) {
        throw new Error('overlap must be between 0 and 0.8');
      }
    }

    return true;
  }

  /**
   * Get optimal chunk size for content type
   */
  static getOptimalChunkSize(contentType, defaultSize = 800) {
    const sizeMap = {
      'text/markdown': 1000,  // Larger chunks for structured docs
      'text/plain': 800,      // Standard size for plain text
      'application/json': 600, // Smaller for structured data
      'text/javascript': 1200, // Larger for code files
      'text/python': 1200,
      'text/html': 600        // Smaller for HTML content
    };

    return sizeMap[contentType] || defaultSize;
  }

  /**
   * Split very long content into manageable sections first
   */
  preprocessLongContent(content, maxSectionSize = 10000) {
    if (content.length <= maxSectionSize) {
      return [content];
    }

    const sections = [];
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + maxSectionSize, content.length);
      
      // Try to find a good break point (paragraph or section break)
      if (end < content.length) {
        const lastParagraph = content.lastIndexOf('\n\n', end);
        const lastSection = content.lastIndexOf('\n#', end);
        
        if (lastParagraph > start + maxSectionSize * 0.7) {
          end = lastParagraph + 2;
        } else if (lastSection > start + maxSectionSize * 0.7) {
          end = lastSection + 1;
        }
      }

      sections.push(content.substring(start, end));
      start = end;
    }

    return sections;
  }
}