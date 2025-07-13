export class DefaultChatCommand {
  getCommandDefinition(llmProvider) {
    return {
      handler: async (args, session) => {
        const input = args.input || args.message || args.query || '';
        
        if (!input) {
          return {
            success: false,
            error: 'No input provided for chat'
          };
        }
        
        try {
          const response = await llmProvider.complete(input);
          
          return {
            success: true,
            output: response
          };
        } catch (error) {
          return {
            success: false,
            error: `Chat error: ${error.message}`
          };
        }
      },
      description: 'Chat with the AI assistant',
      parameters: [{
        name: 'input',
        type: 'string',
        description: 'Your message to the AI',
        required: true
      }],
      examples: [{
        input: 'chat Hello, how are you?',
        description: 'Start a conversation'
      }]
    };
  }
}