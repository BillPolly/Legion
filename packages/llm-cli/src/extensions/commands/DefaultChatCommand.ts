import { CommandDefinition, CommandResult } from '../../core/types';
import { LLMProvider } from '../../core/providers/types';
import { SessionState } from '../../runtime/session/types';

export interface DefaultChatCommandOptions {
  systemPrompt?: string;
  includeHistory?: boolean;
  maxHistoryEntries?: number;
}

export class DefaultChatCommand {
  private options: DefaultChatCommandOptions;

  constructor(options: DefaultChatCommandOptions = {}) {
    this.options = {
      includeHistory: true,
      maxHistoryEntries: 5,
      ...options
    };
  }

  getCommandDefinition(llmProvider: LLMProvider): CommandDefinition {
    return {
      description: 'General conversational interface',
      parameters: [
        {
          name: 'message',
          type: 'string',
          description: 'The message to respond to',
          required: false
        }
      ],
      handler: async (params, session) => this.handleChat(params, llmProvider, session),
      examples: [
        { input: 'Hello, how are you?' },
        { input: 'Tell me about the weather' },
        { input: 'What can you help me with?' }
      ],
      category: 'general',
      metadata: {
        isDefault: true,
        fallbackCommand: true
      }
    };
  }

  private async handleChat(params: any, llmProvider: LLMProvider, session?: SessionState): Promise<CommandResult> {
    try {
      const message = params.message || params.input || params.query || 'Hello';
      
      // Build chat prompt with history if session is available
      const prompt = session && this.options.includeHistory 
        ? this.buildPromptWithHistory(message, session)
        : this.buildChatPrompt(message);
      
      // Get response from LLM
      const response = await llmProvider.complete(prompt);
      
      return {
        success: true,
        output: response,
        data: {
          originalMessage: message,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate response',
        data: {
          originalMessage: params.message
        }
      };
    }
  }

  private buildChatPrompt(message: string): string {
    const parts: string[] = [];
    
    // System context
    if (this.options.systemPrompt) {
      parts.push(this.options.systemPrompt);
    } else {
      parts.push('You are a helpful CLI assistant. Respond naturally to the user\'s message.');
    }
    
    parts.push('');
    parts.push(`User: ${message}`);
    parts.push('');
    parts.push('Assistant:');
    
    const finalPrompt = parts.join('\n');
    console.log('\n[DefaultChatCommand] CHAT PROMPT BEING SENT TO LLM:');
    console.log('=====================================');
    console.log(finalPrompt);
    console.log('=====================================\n');
    
    return finalPrompt;
  }

  buildPromptWithHistory(message: string, session: SessionState): string {
    const parts: string[] = [];
    
    // System context
    if (this.options.systemPrompt) {
      parts.push(this.options.systemPrompt);
    } else {
      parts.push('You are a helpful CLI assistant. Respond naturally to the user\'s message while considering the conversation history.');
    }
    
    // Add conversation history
    if (this.options.includeHistory && session.history.length > 0) {
      parts.push('');
      parts.push('Previous conversation:');
      
      const recentHistory = session.history.slice(-this.options.maxHistoryEntries!);
      recentHistory.forEach(entry => {
        parts.push(`User: ${entry.input}`);
        if (entry.result?.output) {
          parts.push(`Assistant: ${entry.result.output}`);
        }
      });
    }
    
    parts.push('');
    parts.push(`User: ${message}`);
    parts.push('');
    parts.push('Assistant:');
    
    return parts.join('\n');
  }
}