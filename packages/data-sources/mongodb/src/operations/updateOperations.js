/**
 * Update operations for MongoDB
 * Handles all CRUD operations that modify data
 * All operations are async and called from UpdateResultHandle
 */

/**
 * Execute update operations
 * @param {Object} client - MongoDB client
 * @param {Object} updateSpec - Update specification
 * @returns {Promise<*>} Operation result
 */
export async function executeUpdateOperation(client, updateSpec) {
  const { level } = updateSpec;
  
  switch (level) {
    case 'server':
      return await executeServerUpdate(client, updateSpec);
    
    case 'database':
      return await executeDatabaseUpdate(client, updateSpec);
    
    case 'collection':
      return await executeCollectionUpdate(client, updateSpec);
    
    case 'document':
      return await executeDocumentUpdate(client, updateSpec);
    
    default:
      throw new Error(`Invalid update level: ${level}`);
  }
}

/**
 * Execute server-level update operations
 * @private
 */
async function executeServerUpdate(client, updateSpec) {
  const { operation } = updateSpec;
  
  switch (operation) {
    case 'createDatabase':
      // MongoDB creates databases implicitly
      // Just verify connection
      return await client.db(updateSpec.database).admin().ping();
    
    default:
      throw new Error(`Unsupported server update operation: ${operation}`);
  }
}

/**
 * Execute database-level update operations
 * @private
 */
async function executeDatabaseUpdate(client, updateSpec) {
  const { database, operation } = updateSpec;
  
  if (!database) {
    throw new Error('Database name is required for database update operations');
  }
  
  const db = client.db(database);
  
  switch (operation) {
    case 'createCollection':
      if (!updateSpec.collectionName) {
        throw new Error('Collection name is required for createCollection');
      }
      return await db.createCollection(updateSpec.collectionName, updateSpec.options || {});
    
    case 'dropCollection':
      if (!updateSpec.collectionName) {
        throw new Error('Collection name is required for dropCollection');
      }
      return await db.dropCollection(updateSpec.collectionName);
    
    case 'renameCollection':
      if (!updateSpec.oldName || !updateSpec.newName) {
        throw new Error('Both oldName and newName are required for renameCollection');
      }
      return await db.renameCollection(updateSpec.oldName, updateSpec.newName, updateSpec.options || {});
    
    case 'dropDatabase':
      return await db.dropDatabase();
    
    default:
      throw new Error(`Unsupported database update operation: ${operation}`);
  }
}

/**
 * Execute collection-level update operations
 * @private
 */
export async function executeCollectionUpdate(client, updateSpec) {
  const { database, collection, operation } = updateSpec;
  
  if (!database || !collection) {
    throw new Error('Database and collection are required for collection update operations');
  }
  
  const db = client.db(database);
  const coll = db.collection(collection);
  
  switch (operation) {
    case 'insert':
      return await handleInsert(coll, updateSpec);
    
    case 'insertMany':
      return await handleInsertMany(coll, updateSpec);
    
    case 'updateOne':
      return await handleUpdateOne(coll, updateSpec);
    
    case 'updateMany':
      return await handleUpdateMany(coll, updateSpec);
    
    case 'replace':
      return await handleReplaceOne(coll, updateSpec);
    
    case 'replaceOne':
      return await handleReplaceOne(coll, updateSpec);
    
    case 'deleteOne':
      return await handleDeleteOne(coll, updateSpec);
    
    case 'deleteMany':
      return await handleDeleteMany(coll, updateSpec);
    
    case 'findOneAndUpdate':
      return await handleFindOneAndUpdate(coll, updateSpec);
    
    case 'findOneAndReplace':
      return await handleFindOneAndReplace(coll, updateSpec);
    
    case 'findOneAndDelete':
      return await handleFindOneAndDelete(coll, updateSpec);
    
    case 'bulkWrite':
      return await handleBulkWrite(coll, updateSpec);
    
    case 'createIndex':
      return await handleCreateIndex(coll, updateSpec);
    
    case 'dropIndex':
      return await handleDropIndex(coll, updateSpec);
    
    case 'dropIndexes':
      return await handleDropIndexes(coll, updateSpec);
    
    case 'dropCollection':
      // Drop the collection
      return await coll.drop();
    
    default:
      throw new Error(`Unsupported collection update operation: ${operation}`);
  }
}

/**
 * Handle insert operations
 * @private
 */
async function handleInsert(collection, updateSpec) {
  const { document, documents, options = {} } = updateSpec;
  
  if (documents) {
    // Insert many
    if (!Array.isArray(documents)) {
      throw new Error('documents must be an array for insertMany');
    }
    return await collection.insertMany(documents, options);
  } else if (document) {
    // Insert one
    return await collection.insertOne(document, options);
  } else {
    throw new Error('Either document or documents is required for insert operation');
  }
}

/**
 * Handle insertMany operation
 * @private
 */
async function handleInsertMany(collection, updateSpec) {
  const { documents, options = {} } = updateSpec;
  
  if (!documents) {
    throw new Error('documents is required for insertMany');
  }
  
  if (!Array.isArray(documents)) {
    throw new Error('documents must be an array for insertMany');
  }
  
  return await collection.insertMany(documents, options);
}

