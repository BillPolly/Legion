// Mock for @legion/nomic package
export class NomicEmbeddings {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  async embed(text) {
    // Return a mock 768-dimensional embedding
    return new Array(768).fill(0).map(() => Math.random() * 2 - 1);
  }

  async embedBatch(texts) {
    return Promise.all(texts.map(text => this.embed(text)));
  }
}