import { AmbiguityResolver } from './AmbiguityResolver';
import { Intent, CommandSuggestion } from '../types';
import { LLMCLIConfig, CommandDefinition } from '../../../core/types';
import { SessionState, HistoryEntry } from '../../../runtime/session/types';
import { DefaultIntentRecognizer } from '../recognizer/DefaultIntentRecognizer';

export class DefaultAmbiguityResolver implements AmbiguityResolver {
  private intentRecognizer = new DefaultIntentRecognizer();
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

  isAmbiguous(intent: Intent, config: LLMCLIConfig, session: SessionState): boolean {
    // Check confidence threshold
    const threshold = this.getConfidenceThreshold(session);
    if (intent.confidence < threshold) {
      return true;
    }

    // Check for unknown command
    if (intent.command === 'unknown') {
      return true;
    }

    // Check if command exists in registry
    if (!config.commands[intent.command]) {
      return true;
    }

    // Check for missing required parameters
    const command = config.commands[intent.command];
    if (command.parameters) {
      const missingRequired = command.parameters
        .filter(param => param.required && intent.parameters[param.name] === undefined);
      
      if (missingRequired.length > 0) {
        return true;
      }
    }

    return false;
  }

  generateClarificationQuestion(intent: Intent, config: LLMCLIConfig, session: SessionState): string {
    // Handle unknown commands
    if (intent.command === 'unknown' || !config.commands[intent.command]) {
      const suggestions = this.suggestAlternatives(intent, config, session, 3);
      const commandList = suggestions.map(s => s.command).join(', ');
      
      return `I'm not sure what you want to do. Did you mean one of these commands: ${commandList}? ` +
             `Or could you rephrase your request?`;
    }

    const command = config.commands[intent.command];

    // Handle missing required parameters
    if (command.parameters) {
      const missingRequired = command.parameters
        .filter(param => param.required && intent.parameters[param.name] === undefined);

      if (missingRequired.length > 0) {
        const paramNames = missingRequired.map(p => p.description || p.name).join(' and ');
        return `To use the ${intent.command} command, I need to know: ${paramNames}. Could you provide this information?`;
      }
    }

    // Handle low confidence
    if (intent.confidence < this.getConfidenceThreshold(session)) {
      const paramSummary = Object.keys(intent.parameters).length > 0
        ? ` with parameters: ${JSON.stringify(intent.parameters)}`
        : '';
      
      return `I think you want to run the "${intent.command}" command${paramSummary}. Is that correct?`;
    }

    return 'Could you clarify what you want to do?';
  }

  suggestAlternatives(intent: Intent, config: LLMCLIConfig, session: SessionState, limit: number = 5): CommandSuggestion[] {
    const input = intent.rawQuery;
    return this.intentRecognizer.suggestCommands(input, config.commands, limit);
  }

  async resolveAmbiguity(
    originalIntent: Intent,
    clarificationResponse: string,
    config: LLMCLIConfig,
    session: SessionState
  ): Promise<Intent> {
    try {
      // If original intent was unknown, try to recognize from clarification
      if (originalIntent.command === 'unknown') {
        return await this.intentRecognizer.recognizeIntent(clarificationResponse, config, session);
      }

      // If missing parameters, try to extract them from clarification
      const command = config.commands[originalIntent.command];
      if (command?.parameters) {
        const extractedParams = this.extractParametersFromText(clarificationResponse, command);
        
        if (Object.keys(extractedParams).length > 0) {
          return {
            ...originalIntent,
            parameters: { ...originalIntent.parameters, ...extractedParams },
            confidence: Math.min(0.9, originalIntent.confidence + 0.2),
            rawQuery: `${originalIntent.rawQuery} (clarified: ${clarificationResponse})`
          };
        }
      }

      // Check if clarification contains a command name
      const mentionedCommands = Object.keys(config.commands)
        .filter(cmd => clarificationResponse.toLowerCase().includes(cmd.toLowerCase()));

      if (mentionedCommands.length === 1) {
        const newCommand = mentionedCommands[0];
        return {
          command: newCommand,
          parameters: {},
          confidence: 0.8,
          rawQuery: clarificationResponse
        };
      }

      // If clarification is positive confirmation
      if (this.isPositiveResponse(clarificationResponse)) {
        return {
          ...originalIntent,
          confidence: Math.min(0.9, originalIntent.confidence + 0.3)
        };
      }

      // If clarification is negative, try to recognize new intent
      if (this.isNegativeResponse(clarificationResponse)) {
        return await this.intentRecognizer.recognizeIntent(clarificationResponse, config, session);
      }

      // Default: return original intent with slightly higher confidence
      return {
        ...originalIntent,
        confidence: Math.min(0.8, originalIntent.confidence + 0.1)
      };

    } catch (error) {
      console.error('Error resolving ambiguity:', error);
      return originalIntent;
    }
  }

