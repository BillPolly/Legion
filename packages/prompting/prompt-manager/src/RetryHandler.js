/**
 * RetryHandler - Intelligent retry logic with error feedback
 */

export class RetryHandler {
  constructor(retryConfig = {}) {
    this.config = {
      maxAttempts: 3,
      errorFeedback: { enabled: true },
      backoffMs: 1000,
      timeoutMs: 30000,
      ...retryConfig
    };
    
    this.attemptHistory = [];
  }

  async executeWithRetry(attemptFunction, options = {}) {
    const maxAttempts = options.maxAttempts || this.config.maxAttempts;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await attemptFunction(attempt, lastError);
        
        if (result.success) {
          return {
            ...result,
            metadata: {
              ...result.metadata,
              attempts: attempt,
              attemptHistory: this.attemptHistory
            }
          };
        }

        // Store attempt info
        lastError = result;
        this.attemptHistory.push({
          attempt: attempt,
          errors: result.errors,
          timestamp: new Date().toISOString()
        });

        if (attempt < maxAttempts) {
          await this._delayBeforeRetry(attempt);
        }

      } catch (error) {
        const errorResult = { errors: [{ message: error.message }] };
        lastError = errorResult;
        
        this.attemptHistory.push({
          attempt: attempt,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        if (attempt >= maxAttempts) {
          throw error;
        }
      }
    }

    return {
      success: false,
      stage: 'retry_exhausted',
      errors: this.attemptHistory[this.attemptHistory.length - 1]?.errors || [],
      attemptHistory: this.attemptHistory,
      totalAttempts: maxAttempts
    };
  }

  generateErrorFeedback(errors, originalPrompt) {
    if (!this.config.errorFeedback.enabled) {
      return originalPrompt;
    }

    const errorList = errors.map((error, index) => {
      let errorText = `${index + 1}. ${error.message}`;
      if (error.suggestion) {
        errorText += `\n   Suggestion: ${error.suggestion}`;
      }
      return errorText;
    }).join('\n\n');

    return `PREVIOUS RESPONSE HAD VALIDATION ERRORS:

${errorList}

ORIGINAL REQUEST:
${originalPrompt}

PLEASE PROVIDE CORRECTED RESPONSE:`;
  }

  updateConfiguration(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  validateConfiguration() {
    if (this.config.maxAttempts < 1) {
      throw new Error('maxAttempts must be at least 1');
    }
  }

  reset() {
    this.attemptHistory = [];
  }

  async _delayBeforeRetry(attempt) {
    const delay = this.config.backoffMs * attempt;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}