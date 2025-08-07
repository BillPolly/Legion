/**
 * Input validation utilities for plan validation
 */

import { ValidationError } from './errors.js';

/**
 * Input validator utility class
 */
export class ValidationUtils {
  /**
   * Validate that a value is not null or undefined
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If value is null or undefined
   */
  static required(value, fieldName) {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} is required`, fieldName, value);
    }
  }

  /**
   * Validate that a string is not empty
   * @param {string} value - String to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If string is empty
   */
  static nonEmptyString(value, fieldName) {
    this.required(value, fieldName);
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new ValidationError(`${fieldName} must be a non-empty string`, fieldName, value);
    }
  }

  /**
   * Validate that a value is a positive number
   * @param {number} value - Number to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If not a positive number
   */
  static positiveNumber(value, fieldName) {
    this.required(value, fieldName);
    if (typeof value !== 'number' || value <= 0 || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a positive number`, fieldName, value);
    }
  }

  /**
   * Validate that a value is a non-negative number
   * @param {number} value - Number to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If not a non-negative number
   */
  static nonNegativeNumber(value, fieldName) {
    this.required(value, fieldName);
    if (typeof value !== 'number' || value < 0 || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a non-negative number`, fieldName, value);
    }
  }

  /**
   * Validate that a value is an array
   * @param {Array} value - Array to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If not an array
   */
  static array(value, fieldName) {
    this.required(value, fieldName);
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName, value);
    }
  }

  /**
   * Validate that a value is a function
   * @param {Function} value - Function to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If not a function
   */
  static function(value, fieldName) {
    this.required(value, fieldName);
    if (typeof value !== 'function') {
      throw new ValidationError(`${fieldName} must be a function`, fieldName, value);
    }
  }

  /**
   * Validate that a value is an object
   * @param {Object} value - Object to validate
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If not an object
   */
  static object(value, fieldName) {
    this.required(value, fieldName);
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an object`, fieldName, value);
    }
  }

  /**
   * Validate that a value is one of the allowed values
   * @param {any} value - Value to validate
   * @param {Array} allowedValues - Array of allowed values
   * @param {string} fieldName - Name of the field being validated
   * @throws {ValidationError} If value is not in allowed values
   */
  static oneOf(value, allowedValues, fieldName) {
    this.required(value, fieldName);
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        fieldName,
        value,
        [`Expected one of: ${allowedValues.join(', ')}`]
      );
    }
  }

  /**
   * Validate a plan step structure
   * @param {Object} step - Step to validate
   * @throws {ValidationError} If step is invalid
   */
  static planStep(step) {
    this.object(step, 'step');
    this.nonEmptyString(step.id, 'step.id');
    this.nonEmptyString(step.description, 'step.description');
    this.nonEmptyString(step.tool, 'step.tool');
    
    if (step.params !== undefined) {
      this.object(step.params, 'step.params');
    }
    
    if (step.dependencies !== undefined) {
      this.array(step.dependencies, 'step.dependencies');
    }
  }

  /**
   * Validate resource constraints
   * @param {Object} constraints - Constraints to validate
   * @throws {ValidationError} If constraints are invalid
   */
  static resourceConstraints(constraints) {
    this.object(constraints, 'constraints');
    
    if (constraints.maxExecutionTime !== undefined) {
      this.positiveNumber(constraints.maxExecutionTime, 'constraints.maxExecutionTime');
    }
    
    if (constraints.maxMemoryMB !== undefined) {
      this.positiveNumber(constraints.maxMemoryMB, 'constraints.maxMemoryMB');
    }
    
    if (constraints.maxToolCalls !== undefined) {
      this.positiveNumber(constraints.maxToolCalls, 'constraints.maxToolCalls');
    }
    
    if (constraints.maxRecursionDepth !== undefined) {
      this.positiveNumber(constraints.maxRecursionDepth, 'constraints.maxRecursionDepth');
    }
    
    if (constraints.maxConcurrentSteps !== undefined) {
      this.positiveNumber(constraints.maxConcurrentSteps, 'constraints.maxConcurrentSteps');
    }
  }

  /**
   * Validate agent configuration
   * @param {Object} config - Configuration to validate
   * @throws {ValidationError} If configuration is invalid
   */
  static agentConfig(config) {
    this.object(config, 'config');
    this.nonEmptyString(config.name, 'config.name');
    this.nonEmptyString(config.description, 'config.description');
  }
}