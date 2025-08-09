/**
 * LocalEmbeddingService - ONNX-based local embeddings for M4 Apple Silicon
 * 
 * Uses ONNX Runtime with CoreML acceleration to generate embeddings
 * locally without API costs. Optimized for log and event processing.
 */

// Dynamic import to handle missing dependency gracefully
let ort = null;

export class LocalEmbeddingService {
  constructor(config = {}) {
    this.config = {
      modelPath: config.modelPath || './models/all-MiniLM-L6-v2-quantized.onnx',
      executionProviders: config.executionProviders || [
        'CoreMLExecutionProvider',  // Use M4's Neural Engine
        'CPUExecutionProvider'
      ],
      pooling: config.pooling || 'mean',
      normalize: config.normalize || true,
      batchSize: config.batchSize || 100,
      dimensions: config.dimensions || 384,
      maxLength: config.maxLength || 256,
      ...config
    };
    
    this.session = null;
    this.tokenizer = null;
    this.initialized = false;
    this.totalEmbeddings = 0;
    this.totalTime = 0;
  }

  /**
   * Initialize the ONNX session and tokenizer
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('Loading local embedding model...');
      
      // Try to load ONNX Runtime
      if (!ort) {
        try {
          ort = await import('onnxruntime-node');
        } catch (error) {
          throw new Error('onnxruntime-node is required for local embeddings. Install with: npm install onnxruntime-node');
        }
      }
      
      // Initialize ONNX Runtime session
      this.session = await ort.InferenceSession.create(
        this.config.modelPath,
        {
          executionProviders: this.config.executionProviders,
          graphOptimizationLevel: 'all',
          executionMode: 'parallel',
          interOpNumThreads: 4,  // Use M4's performance cores
          intraOpNumThreads: 2
        }
      );

      // Initialize tokenizer (using dynamic import to avoid hard dependency)
      try {
        const { AutoTokenizer } = await import('@xenova/transformers');
        this.tokenizer = await AutoTokenizer.from_pretrained(
          'sentence-transformers/all-MiniLM-L6-v2'
        );
      } catch (error) {
        throw new Error(`Tokenizer initialization failed: ${error.message}. Install @xenova/transformers`);
      }

      this.initialized = true;
      console.log(`Local embedding service ready (${this.config.dimensions}d vectors)`);
      console.log('Using providers:', this.session.inputNames);
      
    } catch (error) {
      console.error('Failed to initialize local embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text) {
    if (!this.initialized) {
      throw new Error('LocalEmbeddingService not initialized');
    }

    const startTime = Date.now();
    
    try {
      // If no ONNX session available, raise error
      if (!this.session) {
        throw new Error('ONNX session not initialized. Local embedding model may be missing or corrupt.');
      }
      
      // Tokenize the text
      const tokens = await this.tokenize(text);
      
      // Run inference
      const results = await this.session.run({
        input_ids: tokens.input_ids,
        attention_mask: tokens.attention_mask
      });
      
      // Apply pooling and normalization
      const embedding = this.poolAndNormalize(
        results.last_hidden_state.data,
        tokens.attention_mask.data,
        results.last_hidden_state.dims
      );
      
      // Update stats
      this.totalEmbeddings++;
      this.totalTime += Date.now() - startTime;
      
      return embedding;
      
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedBatch(texts) {
    if (!texts || texts.length === 0) return [];
    
    // Process in smaller batches to avoid memory issues
    const batches = this.createBatches(texts, this.config.batchSize);
    const results = [];
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Generate embeddings - interface compatibility with OpenAIEmbeddingService
   */
  async generateEmbeddings(texts, options = {}) {
    if (!texts || texts.length === 0) return [];
    
    // Ensure texts is an array
    const textArray = Array.isArray(texts) ? texts : [texts];
    
    // Use batch processing
    return await this.embedBatch(textArray);
  }

  /**
   * Specialized embedding for log/event text
   */
  async embedLogEvent(event) {
    // Extract relevant text from event for embedding
    const text = this.extractEmbeddingText(event);
    return await this.embed(text);
  }

