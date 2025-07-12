import { CommandDefinition } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../intent/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validatedParameters: Record<string, any>;
}

export interface RequirementCheckResult {
  canExecute: boolean;
  errors: string[];
}

export interface CommandValidator {
  /**
   * Validate an intent against a command definition
   */
  validateIntent(intent: Intent, command: CommandDefinition, session: SessionState): ValidationResult;

  /**
   * Check if command requirements are met
   */
  checkRequirements(command: CommandDefinition, session: SessionState): RequirementCheckResult;

  /**
   * Coerce parameter to the correct type
   */
  coerceParameterType(value: any, type: string): any;

  /**
   * Validate parameter type
   */
  validateParameterType(value: any, type: string): boolean;
}