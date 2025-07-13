export class DefaultIntentRecognizer {
  async recognizeIntent(input, config, session) {
    // Simple intent recognition - split by spaces
    const parts = input.trim().split(/\s+/);
    const command = parts[0];
    
    // Extract parameters (everything after the command)
    const parameters = {};
    if (parts.length > 1) {
      // Simple key=value parsing
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].includes('=')) {
          const [key, value] = parts[i].split('=');
          parameters[key] = value;
        } else {
          // Default parameter
          parameters.input = parts.slice(1).join(' ');
          break;
        }
      }
    }
    
    return {
      command,
      parameters,
      confidence: 1.0,
      rawInput: input
    };
  }
}