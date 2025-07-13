export class DefaultCommandValidator {
  validate(command, parameters, commandDef) {
    const errors = [];
    
    if (commandDef.parameters) {
      for (const param of commandDef.parameters) {
        if (param.required && !(param.name in parameters)) {
          errors.push(`Missing required parameter: ${param.name}`);
        }
        
        if (param.name in parameters && param.validator) {
          if (!param.validator(parameters[param.name])) {
            errors.push(param.validationError || `Invalid value for parameter: ${param.name}`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}