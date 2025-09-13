/**
 * PrototypeFactory - Universal prototype manufacturing for introspection capabilities
 * 
 * Creates cached prototype objects based on resource schemas to provide universal knowledge layer.
 * Unlike the DataScript-specific version, this factory works with any Handle type and ResourceManager.
 * 
 * The factory analyzes schemas to detect entity types and relationships, then manufactures 
 * dynamic prototypes that extend Handle subclasses with schema-based properties and methods.
 * 
 * CRITICAL: All operations are synchronous - NO await, NO promises!
 */

export class PrototypeFactory {
  constructor(baseHandleClass = null) {
    // Cache manufactured prototypes by type
    this.entityPrototypes = new Map();
    this.collectionPrototypes = new Map();
    this.streamPrototypes = new Map();
    
    // Cache schema analysis
    this.schemaTypes = new Map();
    this.relationships = new Map();
    this.capabilities = new Map();
    
    // Base Handle class to extend (can be any Handle subclass)
    this.baseHandleClass = baseHandleClass;
    
    // Schema format adapters for different resource types
    this.schemaAdapters = new Map();
    this._registerDefaultAdapters();
  }
  
  /**
   * Analyze schema to identify entity types, attributes, and relationships
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} schema - Resource schema in any supported format
   * @param {string} schemaFormat - Schema format ('datascript', 'json-schema', 'custom', etc.)
   */
  analyzeSchema(schema, schemaFormat = 'auto') {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be a non-null object');
    }
    
    // Auto-detect schema format if not specified
    if (schemaFormat === 'auto') {
      schemaFormat = this._detectSchemaFormat(schema);
    }
    
    // Get appropriate schema adapter
    const adapter = this.schemaAdapters.get(schemaFormat);
    if (!adapter) {
      throw new Error(`Unsupported schema format: ${schemaFormat}`);
    }
    
    // Extract types, attributes, and relationships using adapter
    const analysisResult = adapter.analyze(schema);
    
    // Store analysis results
    this.schemaTypes = analysisResult.types;
    this.relationships = analysisResult.relationships;
    this.capabilities = analysisResult.capabilities;
    
