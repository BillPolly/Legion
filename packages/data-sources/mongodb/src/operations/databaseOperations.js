/**
 * Database-level operations for MongoDB
 */

// Async operations - called from QueryResultHandle

/**
 * Execute database-level operations
 * @param {Object} client - MongoDB client
 * @param {Object} querySpec - Query specification
 * @returns {*} Operation result
 */
export async function executeDatabaseQuery(client, querySpec) {
  const { database, operation } = querySpec;
  
  if (!database) {
    throw new Error('Database name is required for database operations');
  }
  
  const db = client.db(database);
  
  switch (operation) {
    case 'stats':
      return executeDatabaseStats(db);
    
    case 'listCollections':
      return executeListCollections(db, querySpec);
    
    case 'command':
      return executeCommand(db, querySpec);
    
    case 'dropDatabase':
      return executeDropDatabase(db);
    
    case 'createCollection':
      return executeCreateCollection(db, querySpec);
    
    case 'dropCollection':
      return executeDropCollection(db, querySpec);
    
    default:
      throw new Error(`Unsupported database operation: ${operation}`);
  }
}

/**
 * Get database statistics
 * @private
 */
async function executeDatabaseStats(db) {
  return await db.stats();
}

/**
 * List all collections in database
 * @private
 */
async function executeListCollections(db, querySpec) {
  const { filter = {}, options = {} } = querySpec;
  
  const cursor = db.listCollections(filter, options);
  return await cursor.toArray();
}

/**
 * Execute arbitrary database command
 * @private
 */
async function executeCommand(db, querySpec) {
  const { command, options = {} } = querySpec;
  
  if (!command || typeof command !== 'object') {
    throw new Error('Command object is required for database command operation');
  }
  
  return await db.command(command, options);
}

/**
 * Drop the database
 * @private
 */
async function executeDropDatabase(db) {
  return await db.dropDatabase();
}

/**
 * Create a collection
 * @private
 */
async function executeCreateCollection(db, querySpec) {
  const { collectionName, options = {} } = querySpec;
  
  if (!collectionName) {
    throw new Error('Collection name is required for create collection operation');
  }
  
  return await db.createCollection(collectionName, options);
}

/**
 * Drop a collection
 * @private
 */
async function executeDropCollection(db, querySpec) {
  const { collectionName } = querySpec;
  
  if (!collectionName) {
    throw new Error('Collection name is required for drop collection operation');
  }
  
  return await db.dropCollection(collectionName);
}

/**
 * Execute database-level update/modification operations
 * @param {Object} client - MongoDB client
 * @param {Object} updateSpec - Update specification
 * @returns {*} Operation result
 */
export async function executeDatabaseUpdate(client, updateSpec) {
  const { database, operation, collectionName, options } = updateSpec;
  
  if (!database) {
    throw new Error('Database name is required for database operations');
  }
  
  const db = client.db(database);
  
  switch (operation) {
    case 'createCollection':
      if (!collectionName) {
        throw new Error('Collection name is required');
      }
      await db.createCollection(collectionName, options || {});
      return { ok: 1, collection: collectionName };
    
    case 'dropDatabase':
      const result = await db.dropDatabase();
      return { ...result, ok: 1 };
    
    case 'dropCollection':
      if (!collectionName) {
        throw new Error('Collection name is required');
      }
      const dropResult = await db.dropCollection(collectionName);
      return { ...dropResult, ok: 1 };
    
    default:
      throw new Error(`Unsupported database update operation: ${operation}`);
  }
}