/**
 * Schema DSL - Template literal schema definition for Handles
 * 
 * Provides natural language schema definition using template literals.
 * Works with any Handle implementation - the Handle itself handles translation.
 */

import { DSLParser } from './parser.js';

/**
 * Tagged template literal function for schema definition
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} expressions - Template literal expressions
 * @returns {Object} DataScript-compatible schema object
 */
export function defineSchema(strings, ...expressions) {
  // Process template literal
  const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
  
  // Substitute expressions to get final text
  const finalText = DSLParser._substituteExpressions(templateResult.text, templateResult.expressions);
  
  // Check if this is modern syntax (entity Person { ... }) or simple syntax (user/name: string)
  if (finalText.includes('entity ') && finalText.includes('{')) {
    // Modern syntax - return generic Handle schema format (for SimpleObjectDataSource)
    return DSLParser.schemaToHandleFormat(finalText, templateResult.expressions);
  } else {
    // Simple syntax - parse directly to DataScript format (for DataStore)
    return DSLParser.parseSchema(finalText);
  }
}

// Extend DSLParser with schema-specific methods
Object.assign(DSLParser, {
  /**
   * Parse schema DSL text into generic structure
   * @param {string} dslText - Schema DSL text
   * @param {Array} expressions - Template literal expressions
   * @returns {Object} Parsed schema structure
   */
  parseSchemaStructure(dslText, expressions = []) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(dslText, expressions);
    
    // Parse modern syntax: entity EntityName { ... }
    return this._parseModernSyntax(processedText);
  },

  /**
   * Parse modern entity syntax: entity Person { name: string required }
   * @private
   */
  _parseModernSyntax(dslText) {
    const entities = {};
    const relationships = {};
    
    // Match entity definitions
    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/gi;
    let entityMatch;
    
    while ((entityMatch = entityRegex.exec(dslText)) !== null) {
      const entityName = entityMatch[1];
      const entityBody = entityMatch[2].trim();
      
      // Parse attributes within the entity
      const attributes = this._parseEntityAttributes(entityName, entityBody);
      entities[entityName] = { attributes };
    }
    
    // Match relationship definitions
    const relationshipRegex = /relationship\s+(\w+)\s*\{([^}]+)\}/gi;
    let relMatch;
    
    while ((relMatch = relationshipRegex.exec(dslText)) !== null) {
      const relationshipName = relMatch[1];
      const relationshipBody = relMatch[2].trim();
      
      // Parse relationship definition
      const relationship = this._parseRelationshipDefinition(relationshipName, relationshipBody);
      relationships[relationshipName] = relationship;
    }
    
    return { 
      entities, 
      relationships,
      definitions: this._convertToDefinitionsFormat(entities, relationships)
    };
  },

  /**
   * Parse attributes within an entity definition
   * @private
   */
  _parseEntityAttributes(entityName, entityBody) {
    const attributes = {};
    
    // Split by lines and parse each attribute
    const lines = entityBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    
    for (const line of lines) {
      try {
        const attribute = this._parseAttributeLine(entityName, line);
        if (attribute) {
          attributes[attribute.name] = {
            type: attribute.type,
            required: attribute.required || false,
            unique: attribute.unique || false,
            multiple: attribute.multiple || false,
            component: attribute.component || false,
            referenceTarget: attribute.referenceTarget
          };
        }
      } catch (error) {
        throw new Error(`Error parsing attribute in entity ${entityName}: ${error.message}`);
      }
    }
    
    return attributes;
  },

  /**
   * Parse single attribute line: name: string required
   * @private
   */
  _parseAttributeLine(entityName, line) {
    // Match pattern: attributeName: type [modifiers]
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      return null; // Skip lines without colons
    }
    
    const attributeName = line.slice(0, colonIndex).trim();
    const definitionPart = line.slice(colonIndex + 1).trim();
    
    if (!attributeName) {
      throw new Error(`Missing attribute name in: ${line}`);
    }
    
    // Parse type and modifiers
    const tokens = definitionPart.split(/\s+/).filter(t => t);
    if (tokens.length === 0) {
      throw new Error(`Missing type for attribute ${attributeName}`);
    }
    
    let type = tokens[0];
    const modifiers = tokens.slice(1);
    let referenceTarget = null;
    
    // Handle optional syntax: string?
    if (type.endsWith('?')) {
      type = type.slice(0, -1);
      // Optional is the default, so we don't need to track this
    }
    
    // Handle reference types
    if (type === 'ref' || type.startsWith('ref<') || type.includes('->')) {
      // Handle ref -> Target or ref<Target> syntax
      if (type.includes('->')) {
        const parts = definitionPart.split('->');
        type = 'ref';
        referenceTarget = parts[1].trim();
      } else if (type.startsWith('ref<') && type.endsWith('>')) {
        referenceTarget = type.slice(4, -1);
        type = 'ref';
      }
    }
    
    return {
      name: attributeName,
      type: type,
      required: modifiers.includes('required'),
      unique: modifiers.includes('unique'),
      multiple: modifiers.includes('multiple') || modifiers.includes('many'),
      component: modifiers.includes('component'),
      referenceTarget: referenceTarget
    };
  },

  /**
   * Parse relationship definition
   * @private
   */
  _parseRelationshipDefinition(relationshipName, relationshipBody) {
    const lines = relationshipBody
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    
    const relationship = { name: relationshipName };
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      
      if (key === 'from' || key === 'to') {
        relationship[key] = value;
      }
    }
    
    return relationship;
  },

  /**
   * Convert modern syntax to old definitions format for compatibility
   * @private
   */
  _convertToDefinitionsFormat(entities, relationships) {
    const definitions = [];
    
    // Convert entities to definitions
    for (const [entityName, entityDef] of Object.entries(entities)) {
      for (const [attributeName, attributeDef] of Object.entries(entityDef.attributes)) {
        const constraints = [];
        
        if (attributeDef.required) constraints.push('required');
        if (attributeDef.unique) constraints.push('unique', 'value');
        if (attributeDef.multiple) constraints.push('many');
        if (attributeDef.component) constraints.push('component');
        
        definitions.push({
          entity: entityName,
          attribute: attributeName,
          type: attributeDef.type,
          constraints: constraints,
          referenceTarget: attributeDef.referenceTarget
        });
      }
    }
    
    return definitions;
  },

  /**
   * Convert schema DSL to generic Handle schema format
   * @param {string} dslText - Schema DSL text
   * @param {Array} expressions - Template literal expressions
   * @returns {Object} Generic schema object that any Handle can interpret
   */
  schemaToHandleFormat(dslText, expressions = []) {
    // Substitute expressions first
    const processedText = this._substituteExpressions(dslText, expressions);
    
    // Parse schema structure
    const parsed = this.parseSchemaStructure(processedText, expressions);
    
    // Return generic format - Handles will translate as needed
    return {
      type: 'schema',
      entities: parsed.entities || {},
      relationships: parsed.relationships || {},
      definitions: parsed.definitions || [],
      // Original text for Handles that want to do their own parsing
      originalDSL: processedText
    };
  },

  /**
   * Convert generic Handle schema to DataScript format
   * Used by DataStoreHandle to translate generic schemas
   * @param {Object} handleSchema - Generic Handle schema
   * @returns {Object} DataScript schema object
   */
  handleSchemaToDataScript(handleSchema) {
    if (!handleSchema.definitions || handleSchema.definitions.length === 0) {
      return {};
    }

    const schema = {};
    
    handleSchema.definitions.forEach(parsed => {
      const dataScriptDef = this.toDataScriptSchema(parsed);
      Object.assign(schema, dataScriptDef);
    });
    
    // Validate complete schema
    const validation = this.validateSchema(schema);
    if (!validation.valid) {
      const error = new Error('Schema validation failed: ' + validation.errors.map(e => e.message).join(', '));
      error.validationErrors = validation.errors;
      throw error;
    }
    
    return schema;
  },

  /**
   * Parse single schema line into structured format
   * @param {string} line - Schema line (e.g., "user/name: string")
   * @returns {Object} Parsed schema line object
   */
  parseSchemaLine(line) {
    if (!line || typeof line !== 'string') {
      throw new Error('Schema line is required');
    }
    
    // Basic format: entity/attribute: [constraints] type [-> target]
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid schema format: missing ':' in "${line}"`);
    }
    
    const attributePart = line.slice(0, colonIndex).trim();
    const definitionPart = line.slice(colonIndex + 1).trim();
    
    // Parse entity/attribute
    if (!attributePart.includes('/')) {
      throw new Error(`Invalid attribute format: missing '/' in "${attributePart}"`);
    }
    
    const [entity, attribute] = attributePart.split('/');
    if (!entity) {
      throw new Error(`Missing entity name in "${attributePart}"`);
    }
    if (!attribute) {
      throw new Error(`Missing attribute name in "${attributePart}"`);
    }
    
    // Parse definition part
    const tokens = this.tokenize(definitionPart);
    if (tokens.length === 0) {
      throw new Error(`Missing type definition for "${attributePart}"`);
    }
    
    return this._parseDefinitionTokens(tokens, entity, attribute);
  },

  /**
   * Parse definition tokens into schema structure
   * @private
   */
  _parseDefinitionTokens(tokens, entity, attribute) {
    const constraints = [];
    let type = null;
    let referenceTarget = null;
    
    let i = 0;
    
    // Parse constraints and type
    while (i < tokens.length) {
      const token = tokens[i];
      
      if (token.type === 'keyword') {
        // Type keywords
        if (['string', 'number', 'boolean', 'instant', 'ref'].includes(token.value)) {
          if (type !== null) {
            throw new Error(`Multiple types specified: ${type} and ${token.value}`);
          }
          type = token.value;
        }
        // Constraint keywords
        else if (['unique', 'value', 'identity', 'many', 'component'].includes(token.value)) {
          constraints.push(token.value);
        }
        // Reference arrow
        else if (token.value === 'ref' && i + 2 < tokens.length && 
                 tokens[i + 1].type === 'operator' && tokens[i + 1].value === '>' &&
                 tokens[i + 2].type === 'identifier') {
          // Handle "ref -> target" syntax
          referenceTarget = tokens[i + 2].value;
          type = 'ref';
          i += 2; // Skip the -> and target
        }
      }
      // Handle -> operator for references
      else if (token.type === 'operator' && token.value === '>' && 
               i + 1 < tokens.length && tokens[i + 1].type === 'identifier') {
        referenceTarget = tokens[i + 1].value;
        i += 1; // Skip the target
      }
      // Handle minus operator as part of ->
      else if (token.type === 'operator' && token.value === '-' &&
               i + 1 < tokens.length && tokens[i + 1].type === 'operator' && tokens[i + 1].value === '>') {
        // Skip the - part of ->
      }
      
      i++;
    }
    
    if (!type) {
      throw new Error(`Missing type definition for ${entity}/${attribute}`);
    }
    
    // Validate reference target
    if (type === 'ref' && !referenceTarget) {
      throw new Error(`Reference type requires target: ${entity}/${attribute}: ref -> target`);
    }
    
    return {
      entity,
      attribute, 
      type,
      constraints,
      referenceTarget
    };
  },

  /**
   * Convert parsed schema line to DataScript schema format
   * @param {Object} parsed - Parsed schema line object
   * @returns {Object} DataScript schema object
   */
  toDataScriptSchema(parsed) {
    const fullAttribute = `:${parsed.entity}/${parsed.attribute}`;
    const definition = {};
    
    // Set value type
    if (parsed.type !== 'ref') {
      definition.valueType = parsed.type;
    } else {
      definition.valueType = 'ref';
    }
    
    // Handle constraints
    parsed.constraints.forEach(constraint => {
      switch (constraint) {
        case 'unique':
          // Next constraint should be 'value' or 'identity'
          const uniqueType = parsed.constraints.includes('value') ? 'value' : 
                           parsed.constraints.includes('identity') ? 'identity' : 'value';
          definition.unique = uniqueType;
          break;
        case 'many':
          definition.card = 'many';
          break;
        case 'component':
          definition.component = true;
          break;
        // 'value' and 'identity' are handled with 'unique'
      }
    });
    
    return { [fullAttribute]: definition };
  },

  /**
   * Validate complete schema for consistency
   * @param {Object} schema - DataScript schema object
   * @returns {Object} Validation result
   */
  validateSchema(schema) {
    const errors = [];
    
    // Check for valid schema structure
    if (!schema || typeof schema !== 'object') {
      errors.push({ message: 'Schema must be an object' });
    } else {
      // Validate each attribute definition
      Object.entries(schema).forEach(([attr, def]) => {
        if (!attr.startsWith(':')) {
          errors.push({ message: `Attribute must start with ':': ${attr}` });
        }
        
        if (!def.valueType) {
          errors.push({ message: `Missing valueType for ${attr}` });
        }
        
        // Validate unique constraints
        if (def.unique && !['value', 'identity'].includes(def.unique)) {
          errors.push({ message: `Invalid unique constraint for ${attr}: ${def.unique}` });
        }
        
        // Validate cardinality
        if (def.card && !['one', 'many'].includes(def.card)) {
          errors.push({ message: `Invalid cardinality for ${attr}: ${def.card}` });
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Merge multiple schema objects
   * @param {...Object} schemas - Schema objects to merge
   * @returns {Object} Merged schema object
   */
  mergeSchemas(...schemas) {
    const merged = {};
    
    schemas.forEach(schema => {
      if (schema && typeof schema === 'object') {
        Object.assign(merged, schema);
      }
    });
    
    return merged;
  },

  /**
   * Substitute expressions in DSL text
   * @private
   */
  _substituteExpressions(text, expressions) {
    if (!expressions || expressions.length === 0) {
      return text;
    }
    
    let substituted = text;
    expressions.forEach((expr, index) => {
      const placeholder = `\${${index}}`;
      let value;
      
      if (typeof expr === 'string') {
        value = expr;
      } else if (typeof expr === 'number') {
        value = String(expr);
      } else if (typeof expr === 'boolean') {
        value = String(expr);
      } else if (expr === null || expr === undefined) {
        value = 'null';
      } else if (expr instanceof Date) {
        // Preserve Date objects as-is by using a special marker
        value = `__DATE_OBJECT_${index}__`;
      } else {
        // For other objects and arrays, convert to string representation
        value = JSON.stringify(expr);
      }
      
      substituted = substituted.replace(placeholder, value);
    });
    
    return substituted;
  }
});