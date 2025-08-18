# Script Consolidation Plan

## Summary
Consolidated 26+ scripts into 4 core scripts that enforce proper architecture (LoadingManager/ToolRegistry only).

## New Core Scripts (✅ COMPLETED)

### 1. `manager.js` - Main Management Script
**Purpose**: Complete pipeline management using LoadingManager
**Replaces**: 
- `full-loading-pipeline.js`
- `clear-database.js` 
- `populate-all-modules.js`
- `populate-all-modules-comprehensive.js`
- `populate-and-verify.js`
- `populate-vector-index.js`
- `simple-populate.js`
- `discover-all-modules.js`
- `discover-all-modules-comprehensive.js`
- `register-all-modules.js`
- `generate-perspectives.js`
- `generate-perspectives-simple.js`

**Commands**:
- `discover` - Module discovery
- `load` - Load modules to database
- `clear` - Clear database collections
- `pipeline` - Full loading pipeline
- `status` - Show pipeline status

### 2. `search.js` - Search and Testing Script
**Purpose**: All search functionality using ToolRegistry
**Replaces**:
- `test-tool-search.js`
- `test-registry-search.js`
- `test-semantic-search.js` (fixed but kept for now)

**Commands**:
- `test` - Basic search functionality
- `semantic` - Semantic search testing
- `registry` - Registry search methods
- `benchmark` - Performance benchmarking

### 3. `verify.js` - Comprehensive Verification Script
**Purpose**: MongoDB-Qdrant relationship verification using ToolRegistry.getLoader()
**Replaces**:
- `verify-database.js`
- `debug-schemas.js`
- `validate-and-fix-schemas.js`
- `validate-all-tools.js`
- `prove-qdrant-real.js`

**Commands**:
- `status` - Quick health check
- `stats` - Collection statistics
- `relationships` - Check data relationships
- `constraints` - Validate schema constraints
- `health` - Full system health report

### 4. `tools.js` - Tool Operations Script
**Purpose**: Tool execution and validation using ToolRegistry
**Replaces**:
- `test-tool-execution.js`
- `test-tool-execution-simple.js`
- `test-module-loading.js`
- `list-all-modules.js`

**Commands**:
- `execute` - Execute specific tools
- `validate` - Validate tool definitions
- `list` - List available tools
- `info` - Get tool information

## Scripts to Delete

### Obsolete Scripts (Ready for deletion):
1. `populate-all-modules.js` - ❌ Direct MongoDB operations
2. `populate-all-modules-comprehensive.js` - ❌ Direct operations
3. `populate-and-verify.js` - ❌ Direct operations
4. `populate-vector-index.js` - ❌ Direct operations
5. `simple-populate.js` - ❌ Direct operations
6. `discover-all-modules.js` - ❌ Direct operations
7. `discover-all-modules-comprehensive.js` - ❌ Direct operations
8. `register-all-modules.js` - ❌ Direct operations
9. `generate-perspectives.js` - ❌ Direct ToolIndexer operations
10. `generate-perspectives-simple.js` - ❌ Direct operations
11. `verify-database.js` - ❌ Direct provider access
12. `debug-schemas.js` - ❌ Direct operations
13. `validate-and-fix-schemas.js` - ❌ Direct operations
14. `validate-all-tools.js` - ❌ Direct operations
15. `prove-qdrant-real.js` - ❌ Direct operations
16. `test-tool-execution.js` - ❌ Direct operations
17. `test-tool-execution-simple.js` - ❌ Direct operations
18. `test-module-loading.js` - ❌ Direct operations
19. `list-all-modules.js` - ❌ Direct operations
20. `test-tool-search.js` - ❌ Direct provider access
21. `test-registry-search.js` - ❌ Direct provider access
22. `clean-duplicate-modules.js` - ❌ Direct operations
23. `verify-discovered-modules.js` - ❌ Direct operations

### Scripts to Keep Temporarily:
- `test-semantic-search.js` - ✅ FIXED to use ToolRegistry - keep for testing
- `test-qdrant-autostart.js` - Keep for Qdrant testing
- `full-loading-pipeline.js` - Keep until manager.js is fully tested

## Architecture Enforcement
All new scripts follow the rule:
- **ONLY** use LoadingManager or ToolRegistry
- **NO** direct database operations  
- **NO** direct provider access
- **NO** fallback patterns

## Key Improvements
1. **Reduced Complexity**: 26+ scripts → 4 core scripts
2. **Parameter-Driven**: Single scripts handle multiple use cases
3. **Architecture Compliance**: Enforces proper abstraction layers
4. **Better UX**: Consistent command interfaces and help
5. **Comprehensive Verification**: MongoDB-Qdrant relationship checking
6. **Auto-Repair**: Safe fixes for data integrity issues

## Testing Results
- ✅ All 4 new scripts show help correctly
- ✅ Semantic search script fixed and working
- ✅ Architecture enforcement successful
- ⚠️ Vector indexing issue confirmed (perspectives exist, vectors don't)

## Next Steps
1. Test core scripts with actual operations
2. Delete obsolete scripts
3. Update documentation
4. Fix vector indexing issue using the new manager.js pipeline