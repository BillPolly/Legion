import { ValidationHelper } from './ValidationHelper.js';

export class ConfigValidator {
  static validateAgentConfig(config) {
    const requiredFields = ['name', 'version', 'maxTokens'];
    
    for (const field of requiredFields) {
      if (!config.agent?.[field]) {
        throw new Error(`Missing required agent config field: ${field}`);
      }
    }
    
    if (config.maxTokens < 0 || config.maxTokens > 32768) {
      throw new Error('maxTokens must be between 0 and 32768');
    }
    
    return true;
  }
}
