import { PromptBuilder } from './PromptBuilder';
import { LLMCLIConfig, CommandDefinition } from '../../core/types';
import { SessionState } from '../../runtime/session/types';
import { ContextData } from '../../runtime/context/types';
import { HistoryEntry } from '../../runtime/session/types';

export class DefaultPromptBuilder implements PromptBuilder {
  private readonly DEFAULT_SYSTEM_PROMPT = `You are a CLI intent recognition system. Analyze user input and map it to available commands.`;

  async buildSystemPrompt(config: LLMCLIConfig, session: SessionState): Promise<string> {
    const parts: string[] = [];

    // Base system prompt
    parts.push(config.systemPrompt || this.DEFAULT_SYSTEM_PROMPT);

    // Custom sections from template
    if (config.promptTemplate?.customSections) {
      const customSections = config.promptTemplate.customSections
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .map(section => section.generator(session));
      parts.push(...customSections);
    }

    // Available commands section
    parts.push('\nAVAILABLE COMMANDS:');
    parts.push(this.formatAllCommands(config.commands, session));

    // Response format instructions
    parts.push('\nRESPONSE FORMAT:');
    parts.push('Return a JSON object with: command, parameters, confidence');

    // Apply system template if provided
    const basePrompt = parts.join('\n');
    if (config.promptTemplate?.systemTemplate) {
      return config.promptTemplate.systemTemplate.replace('{{basePrompt}}', basePrompt);
    }

    return basePrompt;
  }

  async buildUserMessage(input: string, session: SessionState): Promise<string> {
    const parts: string[] = [];

    // Add conversation context if there's history
    if (session.history.length > 0) {
      parts.push('Previous context:');
      parts.push(this.formatHistory(session.history, 3));
      parts.push('');
    }

    // User input
    parts.push(`User input: ${input}`);

    return parts.join('\n');
  }

  formatCommandInfo(name: string, command: CommandDefinition, session: SessionState): string {
    // Check requirements first
    if (command.requirements?.customChecker && !command.requirements.customChecker(session)) {
      return '';
    }

    const parts: string[] = [];

    // Basic info
    parts.push(`Command: ${name}`);
    parts.push(`Description: ${command.description}`);

    // Parameters
    if (command.parameters && command.parameters.length > 0) {
      parts.push('Parameters:');
      command.parameters.forEach(param => {
        const required = param.required ? 'required' : 'optional';
        const defaultValue = param.default !== undefined ? ` (default: ${param.default})` : '';
        parts.push(`  - ${param.name}: ${param.type} (${required})${defaultValue} - ${param.description}`);
      });
    }

    // Examples
    if (command.examples && command.examples.length > 0) {
      parts.push('Examples:');
      command.examples.forEach(example => {
        parts.push(`  - "${example.input}"`);
      });
    }

    // Dynamic help
    if (command.helpGenerator) {
      const dynamicHelp = command.helpGenerator(session);
      parts.push(`Note: ${dynamicHelp}`);
    }

    // Apply command template if provided
    const config = session as any; // Access config through session if needed
    if (config.promptTemplate?.commandTemplate) {
      return config.promptTemplate.commandTemplate
        .replace('{{name}}', name)
        .replace('{{description}}', command.description);
    }

    return parts.join('\n');
  }

  formatContext(contexts: ContextData[]): string {
    if (contexts.length === 0) {
      return 'No additional context available.';
    }

    const parts: string[] = [];

    if (contexts.length === 1) {
      parts.push(contexts[0].summary);
    } else {
      contexts.forEach(context => {
        parts.push(`- ${context.summary}`);
      });
    }

    // Include warnings
    const allWarnings = contexts.flatMap(c => c.warnings || []);
    if (allWarnings.length > 0) {
      parts.push('\nWarnings:');
      allWarnings.forEach(warning => {
        parts.push(`- ${warning}`);
      });
    }

    return parts.join('\n');
  }

  formatHistory(history: HistoryEntry[], limit: number = 5): string {
    if (history.length === 0) {
      return 'No previous commands.';
    }

    // Get the most recent entries
    const recentHistory = history.slice(-limit);
    const parts: string[] = [];

    recentHistory.forEach(entry => {
      parts.push(`User: ${entry.input}`);
      
      if (entry.intent) {
        parts.push(`Command: ${entry.intent.command}`);
      }
      
      if (entry.result) {
        const status = entry.result.success ? 'Success' : 'Failed';
        const message = entry.result.success 
          ? entry.result.output || ''
          : entry.result.error || '';
        parts.push(`Result: ${status}${message ? ' - ' + message : ''}`);
      }
      
      parts.push('---');
    });

    // Remove the last separator
    parts.pop();

    return parts.join('\n');
  }

  private formatAllCommands(commands: Record<string, CommandDefinition>, session: SessionState): string {
    const formattedCommands: string[] = [];

    Object.entries(commands).forEach(([name, command]) => {
      const formatted = this.formatCommandInfo(name, command, session);
      if (formatted) {
        formattedCommands.push(formatted);
        formattedCommands.push(''); // Add spacing between commands
      }
    });

    return formattedCommands.join('\n').trim();
  }
}