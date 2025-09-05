/**
 * ContextOptimizer - LLM-powered intelligent context optimization
 * 
 * Automatically optimizes agent context after each user request completion:
 * - Compresses chat history with semantic understanding
 * - Analyzes artifact relevance and discards stale variables
 * - Optimizes operation history while preserving learning value
 * - NEVER touches infrastructure variables (resourceActor, toolRegistry, etc.)
 * 
 * Design Principles:
 * - Fully modular and testable
 * - Pure functions with JSON in/out
 * - LLM-driven semantic decisions
 * - Infrastructure protection
 * - Zero user interaction required
 * - Uses PromptBuilder for consistent, validated prompts
 */

import { PromptBuilder } from './PromptBuilder.js';

export class ContextOptimizer {
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required for ContextOptimizer');
    }
    this.llmClient = llmClient;
    
    // Initialize prompt builder for consistent prompts
    this.promptBuilder = new PromptBuilder();
    
    // Infrastructure variables that must NEVER be touched
    this.protectedFields = new Set([
      'resourceActor',
      'toolRegistry', 
      'llmClient',
      'eventCallback',
      'parentActor',
      'remoteActor',
      'services'
    ]);
    
    // Configuration for optimization behavior
    this.config = {
      maxChatMessages: 15,      // Keep this many recent full messages
      maxOperations: 25,        // Keep this many recent operations  
      maxArtifacts: 50,         // Warning threshold for artifact count
      compressionRatio: 0.3,    // Target: compress to 30% of original size
      maxRetries: 3,            // Maximum LLM retry attempts
      retryDelay: 1000          // Delay between retries (ms)
    };
  }
  
  /**
   * Main entry point - optimize complete agent context
   * @param {Object} contextSnapshot - Complete agent state snapshot
   * @returns {Object} Optimized context with same structure
   */
  async optimizeContext(contextSnapshot) {
    console.log('[ContextOptimizer] Starting intelligent context optimization...');
    
    try {
      // Create deep copy to avoid mutating original
      const optimized = JSON.parse(JSON.stringify(contextSnapshot));
      
      // Parallel optimization for performance - but handle the case where artifacts are under the threshold
      const artifactCount = Object.keys(optimized.executionContext?.artifacts || {}).length;
      const operationCount = (optimized.operationHistory || []).length;
      
      const promises = [
        this.compressChatHistory(optimized.chatHistory || [], optimized.executionContext?.artifacts || {})
      ];
      
      // Only run artifact analysis if over threshold
      if (artifactCount >= this.config.maxArtifacts) {
        promises.push(this.analyzeArtifactRelevance(optimized.executionContext?.artifacts || {}, optimized));
      } else {
        promises.push(Promise.resolve({
          optimizedArtifacts: optimized.executionContext?.artifacts || {},
          changeStats: { kept: artifactCount, archived: 0, discarded: 0 }
        }));
      }
      
      // Only run operation optimization if over threshold
      if (operationCount > this.config.maxOperations) {
        promises.push(this.optimizeOperations(optimized.operationHistory || [], optimized.executionContext?.artifacts || {}));
      } else {
        promises.push(Promise.resolve({
          optimizedOperations: optimized.operationHistory || [],
          changeStats: { kept: operationCount, summarized: 0 }
        }));
      }
      
      const [
        chatOptimization,
        artifactAnalysis, 
        operationOptimization
      ] = await Promise.all(promises);
      
      // Apply optimizations
      optimized.chatHistory = chatOptimization.optimizedHistory;
      optimized.executionContext.artifacts = artifactAnalysis.optimizedArtifacts;
      optimized.operationHistory = operationOptimization.optimizedOperations;
      
      // Add optimization metadata for observability
      optimized._optimizationMetadata = {
        timestamp: new Date().toISOString(),
        chatCompression: chatOptimization.compressionStats,
        artifactChanges: artifactAnalysis.changeStats,
        operationChanges: operationOptimization.changeStats
      };
      
      console.log('[ContextOptimizer] ✅ Context optimization complete');
      return optimized;
      
    } catch (error) {
      console.error('[ContextOptimizer] ❌ Optimization failed:', error);
      // FAIL FAST - return original context if optimization fails
      // But still add empty optimization metadata to distinguish from unprocessed context
      const failureResult = JSON.parse(JSON.stringify(contextSnapshot));
      failureResult._optimizationMetadata = {
        timestamp: new Date().toISOString(),
        chatCompression: { original: 0, final: 0, compressed: 0 },
        artifactChanges: { kept: 0, archived: 0, discarded: 0 },
        operationChanges: { kept: 0, summarized: 0 },
        error: error.message
      };
      return failureResult;
    }
  }
  
  /**
   * Compress chat history using LLM semantic understanding
   * @param {Array} messages - Chat history messages
   * @param {Object} currentArtifacts - Current context artifacts
   * @returns {Object} Optimized chat history with compression stats
   */
  async compressChatHistory(messages, currentArtifacts) {
    if (messages.length <= this.config.maxChatMessages) {
      return {
        optimizedHistory: messages,
        compressionStats: { original: messages.length, final: messages.length, compressed: 0 }
      };
    }
    
    // Keep recent messages fully, compress older ones
    const recentMessages = messages.slice(-this.config.maxChatMessages);
    const oldMessages = messages.slice(0, -this.config.maxChatMessages);
    
    if (oldMessages.length === 0) {
      return {
        optimizedHistory: recentMessages,
        compressionStats: { original: messages.length, final: recentMessages.length, compressed: 0 }
      };
    }
    
    // Use PromptBuilder for consistent, validated prompts
    const prompt = this.promptBuilder.buildChatCompressionPrompt(oldMessages, currentArtifacts);
    console.log(`[ContextOptimizer] Generated chat compression prompt: ${prompt.length} chars`);

    // NO FALLBACKS - retry LLM calls using standard pattern
    const compressionResult = await this.retryLLMCall(async () => {
      const llmResponse = await this.llmClient.complete(prompt, 500);
      return this.extractJSON(llmResponse);
    }, 'chat history compression');
    
    // Create compressed history: summary + recent messages
    const optimizedHistory = [
      {
        role: 'system',
        content: `CHAT HISTORY SUMMARY: ${compressionResult.summary}`,
        timestamp: Date.now(),
        type: 'compressed_history',
        metadata: {
          compressedMessages: oldMessages.length,
          keyInsights: compressionResult.keyInsights || [],
          relevantToCurrentWork: compressionResult.relevantToCurrentWork || []
        }
      },
      ...recentMessages
    ];
    
    return {
      optimizedHistory,
      compressionStats: {
        original: messages.length,
        final: optimizedHistory.length,
        compressed: oldMessages.length
      }
    };
  }
  
  /**
   * Analyze artifact relevance using LLM semantic understanding
   * @param {Object} artifacts - Current context artifacts
   * @param {Object} fullContext - Complete context for analysis
   * @returns {Object} Optimized artifacts with change statistics
   */
  async analyzeArtifactRelevance(artifacts, fullContext) {
    const artifactKeys = Object.keys(artifacts);
    
    if (artifactKeys.length === 0) {
      return {
        optimizedArtifacts: artifacts,
        changeStats: { kept: 0, archived: 0, discarded: 0 }
      };
    }
    
    // Don't optimize if artifact count is manageable
    if (artifactKeys.length < this.config.maxArtifacts) {
      return {
        optimizedArtifacts: artifacts,
        changeStats: { kept: artifactKeys.length, archived: 0, discarded: 0 }
      };
    }
    
    // Use PromptBuilder for consistent, validated prompts
    const prompt = this.promptBuilder.buildArtifactAnalysisPrompt(artifacts, fullContext.operationHistory || []);
    console.log(`[ContextOptimizer] Generated artifact analysis prompt: ${prompt.length} chars`);

    // NO FALLBACKS - retry LLM calls using standard pattern
    const analysisResult = await this.retryLLMCall(async () => {
      const llmResponse = await this.llmClient.complete(prompt, 1000);
      return this.extractJSON(llmResponse);
    }, 'artifact relevance analysis');
    
    // Handle both detailed and compact analysis formats
    let analysis = {};
    if (analysisResult.analysis) {
      // Detailed format for smaller sets
      analysis = analysisResult.analysis;
    } else if (analysisResult.decisions) {
      // Compact format for large sets - convert to detailed format
      analysis = {};
      for (const [key, decision] of Object.entries(analysisResult.decisions)) {
        analysis[key] = { 
          decision, 
          reason: `Pattern-based decision for large set optimization` 
        };
      }
    }
    
    const optimizedArtifacts = {};
    const changeStats = { kept: 0, archived: 0, discarded: 0 };
    
    // Process each artifact based on LLM analysis
    for (const [key, value] of Object.entries(artifacts)) {
      const decision = analysis[key]?.decision || 'KEEP'; // Default to keep if not analyzed
      
      switch (decision) {
        case 'KEEP':
          optimizedArtifacts[key] = value;
          changeStats.kept++;
          break;
          
        case 'ARCHIVE':
          // Compress large values but keep reference
          optimizedArtifacts[`${key}_archived`] = {
            type: 'archived_variable',
            originalKey: key,
            summary: this.summarizeValue(value),
            archivedAt: new Date().toISOString(),
            reason: analysis[key]?.reason || 'Archived for space'
          };
          changeStats.archived++;
          break;
          
        case 'DISCARD':
          // Don't include in optimized artifacts
          changeStats.discarded++;
          break;
          
        default:
          // Unknown decision - keep to be safe
          optimizedArtifacts[key] = value;
          changeStats.kept++;
      }
    }
    
    return {
      optimizedArtifacts,
      changeStats
    };
  }
  
  /**
   * Optimize operation history while preserving learning value
   * @param {Array} operations - Operation history
   * @param {Object} currentArtifacts - Current artifacts for context
   * @returns {Object} Optimized operations with change statistics
   */
  async optimizeOperations(operations, currentArtifacts) {
    if (operations.length <= this.config.maxOperations) {
      return {
        optimizedOperations: operations,
        changeStats: { kept: operations.length, summarized: 0 }
      };
    }
    
    // Always keep recent operations and failed operations
    const recentOps = operations.slice(-this.config.maxOperations);
    const oldOps = operations.slice(0, -this.config.maxOperations);
    
    if (oldOps.length === 0) {
      return {
        optimizedOperations: recentOps,
        changeStats: { kept: recentOps.length, summarized: 0 }
      };
    }
    
    // Use PromptBuilder for consistent, validated prompts
    const prompt = this.promptBuilder.buildOperationOptimizationPrompt(oldOps, currentArtifacts);
    console.log(`[ContextOptimizer] Generated operation optimization prompt: ${prompt.length} chars`);

    // NO FALLBACKS - retry LLM calls using standard pattern
    const summaryResult = await this.retryLLMCall(async () => {
      const llmResponse = await this.llmClient.complete(prompt, 800);
      return this.extractJSON(llmResponse);
    }, 'operation history optimization');
    
    // Create optimized history: summary + recent operations
    const optimizedOperations = [
      {
        tool: 'operation_history_summary',
        timestamp: Date.now(),
        success: true,
        summary: summaryResult.summary,
        metadata: {
          type: 'compressed_operations',
          originalCount: oldOps.length,
          successPatterns: summaryResult.successPatterns || [],
          failureInsights: summaryResult.failureInsights || [],
          toolsUsed: summaryResult.toolsUsed || [],
          variableCreators: summaryResult.variableCreators || []
        }
      },
      ...recentOps
    ];
    
    return {
      optimizedOperations,
      changeStats: {
        kept: recentOps.length,
        summarized: oldOps.length
      }
    };
  }
  
  /**
   * Create a summary of a variable value for archiving
   * @param {*} value - Variable value to summarize
   * @returns {string} Human-readable summary
   * @private
   */
  summarizeValue(value) {
    if (value === null || value === undefined) {
      return String(value);
    }
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 100 ? `String(${value.length} chars): "${value.substring(0, 97)}..."` : `String: "${value}"`;
      case 'number':
      case 'boolean':
        return `${type}: ${value}`;
      case 'object':
        if (Array.isArray(value)) {
          return `Array(${value.length} items)`;
        } else {
          const keys = Object.keys(value);
          return `Object(${keys.length} keys): [${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}]`;
        }
      default:
        return `${type}: ${String(value).substring(0, 50)}`;
    }
  }
  
  /**
   * Retry LLM calls with exponential backoff - NO FALLBACKS
   * @param {Function} llmCall - Async function that makes the LLM call
   * @param {string} operationName - Name of operation for error reporting
   * @returns {Promise<Object>} LLM response result
   * @private
   */
  async retryLLMCall(llmCall, operationName) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`[ContextOptimizer] ${operationName} attempt ${attempt}/${this.config.maxRetries}`);
        const result = await llmCall();
        console.log(`[ContextOptimizer] ${operationName} succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`[ContextOptimizer] ${operationName} failed on attempt ${attempt}:`, error.message);
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[ContextOptimizer] Retrying ${operationName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // ALL retries failed - FAIL FAST
    throw new Error(`${operationName} failed after ${this.config.maxRetries} attempts. Last error: ${lastError.message}`);
  }
  
  /**
   * Extract JSON from LLM response with error handling
   * @param {string} response - LLM response text
   * @returns {Object} Parsed JSON object
   * @private
   */
  extractJSON(response) {
    try {
      // Try to find JSON block in response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON block found, try parsing entire response
      return JSON.parse(response);
    } catch (error) {
      // NO FALLBACKS - throw error to trigger retry
      throw new Error(`Failed to parse LLM JSON response: ${error.message}. Response: ${response.substring(0, 200)}...`);
    }
  }
  
  /**
   * Validate that infrastructure fields are preserved
   * @param {Object} original - Original context
   * @param {Object} optimized - Optimized context
   * @throws {Error} If infrastructure fields are missing
   * @private
   */
  validateInfrastructurePreservation(original, optimized) {
    for (const field of this.protectedFields) {
      if (original[field] && !optimized[field]) {
        throw new Error(`Infrastructure field '${field}' was lost during optimization`);
      }
    }
  }
}