/**
 * DocumentProcessor - Process documents for semantic search
 * 
 * Handles text extraction, cleaning, and preparation of documents
 * for embedding generation and semantic search.
 */

export class DocumentProcessor {
  constructor(config = {}) {
    this.config = {
      maxTextLength: 8000, // Max characters for embedding
      truncateStrategy: 'smart', // 'smart', 'end', 'start'
      includeMetadata: true,
      weightedFields: {
        name: 3.0,
        title: 2.5,
        description: 2.0,
        content: 1.0,
        tags: 1.5
      },
      ...config
    };
  }

  /**
   * Process a document for semantic search
   * @param {Object} document - Document to process
   * @param {Array<string>} textFields - Fields to extract text from
   * @returns {Object} - Processed document with searchable text
   */
  processDocument(document, textFields = null) {
    // Auto-detect text fields if not specified
    if (!textFields) {
      textFields = this._detectTextFields(document);
    }

    // Extract and combine text from specified fields
    const searchText = this._extractSearchText(document, textFields);

    // Clean and prepare text
    const cleanedText = this._cleanText(searchText);

    // Generate metadata for search enhancement
    const metadata = this._extractMetadata(document);

    return {
      ...document,
      searchText: cleanedText,
      _processedFields: textFields,
      _metadata: metadata,
      _processedAt: new Date().toISOString()
    };
  }

  /**
   * Process multiple documents in batch
   * @param {Array} documents - Documents to process
   * @param {Array<string>} textFields - Fields to extract text from
   * @returns {Array} - Processed documents
   */
  processDocuments(documents, textFields = null) {
    return documents.map(doc => this.processDocument(doc, textFields));
  }

  /**
   * Extract searchable text optimized for tool discovery
   * @param {Object} toolDocument - Tool document
   * @returns {Object} - Processed tool with enhanced search text
   */
  processToolForSearch(toolDocument) {
    const tool = { ...toolDocument };
    
    // Build comprehensive search text for tools
    const textParts = [];

    // Tool name (highest weight)
    if (tool.name) {
      textParts.push(`Tool: ${tool.name}`);
    }

    // Description (high weight)
    if (tool.description) {
      textParts.push(`Description: ${tool.description}`);
    }

    // Parameters and their descriptions
    if (tool.parameters || tool.inputSchema) {
      const params = tool.parameters || tool.inputSchema?.properties || {};
      const paramDescriptions = [];
      
      Object.entries(params).forEach(([name, spec]) => {
        if (typeof spec === 'object' && spec.description) {
          paramDescriptions.push(`${name}: ${spec.description}`);
        } else if (typeof spec === 'string') {
          paramDescriptions.push(`${name}: ${spec}`);
        }
      });
      
      if (paramDescriptions.length > 0) {
        textParts.push(`Parameters: ${paramDescriptions.join(', ')}`);
      }
    }

    // Module/category context
    if (tool.module) {
      textParts.push(`Module: ${tool.module}`);
    }

    if (tool.category) {
      textParts.push(`Category: ${tool.category}`);
    }

    // Tags for additional context
    if (tool.tags && Array.isArray(tool.tags)) {
      textParts.push(`Tags: ${tool.tags.join(', ')}`);
    }

    // Examples or usage patterns
    if (tool.examples) {
      const examples = Array.isArray(tool.examples) ? tool.examples : [tool.examples];
      textParts.push(`Examples: ${examples.join(', ')}`);
    }

    // Combine all text
    const searchText = textParts.join('. ');

    return {
      ...tool,
      searchText: this._cleanText(searchText),
      _toolProcessed: true,
      _processedAt: new Date().toISOString()
    };
  }

  /**
   * Create embeddings-optimized text for capabilities search
   * @param {string} capability - Natural language capability description
   * @returns {string} - Optimized search query
   */
  processCapabilityQuery(capability) {
    // Clean and normalize the capability query
    let processed = capability.toLowerCase().trim();
    
    // Expand common abbreviations and synonyms
    const expansions = {
      'auth': 'authentication authorize login security',
      'db': 'database data storage',
      'api': 'application programming interface endpoint',
      'ui': 'user interface frontend display',
      'file': 'document file system storage',
      'img': 'image picture photo graphics',
      'vid': 'video media multimedia',
      'net': 'network http request client',
      'json': 'json data format parsing',
      'xml': 'xml data format parsing',
      'csv': 'csv comma separated values data',
      'pdf': 'pdf document portable format',
      'zip': 'archive compression zip',
      'encrypt': 'encryption security cryptography',
      'hash': 'hashing cryptographic digest',
      'jwt': 'json web token authentication',
      'oauth': 'oauth authentication authorization',
      'sql': 'sql database query language',
      'regex': 'regular expression pattern matching',
      'ml': 'machine learning model algorithm',
      'ai': 'artificial intelligence',
      'dl': 'deep learning neural network',
      'nn': 'neural network',
      'nlp': 'natural language processing'
    };

    // Apply expansions
    Object.entries(expansions).forEach(([abbrev, expansion]) => {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      processed = processed.replace(regex, expansion);
    });

    // Add action context words
    if (/\b(need|want|require|looking for)\b/i.test(processed)) {
      processed += ' tool function capability';
    }

    return processed;
  }

