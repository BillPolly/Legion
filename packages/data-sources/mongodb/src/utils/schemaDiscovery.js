/**
 * Schema Discovery Utilities
 * Discovers MongoDB collection schemas by sampling documents
 */

/**
 * Discover schema for a MongoDB collection by sampling documents
 * @param {Collection} collection - MongoDB collection instance
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} JSON Schema representation
 */
export async function discoverCollectionSchema(collection, options = {}) {
  const {
    sampleSize = 100,
    includeIndexes = true,
    includeStats = true
  } = options;
  
  // Sample documents from collection
  const documents = await collection.find({})
    .limit(sampleSize)
    .toArray();
  
  if (documents.length === 0) {
    return {
      schema: {
        type: 'object',
        properties: {},
        description: 'Empty collection - no schema available'
      },
      metadata: {
        sampleSize: 0,
        totalDocuments: 0
      }
    };
  }
  
  // Analyze document structure
  const schema = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: true
  };
  
  // Track field occurrences and types
  const fieldInfo = new Map();
  
  for (const doc of documents) {
    analyzeDocument(doc, fieldInfo, '');
  }
  
  // Build schema from field information
  for (const [fieldPath, info] of fieldInfo.entries()) {
    const occurrenceRate = info.count / documents.length;
    
    // Only include fields that appear in more than 10% of documents
    if (occurrenceRate >= 0.1) {
      const fieldSchema = buildFieldSchema(info);
      setNestedProperty(schema.properties, fieldPath, fieldSchema);
      
      // Also add flattened dotted path for nested fields
      if (fieldPath.includes('.')) {
        schema.properties[fieldPath] = fieldSchema;
      }
      
      // Mark as required if present in more than 90% of documents
      if (occurrenceRate >= 0.9) {
        schema.required.push(fieldPath);
      }
    }
  }
  
  // Add metadata
  const metadata = {
    sampleSize: documents.length,
    totalDocuments: await collection.countDocuments()
  };
  
  if (includeIndexes) {
    metadata.indexes = await collection.indexes();
  }
  
  if (includeStats) {
    try {
      metadata.stats = await collection.stats();
    } catch (error) {
      // Stats may not be available in all MongoDB versions
      metadata.stats = null;
    }
  }
  
  return {
    schema,
    metadata
  };
}

/**
 * Analyze a document and track field information
 * @private
 */
function analyzeDocument(doc, fieldInfo, prefix) {
  for (const [key, value] of Object.entries(doc)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    
    if (!fieldInfo.has(fieldPath)) {
      fieldInfo.set(fieldPath, {
        count: 0,
        types: new Map(),
        examples: []
      });
    }
    
    const info = fieldInfo.get(fieldPath);
    info.count++;
    
    // Determine type
    const type = getMongoType(value);
    info.types.set(type, (info.types.get(type) || 0) + 1);
    
    // Store example (max 3 examples per field)
    if (info.examples.length < 3) {
      info.examples.push(value);
    }
    
    // Recursively analyze nested objects
    if (type === 'object' && value !== null) {
      analyzeDocument(value, fieldInfo, fieldPath);
    }
    
    // Analyze array elements
    if (type === 'array' && Array.isArray(value) && value.length > 0) {
      const firstElement = value[0];
      const elementType = getMongoType(firstElement);
      
      if (elementType === 'object' && firstElement !== null) {
        analyzeDocument(firstElement, fieldInfo, `${fieldPath}.[]`);
      }
    }
  }
}

/**
 * Build JSON Schema for a field based on analyzed information
 * @private
 */
function buildFieldSchema(info) {
  // Find most common type
  let mostCommonType = null;
  let maxCount = 0;
  
  for (const [type, count] of info.types.entries()) {
    if (count > maxCount) {
      mostCommonType = type;
      maxCount = count;
    }
  }
  
  const schema = {
    type: mapMongoTypeToJsonSchema(mostCommonType)
  };
  
  // Add type alternatives if field has mixed types
  if (info.types.size > 1) {
    schema.oneOf = Array.from(info.types.keys()).map(type => ({
      type: mapMongoTypeToJsonSchema(type)
    }));
  }
  
  // Add format hints for special types
  if (mostCommonType === 'ObjectId') {
    schema.format = 'objectid';
  } else if (mostCommonType === 'Date') {
    schema.format = 'date-time';
  }
  
  // Add examples
  if (info.examples.length > 0) {
    schema.examples = info.examples.slice(0, 3);
  }
  
  return schema;
}

/**
 * Get MongoDB type for a value
 * @private
 */
function getMongoType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  
  const type = typeof value;
  
  if (type === 'object') {
    // Check for special MongoDB types
    if (value.constructor.name === 'ObjectId') return 'ObjectId';
    if (value instanceof Date) return 'Date';
    if (value.constructor.name === 'Binary') return 'Binary';
    if (value.constructor.name === 'Decimal128') return 'Decimal128';
    if (value.constructor.name === 'Long') return 'Long';
    if (value.constructor.name === 'Timestamp') return 'Timestamp';
    return 'object';
  }
  
  return type;
}

/**
 * Map MongoDB type to JSON Schema type
 * @private
 */
function mapMongoTypeToJsonSchema(mongoType) {
  const typeMap = {
    'string': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'object': 'object',
    'array': 'array',
    'null': 'null',
    'undefined': 'null',
    'ObjectId': 'string',
    'Date': 'string',
    'Binary': 'string',
    'Decimal128': 'number',
    'Long': 'number',
    'Timestamp': 'number'
  };
  
  return typeMap[mongoType] || 'string';
}

/**
 * Set a nested property in an object using dot notation
 * @private
 */
function setNestedProperty(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    // Handle array notation
    if (part === '[]') {
      if (!current.items) {
        current.items = {
          type: 'object',
          properties: {}
        };
      }
      current = current.items.properties;
    } else {
      if (!current[part]) {
        current[part] = {
          type: 'object',
          properties: {}
        };
      }
      current = current[part].properties || current[part];
    }
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * Discover schemas for all collections in a database
 * @param {Db} db - MongoDB database instance
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Map of collection names to schemas
 */
export async function discoverDatabaseSchemas(db, options = {}) {
  const collections = await db.listCollections().toArray();
  const schemas = {};
  
  for (const collInfo of collections) {
    const collectionName = collInfo.name;
    
    // Skip system collections
    if (collectionName.startsWith('system.')) {
      continue;
    }
    
    const collection = db.collection(collectionName);
    schemas[collectionName] = await discoverCollectionSchema(collection, options);
  }
  
  return schemas;
}

/**
 * Discover schemas for all databases on a server
 * @param {MongoClient} client - MongoDB client instance
 * @param {Object} options - Discovery options
 * @returns {Promise<Object>} Map of database names to collection schemas
 */
export async function discoverServerSchemas(client, options = {}) {
  const adminDb = client.db().admin();
  const dbList = await adminDb.listDatabases();
  const schemas = {};
  
  for (const dbInfo of dbList.databases) {
    const dbName = dbInfo.name;
    
    // Skip system databases
    if (['admin', 'local', 'config'].includes(dbName)) {
      continue;
    }
    
    const db = client.db(dbName);
    schemas[dbName] = await discoverDatabaseSchemas(db, options);
  }
  
  return schemas;
}