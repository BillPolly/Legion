/**
 * Subscription operations for MongoDB Change Streams
 * Creates and configures Change Streams at different levels
 */

/**
 * Execute subscription operation and return Change Stream
 * @param {Object} client - MongoDB client
 * @param {Object} subscriptionSpec - Subscription specification
 * @returns {ChangeStream} MongoDB Change Stream
 */
export async function executeSubscriptionOperation(client, subscriptionSpec) {
  const { level } = subscriptionSpec;
  
  switch (level) {
    case 'server':
      return await executeServerSubscription(client, subscriptionSpec);
    
    case 'database':
      return await executeDatabaseSubscription(client, subscriptionSpec);
    
    case 'collection':
      return await executeCollectionSubscription(client, subscriptionSpec);
    
    default:
      throw new Error(`Invalid subscription level: ${level}`);
  }
}

/**
 * Execute server-level subscription (watches all databases)
 * @private
 */
async function executeServerSubscription(client, subscriptionSpec) {
  const { pipeline = [], options = {} } = subscriptionSpec;
  
  // Create change stream at server level
  return client.watch(pipeline, options);
}

/**
 * Execute database-level subscription (watches all collections in database)
 * @private
 */
async function executeDatabaseSubscription(client, subscriptionSpec) {
  const { database, pipeline = [], options = {} } = subscriptionSpec;
  
  if (!database) {
    throw new Error('Database name is required for database-level subscriptions');
  }
  
  const db = client.db(database);
  
  // Create change stream at database level
  return db.watch(pipeline, options);
}

/**
 * Execute collection-level subscription (watches single collection)
 * @private
 */
async function executeCollectionSubscription(client, subscriptionSpec) {
  const { database, collection, pipeline = [], options = {} } = subscriptionSpec;
  
  if (!database || !collection) {
    throw new Error('Database and collection are required for collection-level subscriptions');
  }
  
  const db = client.db(database);
  const coll = db.collection(collection);
  
  // Create change stream at collection level
  return coll.watch(pipeline, options);
}