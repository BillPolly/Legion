# Neo4j Docker Setup Documentation

## Overview
This document captures the complete setup process for running Neo4j in Docker as part of the Legion ResourceManager infrastructure.

## Docker Setup

### 1. Initial Docker Run Command
```bash
docker run \
  --name legion-neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -v $(pwd)/packages/resource-manager/neo4j/data:/data \
  -v $(pwd)/packages/resource-manager/neo4j/logs:/logs \
  -v $(pwd)/packages/resource-manager/neo4j/import:/var/lib/neo4j/import \
  -v $(pwd)/packages/resource-manager/neo4j/plugins:/plugins \
  --env NEO4J_AUTH=neo4j/password123 \
  --env NEO4J_PLUGINS='["apoc"]' \
  --env NEO4J_apoc_export_file_enabled=true \
  --env NEO4J_apoc_import_file_enabled=true \
  --env NEO4J_apoc_import_file_use__neo4j__config=true \
  --env NEO4J_dbms_security_allow__csv__import__from__file__urls=true \
  neo4j:5.13.0
```

### 2. Ports
- **7474**: HTTP port for Neo4j Browser
- **7687**: Bolt port for database connections

### 3. Default Credentials
- Username: `neo4j`
- Password: `password123`

### 4. Volume Mounts
- `/data`: Database files
- `/logs`: Log files
- `/import`: Import directory for CSV/JSON files
- `/plugins`: Plugin directory (e.g., APOC)

## Testing Connectivity

### 1. Browser Access
Open http://localhost:7474 in a web browser

### 2. Curl Test for HTTP API
```bash
# Test basic connectivity
curl -X GET http://localhost:7474/db/neo4j/ \
  -u neo4j:password123

# Get database info
curl -X POST http://localhost:7474/db/neo4j/tx/commit \
  -u neo4j:password123 \
  -H "Content-Type: application/json" \
  -d '{"statements":[{"statement":"CALL dbms.components() YIELD name, versions RETURN name, versions"}]}'
```

### 3. Cypher Shell Test
```bash
# Connect via cypher-shell (if installed)
docker exec -it legion-neo4j cypher-shell \
  -u neo4j \
  -p password123 \
  -d neo4j
```

### 4. Node.js Connection Test
```javascript
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password123')
);

async function testConnection() {
  const session = driver.session();
  try {
    const result = await session.run('RETURN 1 as number');
    console.log('Connection successful:', result.records[0].get('number'));
  } finally {
    await session.close();
    await driver.close();
  }
}
```

## Common Commands

### Start/Stop Container
```bash
# Stop
docker stop legion-neo4j

# Start
docker start legion-neo4j

# Restart
docker restart legion-neo4j

# Remove (warning: removes container but not volumes)
docker rm legion-neo4j

# View logs
docker logs legion-neo4j
docker logs -f legion-neo4j  # Follow logs
```

### Container Management
```bash
# Check if running
docker ps | grep neo4j

# Check all containers (including stopped)
docker ps -a | grep neo4j

# Inspect container
docker inspect legion-neo4j
```

## Troubleshooting

### Port Already in Use
If ports 7474 or 7687 are already in use:
```bash
# Check what's using the port
lsof -i :7474
lsof -i :7687

# Use different ports in docker run:
# -p 7475:7474 -p 7688:7687
```

### Permission Issues
If you get permission errors with volumes:
```bash
# Fix permissions
chmod -R 777 packages/resource-manager/neo4j/data
chmod -R 777 packages/resource-manager/neo4j/logs
```

### Memory Issues
Neo4j requires significant memory. If container crashes:
```bash
# Run with memory limits
docker run \
  --memory="2g" \
  --memory-swap="4g" \
  ...
```

## Integration with ResourceManager

The ResourceManager will:
1. Check if `legion-neo4j` container exists
2. Start it if stopped
3. Create it if it doesn't exist
4. Wait for Neo4j to be ready (check HTTP endpoint)
5. Provide connection details to DataSource

Environment variables that can override defaults:
- `NEO4J_URI`: Override default bolt://localhost:7687
- `NEO4J_USER`: Override default neo4j
- `NEO4J_PASSWORD`: Override default password123
- `NEO4J_DATABASE`: Override default neo4j

## Date Created
2024-01-29