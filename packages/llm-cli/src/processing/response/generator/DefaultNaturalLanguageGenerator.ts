import { NaturalLanguageGenerator, ResponseTone } from './NaturalLanguageGenerator';
import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { ExecutionContext } from '../../execution/types';

export class DefaultNaturalLanguageGenerator implements NaturalLanguageGenerator {
  async generateResponse(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): Promise<string> {
    try {
      const prompt = this.buildPrompt(context, result, config);
      const response = await config.llmProvider.complete(prompt);
      
      // Clean and validate the response
      const cleanResponse = this.cleanResponse(response);
      
      if (!this.validateResponse(cleanResponse, context)) {
        throw new Error('Generated response failed validation');
      }
      
      // Personalize if appropriate
      return this.personalizeResponse(cleanResponse, context);
      
    } catch (error) {
      console.error('Natural language generation failed:', error);
      // Fall back to original output
      return result.output || (result.success ? 'Command completed successfully' : 'Command failed');
    }
  }

  buildPrompt(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig): string {
    const parts: string[] = [];

    // System instruction
    const tone = this.getResponseTone(context, result);
    parts.push(`You are a helpful CLI assistant. Generate a natural, ${tone} response based on the command execution result.`);
    parts.push('');

    // Context information
    parts.push('CONTEXT:');
    parts.push(this.buildContextInformation(context, config));
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
      parts.push(`Additional data: ${JSON.stringify(result.data)}`);
    }
    parts.push('');

    // Response guidelines
    if (result.success) {
      parts.push('Generate a response that:');
      parts.push('- Confirms the successful completion of the task');
      parts.push('- Summarizes key results in user-friendly language');
      parts.push('- Shows enthusiasm for helping the user');
      parts.push('- Offers relevant next steps if appropriate');
    } else {
      parts.push('Generate a response that:');
      parts.push('- Acknowledges the problem empathetically');
      parts.push('- Explains what went wrong in simple terms');
      parts.push('- Suggests concrete solutions or alternatives');
      parts.push('- Maintains a helpful and supportive tone');
    }

    parts.push('');
    parts.push('Keep the response conversational, concise (1-2 sentences), and avoid technical jargon.');
    parts.push('Do not include prefixes like "Response:" or quotes around your answer.');

    return parts.join('\n');
  }

  buildContextInformation(context: ExecutionContext, config: LLMCLIConfig): string {
    const parts: string[] = [];

    // User information
    const userName = context.session.state.get('userName') || context.session.state.get('user');
    if (userName) {
      parts.push(`User: ${userName}`);
    }

    // Command information
    parts.push(`Command: ${context.command}`);
    
    const commandDef = config.commands[context.command];
    if (commandDef?.description) {
      parts.push(`Purpose: ${commandDef.description}`);
    }

    parts.push(`Original query: "${context.originalIntent.rawQuery}"`);

    // Parameters
    if (Object.keys(context.parameters).length > 0) {
      parts.push(`Parameters: ${JSON.stringify(context.parameters)}`);
    }

    // Recent history
    if (context.session.history.length > 0) {
      const recentCommands = context.session.history.slice(-2).map(h => h.input);
      parts.push(`Recent commands: ${recentCommands.join(', ')}`);
    }

    return parts.join('\n');
  }

  async generateResponseVariation(context: ExecutionContext, result: CommandResult, config: LLMCLIConfig, variation: number): Promise<string> {
    // Modify the prompt slightly for variation
    const basePrompt = this.buildPrompt(context, result, config);
    const variationPrompts = [
      basePrompt,
      basePrompt + '\n\nUse a slightly different phrasing while maintaining the same meaning.',
      basePrompt + '\n\nProvide an alternative way to express the same information.'
    ];

    const prompt = variationPrompts[variation % variationPrompts.length];
    
    try {
      const response = await config.llmProvider.complete(prompt);
      return this.cleanResponse(response);
    } catch (error) {
      console.error('Response variation generation failed:', error);
      return await this.generateResponse(context, result, config);
    }
  }

  personalizeResponse(response: string, context: ExecutionContext): string {
    // Check if personalization is disabled
    if (context.session.state.get('disablePersonalization')) {
      return response;
    }

    const userName = context.session.state.get('userName') || context.session.state.get('user');
    if (!userName) {
      return response;
    }

    // Simple personalization: add user name if not already present
    if (!response.toLowerCase().includes(userName.toLowerCase())) {
      // Add personalization at the beginning or end based on context
      if (response.toLowerCase().startsWith('i ')) {
        return response.replace(/^i /i, `${userName}, I `);
      } else {
        return `${userName}, ${response.charAt(0).toLowerCase() + response.slice(1)}`;
      }
    }

    return response;
  }

  getResponseTone(context: ExecutionContext, result?: CommandResult): ResponseTone {
    // Check user preference
    const userTone = context.session.state.get('responseTone') as ResponseTone;
    if (userTone && ['professional', 'casual', 'friendly', 'empathetic'].includes(userTone)) {
      return userTone;
    }

    // Determine tone based on result
    if (result) {
      if (result.success) {
        return 'friendly';
      } else {
        return 'empathetic';
      }
    }

    return 'professional';
  }

  validateResponse(response: string, context: ExecutionContext): boolean {
    // Check minimum length
    if (response.length < 10) {
      return false;
    }

    // Check maximum length
    if (response.length > 500) {
      return false;
    }

    // Check for empty or whitespace-only response
    if (!response.trim()) {
      return false;
    }

    // Check for common error patterns
    const errorPatterns = [
      /^error:/i,
      /^failed:/i,
      /cannot generate/i,
      /unable to process/i
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(response)) {
        return false;
      }
    }

    return true;
  }

  private cleanResponse(response: string): string {
    let cleaned = response.trim();

    // Remove common prefixes
    const prefixes = [
      'Response: ',
      'Answer: ',
      'Output: ',
      'Result: ',
      'Reply: '
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.slice(prefix.length).trim();
        break;
      }
    }

    // Remove surrounding quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    // Ensure proper sentence capitalization
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }
}