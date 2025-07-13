export class DefaultResponseGenerator {
  async generateResponse(executionContext, commandResult, config) {
    const response = {
      success: commandResult.success,
      command: executionContext.command,
      executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    
    if (commandResult.success) {
      response.message = commandResult.output || 'Command executed successfully';
      if (commandResult.data) {
        response.data = commandResult.data;
      }
      if (commandResult.suggestions) {
        response.suggestions = commandResult.suggestions;
      }
    } else {
      response.message = commandResult.error || 'Command failed';
    }
    
    return response;
  }
}