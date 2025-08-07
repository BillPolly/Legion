/**
 * Validation utilities for attribute-based values system
 */

import { ValidationResult, ValidationError, ValidationResultBuilder } from '../types/ValidationResult';
import { KindUtils } from './KindUtils';

export interface AttributeDefinition {
  id: string;
  name: string;
  description?: string;
  dataType: 'string' | 'number' | 'boolean' | 'categorical' | 'array' | 'object';
  valueRange?: any[]; // For categorical types
  defaultValue?: any;
  units?: string;
  required?: boolean;
  validationRules?: string[];
  compatibleKinds?: string[]; // Which capability kinds can use this attribute
}

export class AttributeValidator {
  /**
   * Validate that all keys in values are valid attribute IDs
   */
  static validateAttributeKeys(
    values: Record<string, any>,
    availableAttributes: Map<string, AttributeDefinition>
  ): ValidationResult {
    const builder = new ValidationResultBuilder();

    for (const attributeId of Object.keys(values)) {
      if (!availableAttributes.has(attributeId)) {
        builder.addError(
          'values',
          `Invalid attribute ID: '${attributeId}'. All keys in values must be IDs of attribute capabilities.`,
          'INVALID_ATTRIBUTE_ID'
        );
      }
    }

    return builder.build();
  }

  /**
   * Validate that attribute values conform to their definitions
   */
  static validateAttributeValues(
    values: Record<string, any>,
    availableAttributes: Map<string, AttributeDefinition>,
    capabilityKind: string
  ): ValidationResult {
    const builder = new ValidationResultBuilder();

    for (const [attributeId, value] of Object.entries(values)) {
      const attribute = availableAttributes.get(attributeId);
      if (!attribute) {
        builder.addError('values', `Attribute '${attributeId}' not found`, 'ATTRIBUTE_NOT_FOUND');
        continue;
      }

      // Check if this attribute is compatible with the capability kind
      if (attribute.compatibleKinds && attribute.compatibleKinds.length > 0) {
        const isCompatible = attribute.compatibleKinds.some(compatibleKind => 
          KindUtils.isDescendantOf(capabilityKind, compatibleKind) ||
          capabilityKind === compatibleKind ||
          capabilityKind.includes(compatibleKind)
        );

        if (!isCompatible) {
          builder.addError(
            attributeId,
            `Attribute '${attributeId}' is not compatible with capability kind '${capabilityKind}'. Compatible kinds: ${attribute.compatibleKinds.join(', ')}`,
            'INCOMPATIBLE_ATTRIBUTE'
          );
          continue;
        }
      }

      // Validate value against attribute definition
      const valueValidation = this.validateSingleValue(value, attribute, attributeId);
      if (!valueValidation.isValid) {
        // Add all validation errors from the single value validation
        valueValidation.errors.forEach(error => {
          builder.addError(error.field, error.message, error.code);
        });
      }
    }

    // Check for required attributes
    for (const [attributeId, attribute] of availableAttributes) {
      if (attribute.required && !(attributeId in values)) {
        // Check if this required attribute applies to this capability kind
        if (!attribute.compatibleKinds || attribute.compatibleKinds.length === 0 ||
            attribute.compatibleKinds.some(compatibleKind => 
              KindUtils.isDescendantOf(capabilityKind, compatibleKind) ||
              capabilityKind === compatibleKind ||
              capabilityKind.includes(compatibleKind)
            )) {
          builder.addFieldRequired(attributeId);
        }
      }
    }

    return builder.build();
  }

  /**
   * Validate a single value against its attribute definition
   */
  private static validateSingleValue(
    value: any,
    attribute: AttributeDefinition,
    fieldName: string
  ): ValidationResult {
    const builder = new ValidationResultBuilder();

    // Check data type
    switch (attribute.dataType) {
      case 'string':
        if (typeof value !== 'string') {
          builder.addInvalidValue(fieldName, value, 'string');
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          builder.addInvalidValue(fieldName, value, 'number');
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          builder.addInvalidValue(fieldName, value, 'boolean');
        }
        break;

      case 'categorical':
        if (attribute.valueRange && !attribute.valueRange.includes(value)) {
          builder.addError(
            fieldName,
            `Value '${value}' not in allowed range: ${attribute.valueRange.join(', ')}`,
            'VALUE_OUT_OF_RANGE'
          );
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          builder.addInvalidValue(fieldName, value, 'array');
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          builder.addInvalidValue(fieldName, value, 'object');
        }
        break;
    }

    // Apply custom validation rules
    if (attribute.validationRules) {
      for (const rule of attribute.validationRules) {
        const ruleValidation = this.applyValidationRule(value, rule, fieldName);
        if (!ruleValidation.isValid) {
          ruleValidation.errors.forEach(error => {
            builder.addError(error.field, error.message, error.code);
          });
        }
      }
    }

    return builder.build();
  }