  /**
   * Extract relevant text from event for embedding
   */
  extractEmbeddingText(event) {
    const parts = [];
    
    // Event type and level
    if (event.type) parts.push(`Type: ${event.type}`);
    if (event.level) parts.push(`Level: ${event.level}`);
    
    // Main message or error
    if (event.message) parts.push(event.message);
    if (event.error?.message) parts.push(`Error: ${event.error.message}`);
    
    // Context information
    if (event.service) parts.push(`Service: ${event.service}`);
    if (event.eventType) parts.push(`Event: ${event.eventType}`);
    if (event.testName) parts.push(`Test: ${event.testName}`);
    
    // API call information
    if (event.method && event.url) {
      parts.push(`${event.method} ${event.url}`);
    }
    
    return parts.join('. ').substring(0, 512); // Reasonable length limit
  }

  /**
   * Tokenize text
   */
  async tokenize(text) {
    if (!this.tokenizer || !this.tokenizer.encode || !ort) {
      throw new Error('Tokenizer or ONNX runtime not properly initialized');
    }
    
    const encoded = await this.tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: this.config.maxLength,
      return_tensors: false
    });
    
    return {
      input_ids: new ort.Tensor('int64', encoded.input_ids.data, [1, encoded.input_ids.dims[1]]),
      attention_mask: new ort.Tensor('int64', encoded.attention_mask.data, [1, encoded.attention_mask.dims[1]])
    };
  }

  /**
   * Simple fallback tokenizer for when transformers is not available
   */
  fallbackTokenize(text) {
    // Very basic tokenization - not production ready but allows testing
    const words = text.toLowerCase().split(/\s+/).slice(0, this.config.maxLength);
    const ids = words.map(word => this.simpleHash(word) % 30000 + 100);
    const mask = new Array(ids.length).fill(1);
    
    // Pad to consistent length
    while (ids.length < 64) {
      ids.push(0);
      mask.push(0);
    }
    
    if (ort) {
      return {
        input_ids: new ort.Tensor('int64', new BigInt64Array(ids.map(id => BigInt(id))), [1, ids.length]),
        attention_mask: new ort.Tensor('int64', new BigInt64Array(mask.map(m => BigInt(m))), [1, mask.length])
      };
    } else {
      // Return plain arrays when ONNX is not available
      return {
        input_ids: { data: ids },
        attention_mask: { data: mask }
      };
    }
  }

  /**
   * Simple hash function for fallback tokenizer
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Create fallback tokenizer
   */
  createFallbackTokenizer() {
    return {
      encode: (text) => this.fallbackTokenize(text)
    };
  }

  /**
   * Apply mean pooling and normalization
   */
  poolAndNormalize(tensor, mask, dims) {
    const [batchSize, seqLength, hiddenSize] = dims;
    const embeddings = new Float32Array(hiddenSize);
    
    let validTokens = 0;
    
    // Mean pooling with attention mask
    for (let i = 0; i < seqLength; i++) {
      if (mask[i] === 1) {
        validTokens++;
        for (let j = 0; j < hiddenSize; j++) {
          embeddings[j] += tensor[i * hiddenSize + j];
        }
      }
    }
    
    // Average the embeddings
    if (validTokens > 0) {
      for (let j = 0; j < hiddenSize; j++) {
        embeddings[j] /= validTokens;
      }
    }
    
    // Normalize if requested
    if (this.config.normalize) {
      let norm = 0;
      for (let i = 0; i < hiddenSize; i++) {
        norm += embeddings[i] * embeddings[i];
      }
      norm = Math.sqrt(norm);
      
      if (norm > 0) {
        for (let i = 0; i < hiddenSize; i++) {
          embeddings[i] /= norm;
        }
      }
    }
    
    return Array.from(embeddings);
  }

  /**
   * Create batches from array
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const avgTime = this.totalEmbeddings > 0 ? this.totalTime / this.totalEmbeddings : 0;
    
    return {
      totalEmbeddings: this.totalEmbeddings,
      totalTime: this.totalTime,
      averageTime: avgTime,
      throughput: this.totalTime > 0 ? (this.totalEmbeddings / this.totalTime) * 1000 : 0,
      dimensions: this.config.dimensions,
      initialized: this.initialized,
      model: this.config.modelPath
    };
  }


  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.session) {
      // ONNX Runtime sessions don't need explicit cleanup in Node.js
      this.session = null;
    }
    this.tokenizer = null;
    this.initialized = false;
  }
}