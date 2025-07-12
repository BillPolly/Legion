import { ResponseGenerator } from './ResponseGenerator';
import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { ExecutionContext } from '../../execution/types';
import { GeneratedResponse } from '../types';

export class DefaultResponseGenerator implements ResponseGenerator {
  async generateResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<GeneratedResponse> {
    // Determine the base message
    let message: string;
    if (result.success) {
      message = this.formatSuccessMessage(result, context);
    } else {
      message = this.formatErrorMessage(result, context);
    }

    // Try to generate natural language response if applicable
    if (this.shouldGenerateNaturalLanguage(config, context, result)) {
      try {
        const nlMessage = await this.generateNaturalLanguageResponse(context, result, config);
        if (nlMessage && nlMessage.trim() !== '') {
          message = nlMessage;
        }
      } catch (error) {
        console.error('Error generating natural language response:', error);
        // Continue with the original message
      }
    }

    // Build the complete response
    const response: GeneratedResponse = {
      success: result.success,
      message,
      executionId: context.executionId,
      timestamp: new Date(),
      command: context.command
    };

    // Include additional data if present
    if (result.data !== undefined) {
      response.data = result.data;
    }

    if (result.suggestions && result.suggestions.length > 0) {
      response.suggestions = result.suggestions;
    }

    if (result.responseContext) {
      response.metadata = result.responseContext;
    }

    return response;
  }

  formatSuccessMessage(result: CommandResult, context: ExecutionContext): string {
    if (result.output) {
      return result.output;
    }

    // Generate a default success message
    let message = 'Command completed successfully';

    // Add data summary if available
    if (result.data) {
      const dataSummary = this.extractDataSummary(result.data);
      if (dataSummary) {
        message += ` (${dataSummary})`;
      }
    }

    return message;
  }

  formatErrorMessage(result: CommandResult, context: ExecutionContext): string {
    if (result.error) {
      return result.error;
    }

    return 'Command failed';
  }

  shouldGenerateNaturalLanguage(config: LLMCLIConfig, context: ExecutionContext, result: CommandResult): boolean {
    // Check if LLM provider is available
    if (!config.llmProvider || typeof config.llmProvider.complete !== 'function') {
      return false;
    }

    // Check user preferences
    const useNaturalLanguage = context.session.state.get('useNaturalLanguage');
    if (useNaturalLanguage === false) {
      return false;
    }

    // NEVER generate natural language for chat command - it already returns natural language!
    if (context.command === 'chat') {
      return false;
    }

    // For now, always generate natural language if LLM is available
    return true;
  }

  async generateNaturalLanguageResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<string> {
    try {
      const prompt = this.buildResponsePrompt(context, result, config);
      const response = await config.llmProvider.complete(prompt);
      
      // Extract clean response from LLM output
      const cleanResponse = this.extractCleanResponse(response);
      
      // Fall back to original output if NL generation failed
      if (!cleanResponse || cleanResponse.trim() === '') {
        return result.output || (result.success ? 'Command completed successfully' : 'Command failed');
      }
      
      return cleanResponse;
    } catch (error) {
      console.error('Natural language response generation failed:', error);
      return result.output || (result.success ? 'Command completed successfully' : 'Command failed');
    }
  }

  buildResponsePrompt(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): string {
    const parts: string[] = [];

    // System instruction
    parts.push('You are a helpful CLI assistant. Generate a natural, conversational response based on the command execution result.');
    parts.push('');

    // Context information
    parts.push('COMMAND EXECUTED:');
    parts.push(`Command: ${context.command}`);
    parts.push(`Parameters: ${JSON.stringify(context.parameters)}`);
    parts.push(`Original query: "${context.originalIntent.rawQuery}"`);
    parts.push('');

    // Execution result
    parts.push('EXECUTION RESULT:');
    parts.push(`Status: ${result.success ? 'successful' : 'failed'}`);
    
    if (result.success && result.output) {
      parts.push(`Output: ${result.output}`);
    }
    
    if (!result.success && result.error) {
      parts.push(`Error: ${result.error}`);
    }

    if (result.data) {
      parts.push(`Data: ${JSON.stringify(result.data)}`);
    }
    parts.push('');

    // Session context
    if (context.session.state.size > 0) {
      parts.push('SESSION CONTEXT:');
      const userName = context.session.state.get('userName') || context.session.state.get('user');
      if (userName) {
        parts.push(`User: ${userName}`);
      }
      parts.push('');
    }

    // Recent history
    if (context.session.history.length > 0) {
      const recentCommands = context.session.history.slice(-2).map(h => h.input);
      parts.push(`Recent commands: ${recentCommands.join(', ')}`);
      parts.push('');
    }

    // Instructions
    if (result.success) {
      parts.push('Generate a helpful, natural language response that:');
      parts.push('- Confirms the action was completed');
      parts.push('- Summarizes key information from the result');
      parts.push('- Is conversational and user-friendly');
    } else {
      parts.push('Generate a helpful, natural language response that:');
      parts.push('- Explains what went wrong in user-friendly terms');
      parts.push('- Suggests possible solutions or next steps');
      parts.push('- Is empathetic and supportive');
    }

    parts.push('');
    parts.push('Keep the response concise and avoid technical jargon. Respond in a single paragraph.');

    return parts.join('\n');
  }

  extractDataSummary(data: any): string {
    if (!data || typeof data !== 'object') {
      return '';
    }

    // Check for array data
    if (Array.isArray(data)) {
      return `${data.length} items`;
    }

    // Check for count properties
    if (typeof data.count === 'number') {
      return `${data.count} items`;
    }

    if (typeof data.totalCount === 'number') {
      return `${data.totalCount} items`;
    }

    if (typeof data.length === 'number') {
      return `${data.length} items`;
    }

    // Check for results array
    if (Array.isArray(data.results)) {
      return `${data.results.length} items`;
    }

    if (Array.isArray(data.items)) {
      return `${data.items.length} items`;
    }

    return '';
  }

  private extractCleanResponse(response: string): string {
    // Remove common prefixes/suffixes from LLM responses
    let cleaned = response.trim();
    
    // Remove quotes if the entire response is quoted
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    // Remove common prefixes
    const prefixes = [
      'Response: ',
      'Output: ',
      'Result: ',
      'Answer: '
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.slice(prefix.length).trim();
        break;
      }
    }

    return cleaned;
  }
}