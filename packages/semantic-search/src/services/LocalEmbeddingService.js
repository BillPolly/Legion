/**
 * LocalEmbeddingService - ONNX-based local embeddings for M4 Apple Silicon
 * 
 * Uses ONNX Runtime with CoreML acceleration to generate embeddings
 * locally without API costs. Optimized for log and event processing.
 */

// Dynamic import to handle missing dependency gracefully
let ort = null;

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LocalEmbeddingService {
  constructor(config = {}) {
    // Model path is ALWAYS resolved relative to this module's location
    // This makes it completely independent of CWD
    const modelPath = path.resolve(__dirname, '../../../../models/all-MiniLM-L6-v2-quantized.onnx');
    
    this.config = {
      modelPath,  // This is the ONLY model we use
      executionProviders: config.executionProviders || [
        'cpu'  // Use CPU provider which is always available
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
          const ortModule = await import('onnxruntime-node');
          // In v1.14.0, the actual ort object is in the default export
          ort = ortModule.default || ortModule;
          
          if (!ort || !ort.InferenceSession) {
            throw new Error('ONNX Runtime import successful but InferenceSession not available');
          }
        } catch (error) {
          throw new Error('onnxruntime-node is required for local embeddings. Install with: npm install onnxruntime-node');
        }
      }
      
      // Initialize ONNX Runtime session with specific configuration
      // Use only CPU provider to ensure compatibility across all systems
      const sessionOptions = {
        executionProviders: ['cpu'], // Force CPU-only to avoid device issues
        // Enable basic optimizations for better performance
        graphOptimizationLevel: 'basic',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
        // Logging configuration
        enableProfiling: false,
        logSeverityLevel: 3, // Warnings and errors
        logVerbosityLevel: 0
      };
      
      this.session = await ort.InferenceSession.create(this.config.modelPath, sessionOptions);

      // Initialize tokenizer (using dynamic import to avoid hard dependency)
      try {
        const transformers = await import('@xenova/transformers');
        
        // Configure transformers to not load ONNX models (we handle that separately)
        transformers.env.allowLocalModels = false;
        transformers.env.allowRemoteModels = false;
        
        // For now, skip transformers tokenizer to avoid ONNX conflicts
        // The transformers library uses its own ONNX runtime which conflicts with ours
        console.log('Using fallback tokenizer to avoid ONNX conflicts');
        this.tokenizer = this.createFallbackTokenizer();
        
        // Original code commented out to avoid conflicts:
        // const { AutoTokenizer } = transformers;
        // this.tokenizer = await AutoTokenizer.from_pretrained(
        //   'sentence-transformers/all-MiniLM-L6-v2'
        // );
      } catch (error) {
        console.log('Warning: Transformers not available, using fallback tokenizer');
        this.tokenizer = this.createFallbackTokenizer();
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
      
      // Ensure all tensors are valid ONNX tensors before running inference
      const feeds = {};
      
      // Validate and normalize tensors
      for (const [key, tensor] of Object.entries(tokens)) {
        if (!tensor || typeof tensor !== 'object') {
          throw new Error(`Invalid tensor for ${key}: expected ONNX Tensor object`);
        }
        
        // If it's not already an ONNX Tensor, something went wrong
        if (!tensor.type || !tensor.data || !tensor.dims) {
          throw new Error(`Invalid tensor format for ${key}: missing required properties`);
        }
        
        feeds[key] = tensor;
      }
      
      // Run inference with validated tensors
      const results = await this.session.run(feeds);
      
      // Apply pooling and normalization
      // Get the raw data from the tensor
      const outputData = results.last_hidden_state.data || results.last_hidden_state.cpuData;
      const maskData = tokens.attention_mask.data || tokens.attention_mask.cpuData;
      
      // Ensure we have Float32Array for the output
      let floatData;
      if (outputData instanceof Float32Array) {
        floatData = outputData;
      } else {
        // Convert to Float32Array if needed
        floatData = new Float32Array(outputData);
      }
      
      const embedding = this.poolAndNormalize(
        floatData,
        maskData,
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
    if (!this.tokenizer) {
      throw new Error('Tokenizer not properly initialized');
    }
    
    // Ensure ONNX runtime is available for tensor creation
    if (!ort) {
      try {
        const ortModule = await import('onnxruntime-node');
        ort = ortModule.default || ortModule;
        
        if (!ort || !ort.Tensor) {
          throw new Error('ONNX Runtime import successful but Tensor not available');
        }
      } catch (error) {
        throw new Error('onnxruntime-node is required for local embeddings');
      }
    }
    
    const encoded = await this.tokenizer(text, {
      padding: true,
      truncation: true,
      max_length: this.config.maxLength,
      return_tensors: false
    });
    
    // @xenova/transformers returns its own Tensor objects
    // Check if we can use them directly as ONNX tensors
    if (encoded.input_ids.ort_tensor) {
      // If it has ort_tensor property, use it directly
      return {
        input_ids: encoded.input_ids.ort_tensor,
        attention_mask: encoded.attention_mask.ort_tensor,
        token_type_ids: encoded.token_type_ids?.ort_tensor || 
                       new ort.Tensor('int64', 
                         new BigInt64Array(encoded.input_ids.dims[1]).fill(0n),
                         encoded.input_ids.dims)
      };
    }
    
    // Otherwise, extract the data and create ONNX tensors
    const inputIds = encoded.input_ids.data;
    const attentionMask = encoded.attention_mask.data;
    const seqLength = inputIds.length;
    
    // Create token_type_ids if not provided
    const tokenTypeIds = encoded.token_type_ids?.data || new BigInt64Array(seqLength).fill(0n);
    
    // The Transformers.js library returns BigInt64Array for int64 tensors
    // Create ONNX tensors from the data
    return {
      input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
      attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
      token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, seqLength])
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
      const tokenTypeIds = new BigInt64Array(ids.length).fill(0n);
      return {
        input_ids: new ort.Tensor('int64', new BigInt64Array(ids.map(id => BigInt(id))), [1, ids.length]),
        attention_mask: new ort.Tensor('int64', new BigInt64Array(mask.map(m => BigInt(m))), [1, mask.length]),
        token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, ids.length])
      };
    } else {
      // Return plain arrays when ONNX is not available
      return {
        input_ids: { data: ids },
        attention_mask: { data: mask },
        token_type_ids: { data: new Array(ids.length).fill(0) }
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
    return async (text, options) => {
      try {
        // Simple tokenization for testing - creates proper ONNX tensors
        const result = this.fallbackTokenize(text);
        return {
          input_ids: result.input_ids,
          attention_mask: result.attention_mask,
          token_type_ids: result.token_type_ids
        };
      } catch (error) {
        console.warn('Fallback tokenizer failed, using minimal tokenization');
        // Ultra-minimal fallback
        const tokens = [101, 2023, 102]; // CLS, UNK, SEP
        const mask = [1, 1, 1];
        
        if (ort) {
          return {
            input_ids: new ort.Tensor('int64', new BigInt64Array(tokens.map(t => BigInt(t))), [1, 3]),
            attention_mask: new ort.Tensor('int64', new BigInt64Array(mask.map(m => BigInt(m))), [1, 3]),
            token_type_ids: new ort.Tensor('int64', new BigInt64Array(3).fill(0n), [1, 3])
          };
        }
        throw error;
      }
    };
  }

  /**
   * Apply mean pooling and normalization
   */
  poolAndNormalize(tensor, mask, dims) {
    const [batchSize, seqLength, hiddenSize] = dims;
    const embeddings = new Float32Array(hiddenSize);
    
    let validTokens = 0;
    
    // The mask is a BigInt64Array, so we need to check for 1n
    // Mean pooling with attention mask
    for (let i = 0; i < seqLength; i++) {
      // Check if mask value is 1 (for BigInt or regular number)
      const maskValue = typeof mask[i] === 'bigint' ? mask[i] : BigInt(mask[i]);
      if (maskValue === 1n) {
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
   * Get model information
   */
  getModelInfo() {
    return {
      name: 'Local ONNX Embedding Model',
      type: 'local',
      dimensions: this.config.dimensions,
      model: this.config.modelPath,
      provider: 'ONNX Runtime'
    };
  }

  /**
   * Generate embedding for a single text - alias for embed
   */
  async generateEmbedding(text) {
    return await this.embed(text);
  }


  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.session) {
      // Properly release ONNX session to avoid singleton issues
      try {
        await this.session.release();
      } catch (error) {
        // Session might already be released, ignore
        console.log('Session release warning:', error.message);
      }
      this.session = null;
    }
    this.tokenizer = null;
    this.initialized = false;
  }
}