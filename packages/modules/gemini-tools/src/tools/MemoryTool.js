/**
 * MemoryTool - Ported from Gemini CLI memoryTool.ts to Legion patterns
 * Saves and manages long-term memory for the agent
 */

import { Tool } from '@legion/tools-registry';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Tool for memory management (ported from Gemini CLI's memoryTool.ts)
 */
class MemoryTool extends Tool {
  constructor(moduleOrConfig, toolName = null) {
    // NEW PATTERN: Tool(module, toolName) - metadata comes from module
    if (toolName && moduleOrConfig?.getToolMetadata) {
      super(moduleOrConfig, toolName);
      
      // Get config from module  
      const config = moduleOrConfig.config || {};
      this.memoryDir = config.memoryDir || path.join(os.homedir(), '.gemini');
      this.memoryFile = config.memoryFile || 'GEMINI.md';
      this.shortName = 'memory';
    } 
    // OLD PATTERN: Tool(config) - backwards compatibility
    else {
      const { memoryDir, memoryFile = 'GEMINI.md' } = moduleOrConfig || {};
      
      super({
        name: 'save_memory',
        shortName: 'memory',
        description: 'Saves specific information to long-term memory (ported from Gemini CLI)',
        schema: {
          input: {
            type: 'object',
            properties: {
              fact: {
                type: 'string',
                description: 'The specific fact or piece of information to remember'
              }
            },
            required: ['fact']
          },
          output: {
            type: 'object',
            properties: {
              saved: {
                type: 'boolean',
                description: 'Whether the memory was saved successfully'
              },
              memoryPath: {
                type: 'string',
                description: 'Path where the memory was saved'
              },
              fact: {
                type: 'string',
                description: 'The fact that was saved'
              }
            },
            required: ['saved', 'memoryPath', 'fact']
          }
        }
      });

      this.memoryDir = memoryDir || path.join(os.homedir(), '.gemini');
      this.memoryFile = memoryFile;
    }
  }

  /**
   * Execute memory saving (core logic ported from Gemini CLI)
   * @param {Object} args - The arguments for saving memory
   * @returns {Promise<Object>} The save result
   */
  async _execute(args) {
    try {
      const { fact } = args;

      // Validate input (ported from Gemini CLI validation)
      if (typeof fact !== 'string') {
        throw new Error('Fact must be a string');
      }

      if (fact.trim() === '') {
        throw new Error('Fact cannot be empty');
      }

      // Prepare memory file path (ported from Gemini CLI path handling)
      const memoryPath = path.join(this.memoryDir, this.memoryFile);

      // Ensure memory directory exists
      await fs.mkdir(this.memoryDir, { recursive: true });

      // Read existing memory content (ported from Gemini CLI)
      let existingContent = '';
      try {
        existingContent = await fs.readFile(memoryPath, 'utf-8');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist yet, start with empty content
      }

      // Add new memory entry (ported format from Gemini CLI)
      const timestamp = new Date().toISOString();
      const memoryEntry = `\n- [${timestamp}] ${fact.trim()}`;

      // Update memory file (ported logic from Gemini CLI)
      let newContent;
      if (existingContent.includes('## Gemini Added Memories')) {
        // Append to existing memories section
        newContent = existingContent + memoryEntry;
      } else {
        // Create new memories section
        const memoriesSection = `\n\n## Gemini Added Memories\n${memoryEntry}`;
        newContent = existingContent + memoriesSection;
      }

      // Write updated memory file
      await fs.writeFile(memoryPath, newContent, 'utf-8');

      return {
        saved: true,
        memoryPath,
        fact: fact.trim()
      };

    } catch (error) {
      // Legion pattern: fail fast, no fallbacks
      throw new Error(error.message || 'Failed to save memory');
    }
  }

  /**
   * Load saved memories (additional helper method)
   * @returns {Promise<string>} Saved memory content
   */
  async loadMemories() {
    try {
      const memoryPath = path.join(this.memoryDir, this.memoryFile);
      const content = await fs.readFile(memoryPath, 'utf-8');
      
      // Extract just the memories section
      const memoriesMatch = content.match(/## Gemini Added Memories\n([\s\S]*)/);
      return memoriesMatch ? memoriesMatch[1] : '';
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return ''; // No memories saved yet
      }
      throw error;
    }
  }
}

export default MemoryTool;