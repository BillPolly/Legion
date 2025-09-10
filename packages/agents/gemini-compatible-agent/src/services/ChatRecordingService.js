/**
 * ChatRecordingService - Ported from Gemini CLI chatRecordingService.ts
 * Provides conversation persistence and recording functionality
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Token usage summary (ported from Gemini CLI)
 */
export class TokensSummary {
  constructor(input = 0, output = 0, cached = 0, thoughts = 0, tool = 0) {
    this.input = input;
    this.output = output; 
    this.cached = cached;
    this.thoughts = thoughts;
    this.tool = tool;
    this.total = input + output + cached + (thoughts || 0) + (tool || 0);
  }
}

/**
 * Tool call record (ported from Gemini CLI)
 */
export class ToolCallRecord {
  constructor(id, name, args, result = null, status = 'completed') {
    this.id = id;
    this.name = name;
    this.args = args;
    this.result = result;
    this.status = status;
    this.timestamp = new Date().toISOString();
    this.displayName = name;
    this.description = `Execute ${name} tool`;
  }
}

/**
 * Service for recording and persisting chat conversations (ported from Gemini CLI)
 */
export class ChatRecordingService {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.recordingDir = path.join(os.homedir(), '.gemini', 'recordings');
    this.currentSession = null;
    this.isRecording = false;
  }

  /**
   * Start recording a new conversation session (ported from Gemini CLI)
   * @param {string} sessionId - Session identifier
   * @param {Object} metadata - Session metadata
   * @returns {Promise<Object>} Recording session
   */
  async startRecording(sessionId = null, metadata = {}) {
    try {
      const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Ensure recording directory exists
      await fs.mkdir(this.recordingDir, { recursive: true });
      
      this.currentSession = {
        id,
        startTime: new Date().toISOString(),
        metadata,
        messages: [],
        toolCalls: [],
        tokenUsage: new TokensSummary(),
        filePath: path.join(this.recordingDir, `${id}.json`)
      };
      
      this.isRecording = true;
      
      console.log('📹 Recording started:', id);
      return this.currentSession;
    } catch (error) {
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Record user message (ported from Gemini CLI)
   * @param {string} content - User message content
   * @param {Object} metadata - Additional metadata
   */
  async recordUserMessage(content, metadata = {}) {
    if (!this.isRecording || !this.currentSession) {
      return;
    }

    const messageRecord = {
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'user',
      content,
      metadata
    };

    this.currentSession.messages.push(messageRecord);
    await this._saveSession();
  }

  /**
   * Record assistant message (ported from Gemini CLI)
   * @param {string} content - Assistant response
   * @param {Array} toolCalls - Tool executions
   * @param {Object} tokenUsage - Token usage info
   * @param {Object} metadata - Additional metadata
   */
  async recordAssistantMessage(content, toolCalls = [], tokenUsage = null, metadata = {}) {
    if (!this.isRecording || !this.currentSession) {
      return;
    }

    const messageRecord = {
      id: `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'assistant',
      content,
      toolCalls: toolCalls.map(tool => new ToolCallRecord(
        tool.id || `tool_${Date.now()}`,
        tool.name,
        tool.args,
        tool.result,
        tool.status || 'completed'
      )),
      metadata
    };

    this.currentSession.messages.push(messageRecord);
    
    // Update token usage if provided
    if (tokenUsage) {
      this.currentSession.tokenUsage.input += tokenUsage.input || 0;
      this.currentSession.tokenUsage.output += tokenUsage.output || 0;
      this.currentSession.tokenUsage.total = this.currentSession.tokenUsage.input + this.currentSession.tokenUsage.output;
    }

    await this._saveSession();
  }

  /**
   * Stop recording and finalize session (ported from Gemini CLI)
   * @returns {Promise<Object>} Final session data
   */
  async stopRecording() {
    if (!this.isRecording || !this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.duration = Date.now() - new Date(this.currentSession.startTime).getTime();
    
    await this._saveSession();
    
    const finalSession = { ...this.currentSession };
    
    this.currentSession = null;
    this.isRecording = false;
    
    console.log('📹 Recording stopped:', finalSession.id);
    return finalSession;
  }

  /**
   * Load recorded session (ported from Gemini CLI)
   * @param {string} sessionId - Session to load
   * @returns {Promise<Object>} Session data
   */
  async loadSession(sessionId) {
    try {
      const sessionPath = path.join(this.recordingDir, `${sessionId}.json`);
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      return JSON.parse(sessionData);
    } catch (error) {
      throw new Error(`Failed to load session ${sessionId}: ${error.message}`);
    }
  }

  /**
   * List recorded sessions (ported from Gemini CLI)
   * @returns {Promise<Array>} Available sessions
   */
  async listSessions() {
    try {
      await fs.mkdir(this.recordingDir, { recursive: true });
      const files = await fs.readdir(this.recordingDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));
      
      const sessions = [];
      for (const file of sessionFiles) {
        try {
          const sessionPath = path.join(this.recordingDir, file);
          const sessionData = await fs.readFile(sessionPath, 'utf-8');
          const session = JSON.parse(sessionData);
          sessions.push({
            id: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            messageCount: session.messages.length,
            toolCallCount: session.toolCalls.length
          });
        } catch (error) {
          console.warn(`Failed to load session ${file}:`, error.message);
        }
      }
      
      return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    } catch (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  /**
   * Save current session to disk (ported from Gemini CLI)
   * @private
   */
  async _saveSession() {
    if (!this.currentSession) {
      return;
    }

    try {
      await fs.writeFile(
        this.currentSession.filePath,
        JSON.stringify(this.currentSession, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.warn('Failed to save session:', error.message);
    }
  }

  /**
   * Get recording statistics
   * @returns {Object} Recording stats
   */
  getRecordingStats() {
    return {
      isRecording: this.isRecording,
      currentSession: this.currentSession?.id || null,
      recordingDir: this.recordingDir,
      messageCount: this.currentSession?.messages.length || 0,
      tokenUsage: this.currentSession?.tokenUsage || new TokensSummary()
    };
  }
}

export default ChatRecordingService;