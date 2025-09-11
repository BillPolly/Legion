/**
 * LoopDetectionService - Ported from Gemini CLI loopDetectionService.ts
 * Detects and prevents infinite loops in AI responses and tool executions
 */

import { createHash } from 'crypto';

/**
 * Loop types (ported from Gemini CLI)
 */
export const LoopType = {
  TOOL_CALL: 'tool_call',
  CONTENT_REPETITION: 'content_repetition',
  LLM_DETECTED: 'llm_detected'
};

/**
 * Service for detecting infinite loops (ported from Gemini CLI)
 */
export class LoopDetectionService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    
    // Thresholds (ported from Gemini CLI constants)
    this.TOOL_CALL_LOOP_THRESHOLD = 5;
    this.CONTENT_LOOP_THRESHOLD = 10;
    this.MAX_HISTORY_LENGTH = 1000;
    this.LLM_CHECK_AFTER_TURNS = 30;
    this.DEFAULT_LLM_CHECK_INTERVAL = 3;
    
    // Tool call tracking
    this.lastToolCallKey = null;
    this.toolCallRepetitionCount = 0;
    this.toolCallHistory = [];
    
    // Content tracking
    this.contentHistory = [];
    this.contentStats = new Map(); // content chunk -> occurrence count
    this.loopDetected = false;
    
    // LLM-based loop tracking
    this.turnsInCurrentPrompt = 0;
    this.llmCheckInterval = this.DEFAULT_LLM_CHECK_INTERVAL;
    this.lastCheckTurn = 0;
  }

  /**
   * Check for tool call loops (ported from Gemini CLI)
   * @param {string} toolName - Tool being called
   * @param {Object} toolArgs - Tool arguments
   * @returns {boolean} Whether a loop was detected
   */
  checkToolCallLoop(toolName, toolArgs) {
    try {
      // Increment turn counter for tracking
      this.turnsInCurrentPrompt++;
      
      // Create unique key for this tool call (ported from Gemini CLI)
      const toolCallKey = this._createToolCallKey(toolName, toolArgs);
      
      if (this.lastToolCallKey === toolCallKey) {
        this.toolCallRepetitionCount++;
        
        if (this.toolCallRepetitionCount >= this.TOOL_CALL_LOOP_THRESHOLD) {
          console.error(`🔄 Tool call loop detected: ${toolName} repeated ${this.toolCallRepetitionCount} times`);
          this._recordLoop(LoopType.TOOL_CALL, `Tool ${toolName} repeated ${this.toolCallRepetitionCount} times`);
          return true;
        }
      } else {
        // Different tool call, reset counter
        this.lastToolCallKey = toolCallKey;
        this.toolCallRepetitionCount = 1;
      }
      
      // Track tool call history
      this.toolCallHistory.push({
        toolName,
        args: toolArgs,
        key: toolCallKey,
        timestamp: Date.now()
      });
      
      // Maintain history size
      if (this.toolCallHistory.length > this.MAX_HISTORY_LENGTH) {
        this.toolCallHistory = this.toolCallHistory.slice(-this.MAX_HISTORY_LENGTH);
      }
      
      return false;
    } catch (error) {
      console.warn('Tool call loop detection failed:', error.message);
      return false;
    }
  }

  /**
   * Check for content repetition loops (ported from Gemini CLI)
   * @param {string} content - Content to check
   * @returns {boolean} Whether a content loop was detected
   */
  checkContentLoop(content) {
    try {
      // Increment turn counter for tracking
      this.turnsInCurrentPrompt++;
      
      if (!content || typeof content !== 'string') {
        return false;
      }
      
      // Break content into chunks for analysis (ported from Gemini CLI)
      const chunks = this._chunkContent(content, 50); // 50 char chunks
      
      for (const chunk of chunks) {
        if (chunk.trim().length < 10) continue; // Skip very short chunks
        
        const chunkHash = this._hashContent(chunk);
        const occurrences = this.contentStats.get(chunkHash) || [];
        occurrences.push(Date.now());
        
        // Remove old occurrences (older than 5 minutes)
        const recentOccurrences = occurrences.filter(time => 
          Date.now() - time < 5 * 60 * 1000
        );
        
        this.contentStats.set(chunkHash, recentOccurrences);
        
        // Check if threshold exceeded
        if (recentOccurrences.length >= this.CONTENT_LOOP_THRESHOLD) {
          console.error(`🔄 Content repetition loop detected: chunk repeated ${recentOccurrences.length} times`);
          this._recordLoop(LoopType.CONTENT_REPETITION, `Content chunk repeated ${recentOccurrences.length} times`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Content loop detection failed:', error.message);
      return false;
    }
  }

  /**
   * Check if LLM-based loop detection should run (ported from Gemini CLI)
   * @param {Array} conversationHistory - Current conversation
   * @returns {Promise<boolean>} Whether an LLM-detected loop was found
   */
  async checkLLMLoop(conversationHistory) {
    try {
      this.turnsInCurrentPrompt++;
      
      // Only check after sufficient turns (ported threshold)
      if (this.turnsInCurrentPrompt < this.LLM_CHECK_AFTER_TURNS) {
        return false;
      }
      
      // Check at intervals (ported logic)
      const turnsSinceLastCheck = this.turnsInCurrentPrompt - this.lastCheckTurn;
      if (turnsSinceLastCheck < this.llmCheckInterval) {
        return false;
      }
      
      this.lastCheckTurn = this.turnsInCurrentPrompt;
      
      // Use LLM to detect subtle loops (ported from Gemini CLI)
      const llmClient = await this.resourceManager.get('llmClient');
      const loopCheckPrompt = this._buildLoopCheckPrompt(conversationHistory);
      
      const response = await llmClient.complete(loopCheckPrompt);
      const isLoop = this._parseLoopCheckResponse(response);
      
      if (isLoop) {
        console.error('🔄 LLM-detected conversation loop');
        this._recordLoop(LoopType.LLM_DETECTED, 'LLM detected conversational loop pattern');
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('LLM loop detection failed:', error.message);
      return false;
    }
  }

  /**
   * Create tool call key for comparison (ported from Gemini CLI)
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {string} Unique key
   * @private
   */
  _createToolCallKey(toolName, toolArgs) {
    const argsString = JSON.stringify(toolArgs, Object.keys(toolArgs).sort());
    return `${toolName}:${this._hashContent(argsString)}`;
  }

  /**
   * Hash content for comparison (ported from Gemini CLI)
   * @param {string} content - Content to hash
   * @returns {string} Content hash
   * @private
   */
  _hashContent(content) {
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Break content into chunks (ported from Gemini CLI)
   * @param {string} content - Content to chunk
   * @param {number} chunkSize - Size of each chunk
   * @returns {Array} Content chunks
   * @private
   */
  _chunkContent(content, chunkSize) {
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Build prompt for LLM loop detection (ported concept from Gemini CLI)
   * @param {Array} conversationHistory - Recent conversation
   * @returns {string} Loop detection prompt
   * @private
   */
  _buildLoopCheckPrompt(conversationHistory) {
    const recentTurns = conversationHistory.slice(-20); // Last 20 turns
    let conversationText = '';
    
    for (const turn of recentTurns) {
      conversationText += `${turn.type.toUpperCase()}: ${turn.content}\\n`;
    }
    
    return `Analyze this conversation for repetitive patterns or loops. Look for:
1. Repeated identical or very similar responses
2. Circular reasoning or logic
3. Same questions being asked repeatedly
4. Stuck patterns where no progress is being made

Conversation:
${conversationText}

Respond with "LOOP_DETECTED" if you see repetitive patterns, or "NO_LOOP" if the conversation is progressing normally.`;
  }

  /**
   * Parse LLM loop check response (ported from Gemini CLI)
   * @param {string} response - LLM response
   * @returns {boolean} Whether loop was detected
   * @private
   */
  _parseLoopCheckResponse(response) {
    return response.toLowerCase().includes('loop_detected');
  }

  /**
   * Record detected loop (ported from Gemini CLI)
   * @param {string} loopType - Type of loop detected
   * @param {string} description - Loop description
   * @private
   */
  _recordLoop(loopType, description) {
    this.loopDetected = true;
    
    const loopEvent = {
      type: loopType,
      description,
      timestamp: new Date().toISOString(),
      turnsInPrompt: this.turnsInCurrentPrompt,
      toolCallCount: this.toolCallHistory.length
    };
    
    // Log for debugging
    console.warn('Loop detected:', loopEvent);
  }

  /**
   * Reset loop detection state (ported from Gemini CLI)
   * @param {string} newPromptId - New prompt identifier
   */
  resetForNewPrompt(newPromptId = null) {
    this.promptId = newPromptId || `prompt_${Date.now()}`;
    this.turnsInCurrentPrompt = 0;
    this.lastCheckTurn = 0;
    this.loopDetected = false;
    this.streamContentHistory = '';
    
    // Clear old content stats (keep only recent)
    const cutoffTime = Date.now() - 10 * 60 * 1000; // 10 minutes
    for (const [hash, timestamps] of this.contentStats) {
      const recentTimestamps = timestamps.filter(time => time > cutoffTime);
      if (recentTimestamps.length > 0) {
        this.contentStats.set(hash, recentTimestamps);
      } else {
        this.contentStats.delete(hash);
      }
    }
  }

  /**
   * Check if any loop has been detected
   * @returns {boolean} Whether loop is detected
   */
  isLoopDetected() {
    return this.loopDetected;
  }

  /**
   * Get loop detection statistics
   * @returns {Object} Loop detection stats
   */
  getLoopStats() {
    return {
      turnsInCurrentPrompt: this.turnsInCurrentPrompt,
      toolCallRepetitionCount: this.toolCallRepetitionCount,
      lastToolCall: this.lastToolCallKey,
      contentChunksTracked: this.contentStats.size,
      loopDetected: this.loopDetected,
      toolCallHistory: this.toolCallHistory.length
    };
  }

  /**
   * Clear all tracking data (for testing)
   */
  clearTrackingData() {
    this.toolCallHistory = [];
    this.contentHistory = [];
    this.contentStats.clear();
    this.loopDetected = false;
    this.toolCallRepetitionCount = 0;
    this.lastToolCallKey = null;
    this.turnsInCurrentPrompt = 0;
  }
}

export default LoopDetectionService;