  // ===================
  // Private methods
  // ===================

  /**
   * Auto-detect text fields in document
   * @private
   */
  _detectTextFields(document) {
    const textFields = [];
    const commonTextFields = [
      'name', 'title', 'description', 'content', 'summary',
      'text', 'body', 'details', 'info', 'documentation',
      'tags', 'keywords', 'category', 'type'
    ];

    Object.keys(document).forEach(key => {
      const value = document[key];
      
      // Include if it's a common text field
      if (commonTextFields.includes(key.toLowerCase())) {
        textFields.push(key);
        return;
      }

      // Include if it's a string with meaningful content
      if (typeof value === 'string' && value.length > 2) {
        textFields.push(key);
      }

      // Include if it's an array of strings
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        textFields.push(key);
      }

      // Include if it's an object (for nested data)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        textFields.push(key);
      }
    });

    return textFields;
  }

  /**
   * Extract and combine text from specified fields
   * @private
   */
  _extractSearchText(document, textFields) {
    const textParts = [];

    textFields.forEach(field => {
      const value = document[field];
      const weight = this.config.weightedFields[field] || 1.0;

      if (typeof value === 'string' && value.trim()) {
        // Repeat text based on weight (simple but effective)
        const repetitions = Math.ceil(weight);
        for (let i = 0; i < repetitions; i++) {
          textParts.push(value.trim());
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of strings (like tags)
        const arrayText = value
          .filter(item => typeof item === 'string')
          .join(' ');
        
        if (arrayText) {
          const repetitions = Math.ceil(weight);
          for (let i = 0; i < repetitions; i++) {
            textParts.push(arrayText);
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects (extract string values)
        const objectText = this._extractTextFromObject(value);
        if (objectText) {
          const repetitions = Math.ceil(weight);
          for (let i = 0; i < repetitions; i++) {
            textParts.push(objectText);
          }
        }
      }
    });

    return textParts.join(' ');
  }

  /**
   * Extract text from nested objects
   * @private
   */
  _extractTextFromObject(obj, maxDepth = 2, currentDepth = 0) {
    if (currentDepth >= maxDepth) return '';

    const textParts = [];

    Object.values(obj).forEach(value => {
      if (typeof value === 'string' && value.trim()) {
        textParts.push(value.trim());
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const nestedText = this._extractTextFromObject(value, maxDepth, currentDepth + 1);
        if (nestedText) {
          textParts.push(nestedText);
        }
      } else if (Array.isArray(value)) {
        const arrayText = value
          .filter(item => typeof item === 'string')
          .join(' ');
        if (arrayText) {
          textParts.push(arrayText);
        }
      }
    });

    return textParts.join(' ');
  }

  /**
   * Clean and prepare text for embedding
   * @private
   */
  _cleanText(text) {
    if (!text) return '';

    let cleaned = text;

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove special characters that don't add semantic value
    cleaned = cleaned.replace(/[^\w\s\-.,!?:;]/g, ' ');

    // Remove excessive punctuation
    cleaned = cleaned.replace(/[.,!?:;]{2,}/g, '.');

    // Normalize case (keep some capitalization for proper nouns)
    cleaned = cleaned.replace(/\b[A-Z]{2,}\b/g, match => 
      match.charAt(0) + match.slice(1).toLowerCase()
    );

    // Trim and handle length limits
    cleaned = cleaned.trim();

    if (cleaned.length > this.config.maxTextLength) {
      cleaned = this._truncateText(cleaned);
    }

    return cleaned;
  }

  /**
   * Intelligently truncate text
   * @private
   */
  _truncateText(text) {
    const maxLength = this.config.maxTextLength;

    if (this.config.truncateStrategy === 'smart') {
      // Try to break at sentence boundaries
      const sentences = text.split(/[.!?]+/);
      let result = '';
      
      for (const sentence of sentences) {
        if ((result + sentence).length > maxLength) {
          break;
        }
        result += sentence + '.';
      }
      
      return result || text.substring(0, maxLength);
    } else if (this.config.truncateStrategy === 'start') {
      return text.substring(0, maxLength);
    } else { // 'end'
      return text.substring(text.length - maxLength);
    }
  }

  /**
   * Extract metadata for search enhancement
   * @private
   */
  _extractMetadata(document) {
    const metadata = {
      hasName: !!document.name,
      hasDescription: !!document.description,
      fieldCount: Object.keys(document).length,
      textLength: 0,
      dataTypes: new Set()
    };

    // Analyze document structure
    Object.entries(document).forEach(([key, value]) => {
      const type = Array.isArray(value) ? 'array' : typeof value;
      metadata.dataTypes.add(type);

      if (typeof value === 'string') {
        metadata.textLength += value.length;
      }
    });

    metadata.dataTypes = Array.from(metadata.dataTypes);

    return metadata;
  }
}