  /**
   * Apply a specific validation rule
   */
  private static applyValidationRule(
    value: any,
    rule: string,
    fieldName: string
  ): ValidationResult {
    const builder = new ValidationResultBuilder();

    switch (rule) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          builder.addError(fieldName, 'Value is required', 'REQUIRED_VALUE');
        }
        break;

      case 'positive':
        if (typeof value === 'number' && value <= 0) {
          builder.addError(fieldName, 'Value must be positive', 'MUST_BE_POSITIVE');
        }
        break;

      case 'non_negative':
        if (typeof value === 'number' && value < 0) {
          builder.addError(fieldName, 'Value must be non-negative', 'MUST_BE_NON_NEGATIVE');
        }
        break;

      case 'non_empty_string':
        if (typeof value === 'string' && value.trim() === '') {
          builder.addError(fieldName, 'String cannot be empty', 'EMPTY_STRING');
        }
        break;

      case 'non_empty_array':
        if (Array.isArray(value) && value.length === 0) {
          builder.addError(fieldName, 'Array cannot be empty', 'EMPTY_ARRAY');
        }
        break;

      case 'valid_duration':
        if (typeof value === 'string' && !this.isValidDuration(value)) {
          builder.addError(
            fieldName,
            'Invalid duration format. Expected format like "30 minutes", "2 hours", "1 day"',
            'INVALID_DURATION'
          );
        }
        break;

      case 'valid_currency':
        if (typeof value === 'number' && (value < 0 || !Number.isFinite(value))) {
          builder.addError(fieldName, 'Invalid currency value', 'INVALID_CURRENCY');
        }
        break;

      default:
        // Custom rule - could be extended with regex patterns, etc.
        if (rule.startsWith('regex:')) {
          const pattern = rule.substring(6);
          const regex = new RegExp(pattern);
          if (typeof value === 'string' && !regex.test(value)) {
            builder.addError(fieldName, `Value does not match pattern: ${pattern}`, 'REGEX_MISMATCH');
          }
        }
        break;
    }

    return builder.build();
  }

  /**
   * Check if a string is a valid duration format
   */
  private static isValidDuration(duration: string): boolean {
    const durationPattern = /^\d+\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months)$/i;
    return durationPattern.test(duration.trim());
  }

  /**
   * Get default values for required attributes
   */
  static getDefaultValues(
    availableAttributes: Map<string, AttributeDefinition>,
    capabilityKind: string
  ): Record<string, any> {
    const defaults: Record<string, any> = {};

    for (const [attributeId, attribute] of availableAttributes) {
      // Check if this attribute applies to this capability kind
      if (attribute.compatibleKinds && attribute.compatibleKinds.length > 0) {
        const isCompatible = attribute.compatibleKinds.some(compatibleKind => 
          KindUtils.isDescendantOf(capabilityKind, compatibleKind) ||
          capabilityKind === compatibleKind ||
          capabilityKind.includes(compatibleKind)
        );

        if (!isCompatible) {
          continue;
        }
      }

      // Add default value if specified
      if (attribute.defaultValue !== undefined) {
        defaults[attributeId] = attribute.defaultValue;
      }
    }

    return defaults;
  }

  /**
   * Get applicable attributes for a capability kind
   */
  static getApplicableAttributes(
    availableAttributes: Map<string, AttributeDefinition>,
    capabilityKind: string
  ): Map<string, AttributeDefinition> {
    const applicable = new Map<string, AttributeDefinition>();

    for (const [attributeId, attribute] of availableAttributes) {
      // If no compatible kinds specified, attribute applies to all
      if (!attribute.compatibleKinds || attribute.compatibleKinds.length === 0) {
        applicable.set(attributeId, attribute);
        continue;
      }

      // Check if this attribute is compatible with the capability kind
      const isCompatible = attribute.compatibleKinds.some(compatibleKind => 
        KindUtils.isDescendantOf(capabilityKind, compatibleKind) ||
        capabilityKind === compatibleKind ||
        capabilityKind.includes(compatibleKind)
      );

      if (isCompatible) {
        applicable.set(attributeId, attribute);
      }
    }

    return applicable;
  }

  /**
   * Create an attribute definition from a capability record
   */
  static createAttributeDefinition(attributeCapability: any): AttributeDefinition {
    const attributes = attributeCapability.attributes || {};
    
    return {
      id: attributeCapability.id,
      name: attributeCapability.name,
      description: attributeCapability.description,
      dataType: attributes.dataType || 'string',
      valueRange: attributes.valueRange,
      defaultValue: attributes.defaultValue,
      units: attributes.units,
      required: attributes.required || false,
      validationRules: attributes.validationRules || [],
      compatibleKinds: attributes.compatibleKinds || []
    };
  }
}
