import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getLlama } from 'node-llama-cpp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class NomicEmbeddings {
  constructor() {
    // Check for available model files
    const modelsDir = path.join(__dirname, '../models');
    const possibleModels = [
      'nomic-embed-text-v1.5.f32.gguf',
      'nomic-embed-text-v1.5.f16.gguf',
      'nomic-embed-text-v1.5.Q8_0.gguf',
      'nomic-embed-text-v1.5.Q4_K_M.gguf',
      'nomic-embed-text-v1.5.Q2_K.gguf'
    ];
    
    // Find the first available model
    let modelFile = null;
    for (const model of possibleModels) {
      const modelPath = path.join(modelsDir, model);
      if (fs.existsSync(modelPath)) {
        modelFile = model;
        break;
      }
    }
    
    if (!modelFile) {
      throw new Error(`No GGUF model found in ${modelsDir}. Expected one of: ${possibleModels.join(', ')}`);
    }
    
    this.modelPath = path.join(modelsDir, modelFile);
    this.modelName = modelFile;
    this.dimensions = 768;
    this.initialized = false;
    this.llama = null;
    this.model = null;
    this.context = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Check if model exists
      if (!fs.existsSync(this.modelPath)) {
        throw new Error(`Model not found at ${this.modelPath}`);
      }

      console.log(`Loading model: ${this.modelName}`);
      
      // Do exactly what worked in the direct test
      this.llama = await getLlama({
        logLevel: 'error' 
      });

      this.model = await this.llama.loadModel({
        modelPath: this.modelPath,
        contextSize: 2048,
        batchSize: 512,
        threads: 4,
        logLevel: 'error'
      });

      this.context = await this.model.createEmbeddingContext({
        contextSize: 512,
        batchSize: 256
      });
      
      this.initialized = true;
      console.log(`NomicEmbeddings initialized successfully with ${this.modelName}`);
    } catch (error) {
      console.error('Failed to initialize NomicEmbeddings:', error);
      throw error;
    }
  }

  async embed(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Handle empty string - use a minimal placeholder
      if (!text || text.trim() === '') {
        text = '.'; // Use a single period as minimal meaningful text
      }
      
      // Handle very long text by truncating to prevent context overflow
      // Approximate max tokens - keep well below context size
      if (text.length > 2000) {
        text = text.substring(0, 2000);
      }
      
      const embedding = await this.context.getEmbeddingFor(text);
      return Array.from(embedding.vector);
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async embedBatch(texts) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Process embeddings in parallel chunks for better performance
    // CRITICAL: Processing 50+ embeddings sequentially takes 10-30 seconds
    // Parallel chunks of 10 reduce this to 1-3 seconds (10x faster!)
    const CHUNK_SIZE = 10;
    const embeddings = [];

    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      const chunk = texts.slice(i, i + CHUNK_SIZE);
      // Process this chunk in parallel
      const chunkEmbeddings = await Promise.all(
        chunk.map(text => this.embed(text))
      );
      embeddings.push(...chunkEmbeddings);
    }

    return embeddings;
  }

  async similarity(embedding1, embedding2) {
    // Compute cosine similarity - exactly like the working version
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (norm1 * norm2);
  }

  async findSimilar(queryEmbedding, documentEmbeddings, topK = 5) {
    const similarities = [];
    
    for (let i = 0; i < documentEmbeddings.length; i++) {
      const similarity = await this.similarity(queryEmbedding, documentEmbeddings[i]);
      similarities.push({ index: i, similarity });
    }
    
    // Sort by similarity descending and return top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, topK);
  }

  async close() {
    if (this.context) {
      this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.initialized = false;
  }
}