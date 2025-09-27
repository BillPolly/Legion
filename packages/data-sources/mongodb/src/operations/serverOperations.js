/**
 * Server-level operations for MongoDB
 * All operations are async and called from QueryResultHandle
 */

/**
 * Execute server-level query operations
 * @param {Object} client - MongoDB client
 * @param {Object} querySpec - Query specification
 * @returns {Promise<*>} Operation result
 */
export async function executeServerQuery(client, querySpec) {
  const { operation } = querySpec;
  
  switch (operation) {
    case 'ping':
      return await executePing(client);
    
    case 'serverStatus':
      return await executeServerStatus(client);
    
    case 'listDatabases':
      return await executeListDatabases(client);
    
    case 'buildInfo':
      return await executeBuildInfo(client);
    
    case 'hostInfo':
      return await executeHostInfo(client);
    
    case 'currentOp':
      return await executeCurrentOp(client, querySpec);
    
    default:
      throw new Error(`Unsupported server operation: ${operation}`);
  }
}

/**
 * Execute ping command
 * @private
 */
async function executePing(client) {
  const admin = client.db().admin();
  return await admin.ping();
}

/**
 * Get server status
 * @private
 */
async function executeServerStatus(client) {
  const admin = client.db().admin();
  return await admin.serverStatus();
}

/**
 * List all databases
 * @private
 */
async function executeListDatabases(client) {
  const admin = client.db().admin();
  return await admin.listDatabases();
}

/**
 * Get build information
 * @private
 */
async function executeBuildInfo(client) {
  const admin = client.db().admin();
  return await admin.buildInfo();
}

/**
 * Get host information
 * @private
 */
async function executeHostInfo(client) {
  const admin = client.db().admin();
  return await admin.command({ hostInfo: 1 });
}

/**
 * Get current operations
 * @private
 */
async function executeCurrentOp(client, querySpec) {
  const admin = client.db().admin();
  const options = querySpec.options || {};
  return await admin.command({ currentOp: 1, ...options });
}

/**
 * Execute server-level update/modification operations
 * @param {Object} client - MongoDB client
 * @param {Object} updateSpec - Update specification
 * @returns {Promise<*>} Operation result
 */
export async function executeServerUpdate(client, updateSpec) {
  const { operation } = updateSpec;
  
  // Most server-level operations are administrative and read-only
  // But we might have some update operations in the future
  switch (operation) {
    case 'killOp':
      const admin = client.db().admin();
      return await admin.command({ killOp: 1, op: updateSpec.opId });
    
    default:
      throw new Error(`Unsupported server update operation: ${operation}`);
  }
}