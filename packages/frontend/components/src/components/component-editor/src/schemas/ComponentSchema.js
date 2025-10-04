/**
 * Component Data Model Schema - Phase 1.2
 *
 * Schema validation for component data structures
 */

/**
 * Data Model Schema Validator
 */
export class DataModelSchema {
  static validate(dataModel) {
    const errors = [];

    // Required fields
    if (!dataModel) {
      errors.push('is required');
      return { isValid: false, errors };
    }

    if (typeof dataModel !== 'object' || Array.isArray(dataModel)) {
      errors.push('must be an object');
      return { isValid: false, errors };
    }

    if (!dataModel.entityName) {
      errors.push('entityName is required');
    } else if (typeof dataModel.entityName !== 'string') {
      errors.push('entityName must be a string');
    }

    if (!dataModel.hasOwnProperty('schema')) {
      errors.push('schema is required');
    } else if (typeof dataModel.schema !== 'object' || Array.isArray(dataModel.schema)) {
      errors.push('schema must be an object');
    } else {
      // Validate schema fields
      for (const [fieldName, fieldDef] of Object.entries(dataModel.schema)) {
        if (!fieldDef.type) {
          errors.push(`schema.${fieldName}.type is required`);
        } else {
          const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'date'];
          if (!validTypes.includes(fieldDef.type)) {
            errors.push(`schema.${fieldName}.type must be one of: ${validTypes.join(', ')}`);
          }
        }
      }
    }

    if (!dataModel.hasOwnProperty('sampleData')) {
      errors.push('sampleData is required');
    } else if (typeof dataModel.sampleData !== 'object' || Array.isArray(dataModel.sampleData)) {
      errors.push('sampleData must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Component Schema Validator
 */
export class ComponentSchema {
  static validate(componentData) {
    const errors = [];

    // Required fields
    if (!componentData) {
      errors.push('componentData is required');
      return { isValid: false, errors };
    }

    if (!componentData.name) {
      errors.push('name is required');
    } else if (typeof componentData.name !== 'string') {
      errors.push('name must be a string');
    }

    if (!componentData.dsl) {
      errors.push('dsl is required');
    } else if (typeof componentData.dsl !== 'string') {
      errors.push('dsl must be a string');
    }

    if (!componentData.dataModel) {
      errors.push('dataModel is required');
    } else {
      // Validate nested dataModel
      const dataModelResult = DataModelSchema.validate(componentData.dataModel);
      if (!dataModelResult.isValid) {
        errors.push(...dataModelResult.errors.map(err => {
          // If error is about the dataModel itself (e.g., "must be an object"),
          // prefix with "dataModel " (no dot)
          // If error is about a field (e.g., "entityName is required"),
          // prefix with "dataModel."
          if (err === 'is required' || err === 'must be an object') {
            return `dataModel ${err}`;
          }
          return err.startsWith('dataModel.') ? err : `dataModel.${err}`;
        }));
      }
    }

    // Optional fields validation
    if (componentData.hasOwnProperty('description') && typeof componentData.description !== 'string') {
      errors.push('description must be a string');
    }

    if (componentData.hasOwnProperty('cnl') && typeof componentData.cnl !== 'string') {
      errors.push('cnl must be a string');
    }

    if (componentData.hasOwnProperty('json') && (typeof componentData.json !== 'object' || Array.isArray(componentData.json))) {
      errors.push('json must be an object');
    }

    if (componentData.hasOwnProperty('author')) {
      const validAuthors = ['human', 'ai', 'collaborative'];
      if (!validAuthors.includes(componentData.author)) {
        errors.push(`author must be one of: ${validAuthors.join(', ')}`);
      }
    }

    if (componentData.hasOwnProperty('authorDetails') && (typeof componentData.authorDetails !== 'object' || Array.isArray(componentData.authorDetails))) {
      errors.push('authorDetails must be an object');
    }

    if (componentData.hasOwnProperty('tags')) {
      if (!Array.isArray(componentData.tags)) {
        errors.push('tags must be an array');
      } else if (!componentData.tags.every(tag => typeof tag === 'string')) {
        errors.push('tags must be an array of strings');
      }
    }

    if (componentData.hasOwnProperty('category') && typeof componentData.category !== 'string') {
      errors.push('category must be a string');
    }

    if (componentData.hasOwnProperty('created') && typeof componentData.created !== 'string') {
      errors.push('created must be a string (ISO date)');
    }

    if (componentData.hasOwnProperty('modified') && typeof componentData.modified !== 'string') {
      errors.push('modified must be a string (ISO date)');
    }

    if (componentData.hasOwnProperty('version') && typeof componentData.version !== 'number') {
      errors.push('version must be a number');
    }

    if (componentData.hasOwnProperty('tests')) {
      if (!Array.isArray(componentData.tests)) {
        errors.push('tests must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
