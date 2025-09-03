/**
 * RAGEngine - Retrieval-Augmented Generation engine
 * 
 * Combines semantic search with LLM response generation
 * Provides intelligent responses with source citations
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import { LLMClient } from '@legion/llm';

export default class RAGEngine {
  constructor({ searchEngine, llmClient, resourceManager, options = {} }) {
    if (!searchEngine) {
      throw new Error('SearchEngine is required');
    }
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.searchEngine = searchEngine;
    this.llmClient = llmClient;
    this.resourceManager = resourceManager;
    
    this.options = {
      maxContextTokens: 4000,
      defaultModel: 'claude-3-5-sonnet-20241022',
      includeCitations: true,
      responseMaxLength: 1000,
      searchLimit: 5,
      searchThreshold: 0.3,
      ...options
    };

    this.initialized = false;
  }

  /**
   * Initialize RAG engine services
   */
  async initialize() {
    if (this.initialized) return;

    // Create LLM client if not provided
    if (!this.llmClient) {
      const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
      
      if (!anthropicKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for RAG responses');
      }
      
      this.llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: anthropicKey,
        model: this.options.defaultModel
      });
    }

    this.initialized = true;
  }

  /**
   * Execute complete RAG query workflow
   */
  async query(query, options = {}) {
    await this.initialize();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    const startTime = Date.now();

    try {
      // Step 1: Execute semantic search within specific workspace
      const searchOptions = {
        workspace: options.workspace || 'default',  // Search within specific workspace
        limit: options.searchLimit || this.options.searchLimit,
        threshold: options.searchThreshold || this.options.searchThreshold,
        includeContext: true,
        includeRelevanceScore: true
      };

      const searchResults = await this.searchEngine.search(query, searchOptions);

      // Step 2: Assemble context from search results
      const context = this.assembleContext(searchResults, {
        maxTokens: this.options.maxContextTokens,
        includeCitations: options.includeSourceCitations !== false
      });

      // Step 3: Generate LLM prompt
      const prompt = this.generatePrompt(query, context, {
        responseStyle: options.responseStyle || 'detailed',
        responseMaxLength: options.responseMaxLength || this.options.responseMaxLength
      });

      // Step 4: Get LLM response
      const llmStartTime = Date.now();
      const maxTokens = Math.floor(options.responseMaxLength || this.options.responseMaxLength || 1000);
      const llmResponse = await this.llmClient.complete(prompt, maxTokens);
      const llmTime = Date.now() - llmStartTime;

      // Step 5: Process and analyze response
      const cleanedResponse = this.cleanResponse(llmResponse);
      const sourceAnalysis = this.analyzeResponseSources(cleanedResponse, searchResults);

      const totalTime = Date.now() - startTime;

      return {
        query,
        response: cleanedResponse,
        sources: searchResults.map((result, index) => ({
          content: result.content,
          source: result.source,
          similarity: result.similarity,
          usedInResponse: sourceAnalysis.usedSources.includes(index)
        })),
        llmMetadata: {
          model: this.options.defaultModel,
          responseTime: llmTime,
          tokensUsed: this.estimateTokenCount(cleanedResponse),
          promptTokens: this.estimateTokenCount(prompt)
        },
        searchResults: searchResults.length,
        searchTime: totalTime - llmTime,
        totalTime
      };

    } catch (error) {
      throw new Error(`RAG query failed: ${error.message}`);
    }
  }

  /**
   * Assemble context text from search results
   */
  assembleContext(searchResults, options = {}) {
    const {
      maxTokens = this.options.maxContextTokens,
      includeCitations = this.options.includeCitations
    } = options;

    if (!searchResults || searchResults.length === 0) {
      return {
        contextText: '',
        sources: [],
        tokenCount: 0
      };
    }

    let contextText = '';
    let currentTokens = 0;
    const includedSources = [];

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      
      // Format source entry
      let sourceEntry = result.content;
      
      if (includeCitations) {
        const sourceName = this.extractSourceName(result.source);
        sourceEntry += `\n[Source: ${sourceName}]`;
      }
      
      // Estimate tokens for this entry
      const entryTokens = this.estimateTokenCount(sourceEntry);
      
      // Check if adding this entry would exceed limit
      if (currentTokens + entryTokens > maxTokens && contextText.length > 0) {
        break;
      }
      
      if (contextText.length > 0) {
        contextText += '\n\n';
      }
      contextText += sourceEntry;
      currentTokens += entryTokens;
      includedSources.push(result);
    }

    return {
      contextText,
      sources: includedSources,
      tokenCount: currentTokens
    };
  }

  /**
   * Generate LLM prompt for RAG query
   */
  generatePrompt(query, context, options = {}) {
    const {
      responseStyle = 'detailed',
      responseMaxLength = this.options.responseMaxLength
    } = options;

    const styleInstructions = {
      detailed: 'Provide a comprehensive and detailed response with step-by-step explanations.',
      concise: 'Provide a brief and direct response focusing on key points only.'
    };

    const instruction = styleInstructions[responseStyle] || styleInstructions.detailed;

    return `You are a helpful AI assistant that provides accurate information based on documentation.

QUERY: ${query}

CONTEXT INFORMATION:
${context.contextText}

INSTRUCTIONS:
- ${instruction}
- Base your response primarily on the provided context information
- If you reference specific information, mention the source when possible
- If the context doesn't contain enough information to fully answer the question, say so
- Keep your response under ${responseMaxLength} characters
- Be accurate and helpful

Please provide your response:`;
  }

  /**
   * Clean and format LLM response
   */
  cleanResponse(response) {
    if (!response || typeof response !== 'string') {
      return '';
    }

    return response
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
  }

  /**
   * Analyze which sources were referenced in the LLM response
   */
  analyzeResponseSources(response, sources) {
    const usedSources = [];
    const unusedSources = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const sourceName = this.extractSourceName(source.source);
      
      // Check if source is referenced in response
      const isReferenced = response.includes(sourceName) || 
                          response.includes(source.source) ||
                          this.hasContentOverlap(response, source.content);
      
      if (isReferenced) {
        usedSources.push(i);
      } else {
        unusedSources.push(i);
      }
    }

    return {
      usedSources,
      unusedSources,
      sourceUtilization: sources.length > 0 ? usedSources.length / sources.length : 0
    };
  }

  /**
   * Check for content overlap between response and source
   */
  hasContentOverlap(response, sourceContent) {
    const responseWords = response.toLowerCase().split(/\s+/);
    const sourceWords = sourceContent.toLowerCase().split(/\s+/);
    
    // Count overlapping significant words (longer than 3 characters)
    const significantWords = sourceWords.filter(word => word.length > 3);
    const overlappingWords = significantWords.filter(word => 
      responseWords.includes(word)
    );
    
    // Consider overlap significant if 30% or more of source words appear
    return overlappingWords.length / Math.max(1, significantWords.length) >= 0.3;
  }

  /**
   * Extract readable source name from source path/URL
   */
  extractSourceName(source) {
    try {
      if (source.startsWith('file://')) {
        const path = source.replace('file://', '');
        return path.split('/').pop() || 'Unknown File';
      }
      
      if (source.startsWith('http')) {
        const url = new URL(source);
        return url.pathname.split('/').pop() || url.hostname;
      }
      
      return source;
    } catch (error) {
      return 'Unknown Source';
    }
  }

  /**
   * Estimate token count for text
   */
  estimateTokenCount(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    
    // Improved estimation based on OpenAI's approach
    // ~4 characters per token on average, with adjustments for complexity
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const avgTokensPerWord = 1.3; // Account for subword tokenization
    
    return Math.ceil(words.length * avgTokensPerWord);
  }

  /**
   * Validate RAG query options
   */
  static validateQueryOptions(options) {
    if (options.searchLimit !== undefined && (typeof options.searchLimit !== 'number' || options.searchLimit <= 0)) {
      throw new Error('searchLimit must be a positive number');
    }
    
    if (options.searchThreshold !== undefined && (typeof options.searchThreshold !== 'number' || options.searchThreshold < 0 || options.searchThreshold > 1)) {
      throw new Error('searchThreshold must be between 0 and 1');
    }
    
    if (options.responseMaxLength !== undefined && (typeof options.responseMaxLength !== 'number' || options.responseMaxLength <= 0)) {
      throw new Error('responseMaxLength must be a positive number');
    }
    
    return true;
  }

  /**
   * Get RAG engine statistics
   */
  getStatistics() {
    return {
      options: this.options,
      initialized: this.initialized,
      hasLLMClient: !!this.llmClient,
      hasSearchEngine: !!this.searchEngine
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.searchEngine && this.searchEngine.cleanup) {
      await this.searchEngine.cleanup();
    }
    
    this.initialized = false;
  }
}