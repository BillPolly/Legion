import { CommandValidator, ValidationResult, RequirementCheckResult } from './CommandValidator';
import { CommandDefinition, CommandParameter } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../intent/types';

export class DefaultCommandValidator implements CommandValidator {
  validateIntent(intent: Intent, command: CommandDefinition, session: SessionState): ValidationResult {
    const errors: string[] = [];
    const validatedParameters: Record<string, any> = { ...intent.parameters };

    // Check requirements first
    const requirementCheck = this.checkRequirements(command, session);
    if (!requirementCheck.canExecute) {
      return {
        isValid: false,
        errors: requirementCheck.errors,
        validatedParameters
      };
    }

    // Validate parameters if command has them
    if (command.parameters) {
      for (const param of command.parameters) {
        const value = validatedParameters[param.name];

        // Check required parameters
        if (param.required && (value === undefined || value === null)) {
          errors.push(`Missing required parameter: ${param.name}`);
          continue;
        }

        // Apply default values for missing optional parameters
        if (value === undefined && param.default !== undefined) {
          validatedParameters[param.name] = param.default;
          continue;
        }

        // Skip validation if parameter is not provided and not required
        if (value === undefined) {
          continue;
        }

        // Type coercion
        const coercedValue = this.coerceParameterType(value, param.type);
        validatedParameters[param.name] = coercedValue;

        // Type validation
        if (!this.validateParameterType(coercedValue, param.type)) {
          errors.push(`Parameter ${param.name} must be of type ${param.type}`);
          continue;
        }

        // Enum validation
        if (param.type === 'enum' && param.enum) {
          if (!param.enum.includes(coercedValue)) {
            errors.push(`Parameter ${param.name} must be one of: ${param.enum.join(', ')}`);
            continue;
          }
        }

        // Custom validation
        if (param.validator && !param.validator(coercedValue)) {
          const message = param.validationError || `Parameter ${param.name} failed validation`;
          errors.push(message);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedParameters
    };
  }

  checkRequirements(command: CommandDefinition, session: SessionState): RequirementCheckResult {
    const errors: string[] = [];

    if (!command.requirements) {
      return { canExecute: true, errors: [] };
    }

    const requirements = command.requirements;

    // Check required state keys
    if (requirements.requiredState) {
      for (const stateKey of requirements.requiredState) {
        const stateValue = session.state.get(stateKey);
        if (stateValue === undefined || stateValue === null || stateValue === false) {
          const message = requirements.errorMessage || `Required state missing: ${stateKey}`;
          errors.push(message);
        }
      }
    }

    // Run custom requirement checker
    if (requirements.customChecker) {
      try {
        const checkResult = requirements.customChecker(session);
        if (!checkResult) {
          const message = requirements.errorMessage || 'Custom requirement check failed';
          errors.push(message);
        }
      } catch (error) {
        const message = requirements.errorMessage || `Requirement check error: ${error}`;
        errors.push(message);
      }
    }

    return {
      canExecute: errors.length === 0,
      errors
    };
  }

  coerceParameterType(value: any, type: string): any {
    try {
      switch (type) {
        case 'string':
          return typeof value === 'string' ? value : String(value);

        case 'number':
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const num = Number(value);
            return isNaN(num) ? value : num;
          }
          return value;

        case 'boolean':
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === 'yes' || lower === '1') return true;
            if (lower === 'false' || lower === 'no' || lower === '0') return false;
          }
          return value;

        case 'array':
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') {
            // Try to parse as comma-separated values
            return value.split(',').map(item => item.trim());
          }
          return value;

        case 'object':
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return value;
          }
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch (error) {
              return value;
            }
          }
          return value;

        case 'enum':
          return value;

        default:
          return value;
      }
    } catch (error) {
      console.error(`Error coercing parameter type ${type}:`, error);
      return value;
    }
  }

  validateParameterType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        return typeof value === 'number' && !isNaN(value);

      case 'boolean':
        return typeof value === 'boolean';

      case 'array':
        return Array.isArray(value);

      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);

      case 'enum':
        return true; // Enum validation is handled separately

      default:
        return true;
    }
  }
}