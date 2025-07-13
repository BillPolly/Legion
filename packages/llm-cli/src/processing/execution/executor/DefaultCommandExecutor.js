export class DefaultCommandExecutor {
  constructor(validator) {
    this.validator = validator;
  }

  async executeCommand(intent, commandDef, session) {
    // Validate parameters
    const validation = this.validator.validate(intent.command, intent.parameters, commandDef);
    
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`
      };
    }
    
    // Execute command handler
    try {
      const result = await commandDef.handler(intent.parameters, session);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}