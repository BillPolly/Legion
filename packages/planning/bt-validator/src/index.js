/**
 * @legion/bt-validator - Behavior Tree validation for Legion framework
 * 
 * This package provides comprehensive validation for behavior tree structures,
 * including BT node validation, tool availability, parameter schemas, and tree integrity.
 */

// Main exports
export { BTValidator, ValidationResult, PlanValidator } from './BTValidator.js';
export { ValidationUtils } from './ValidationUtils.js';
export * from './errors.js';

// Default export
import { BTValidator } from './BTValidator.js';
export default BTValidator;