# ResourceManager Neo4j Integration

## Overview
Successfully implemented Neo4j server handle in ResourceManager with full Docker container management and neo4j-driver integration.

## Completed Features

### 1. Lazy Service Initialization
- Services are started only when first requested via `getService()`
- Can configure auto-start services via `AUTO_START_SERVICES` environment variable
- Neo4j Docker container is managed automatically

### 2. Neo4j Server Handle
The `getNeo4jServer()` method returns a handle with:

```javascript
const neo4j = await resourceManager.getNeo4jServer();
```

#### Handle Properties:
- `uri` - Bolt connection URI (default: bolt://localhost:7687)
- `user` - Neo4j username (default: neo4j)
- `password` - Neo4j password (default: password123)
- `database` - Default database (default: neo4j)
- `driver` - The underlying neo4j-driver instance

#### Handle Methods:

##### Session Management
```javascript
const session = neo4j.session({ database: 'neo4j', mode: neo4j.WRITE });
```

##### Query Execution
```javascript
const result = await neo4j.run('MATCH (n) RETURN n LIMIT 10');
```

##### Transactions
```javascript
// Write transaction
const result = await neo4j.transaction(async (tx) => {
  await tx.run('CREATE (n:Person {name: $name})', { name: 'Alice' });
  return await tx.run('MATCH (n:Person) RETURN count(n)');
});

// Read-only transaction
const count = await neo4j.transaction(async (tx) => {
  const result = await tx.run('MATCH (n) RETURN count(n)');
  return result.records[0].get('count');
}, { readOnly: true });
```

##### Health Check
```javascript
const isHealthy = await neo4j.isHealthy();
```

##### Server Stats
```javascript
const stats = neo4j.getStats();
// Returns: { address, version, protocolVersion }
```

### 3. Docker Container Management
ResourceManager automatically:
1. Checks if Docker is running
2. Checks if `legion-neo4j` container exists
3. Starts existing container or creates new one
4. Waits for Neo4j to be ready before returning handle
5. Manages connection pooling (default: 50 connections)

### 4. Configuration
Environment variables (in .env file):
- `NEO4J_URI` - Override default bolt://localhost:7687
- `NEO4J_USER` - Override default neo4j
- `NEO4J_PASSWORD` - Override default password123
- `NEO4J_DATABASE` - Override default neo4j
- `NEO4J_MAX_CONNECTION_POOL_SIZE` - Override default 50
- `AUTO_START_SERVICES` - Comma-separated list of services to auto-start

## Usage Example

```javascript
import { ResourceManager } from '@legion/resource-manager';

async function example() {
  // Get ResourceManager singleton
  const rm = await ResourceManager.getInstance();
  
  // Get Neo4j handle (starts Docker container if needed)
  const neo4j = await rm.getNeo4jServer();
  
  // Execute queries
  const result = await neo4j.run(
    'CREATE (p:Person {name: $name}) RETURN p',
    { name: 'Bob' }
  );
  
  // Use transactions
  await neo4j.transaction(async (tx) => {
    await tx.run('CREATE (a:Person {name: "Alice"})');
    await tx.run('CREATE (b:Person {name: "Bob"})');
    await tx.run('MATCH (a:Person {name: "Alice"}), (b:Person {name: "Bob"}) CREATE (a)-[:KNOWS]->(b)');
  });
  
  // Check health
  if (await neo4j.isHealthy()) {
    console.log('Neo4j is running');
  }
}
```

## Testing
Run the integration test:
```bash
NODE_OPTIONS='--experimental-vm-modules' node neo4j/scripts/test-resourcemanager-integration.js
```

## Implementation Details

### File Changes:
1. **package.json** - Added neo4j-driver dependency
2. **ResourceManager.js** - Implemented:
   - `_initializeServiceManagement()` - Service registry setup
   - `getService()` - Generic lazy service getter
   - `getNeo4jServer()` - Neo4j-specific getter
   - `_createNeo4jHandle()` - Creates Neo4j handle with driver
   - `_checkNeo4jHealth()` - Health check implementation
   - `_startService()` - Docker container management
   - `_waitForService()` - Service readiness check

### Key Design Decisions:
1. **Lazy Initialization**: Services start only when needed, not at ResourceManager initialization
2. **Handle Caching**: Once created, handles are cached and reused
3. **Connection Pooling**: Built-in connection pooling via neo4j-driver
4. **Transaction Support**: Full support for read/write transactions
5. **Docker Integration**: Automatic container lifecycle management
6. **Test Environment**: Docker management skipped in test environments

## Next Steps
With ResourceManager integration complete, we can now proceed to:
1. Phase 1: Create Neo4j DataSource that uses ResourceManager
2. Implement Handle-based interface for graph operations
3. Add subscription support for real-time updates
4. Integrate with existing Legion patterns

## Date Completed
2024-01-29 11:00 UTC