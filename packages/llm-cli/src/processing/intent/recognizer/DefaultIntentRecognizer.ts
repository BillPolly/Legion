import { IntentRecognizer } from './IntentRecognizer';
import { Intent, CommandSuggestion, ParameterValidationResult, StructuredIntentResponse } from '../types';
import { LLMCLIConfig, CommandRegistry, CommandDefinition } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { DefaultPromptBuilder } from '../../../prompt/builder/DefaultPromptBuilder';
import { DefaultCommandFormatter } from '../../../prompt/formatter/DefaultCommandFormatter';

export class DefaultIntentRecognizer implements IntentRecognizer {
  private promptBuilder = new DefaultPromptBuilder();
  private commandFormatter = new DefaultCommandFormatter();

  async recognizeIntent(input: string, config: LLMCLIConfig, session: SessionState): Promise<Intent> {
    try {
      console.log('[IntentRecognizer] Processing input:', input);
      console.log('[IntentRecognizer] Available commands:', Object.keys(config.commands));
      
      const prompt = await this.buildIntentPrompt(input, config, session);
      
      let intent: Intent;
      
      // Use structured output if available
      if (config.llmProvider.completeStructured) {
        const schema = {
          type: 'object',
          properties: {
            command: { type: 'string' },
            parameters: { type: 'object' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            reasoning: { type: 'string' }
          },
          required: ['command', 'parameters', 'confidence']
        };

        console.log('[IntentRecognizer] Using structured completion');
        const response = await config.llmProvider.completeStructured<StructuredIntentResponse>(prompt, schema);
        console.log('[IntentRecognizer] LLM Response:', response);
        
        intent = {
          command: response.command || 'unknown',
          parameters: response.parameters || {},
          confidence: Math.max(0, Math.min(1, response.confidence || 0)),
          rawQuery: input,
          reasoning: response.reasoning
        };
      } else {
        // Fallback to regular completion and parse JSON
        console.log('[IntentRecognizer] Using regular completion');
        const response = await config.llmProvider.complete(prompt);
        console.log('[IntentRecognizer] LLM Response:', response);
        intent = this.parseIntentResponse(response, input);
      }
      
      console.log('[IntentRecognizer] Parsed intent:', intent);
      
      // If confidence is low or command is unknown, fallback to chat if available
      if ((intent.confidence < 0.5 || intent.command === 'unknown') && 
          !config.disableDefaultChat && 
          config.commands['chat']) {
        console.log('[IntentRecognizer] Falling back to chat command');
        return {
          command: 'chat',
          parameters: { message: input },
          confidence: 0.7,
          rawQuery: input,
          reasoning: 'Low confidence match, falling back to chat'
        };
      }
      
      return intent;
    } catch (error) {
      console.error('[IntentRecognizer] Error recognizing intent:', error);
      
      // If chat is available, use it as fallback
      if (!config.disableDefaultChat && config.commands['chat']) {
        return {
          command: 'chat',
          parameters: { message: input },
          confidence: 0.5,
          rawQuery: input,
          reasoning: 'Error in intent recognition, falling back to chat'
        };
      }
      
      return {
        command: 'unknown',
        parameters: {},
        confidence: 0.1,
        rawQuery: input
      };
    }
  }

  getCommandSimilarity(command1: string, command2: string): number {
    if (command1 === command2) return 1.0;
    
    // Simple string similarity using Levenshtein distance
    const distance = this.levenshteinDistance(command1.toLowerCase(), command2.toLowerCase());
    const maxLength = Math.max(command1.length, command2.length);
    
    if (maxLength === 0) return 1.0;
    
    return Math.max(0, 1 - (distance / maxLength));
  }

  suggestCommands(input: string, commands: CommandRegistry, limit: number = 5): CommandSuggestion[] {
    const suggestions: CommandSuggestion[] = [];
    
    Object.entries(commands).forEach(([name, command]) => {
      const similarity = this.getCommandSimilarity(input, name);
      suggestions.push({
        command: name,
        similarity,
        description: command.description
      });
    });
    
    // Sort by similarity (highest first) and limit
    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  validateParameters(intent: Intent, command: CommandDefinition): ParameterValidationResult {
    const errors: string[] = [];
    const parameters = { ...intent.parameters };
    
    if (!command.parameters) {
      return { isValid: true, errors: [], parameters };
    }
    
    // Check each parameter definition
    for (const param of command.parameters) {
      const value = parameters[param.name];
      
      // Check required parameters
      if (param.required && (value === undefined || value === null)) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }
      
      // Apply default values
      if (value === undefined && param.default !== undefined) {
        parameters[param.name] = param.default;
        continue;
      }
      
      // Skip validation if parameter is not provided and not required
      if (value === undefined) {
        continue;
      }
      
      // Type validation
      if (!this.validateParameterType(value, param)) {
        errors.push(`Parameter ${param.name} must be of type ${param.type}`);
        continue;
      }
      
      // Enum validation
      if (param.type === 'enum' && param.enum) {
        if (!param.enum.includes(value)) {
          errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
          continue;
        }
      }
      
      // Custom validation
      if (param.validator && !param.validator(value)) {
        const message = param.validationError || `Parameter ${param.name} failed validation`;
        errors.push(message);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      parameters
    };
  }

  async buildIntentPrompt(input: string, config: LLMCLIConfig, session: SessionState): Promise<string> {
    const parts: string[] = [];
    
    // System instructions
    parts.push('You are an intent recognition system. Analyze the user input and map it to one of the available commands.');
    parts.push('IMPORTANT: You MUST return the exact command name from the list below. Do not make up command names.');
    parts.push('');
    
    // Available commands
    parts.push('AVAILABLE COMMANDS (use these exact names):');
    const commandsText = this.commandFormatter.formatRegistry(config.commands, session);
    parts.push(commandsText);
    parts.push('');
    
    // Special instructions for chat
    parts.push('SPECIAL INSTRUCTIONS:');
    parts.push('- For general conversation, greetings (hi, hello), questions, or any input that doesn\'t match other specific commands, use the "chat" command');
    parts.push('- The "chat" command is for general conversational interface');
    parts.push('');
    
    // Context from history
    if (session.history.length > 0) {
      parts.push('CONVERSATION CONTEXT:');
      const historyText = this.promptBuilder.formatHistory(session.history, 3);
      parts.push(historyText);
      parts.push('');
    }
    
    // User input
    parts.push(`USER INPUT: ${input}`);
    parts.push('');
    
    // Response format
    parts.push('RESPONSE FORMAT:');
    parts.push('Return a JSON object with:');
    parts.push('- command: the EXACT command name from the available commands list (or "unknown" if no match)');
    parts.push('- parameters: extracted parameters as an object');
    parts.push('- confidence: confidence score from 0 to 1');
    parts.push('- reasoning: brief explanation of your decision');
    parts.push('');
    parts.push('Example: {"command": "chat", "parameters": {"message": "hello"}, "confidence": 0.9, "reasoning": "User is greeting, using chat command"}');
    
    const finalPrompt = parts.join('\n');
    console.log('\n[IntentRecognizer] FULL PROMPT BEING SENT TO LLM:');
    console.log('=====================================');
    console.log(finalPrompt);
    console.log('=====================================\n');
    
    return finalPrompt;
  }

  private parseIntentResponse(response: string, rawQuery: string): Intent {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[^}]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as StructuredIntentResponse;
      
      return {
        command: parsed.command || 'unknown',
        parameters: parsed.parameters || {},
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        rawQuery,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      console.error('Error parsing intent response:', error);
      return {
        command: 'unknown',
        parameters: {},
        confidence: 0.1,
        rawQuery
      };
    }
  }

  private validateParameterType(value: any, param: NonNullable<CommandDefinition['parameters']>[0]): boolean {
    switch (param.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'enum':
        return true; // Enum validation is handled separately
      default:
        return true;
    }
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}