/**
 * Handle updateOne operation
 * @private
 */
async function handleUpdateOne(collection, updateSpec) {
  const { filter, update, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for updateOne');
  }
  if (!update) {
    throw new Error('update is required for updateOne');
  }
  
  return await collection.updateOne(filter, update, options);
}

/**
 * Handle updateMany operation
 * @private
 */
async function handleUpdateMany(collection, updateSpec) {
  const { filter, update, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for updateMany');
  }
  if (!update) {
    throw new Error('update is required for updateMany');
  }
  
  return await collection.updateMany(filter, update, options);
}

/**
 * Handle replaceOne operation
 * @private
 */
async function handleReplaceOne(collection, updateSpec) {
  const { filter, replacement, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for replace operation');
  }
  if (!replacement) {
    throw new Error('replacement is required for replace operation');
  }
  
  return await collection.replaceOne(filter, replacement, options);
}

/**
 * Handle deleteOne operation
 * @private
 */
async function handleDeleteOne(collection, updateSpec) {
  const { filter, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for deleteOne');
  }
  
  return await collection.deleteOne(filter, options);
}

/**
 * Handle deleteMany operation
 * @private
 */
async function handleDeleteMany(collection, updateSpec) {
  const { filter, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for deleteMany');
  }
  
  return await collection.deleteMany(filter, options);
}

/**
 * Handle findOneAndUpdate operation
 * @private
 */
async function handleFindOneAndUpdate(collection, updateSpec) {
  const { filter, update, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for findOneAndUpdate');
  }
  if (!update) {
    throw new Error('update is required for findOneAndUpdate');
  }
  
  return await collection.findOneAndUpdate(filter, update, options);
}

/**
 * Handle findOneAndReplace operation
 * @private
 */
async function handleFindOneAndReplace(collection, updateSpec) {
  const { filter, replacement, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for findOneAndReplace');
  }
  if (!replacement) {
    throw new Error('replacement is required for findOneAndReplace');
  }
  
  return await collection.findOneAndReplace(filter, replacement, options);
}

/**
 * Handle findOneAndDelete operation
 * @private
 */
async function handleFindOneAndDelete(collection, updateSpec) {
  const { filter, options = {} } = updateSpec;
  
  if (!filter) {
    throw new Error('filter is required for findOneAndDelete');
  }
  
  return await collection.findOneAndDelete(filter, options);
}

/**
 * Handle bulkWrite operation
 * @private
 */
async function handleBulkWrite(collection, updateSpec) {
  const { operations, options = {} } = updateSpec;
  
  if (!operations || !Array.isArray(operations)) {
    throw new Error('operations array is required for bulkWrite');
  }
  
  return await collection.bulkWrite(operations, options);
}

/**
 * Handle createIndex operation
 * @private
 */
async function handleCreateIndex(collection, updateSpec) {
  // Support both 'index' and 'keys' parameter names
  const indexSpec = updateSpec.index || updateSpec.keys;
  const options = updateSpec.options || updateSpec.indexOptions || {};
  
  if (!indexSpec) {
    throw new Error('index specification is required for createIndex');
  }
  
  return await collection.createIndex(indexSpec, options);
}

/**
 * Handle dropIndex operation
 * @private
 */
async function handleDropIndex(collection, updateSpec) {
  const { indexName } = updateSpec;
  
  if (!indexName) {
    throw new Error('indexName is required for dropIndex');
  }
  
  return await collection.dropIndex(indexName);
}

/**
 * Handle dropIndexes operation
 * @private
 */
async function handleDropIndexes(collection, updateSpec) {
  // Drop all indexes except the _id index
  return await collection.dropIndexes();
}

/**
 * Execute document-level update operations
 * @private
 */
async function executeDocumentUpdate(client, updateSpec) {
  const { database, collection, documentId, operation } = updateSpec;
  
  if (!database || !collection || !documentId) {
    throw new Error('Database, collection, and documentId are required for document operations');
  }
  
  const db = client.db(database);
  const coll = db.collection(collection);
  
  // Document operations are just collection operations with a specific filter
  const filter = { _id: documentId };
  
  switch (operation) {
    case 'set':
      return await coll.updateOne(filter, { $set: updateSpec.fields }, updateSpec.options || {});
    
    case 'unset':
      return await coll.updateOne(filter, { $unset: updateSpec.fields }, updateSpec.options || {});
    
    case 'increment':
      return await coll.updateOne(filter, { $inc: updateSpec.fields }, updateSpec.options || {});
    
    case 'push':
      return await coll.updateOne(filter, { $push: updateSpec.fields }, updateSpec.options || {});
    
    case 'pull':
      return await coll.updateOne(filter, { $pull: updateSpec.fields }, updateSpec.options || {});
    
    case 'addToSet':
      return await coll.updateOne(filter, { $addToSet: updateSpec.fields }, updateSpec.options || {});
    
    default:
      throw new Error(`Unsupported document update operation: ${operation}`);
  }
}