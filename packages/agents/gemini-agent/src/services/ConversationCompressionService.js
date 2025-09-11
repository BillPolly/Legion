/**
 * ConversationCompressionService - Ported from Gemini CLI client.ts compression logic
 * Handles automatic conversation compression when approaching token limits
 */

/**
 * Compression status enum (ported from Gemini CLI)
 */
export const CompressionStatus = {
  NOOP: 'noop',
  COMPRESSED: 'compressed', 
  COMPRESSION_FAILED_TOKEN_COUNT_ERROR: 'compression_failed_token_count_error',
  COMPRESSION_FAILED_INFLATED_TOKEN_COUNT: 'compression_failed_inflated_token_count'
};

/**
 * Service for managing conversation compression (ported from Gemini CLI)
 */
export class ConversationCompressionService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    
    // Compression thresholds (ported from Gemini CLI constants)
    this.COMPRESSION_TOKEN_THRESHOLD = 0.7; // Compress at 70% of token limit
    this.COMPRESSION_PRESERVE_THRESHOLD = 0.3; // Keep last 30% of conversation
    this.TOKEN_LIMIT = 20000; // More realistic limit for testing compression
    this.hasFailedCompressionAttempt = false;
  }

  /**
   * Check if conversation needs compression (ported from Gemini CLI logic)
   * @param {Array} conversationHistory - Conversation history
   * @param {boolean} force - Force compression regardless of threshold
   * @returns {boolean} Whether compression is needed
   */
  needsCompression(conversationHistory, force = false) {
    if (force) return true;
    if (this.hasFailedCompressionAttempt) return false;
    
    // Estimate token count (simplified from Gemini CLI)
    const estimatedTokens = this.estimateTokenCount(conversationHistory);
    const threshold = this.COMPRESSION_TOKEN_THRESHOLD * this.TOKEN_LIMIT;
    
    return estimatedTokens > threshold;
  }

  /**
   * Estimate token count for conversation (simplified from Gemini CLI)
   * @param {Array} conversationHistory - Conversation history
   * @returns {number} Estimated token count
   */
  estimateTokenCount(conversationHistory) {
    let totalTokens = 0;
    
    for (const turn of conversationHistory) {
      // Simple estimation: ~4 characters per token
      totalTokens += Math.ceil((turn.content || '').length / 4);
      
      // Add tokens for tool executions
      if (turn.tools && turn.tools.length > 0) {
        for (const tool of turn.tools) {
          totalTokens += Math.ceil(JSON.stringify(tool).length / 4);
        }
      }
    }
    
    return totalTokens;
  }

  /**
   * Compress conversation history (ported from Gemini CLI compression logic)
   * @param {Array} conversationHistory - Full conversation history
   * @param {Object} llmClient - LLM client for compression
   * @param {string} compressionPrompt - Compression prompt
   * @returns {Promise<Object>} Compression result
   */
  async compressConversation(conversationHistory, llmClient, compressionPrompt) {
    try {
      const originalTokenCount = this.estimateTokenCount(conversationHistory);
      
      // Calculate compression split point (ported from Gemini CLI)
      const preserveIndex = Math.floor(conversationHistory.length * (1 - this.COMPRESSION_PRESERVE_THRESHOLD));
      
      // Find appropriate conversation boundary (ported logic)
      let compressBeforeIndex = preserveIndex;
      while (
        compressBeforeIndex < conversationHistory.length &&
        conversationHistory[compressBeforeIndex]?.type === 'assistant'
      ) {
        compressBeforeIndex++;
      }
      
      const historyToCompress = conversationHistory.slice(0, compressBeforeIndex);
      const historyToKeep = conversationHistory.slice(compressBeforeIndex);
      
      // Build compression prompt (ported from Gemini CLI)
      const compressionInput = this.buildCompressionInput(historyToCompress, compressionPrompt);
      
      // Get compression summary from LLM
      const summary = await llmClient.complete(compressionInput);
      
      // Create compressed conversation (ported pattern)
      const compressedHistory = [
        {
          id: 'compression_summary',
          type: 'assistant', 
          content: `[CONVERSATION SUMMARY]\n\n${summary}`,
          tools: [],
          timestamp: new Date().toISOString(),
          isCompressed: true
        },
        ...historyToKeep
      ];
      
      const newTokenCount = this.estimateTokenCount(compressedHistory);
      
      return {
        compressedHistory,
        originalTokenCount,
        newTokenCount,
        compressionStatus: CompressionStatus.COMPRESSED,
        compressionRatio: newTokenCount / originalTokenCount
      };
      
    } catch (error) {
      this.hasFailedCompressionAttempt = true;
      return {
        compressedHistory: conversationHistory,
        originalTokenCount: this.estimateTokenCount(conversationHistory),
        newTokenCount: this.estimateTokenCount(conversationHistory),
        compressionStatus: CompressionStatus.COMPRESSION_FAILED_TOKEN_COUNT_ERROR,
        error: error.message
      };
    }
  }

  /**
   * Build compression input for LLM (ported from Gemini CLI)
   * @param {Array} historyToCompress - History to compress
   * @param {string} compressionPrompt - Compression prompt template
   * @returns {string} Complete compression prompt
   */
  buildCompressionInput(historyToCompress, compressionPrompt) {
    let conversationText = '';
    
    for (const turn of historyToCompress) {
      conversationText += `${turn.type.toUpperCase()}: ${turn.content}\n\n`;
      
      // Include tool executions in compression context
      if (turn.tools && turn.tools.length > 0) {
        for (const tool of turn.tools) {
          conversationText += `TOOL_EXECUTION: ${tool.name} -> ${JSON.stringify(tool.result)}\n`;
        }
        conversationText += '\n';
      }
    }
    
    return `${compressionPrompt}

CONVERSATION HISTORY TO COMPRESS:

${conversationText}

Please analyze this conversation and provide the compression summary.`;
  }

  /**
   * Reset compression state (for testing)
   */
  resetCompressionState() {
    this.hasFailedCompressionAttempt = false;
  }
}

export default ConversationCompressionService;