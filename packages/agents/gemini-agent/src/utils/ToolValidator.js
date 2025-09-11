import { ValidationHelper } from './ValidationHelper.js';

export class ToolValidator {
  static validateToolConfig(toolConfig) {
    if (!toolConfig.name) {
      throw new Error('Tool must have a name');
    }
    
    if (!toolConfig.description) {
      throw new Error('Tool must have a description');
    }
    
    if (typeof toolConfig.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
    
    return true;
  }
  
  static validateToolParams(params, schema) {
    return ValidationHelper.validateSchema(params, schema);
  }
}
