/**
 * StreamingParser - Progressive loading and streaming for large documents
 * 
 * Handles large documents by parsing them incrementally in chunks,
 * providing progressive loading experience and preventing UI blocking.
 */

export class StreamingParser {
  constructor(options = {}) {
    this.options = {
      chunkSize: 64 * 1024, // 64KB chunks
      maxProcessingTime: 16, // Max 16ms per chunk (60fps)
      batchSize: 100, // Max nodes per batch
      priorityThreshold: 1024 * 1024, // 1MB - use streaming above this
      bufferTime: 5, // 5ms buffer between chunks
      enableWorker: false, // Web worker support (future)
      ...options
    };

    this.destroyed = false;
    this.activeStreams = new Map();
    this.streamId = 0;
    
    // Progress tracking
    this.progress = {
      total: 0,
      processed: 0,
      currentChunk: 0,
      totalChunks: 0
    };
    
    // Performance metrics
    this.metrics = {
      chunksProcessed: 0,
      totalProcessingTime: 0,
      averageChunkTime: 0,
      nodesCreated: 0,
      memoryUsed: 0
    };
    
    // Callbacks
    this.callbacks = {
      progress: [],
      chunk: [],
      complete: [],
      error: [],
      cancel: []
    };
  }

  /**
   * Start streaming parse of content
   */
  async parseStream(content, parser, options = {}) {
    if (this.destroyed) {
      throw new Error('StreamingParser has been destroyed');
    }

    const streamId = ++this.streamId;
    const shouldStream = this._shouldUseStreaming(content, options);
    
    if (!shouldStream) {
      // Use regular parsing for small content
      return this._parseRegular(content, parser, options);
    }

    const streamInfo = {
      id: streamId,
      content,
      parser,
      options,
      startTime: performance.now(),
      canceled: false,
      chunks: [],
      results: [],
      currentIndex: 0
    };

    this.activeStreams.set(streamId, streamInfo);

    try {
      return await this._parseStreaming(streamInfo);
    } catch (error) {
      this._notifyError(streamId, error);
      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Parse large document progressively
   */
  async parseProgressive(content, parser, options = {}) {
    const streamId = ++this.streamId;
    const progressiveOptions = {
      ...options,
      progressive: true,
      yieldInterval: options.yieldInterval || 10 // Yield every 10 nodes
    };

    const streamInfo = {
      id: streamId,
      content,
      parser,
      options: progressiveOptions,
      startTime: performance.now(),
      canceled: false,
      progressive: true,
      partialResults: {
        title: 'Loading...',
        children: [],
        metadata: { loading: true, progress: 0 }
      }
    };

    this.activeStreams.set(streamId, streamInfo);

    try {
      return await this._parseProgressively(streamInfo);
    } catch (error) {
      this._notifyError(streamId, error);
      throw error;
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Cancel active stream
   */
  cancelStream(streamId) {
    const streamInfo = this.activeStreams.get(streamId);
    if (streamInfo) {
      streamInfo.canceled = true;
      this._notifyCancel(streamId);
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Cancel all active streams
   */
  cancelAll() {
    const streamIds = Array.from(this.activeStreams.keys());
    streamIds.forEach(id => this.cancelStream(id));
  }

  /**
   * Get active stream info
   */
  getStreamInfo(streamId) {
    const streamInfo = this.activeStreams.get(streamId);
    if (!streamInfo) return null;

    return {
      id: streamInfo.id,
      progress: this._calculateProgress(streamInfo),
      startTime: streamInfo.startTime,
      elapsedTime: performance.now() - streamInfo.startTime,
      canceled: streamInfo.canceled
    };
  }

  /**
   * Get all active streams
   */
  getActiveStreams() {
    return Array.from(this.activeStreams.keys()).map(id => this.getStreamInfo(id));
  }

  /**
   * Should use streaming for this content
   * @private
   */
  _shouldUseStreaming(content, options = {}) {
    if (options.forceStreaming) return true;
    if (options.disableStreaming) return false;
    
    // Use streaming for large content
    if (typeof content === 'string') {
      return content.length > this.options.priorityThreshold;
    }
    
    // For objects, estimate size
    try {
      const estimated = JSON.stringify(content).length;
      return estimated > this.options.priorityThreshold;
    } catch (e) {
      // If can't stringify, assume it's large
      return true;
    }
  }

  /**
   * Parse using regular method
   * @private
   */
  async _parseRegular(content, parser, options) {
    const startTime = performance.now();
    
    try {
      const result = await parser.parse(content, options);
      
      // Track metrics
      this.metrics.totalProcessingTime += performance.now() - startTime;
      this.metrics.nodesCreated += this._countNodes(result);
      
      return result;
    } catch (error) {
      throw new Error(`Parse error: ${error.message}`);
    }
  }

  /**
   * Parse using streaming method
   * @private
   */
  async _parseStreaming(streamInfo) {
    const { content, parser, options } = streamInfo;
    
    // Split content into chunks
    const chunks = this._createChunks(content);
    streamInfo.chunks = chunks;
    
    this.progress.totalChunks = chunks.length;
    this.progress.currentChunk = 0;
    this.progress.total = content.length;
    this.progress.processed = 0;

    const results = [];
    let partialContent = '';
    
    for (let i = 0; i < chunks.length; i++) {
      if (streamInfo.canceled) {
        throw new Error('Stream canceled');
      }

      const chunk = chunks[i];
      partialContent += chunk;
      
      const chunkStartTime = performance.now();
      
      try {
        // Try to parse accumulated content
        const chunkResult = await this._parseChunk(partialContent, parser, options);
        
        if (chunkResult) {
          results.push(chunkResult);
          this._notifyChunk(streamInfo.id, chunkResult, i, chunks.length);
        }
      } catch (error) {
        // If parsing fails, continue to next chunk
        console.warn(`Chunk ${i} parsing failed:`, error.message);
      }
      
      // Update progress
      this.progress.currentChunk = i + 1;
      this.progress.processed += chunk.length;
      this._notifyProgress(streamInfo.id, this.progress);
      
      // Track metrics
      const chunkTime = performance.now() - chunkStartTime;
      this.metrics.chunksProcessed++;
      this.metrics.totalProcessingTime += chunkTime;
      this.metrics.averageChunkTime = this.metrics.totalProcessingTime / this.metrics.chunksProcessed;
      
      // Yield control if processing took too long
      if (chunkTime > this.options.maxProcessingTime) {
        await this._yield();
      }
      
      // Small buffer between chunks
      if (this.options.bufferTime > 0) {
        await this._sleep(this.options.bufferTime);
      }
    }

    // Final parse with complete content
    const finalResult = await parser.parse(content, options);
    this.metrics.nodesCreated += this._countNodes(finalResult);
    
    this._notifyComplete(streamInfo.id, finalResult);
    return finalResult;
  }

  /**
   * Parse progressively yielding partial results
   * @private
   */
  async _parseProgressively(streamInfo) {
    const { content, parser, options } = streamInfo;
    
    // Parse in background while yielding partial results
    let nodeCount = 0;
    let processedNodes = 0;
    
    // Create a custom parser wrapper that yields periodically
    const progressiveParser = {
      ...parser,
      parse: async (content, parseOptions) => {
        const originalResult = await parser.parse(content, parseOptions);
        
        // Process tree progressively
        const progressiveResult = await this._processTreeProgressively(
          originalResult, 
          streamInfo,
          (partial, progress) => {
            this._notifyChunk(streamInfo.id, partial, progress.processed, progress.total);
          }
        );
        
        return progressiveResult;
      }
    };

    const result = await progressiveParser.parse(content, options);
    this.metrics.nodesCreated += this._countNodes(result);
    
    this._notifyComplete(streamInfo.id, result);
    return result;
  }

  /**
   * Process tree progressively
   * @private
   */
  async _processTreeProgressively(tree, streamInfo, progressCallback) {
    const totalNodes = this._countNodes(tree);
    let processedNodes = 0;
    
    const partialTree = {
      title: tree.title || 'Loading...',
      content: tree.content || '',
      children: [],
      metadata: {
        ...tree.metadata,
        loading: true,
        progress: 0,
        totalNodes
      }
    };

    // Process children in batches
    if (tree.children && tree.children.length > 0) {
      const batchSize = this.options.batchSize;
      
      for (let i = 0; i < tree.children.length; i += batchSize) {
        if (streamInfo.canceled) {
          throw new Error('Stream canceled');
        }

        const batch = tree.children.slice(i, i + batchSize);
        const processedBatch = await this._processBatch(batch, streamInfo);
        
        partialTree.children.push(...processedBatch);
        processedNodes += batch.length;
        
        // Update progress
        const progress = {
          processed: processedNodes,
          total: totalNodes,
          percentage: Math.round((processedNodes / totalNodes) * 100)
        };
        
        partialTree.metadata.progress = progress.percentage;
        
        // Notify progress
        progressCallback(partialTree, progress);
        
        // Yield control
        await this._yield();
      }
    }

    // Mark as complete
    partialTree.metadata.loading = false;
    partialTree.metadata.progress = 100;
    
    return partialTree;
  }

  /**
   * Process batch of nodes
   * @private
   */
  async _processBatch(nodes, streamInfo) {
    const startTime = performance.now();
    const processedNodes = [];
    
    for (const node of nodes) {
      if (streamInfo.canceled) {
        break;
      }

      // Process node recursively if it has children
      if (node.children && node.children.length > 0) {
        const processedChildren = await this._processBatch(node.children, streamInfo);
        processedNodes.push({
          ...node,
          children: processedChildren
        });
      } else {
        processedNodes.push(node);
      }
      
      // Check if we need to yield
      if (performance.now() - startTime > this.options.maxProcessingTime) {
        await this._yield();
      }
    }
    
    return processedNodes;
  }

  /**
   * Create content chunks
   * @private
   */
  _createChunks(content) {
    if (typeof content !== 'string') {
      // For non-string content, return as single chunk
      return [content];
    }

    const chunks = [];
    const chunkSize = this.options.chunkSize;
    
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * Parse individual chunk
   * @private
   */
  async _parseChunk(content, parser, options) {
    try {
      // For streaming, we might want to parse partial content
      // This depends on the parser's capability
      if (parser.parsePartial) {
        return await parser.parsePartial(content, options);
      } else {
        // Try regular parse, might fail for incomplete content
        return await parser.parse(content, options);
      }
    } catch (error) {
      // Return null for failed chunks, will be retried with more content
      return null;
    }
  }

  /**
   * Calculate progress for stream
   * @private
   */
  _calculateProgress(streamInfo) {
    if (streamInfo.progressive) {
      return streamInfo.partialResults?.metadata?.progress || 0;
    }

    const totalLength = streamInfo.content?.length || 0;
    if (totalLength === 0) return 0;

    const processedLength = streamInfo.chunks
      ?.slice(0, streamInfo.currentIndex)
      ?.reduce((sum, chunk) => sum + chunk.length, 0) || 0;

    return Math.round((processedLength / totalLength) * 100);
  }

  /**
   * Count nodes in tree
   * @private
   */
  _countNodes(tree, count = 0) {
    if (!tree || typeof tree !== 'object') return count;
    
    count++; // Count current node
    
    if (tree.children && Array.isArray(tree.children)) {
      for (const child of tree.children) {
        count = this._countNodes(child, count);
      }
    }
    
    return count;
  }

  /**
   * Yield control to prevent blocking
   * @private
   */
  async _yield() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Sleep for specified time
   * @private
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Notify progress
   * @private
   */
  _notifyProgress(streamId, progress) {
    this.callbacks.progress.forEach(callback => {
      try {
        callback(streamId, progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  /**
   * Notify chunk processed
   * @private
   */
  _notifyChunk(streamId, chunk, index, total) {
    this.callbacks.chunk.forEach(callback => {
      try {
        callback(streamId, chunk, index, total);
      } catch (error) {
        console.error('Error in chunk callback:', error);
      }
    });
  }

  /**
   * Notify completion
   * @private
   */
  _notifyComplete(streamId, result) {
    this.callbacks.complete.forEach(callback => {
      try {
        callback(streamId, result);
      } catch (error) {
        console.error('Error in complete callback:', error);
      }
    });
  }

  /**
   * Notify error
   * @private
   */
  _notifyError(streamId, error) {
    this.callbacks.error.forEach(callback => {
      try {
        callback(streamId, error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  /**
   * Notify cancellation
   * @private
   */
  _notifyCancel(streamId) {
    this.callbacks.cancel.forEach(callback => {
      try {
        callback(streamId);
      } catch (error) {
        console.error('Error in cancel callback:', error);
      }
    });
  }

  /**
   * Add progress callback
   */
  onProgress(callback) {
    this.callbacks.progress.push(callback);
    return () => {
      const index = this.callbacks.progress.indexOf(callback);
      if (index > -1) {
        this.callbacks.progress.splice(index, 1);
      }
    };
  }

  /**
   * Add chunk callback
   */
  onChunk(callback) {
    this.callbacks.chunk.push(callback);
    return () => {
      const index = this.callbacks.chunk.indexOf(callback);
      if (index > -1) {
        this.callbacks.chunk.splice(index, 1);
      }
    };
  }

  /**
   * Add complete callback
   */
  onComplete(callback) {
    this.callbacks.complete.push(callback);
    return () => {
      const index = this.callbacks.complete.indexOf(callback);
      if (index > -1) {
        this.callbacks.complete.splice(index, 1);
      }
    };
  }

  /**
   * Add error callback
   */
  onError(callback) {
    this.callbacks.error.push(callback);
    return () => {
      const index = this.callbacks.error.indexOf(callback);
      if (index > -1) {
        this.callbacks.error.splice(index, 1);
      }
    };
  }

  /**
   * Add cancel callback
   */
  onCancel(callback) {
    this.callbacks.cancel.push(callback);
    return () => {
      const index = this.callbacks.cancel.indexOf(callback);
      if (index > -1) {
        this.callbacks.cancel.splice(index, 1);
      }
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeStreams: this.activeStreams.size,
      efficiency: this.metrics.chunksProcessed > 0 
        ? this.metrics.nodesCreated / this.metrics.chunksProcessed 
        : 0
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      chunksProcessed: 0,
      totalProcessingTime: 0,
      averageChunkTime: 0,
      nodesCreated: 0,
      memoryUsed: 0
    };
  }

  /**
   * Destroy
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Cancel all active streams
    this.cancelAll();
    
    // Clear callbacks
    this.callbacks = {
      progress: [],
      chunk: [],
      complete: [],
      error: [],
      cancel: []
    };
    
    // Reset state
    this.activeStreams.clear();
    this.resetMetrics();
  }
}