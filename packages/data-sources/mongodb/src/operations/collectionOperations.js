/**
 * Collection-level query operations for MongoDB
 */

import { ObjectId } from 'mongodb';

// Import executeCollectionUpdate to re-export it
import { executeCollectionUpdate } from './updateOperations.js';

// Async operations - called from QueryResultHandle

/**
 * Convert extended JSON format to MongoDB native types
 * Handles { $oid: '...' } -> ObjectId conversion
 * @private
 */
function normalizeFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  // Handle arrays
  if (Array.isArray(filter)) {
    return filter.map(normalizeFilter);
  }
  
  // IMPORTANT: If already an ObjectId instance, return as-is
  // Don't destructure it or it will break!
  if (filter instanceof ObjectId) {
    return filter;
  }
  
  // Check if this is an extended JSON ObjectId
  if (filter.$oid && typeof filter.$oid === 'string') {
    return new ObjectId(filter.$oid);
  }
  
  // Recursively normalize nested objects
  const normalized = {};
  for (const [key, value] of Object.entries(filter)) {
    normalized[key] = normalizeFilter(value);
  }
  
  return normalized;
}

/**
 * Execute collection-level query operations
 * @param {Object} client - MongoDB client
 * @param {Object} querySpec - Query specification
 * @returns {*} Query result
 */
export async function executeCollectionQuery(client, querySpec) {
  const { database, collection, operation } = querySpec;
  
  if (!collection) {
    throw new Error('Collection name is required for collection operations');
  }
  
  const db = client.db(database);
  const coll = db.collection(collection);
  
  switch (operation) {
    case 'find':
      return handleFind(coll, querySpec);
    
    case 'findOne':
      return handleFindOne(coll, querySpec);
    
    case 'aggregate':
      return handleAggregate(coll, querySpec);
    
    case 'count':
      return handleCount(coll, querySpec);
    
    case 'distinct':
      return handleDistinct(coll, querySpec);
    
    case 'stats':
      return handleStats(coll);
    
    case 'indexes':
      return handleIndexes(coll);
    
    case 'exists':
      return handleExists(coll, querySpec);
    
    default:
      throw new Error(`Unsupported collection operation: ${operation}`);
  }
}

/**
 * Handle find operation
 * @private
 */
async function handleFind(collection, querySpec) {
  const { filter = {}, projection, sort, limit, skip, options = {} } = querySpec;
  
  // Normalize filter to convert extended JSON to MongoDB types
  const normalizedFilter = normalizeFilter(filter);
  
  // Create cursor with filter
  const cursor = collection.find(normalizedFilter);
  
  // Apply projection
  if (projection) {
    cursor.project(projection);
  }
  
  // Apply sort
  if (sort) {
    cursor.sort(sort);
  }
  
  // Apply skip
  if (skip) {
    cursor.skip(skip);
  }
  
  // Apply limit
  if (limit) {
    cursor.limit(limit);
  }
  
  // Apply additional options
  if (options.collation) {
    cursor.collation(options.collation);
  }
  
  if (options.hint) {
    cursor.hint(options.hint);
  }
  
  if (options.comment) {
    cursor.comment(options.comment);
  }
  
  if (options.maxTimeMS) {
    cursor.maxTimeMS(options.maxTimeMS);
  }
  
  // Convert to array synchronously (placeholder for sync wrapper)
  return await cursor.toArray();
}

/**
 * Handle findOne operation
 * @private
 */
async function handleFindOne(collection, querySpec) {
  const { filter = {}, projection, options = {} } = querySpec;
  
  // Normalize filter to convert extended JSON to MongoDB types
  const normalizedFilter = normalizeFilter(filter);
  
  const findOptions = {};
  
  if (projection) {
    findOptions.projection = projection;
  }
  
  if (options.collation) {
    findOptions.collation = options.collation;
  }
  
  if (options.hint) {
    findOptions.hint = options.hint;
  }
  
  if (options.maxTimeMS) {
    findOptions.maxTimeMS = options.maxTimeMS;
  }
  
  return await collection.findOne(normalizedFilter, findOptions);
}

/**
 * Handle aggregation pipeline
 * @private
 */
async function handleAggregate(collection, querySpec) {
  const { pipeline = [], options = {} } = querySpec;
  
  const cursor = collection.aggregate(pipeline, options);
  
  return await cursor.toArray();
}

/**
 * Handle count operation
 * @private
 */
async function handleCount(collection, querySpec) {
  const { filter = {}, options = {} } = querySpec;
  
  // Normalize filter to convert extended JSON to MongoDB types
  const normalizedFilter = normalizeFilter(filter);
  
  const count = await collection.countDocuments(normalizedFilter, options);
  
  // Return just the count number, not an object
  return count;
}

/**
 * Handle distinct operation
 * @private
 */
async function handleDistinct(collection, querySpec) {
  const { field, filter = {}, options = {} } = querySpec;
  
  if (!field) {
    throw new Error('Field is required for distinct operation');
  }
  
  // Normalize filter to convert extended JSON to MongoDB types
  const normalizedFilter = normalizeFilter(filter);
  
  return await collection.distinct(field, normalizedFilter, options);
}

/**
 * Handle collection stats
 * @private
 */
async function handleStats(collection) {
  // MongoDB driver doesn't have stats() method on collection
  // We need to use the db.command with collStats command
  const db = collection.s.db;
  const collectionName = collection.collectionName;
  return await db.command({ collStats: collectionName });
}

/**
 * Handle list indexes
 * @private
 */
async function handleIndexes(collection) {
  return await collection.indexes();
}

/**
 * Handle document exists check
 * @private
 */
async function handleExists(collection, querySpec) {
  const { filter = {} } = querySpec;
  
  // Normalize filter to convert extended JSON to MongoDB types
  const normalizedFilter = normalizeFilter(filter);
  
  // Use findOne with projection to just get _id for efficiency
  const doc = await collection.findOne(normalizedFilter, { projection: { _id: 1 } });
  
  // Return boolean indicating if document exists
  return doc !== null;
}

// Re-export executeCollectionUpdate from updateOperations
export { executeCollectionUpdate };