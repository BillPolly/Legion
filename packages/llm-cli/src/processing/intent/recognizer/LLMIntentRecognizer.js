export class LLMIntentRecognizer {
  constructor(llmProvider) {
    this.llmProvider = llmProvider;
  }
  
  async recognizeIntent(input, config, session) {
    const commands = Object.keys(config.commands);
    const commandDescriptions = commands.map(cmd => {
      const def = config.commands[cmd];
      return `- ${cmd}: ${def.description}`;
    }).join('\n');
    
    const prompt = `USER INPUT: ${input}

Available commands:
${commandDescriptions}

Analyze the user input and determine which command they want to execute.
Return a JSON object with:
- command: the command name
- parameters: an object with the command parameters
- confidence: a number between 0 and 1 indicating confidence

If the input doesn't match any command, use "chat" as the default command.`;

    try {
      const schema = {
        type: 'object',
        properties: {
          command: { type: 'string' },
          parameters: { type: 'object' },
          confidence: { type: 'number' }
        },
        required: ['command', 'parameters', 'confidence']
      };
      
      const result = await this.llmProvider.completeStructured(prompt, schema);
      
      return {
        ...result,
        rawInput: input
      };
    } catch (error) {
      // Fallback to simple parsing
      const parts = input.trim().split(/\s+/);
      const command = parts[0];
      const parameters = parts.length > 1 ? { input: parts.slice(1).join(' ') } : {};
      
      return {
        command,
        parameters,
        confidence: 0.5,
        rawInput: input
      };
    }
  }
}