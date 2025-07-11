const ResponseParser = require('./ResponseParser');
const ResponseValidator = require('./ResponseValidator');

/**
 * Manages retry logic for LLM responses with error feedback
 */
class RetryManager {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.backoffMultiplier = config.backoffMultiplier || 1000; // milliseconds
    this.tools = config.tools || [];
    
    this.parser = new ResponseParser();
    this.validator = new ResponseValidator(this.tools);
  }

  /**
   * Process a response with automatic retry on errors
   * @param {Object} model - The model instance with sendAndReceiveResponse method
   * @param {Array} messages - The message history
   * @returns {Promise<{success: boolean, data: any, error: string, retries: number}>}
   */
  async processResponse(model, messages) {
    let retries = 0;
    let lastError = null;
    let currentMessages = [...messages]; // Clone to avoid mutating original
    
    while (retries <= this.maxRetries) {
      try {
        // Get response from model
        const rawResponse = await model.sendAndReceiveResponse(currentMessages);
        
        // Parse the response
        const parseResult = this.parser.parse(rawResponse);
        
        if (!parseResult.success) {
          lastError = {
            type: 'parse',
            message: parseResult.error
          };
          
          if (retries < this.maxRetries) {
            // Add error feedback to messages
            currentMessages = this.addErrorFeedback(currentMessages, lastError);
            retries++;
            await this.backoff(retries);
            continue;
          }
        }
        
        // Validate the parsed response
        const validationResult = this.validator.validateResponse(parseResult.data);
        
        if (!validationResult.valid) {
          lastError = {
            type: 'validation',
            errors: validationResult.errors
          };
          
          // Check if there are suggestions for tool/function names
          if (parseResult.data?.use_tool) {
            const toolValidation = this.validator.validateToolUse(parseResult.data.use_tool);
            if (toolValidation.suggestions) {
              lastError.suggestions = toolValidation.suggestions;
            }
          }
          
          if (retries < this.maxRetries) {
            // Add error feedback to messages
            currentMessages = this.addErrorFeedback(currentMessages, lastError);
            retries++;
            await this.backoff(retries);
            continue;
          }
        }
        
        // Success!
        return {
          success: true,
          data: parseResult.data,
          error: null,
          retries
        };
        
      } catch (error) {
        lastError = {
          type: 'exception',
          message: error.message
        };
        
        if (retries < this.maxRetries) {
          messages = this.addErrorFeedback(messages, lastError);
          retries++;
          await this.backoff(retries);
          continue;
        }
      }
    }
    
    // Max retries exceeded
    return {
      success: false,
      data: null,
      error: `Max retries exceeded. Last error: ${this.formatErrorForResponse(lastError)}`,
      retries
    };
  }

  /**
   * Add error feedback to the message history
   */
  addErrorFeedback(messages, error) {
    const feedback = this.formatErrorFeedback(error);
    
    // Clone messages to avoid mutation
    const newMessages = [...messages];
    
    // Add error feedback as a user message
    newMessages.push({
      role: 'user',
      content: feedback
    });
    
    return newMessages;
  }

  /**
   * Format error into helpful feedback for the LLM
   */
  formatErrorFeedback(error) {
    let feedback = 'Your response had an error. Please correct it and try again.\n\n';
    
    switch (error.type) {
      case 'parse':
        feedback += '### JSON PARSING ERROR\n';
        feedback += 'Your response could not be parsed as valid JSON.\n';
        feedback += `Error: ${error.message}\n\n`;
        feedback += 'Common issues:\n';
        feedback += '- Missing commas between properties\n';
        feedback += '- Unmatched brackets or braces\n';
        feedback += '- Unescaped quotes in strings\n';
        feedback += '- Trailing commas (though JSON5 supports them)\n';
        break;
        
      case 'validation':
        feedback += '### VALIDATION ERROR\n';
        feedback += 'Your response structure is incorrect.\n\n';
        feedback += 'Errors found:\n';
        error.errors.forEach(err => {
          feedback += `- ${err}\n`;
        });
        
        if (error.suggestions) {
          feedback += '\n### SUGGESTIONS\n';
          if (error.suggestions.tool) {
            feedback += `Did you mean: ${error.suggestions.tool}?\n`;
          }
          if (error.suggestions.function) {
            feedback += `Did you mean: ${error.suggestions.function}?\n`;
          }
        }
        break;
        
      case 'exception':
        feedback += '### SYSTEM ERROR\n';
        feedback += `An error occurred: ${error.message}\n`;
        break;
    }
    
    feedback += '\n### REMINDER\n';
    feedback += 'Expected format:\n';
    feedback += '```json\n';
    feedback += '{\n';
    feedback += '  "task_completed": true/false,\n';
    feedback += '  "response": {\n';
    feedback += '    "type": "string",\n';
    feedback += '    "message": "Your response message"\n';
    feedback += '  },\n';
    feedback += '  "use_tool": {  // Optional, only if using a tool\n';
    feedback += '    "identifier": "tool_identifier",\n';
    feedback += '    "function_name": "function_name",\n';
    feedback += '    "args": ["arg1", "arg2"]\n';
    feedback += '  }\n';
    feedback += '}\n';
    feedback += '```\n\n';
    feedback += 'Please provide a corrected response following this format exactly.';
    
    return feedback;
  }

  /**
   * Format error for final response
   */
  formatErrorForResponse(error) {
    if (error.type === 'parse') {
      return error.message;
    } else if (error.type === 'validation') {
      return error.errors.join('; ');
    } else {
      return error.message || 'Unknown error';
    }
  }

  /**
   * Exponential backoff delay
   */
  async backoff(retryCount) {
    const delay = this.backoffMultiplier * Math.pow(2, retryCount - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = RetryManager;