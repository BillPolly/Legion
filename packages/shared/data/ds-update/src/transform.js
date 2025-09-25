/**
 * DS-Update Transformation Engine
 * 
 * Converts declarative update specifications combined with input data
 * (typically LLM responses) into DataStore-compatible update objects.
 */

import { evaluateExpression, resolveVariable } from './evaluator.js';
import * as helpers from './helpers.js';

/**
 * Transform a declarative update specification with input data into a DataStore update
 * @param {Object} updateSpec - The declarative update specification
 * @param {Object} data - Input data (e.g., LLM response)
 * @param {Object} context - Additional context (query results, original context, etc.)
 * @returns {Object|Array} DataStore-compatible update object(s)
 */
export function transformUpdate(updateSpec, data, context = {}) {
  if (!updateSpec || typeof updateSpec !== 'object') {
    throw new Error('Update specification is required and must be an object');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Input data is required and must be an object');
  }

  // Create resolution context combining all data sources
  const resolutionContext = {
    response: data,
    context: context,
    transform: {},  // Will be populated with transform results
    refs: {},       // Will be populated with entity references
    now: Date.now(),
    uuid: () => crypto.randomUUID ? crypto.randomUUID() : generateUUID()
  };

  // Process transform functions first if they exist
  if (updateSpec.transform) {
    resolutionContext.transform = processTransforms(
      updateSpec.transform,
      resolutionContext
    );
  }

  const updates = [];

  // Process simple update
  if (updateSpec.update) {
    const update = processUpdate(updateSpec.update, resolutionContext);
    updates.push(update);
  }

  // Process create operations
  if (updateSpec.create) {
    const created = processCreate(updateSpec.create, resolutionContext);
    if (Array.isArray(created)) {
      updates.push(...created);
    } else {
      updates.push(created);
    }
  }

  // Process conditional operations
  if (updateSpec.conditional) {
    const conditionalUpdates = processConditional(
      updateSpec.conditional,
      resolutionContext
    );
    if (conditionalUpdates.length > 0) {
      updates.push(...conditionalUpdates);
    }
  }

  // Return single update or array based on count
  if (updates.length === 0) {
    return null;
  } else if (updates.length === 1) {
    return updates[0];
  } else {
    return updates;
  }
}

/**
 * Process transform functions
 */
function processTransforms(transforms, context) {
  const results = {};

  for (const [name, transformDef] of Object.entries(transforms)) {
    try {
      // Handle different transform definition formats
      let result;

      if (typeof transformDef === 'function') {
        // Direct function
        result = transformDef(context.response, results, context.context);
      } else if (Array.isArray(transformDef)) {
        // Built-in helper format: ["helperName", ...args]
        const [helperName, ...args] = transformDef;
        const helper = helpers[helperName];
        if (!helper) {
          throw new Error(`Unknown helper function: ${helperName}`);
        }
        // Resolve arguments
        const resolvedArgs = args.map(arg => 
          typeof arg === 'string' ? resolveVariable(arg, context) : arg
        );
        result = helper(...resolvedArgs);
      } else {
        // Unknown format
        throw new Error(`Invalid transform definition for ${name}`);
      }

      results[name] = result;
    } catch (error) {
      console.error(`Transform ${name} failed:`, error);
      results[name] = null;
    }
  }

  return results;
}

/**
 * Process a simple update operation
 */
function processUpdate(updateDef, context) {
  const { entityId, data } = updateDef;

  // Resolve entity ID
  const resolvedEntityId = resolveVariable(entityId, context);
  
  if (!resolvedEntityId) {
    throw new Error('Entity ID is required for update operation');
  }

  // Process data attributes
  const updateData = processDataAttributes(data, context);

  // Add entity ID to update
  updateData[':db/id'] = resolvedEntityId;

  return updateData;
}

/**
 * Process create operations (single or batch)
 */
function processCreate(createDef, context) {
  if (Array.isArray(createDef)) {
    // Multiple create operations
    const results = [];
    for (const def of createDef) {
      const created = processSingleCreate(def, context);
      if (Array.isArray(created)) {
        results.push(...created);
      } else {
        results.push(created);
      }
    }
    return results;
  } else {
    // Single create operation
    return processSingleCreate(createDef, context);
  }
}

/**
 * Process a single create operation
 */
function processSingleCreate(createDef, context) {
  const { type, data, foreach, as } = createDef;

  if (type === 'batch' && foreach) {
    // Batch creation with foreach
    const items = resolveVariable(foreach, context);
    
    if (!Array.isArray(items)) {
      throw new Error(`Foreach value must be an array, got ${typeof items}`);
    }

    const results = [];
    items.forEach((item, index) => {
      // Create item context
      const itemContext = {
        ...context,
        item,
        index
      };

      const entityData = processDataAttributes(data, itemContext);
      results.push(entityData);
    });

    return results;
  } else {
    // Single entity creation
    const entityData = processDataAttributes(data, context);
    
    // If 'as' is specified, save reference for later use
    if (as && context.refs !== undefined) {
      // Generate a temporary ID that will be replaced by actual ID
      const tempId = `temp_${as}_${Date.now()}`;
      context.refs[as] = tempId;
      // This would be resolved by DataStore to actual entity ID
    }

    return entityData;
  }
}

/**
 * Process conditional operations
 */
function processConditional(conditionalDef, context) {
  const results = [];

  for (const condition of conditionalDef) {
    const { if: ifExpr, update, create } = condition;

    // Evaluate condition
    const conditionResult = evaluateExpression(ifExpr, context);

    if (conditionResult) {
      // Process update if present
      if (update) {
        const updateResult = processUpdate(update, context);
        results.push(updateResult);
      }

      // Process create if present
      if (create) {
        const createResult = processCreate(create, context);
        if (Array.isArray(createResult)) {
          results.push(...createResult);
        } else {
          results.push(createResult);
        }
      }
    }
  }

  return results;
}

/**
 * Process data attributes with variable resolution
 */
function processDataAttributes(data, context) {
  const result = {};

  for (const [key, value] of Object.entries(data)) {
    // Ensure attribute starts with ':'
    const attribute = key.startsWith(':') ? key : `:${key}`;
    
    // Resolve value
    let resolvedValue;
    
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      // Variable reference
      const varPath = value.slice(2, -2).trim();
      resolvedValue = resolveVariable(varPath, context);
    } else if (typeof value === 'string' && value === '{{now}}') {
      // Special case for current timestamp
      resolvedValue = Date.now();
    } else if (typeof value === 'string' && value === '{{uuid}}') {
      // Special case for UUID
      resolvedValue = context.uuid();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object - process recursively
      resolvedValue = processDataAttributes(value, context);
    } else if (Array.isArray(value)) {
      // Array - resolve each item
      resolvedValue = value.map(item => {
        if (typeof item === 'string' && item.startsWith('{{') && item.endsWith('}}')) {
          const varPath = item.slice(2, -2).trim();
          return resolveVariable(varPath, context);
        }
        return item;
      });
    } else {
      // Direct value
      resolvedValue = value;
    }

    result[attribute] = resolvedValue;
  }

  return result;
}

/**
 * Generate a simple UUID (fallback if crypto.randomUUID not available)
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}