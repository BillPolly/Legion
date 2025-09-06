/**
 * TextPreprocessor - Prepares raw text for intelligent processing while preserving semantic context
 * 
 * Responsibilities:
 * - Encoding normalization (UTF-8 standardization, special character handling)
 * - Structure detection (paragraphs, lists, tables, headers)
 * - Noise reduction (remove formatting artifacts while preserving meaningful structure)
 * - Language detection (identify primary language for LLM processing)
 * - Sentence boundary detection (intelligent segmentation respecting domain terminology)
 */
export class TextPreprocessor {
  constructor(options = {}) {
    this.options = {
      preserveFormatting: false,
      detectLanguage: true,
      removeNoise: true,
      detectStructure: true,
      segmentSentences: true,
      ...options
    };
  }

  /**
   * Normalize text encoding to UTF-8 and handle special characters
   * @param {string} text - Input text
   * @returns {string} - Normalized text
   */
  normalizeEncoding(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Normalize Unicode characters
    let normalized = text.normalize('NFC');
    
    // Handle common encoding issues
    normalized = normalized
      .replace(/\uFEFF/g, '') // Remove BOM
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n');  // Convert remaining CR to LF

    return normalized;
  }

  /**
   * Detect document structure (paragraphs, headers, lists, etc.)
   * @param {string} text - Input text
   * @returns {Object} - Structure information
   */
  detectStructure(text) {
    const elements = [];
    const lines = text.split('\n');
    let currentElement = null;
    let listItems = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        // Empty line - finalize current element
        if (currentElement) {
          elements.push(currentElement);
          currentElement = null;
        }
        if (listItems.length > 0) {
          elements.push({
            type: 'list',
            items: listItems
          });
          listItems = [];
        }
        continue;
      }

      // Check for headers
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (currentElement) {
          elements.push(currentElement);
          currentElement = null;
        }
        if (listItems.length > 0) {
          elements.push({
            type: 'list',
            items: listItems
          });
          listItems = [];
        }
        elements.push({
          type: 'header',
          level: headerMatch[1].length,
          content: headerMatch[2]
        });
        continue;
      }

      // Check for list items
      const listMatch = line.match(/^[•\-\*]\s+(.+)$/);
      if (listMatch) {
        if (currentElement) {
          elements.push(currentElement);
          currentElement = null;
        }
        listItems.push(listMatch[1]);
        continue;
      }

      // Regular paragraph text
      if (listItems.length > 0) {
        elements.push({
          type: 'list',
          items: listItems
        });
        listItems = [];
      }
      
      if (!currentElement) {
        currentElement = {
          type: 'paragraph',
          content: line
        };
      } else {
        currentElement.content += ' ' + line;
      }
    }

    // Finalize remaining elements
    if (currentElement) {
      elements.push(currentElement);
    }
    if (listItems.length > 0) {
      elements.push({
        type: 'list',
        items: listItems
      });
    }

    return {
      type: 'document',
      elements: elements
    };
  }

  /**
   * Remove formatting artifacts and excessive whitespace while preserving meaningful structure
   * @param {string} text - Input text
   * @returns {string} - Cleaned text
   */
  removeNoise(text) {
    if (!text) return '';

    let cleaned = text;

    // Replace various types of whitespace with regular spaces
    cleaned = cleaned
      .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ') // Non-breaking spaces, em spaces, etc.
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n[ \t]+/g, '\n') // Remove leading whitespace on lines
      .replace(/[ \t]+\n/g, '\n') // Remove trailing whitespace on lines
      .replace(/\n{3,}/g, '\n\n'); // Multiple newlines to double newline

    // Trim overall
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Detect the primary language of the text
   * @param {string} text - Input text
   * @returns {string} - Language code (e.g., 'en', 'es', 'fr') or 'unknown'
   */
  detectLanguage(text) {
    if (!text || text.trim().length === 0) {
      return 'unknown';
    }

    // Simple heuristic-based language detection
    // In a real implementation, you might use a library like franc or langdetect
    
    // Common English words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
    
    const words = text.toLowerCase().split(/\s+/);
    const englishWordCount = words.filter(word => englishWords.includes(word)).length;
    const englishRatio = englishWordCount / words.length;

    // If more than 10% of words are common English words, assume English
    if (englishRatio > 0.1 || words.length < 5) {
      return 'en';
    }

    // Default to unknown for now
    return 'unknown';
  }

  /**
   * Detect sentence boundaries with domain-aware segmentation
   * @param {string} text - Input text
   * @returns {Array<string>} - Array of sentences
   */
  detectSentenceBoundaries(text) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Simple sentence splitting for now - split on sentence-ending punctuation followed by space and capital letter
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 0);
    
    // If no sentences found, return the whole text as one sentence
    if (sentences.length === 0) {
      return [text.trim()];
    }
    
    return sentences.map(s => s.trim());
  }

  /**
   * Process text through the complete preprocessing pipeline
   * @param {string} text - Input text
   * @returns {Object} - Processed text with metadata
   */
  process(text) {
    const startTime = Date.now();
    const originalText = text || '';

    // Step 1: Normalize encoding
    const normalizedText = this.normalizeEncoding(originalText);

    // Step 2: Remove noise
    const cleanedText = this.options.removeNoise ? 
      this.removeNoise(normalizedText) : normalizedText;

    // Step 3: Detect structure
    const structure = this.options.detectStructure ? 
      this.detectStructure(cleanedText) : null;

    // Step 4: Detect language
    const language = this.options.detectLanguage ? 
      this.detectLanguage(cleanedText) : 'unknown';

    // Step 5: Segment sentences
    const sentences = this.options.segmentSentences ? 
      this.detectSentenceBoundaries(cleanedText) : [cleanedText];

    // Generate metadata
    const metadata = {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
      originalLength: originalText.length,
      normalizedLength: cleanedText.length,
      sentenceCount: sentences.length,
      structureElementCount: structure ? structure.elements.length : 0,
      language: language,
      options: { ...this.options }
    };

    return {
      originalText,
      normalizedText: cleanedText,
      structure,
      language,
      sentences,
      metadata
    };
  }
}