    return {
      types: this.schemaTypes,
      relationships: this.relationships,
      capabilities: this.capabilities
    };
  }
  
  /**
   * Create or get cached Handle prototype for an entity type
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} typeName - Entity type name (e.g., 'user', 'project')
   * @param {Function} baseClass - Base Handle class to extend (optional)
   * @returns {Function} Prototype constructor that extends Handle
   */
  getEntityPrototype(typeName, baseClass = null) {
    // Use provided base class or factory default
    const HandleClass = baseClass || this.baseHandleClass;
    
    if (!HandleClass) {
      throw new Error('No base Handle class available for prototype manufacturing');
    }
    
    // Create cache key including base class
    const cacheKey = `${typeName}:${HandleClass.name}`;
    
    // Return cached if available
    if (this.entityPrototypes.has(cacheKey)) {
      return this.entityPrototypes.get(cacheKey);
    }
    
    const typeInfo = this.schemaTypes.get(typeName);
    if (!typeInfo) {
      // No schema info for this type, return base Handle class
      this.entityPrototypes.set(cacheKey, HandleClass);
      return HandleClass;
    }
    
    // Capture factory reference for closure
    const factory = this;
    
    // Create new prototype class that extends the Handle class
    class TypedHandle extends HandleClass {
      constructor(resourceManager, entityId, options = {}) {
        super(resourceManager, options);
        
        // Add type-specific information
        this.entityId = entityId;
        this._typeName = typeName;
        this._typeInfo = typeInfo;
      }
      
      /**
       * Get entity type name
       */
      get typeName() {
        return this._typeName;
      }
      
      /**
       * Get available attributes for this entity type
       */
      getAvailableAttributes() {
        return Array.from(this._typeInfo.attributes.keys());
      }
      
      /**
       * Get relationships for this entity type
       */
      getRelationships() {
        const relationships = [];
        const typeRelationships = factory.relationships.get(this._typeName);
        
        if (typeRelationships) {
          for (const [relName, relInfo] of typeRelationships) {
            relationships.push({
              name: relName,
              type: relInfo.type,
              targetType: relInfo.targetType,
              cardinality: relInfo.cardinality,
              fullName: relInfo.fullName
            });
          }
        }
        
        return relationships;
      }
      
      /**
       * Get capabilities for this entity type
       */
      getCapabilities() {
        const capabilities = [];
        const typeCapabilities = factory.capabilities.get(this._typeName);
        
        if (typeCapabilities) {
          capabilities.push(...typeCapabilities);
        }
        
        // Add base Handle capabilities
        capabilities.push('query', 'value', 'subscribe', 'introspect');
        
        return Array.from(new Set(capabilities)); // Remove duplicates
      }
      
      /**
       * Validate attribute name for this entity type
       */
      validateAttribute(attributeName, value) {
        const attrInfo = this._typeInfo.attributes.get(attributeName);
        if (!attrInfo) {
          return { valid: false, error: `Unknown attribute: ${attributeName}` };
        }
        
        // Perform type-based validation if schema has type info
        if (attrInfo.type && value !== null && value !== undefined) {
          const validationResult = this._validateAttributeType(value, attrInfo.type);
          if (!validationResult.valid) {
            return validationResult;
          }
        }
        
        return { valid: true };
      }
      
      /**
       * Get attribute information
       */
      getAttributeInfo(attributeName) {
        const attrInfo = this._typeInfo.attributes.get(attributeName);
        if (!attrInfo) {
          return null;
        }
        
        return {
          name: attributeName,
          fullName: attrInfo.fullName,
          type: attrInfo.type,
          cardinality: attrInfo.cardinality,
          required: attrInfo.required,
          description: attrInfo.description
        };
      }
      
      /**
       * Enhanced introspection that includes type-specific information
       */
      getIntrospectionInfo() {
        const baseInfo = super.getIntrospectionInfo();
        
        return {
          ...baseInfo,
          entityType: this._typeName,
          entityId: this.entityId,
          availableAttributes: this.getAvailableAttributes(),
          relationships: this.getRelationships(),
          capabilities: this.getCapabilities(),
          typeInfo: {
            name: this._typeName,
            attributeCount: this._typeInfo.attributes.size,
            hasRelationships: factory.relationships.has(this._typeName)
          }
        };
      }
      
      /**
       * Internal attribute type validation
       * @private
       */
      _validateAttributeType(value, expectedType) {
        // Basic type validation - can be extended for more sophisticated validation
        switch (expectedType) {
          case 'string':
            if (typeof value !== 'string') {
              return { valid: false, error: `Expected string, got ${typeof value}` };
            }
            break;
          case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
              return { valid: false, error: `Expected number, got ${typeof value}` };
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean') {
              return { valid: false, error: `Expected boolean, got ${typeof value}` };
            }
            break;
          case 'array':
            if (!Array.isArray(value)) {
              return { valid: false, error: `Expected array, got ${typeof value}` };
            }
            break;
          case 'object':
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
              return { valid: false, error: `Expected object, got ${typeof value}` };
            }
            break;
        }
        
        return { valid: true };
      }
    }
    
    // Add dynamic properties for each attribute in the schema
    for (const [attrLocalName, attrInfo] of typeInfo.attributes) {
      // Convert attribute name to property name (e.g., 'userName' or 'user_name')
      const propertyName = this._toPropertyName(attrLocalName);
      
      // Skip if property would conflict with base class methods
      if (this._isReservedProperty(propertyName)) {
        continue;
      }
      
      // Define getter and setter on the prototype
      Object.defineProperty(TypedHandle.prototype, propertyName, {
        get() {
          // Query for specific attribute through ResourceManager
          if (this.entityId !== undefined) {
            const results = this.resourceManager.query({
              find: ['?value'],
              where: [[this.entityId, attrInfo.fullName, '?value']]
            });
            
            // Handle cardinality many attributes (return array)
            if (attrInfo.cardinality === 'many') {
              return results.map(r => r[0]);
            }
            
            return results.length > 0 ? results[0][0] : undefined;
          }
          return undefined;
        },
        set(value) {
          // Update attribute through ResourceManager if it supports updates
          if (this.entityId !== undefined && typeof this.resourceManager.update === 'function') {
            // Validate attribute before setting
            const validation = this.validateAttribute(attrLocalName, value);
            if (!validation.valid) {
              throw new Error(`Attribute validation failed: ${validation.error}`);
            }
            
            return this.resourceManager.update({
              entityId: this.entityId,
              attribute: attrInfo.fullName,
              value: value
            });
          }
          
          throw new Error('ResourceManager does not support updates or entityId not set');
        },
        enumerable: true,
        configurable: true
      });
    }
    
    // Set prototype name for debugging
    Object.defineProperty(TypedHandle, 'name', {
      value: `Typed${HandleClass.name}_${typeName}`,
      configurable: true
    });
    
    // Cache and return the prototype
    this.entityPrototypes.set(cacheKey, TypedHandle);
    return TypedHandle;
  }
  
  /**
   * Detect entity type from current data
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} entityData - Entity data with attributes
   * @returns {string|null} Detected type name or null
   */
  detectEntityType(entityData) {
    if (!entityData || typeof entityData !== 'object') {
      return null;
    }
    
    // Count how many attributes match each type
    const typeMatches = new Map();
    
    for (const attrName of Object.keys(entityData)) {
      // Check each known type to see if this attribute belongs to it
      for (const [typeName, typeInfo] of this.schemaTypes) {
        if (typeInfo.attributes.has(attrName)) {
          typeMatches.set(typeName, (typeMatches.get(typeName) || 0) + 1);
        } else {
          // Check if attribute name matches type pattern (e.g., :user/name -> user)
          const matchResult = this._matchAttributeToType(attrName, typeName);
          if (matchResult) {
            typeMatches.set(typeName, (typeMatches.get(typeName) || 0) + matchResult.confidence);
          }
        }
      }
    }
    
    // Return type with most matches
    let bestType = null;
    let bestCount = 0;
    
    for (const [typeName, count] of typeMatches) {
      if (count > bestCount) {
        bestType = typeName;
        bestCount = count;
      }
    }
    
    return bestType;
  }
  
  /**
   * Clear all cached prototypes
   */
  clearCache() {
    this.entityPrototypes.clear();
    this.collectionPrototypes.clear();
    this.streamPrototypes.clear();
  }
  
  /**
   * Get statistics about cached prototypes and schema analysis
   */
  getStats() {
    return {
      entityPrototypes: this.entityPrototypes.size,
      collectionPrototypes: this.collectionPrototypes.size,
      streamPrototypes: this.streamPrototypes.size,
      schemaTypes: this.schemaTypes.size,
      relationships: this.relationships.size,
      capabilities: this.capabilities.size,
      schemaAdapters: this.schemaAdapters.size
    };
  }
  
  /**
   * Register a schema adapter for a specific format
   * 
   * @param {string} format - Schema format name
   * @param {Object} adapter - Adapter object with analyze(schema) method
   */
  registerSchemaAdapter(format, adapter) {
    if (!adapter || typeof adapter.analyze !== 'function') {
      throw new Error('Schema adapter must have an analyze(schema) method');
    }
    
    this.schemaAdapters.set(format, adapter);
  }
  
  // Private methods
  
  /**
   * Register default schema adapters
   * @private
   */
  _registerDefaultAdapters() {
    // DataScript schema adapter
    this.registerSchemaAdapter('datascript', {
      analyze: (schema) => {
        const types = new Map();
        const relationships = new Map();
        const capabilities = new Map();
        
        // Parse DataScript schema format
        for (const [attrName, attrDef] of Object.entries(schema)) {
          if (!attrName.startsWith(':')) continue;
          
          // Extract type from attribute name (e.g., :user/name -> user)
          const parts = attrName.substring(1).split('/');
          if (parts.length !== 2) continue;
          
          const [typeName, attrLocalName] = parts;
          
          // Initialize type info
          if (!types.has(typeName)) {
            types.set(typeName, {
              name: typeName,
              attributes: new Map()
            });
          }
          
          // Add attribute info
          types.get(typeName).attributes.set(attrLocalName, {
            fullName: attrName,
            type: attrDef[':db/valueType']?.replace(':db.type/', '') || 'string',
            cardinality: attrDef[':db/cardinality']?.replace(':db.cardinality/', '') || 'one',
            required: attrDef[':db/required'] || false,
            unique: attrDef[':db/unique'] || false,
            definition: attrDef
          });
          
          // Track relationships
          if (attrDef[':db/valueType'] === ':db.type/ref') {
            if (!relationships.has(typeName)) {
              relationships.set(typeName, new Map());
            }
            relationships.get(typeName).set(attrLocalName, {
              type: 'reference',
              targetType: 'unknown', // Would need more analysis to determine
              cardinality: attrDef[':db/cardinality']?.replace(':db.cardinality/', '') || 'one',
              fullName: attrName
            });
          }
        }
        
        return { types, relationships, capabilities };
      }
    });
    
    // JSON Schema adapter
    this.registerSchemaAdapter('json-schema', {
      analyze: (schema) => {
        const types = new Map();
        const relationships = new Map();
        const capabilities = new Map();
        
        // Parse JSON Schema format
        if (schema.definitions || schema.$defs) {
          const definitions = schema.definitions || schema.$defs;
          
          for (const [typeName, typeDef] of Object.entries(definitions)) {
            if (!typeDef.properties) continue;
            
            const typeInfo = {
              name: typeName,
              attributes: new Map()
            };
            
            for (const [propName, propDef] of Object.entries(typeDef.properties)) {
              typeInfo.attributes.set(propName, {
                fullName: propName,
                type: propDef.type || 'string',
                cardinality: propDef.type === 'array' ? 'many' : 'one',
                required: typeDef.required?.includes(propName) || false,
                description: propDef.description,
                definition: propDef
              });
            }
            
            types.set(typeName, typeInfo);
          }
        }
        
        return { types, relationships, capabilities };
      }
    });
  }
  
  /**
   * Auto-detect schema format
   * @private
   */
  _detectSchemaFormat(schema) {
    // Check for DataScript format (attributes with :namespace/name pattern)
    const hasDataScriptAttrs = Object.keys(schema).some(key => 
      key.startsWith(':') && key.includes('/')
    );
    
    if (hasDataScriptAttrs) {
      return 'datascript';
    }
    
    // Check for JSON Schema format
    if (schema.$schema || schema.definitions || schema.$defs) {
      return 'json-schema';
    }
    
    // Default to custom format
    return 'custom';
  }
  
  /**
   * Match attribute name to type using patterns
   * @private
   */
  _matchAttributeToType(attrName, typeName) {
    // Pattern matching for different naming conventions
    
    // DataScript pattern (:user/name -> user)
    if (attrName.startsWith(':')) {
      const parts = attrName.substring(1).split('/');
      if (parts.length === 2 && parts[0] === typeName) {
        return { confidence: 1.0 };
      }
    }
    
    // Prefix pattern (userName -> user)
    if (attrName.toLowerCase().startsWith(typeName.toLowerCase())) {
      return { confidence: 0.7 };
    }
    
    // Suffix pattern (nameUser -> user)  
    if (attrName.toLowerCase().endsWith(typeName.toLowerCase())) {
      return { confidence: 0.5 };
    }
    
    return null;
  }
  
  /**
   * Convert attribute name to JavaScript property name
   * @private
   */
  _toPropertyName(attrName) {
    // Convert various naming patterns to camelCase
    
    // kebab-case to camelCase
    if (attrName.includes('-')) {
      return attrName.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
    
    // snake_case to camelCase
    if (attrName.includes('_')) {
      return attrName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    }
    
    // Default: use as-is
    return attrName;
  }
  
  /**
   * Check if property name conflicts with Handle methods
   * @private
   */
  _isReservedProperty(propertyName) {
    // Universal reserved properties for Handle classes
    const reserved = [
      'constructor', 'value', 'query', 'update', 'get', 'set',
      'subscribe', 'destroy', 'isDestroyed', 'receive', 'call',
      'resourceManager', 'entityId', 'typeName', 'getIntrospectionInfo',
      'getAvailableAttributes', 'getRelationships', 'getCapabilities',
      'validateAttribute', 'getAttributeInfo', '_validateNotDestroyed'
    ];
    
    return reserved.includes(propertyName);
  }
}