  getConfidenceThreshold(session: SessionState): number {
    if (session.history.length === 0) {
      return this.DEFAULT_CONFIDENCE_THRESHOLD;
    }

    // Analyze recent history
    const recentHistory = session.history.slice(-5);
    const successRate = recentHistory
      .filter((entry: HistoryEntry) => entry.result?.success)
      .length / recentHistory.length;

    const avgConfidence = recentHistory
      .filter((entry: HistoryEntry) => entry.intent?.confidence)
      .reduce((sum: number, entry: HistoryEntry) => sum + (entry.intent!.confidence || 0), 0) / recentHistory.length;

    // Lower threshold for experienced users with high success rate
    if (successRate > 0.8 && avgConfidence > 0.8) {
      return this.DEFAULT_CONFIDENCE_THRESHOLD - 0.1;
    }

    // Higher threshold for users with low success rate
    if (successRate < 0.5) {
      return this.DEFAULT_CONFIDENCE_THRESHOLD + 0.1;
    }

    return this.DEFAULT_CONFIDENCE_THRESHOLD;
  }

  extractParametersFromText(text: string, command: CommandDefinition): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (!command.parameters) {
      return params;
    }

    const lowerText = text.toLowerCase();

    for (const param of command.parameters) {
      // Try to extract based on parameter type and patterns
      switch (param.type) {
        case 'string':
          const stringValue = this.extractStringParameter(lowerText, param);
          if (stringValue) {
            params[param.name] = stringValue;
          }
          break;

        case 'number':
          const numberValue = this.extractNumberParameter(lowerText, param);
          if (numberValue !== null) {
            params[param.name] = numberValue;
          }
          break;

        case 'boolean':
          const boolValue = this.extractBooleanParameter(lowerText, param);
          if (boolValue !== null) {
            params[param.name] = boolValue;
          }
          break;

        case 'enum':
          if (param.enum) {
            const enumValue = param.enum.find(value => 
              lowerText.includes(value.toString().toLowerCase())
            );
            if (enumValue) {
              params[param.name] = enumValue;
            }
          }
          break;
      }
    }

    return params;
  }

  private extractStringParameter(text: string, param: any): string | null {
    // Special handling for different parameter names
    if (param.name === 'query' || param.name === 'term') {
      const patterns = [
        new RegExp(`${param.name}[:\\s]+([^\\s]+(?:\\s+[^\\s]+)*)`, 'i'),
        new RegExp(`for\\s+([^\\s]+(?:\\s+[^\\s]+)*)(?:\\s+by|$)`, 'i'),
        new RegExp(`about\\s+([^\\s]+(?:\\s+[^\\s]+)*)(?:\\s+by|$)`, 'i'),
        new RegExp(`search\\s+([^\\s]+(?:\\s+[^\\s]+)*)(?:\\s+by|$)`, 'i'),
        new RegExp(`find\\s+(?:papers\\s+)?(?:about\\s+)?([^\\s]+(?:\\s+[^\\s]+)*)(?:\\s+by|$)`, 'i'),
        new RegExp(`"([^"]+)"`, 'i'),
        new RegExp(`'([^']+)'`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[1].trim()) {
          return match[1].trim();
        }
      }
    }

    if (param.name === 'author') {
      const patterns = [
        new RegExp(`by\\s+([^\\s]+(?:\\s+[^\\s]+)*)(?:\\s+from|$)`, 'i'),
        new RegExp(`author[:\\s]+([^\\s]+(?:\\s+[^\\s]+)*)`, 'i')
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[1].trim()) {
          return match[1].trim();
        }
      }
    }

    // General patterns
    const patterns = [
      new RegExp(`${param.name}[:\\s]+([^\\s]+(?:\\s+[^\\s]+)*)`, 'i'),
      new RegExp(`"([^"]+)"`, 'i'),
      new RegExp(`'([^']+)'`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private extractNumberParameter(text: string, param: any): number | null {
    const patterns = [
      new RegExp(`${param.name}[:\\s]+(\\d+)`, 'i'),
      new RegExp(`limit[:\\s]+(\\d+)`, 'i'),
      new RegExp(`from\\s+(\\d{4})`, 'i'), // For years like "from 2023"
      new RegExp(`(\\d{4})`, 'g'), // General 4-digit numbers (years)
      new RegExp(`(\\d+)`, 'g') // Any numbers
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const num = parseInt(match.replace(/\D/g, ''), 10);
          if (!isNaN(num)) {
            // For year parameter, prefer 4-digit numbers
            if (param.name === 'year' && num >= 1900 && num <= 2100) {
              return num;
            } else if (param.name !== 'year') {
              return num;
            }
          }
        }
      }
    }

    return null;
  }

  private extractBooleanParameter(text: string, param: any): boolean | null {
    const truePatterns = ['yes', 'true', 'on', 'enabled', 'enable'];
    const falsePatterns = ['no', 'false', 'off', 'disabled', 'disable'];

    if (truePatterns.some(pattern => text.includes(pattern))) {
      return true;
    }

    if (falsePatterns.some(pattern => text.includes(pattern))) {
      return false;
    }

    return null;
  }

  private isPositiveResponse(text: string): boolean {
    const positiveWords = ['yes', 'yeah', 'yep', 'correct', 'right', 'exactly', 'sure', 'ok', 'okay'];
    const lowerText = text.toLowerCase();
    return positiveWords.some(word => lowerText.includes(word));
  }

  private isNegativeResponse(text: string): boolean {
    const negativeWords = ['no', 'nope', 'wrong', 'incorrect', 'not', 'never'];
    const lowerText = text.toLowerCase();
    return negativeWords.some(word => lowerText.includes(word));
  }
}