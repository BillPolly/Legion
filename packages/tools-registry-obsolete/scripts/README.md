# Tool Registry Scripts

## Overview

This directory contains **4 core scripts** that provide comprehensive management of the Legion tool registry system. All scripts enforce proper architecture by only using LoadingManager and ToolRegistry abstractions.

## Core Scripts

### 🚀 `manager.js` - Main Management Script
Complete pipeline management using LoadingManager only.

```bash
# Discover all modules
./manager.js discover --verbose

# Load modules to database  
./manager.js load --module file

# Clear database collections
./manager.js clear --clear --confirm

# Run full pipeline
./manager.js pipeline --clear --verbose

# Check pipeline status
./manager.js status
```

**Commands**: `discover`, `load`, `clear`, `pipeline`, `status`

### 🔍 `search.js` - Search and Testing Script
All search functionality using ToolRegistry only.

```bash
# Test basic search
./search.js test --verbose

# Test semantic search
./search.js semantic --query "read files from disk"

# Test registry methods
./search.js registry --module file

# Benchmark performance
./search.js benchmark --verbose
```

**Commands**: `test`, `semantic`, `registry`, `benchmark`

### ✅ `verify.js` - Comprehensive Verification Script
MongoDB-Qdrant relationship verification using ToolRegistry.getLoader() only.

```bash
# Quick health check
./verify.js status --verbose

# Collection statistics
./verify.js stats --collection tools

# Check data relationships
./verify.js relationships --deep

# Validate schema constraints
./verify.js constraints --fix

# Full system health report
./verify.js health --verbose
```

**Commands**: `status`, `stats`, `relationships`, `constraints`, `health`

### ⚡ `tools.js` - Tool Operations Script
Tool execution and validation using ToolRegistry only.

```bash
# List available tools
./tools.js list --module file

# Execute a specific tool
./tools.js execute calculator --args '{"expression": "10 + 5"}'

# Validate tool definitions
./tools.js validate --verbose

# Get tool information
./tools.js info file_read --verbose
```

**Commands**: `execute`, `validate`, `list`, `info`

## Test Scripts

### `test-semantic-search.js`
Fixed semantic search test script (uses ToolRegistry pattern).

### `test-qdrant-autostart.js`
Qdrant connection testing utility.

## Architecture Enforcement

All scripts follow strict architectural rules:

- ✅ **ONLY** use LoadingManager or ToolRegistry
- ❌ **NO** direct MongoDB operations
- ❌ **NO** direct provider access
- ❌ **NO** fallback patterns or mock implementations

## Before/After Comparison

| Before | After |
|--------|-------|
| 26+ individual scripts | 4 core scripts |
| Direct database operations | LoadingManager/ToolRegistry only |
| Inconsistent interfaces | Unified command patterns |
| No relationship verification | Comprehensive MongoDB-Qdrant checks |
| No auto-repair capabilities | Safe data integrity fixes |

## Key Features

### 🔧 **Comprehensive Management**
- Full module discovery and loading pipeline
- Database clearing with preservation options
- Status tracking and error reporting

### 🔍 **Advanced Search Testing**
- Basic text search validation
- Semantic search with confidence scoring
- Performance benchmarking
- Query pattern analysis

### ✅ **Deep Verification**
- MongoDB-Qdrant relationship integrity
- Schema constraint validation
- Orphaned record detection
- Vector synchronization checks
- Auto-repair capabilities

### ⚡ **Tool Operations**
- Tool execution with parameter validation
- Comprehensive tool validation
- Multiple output formats (table, JSON, detail)
- Tool information and structure analysis

## Usage Examples

### Complete Setup Pipeline
```bash
# 1. Discover and load everything
./manager.js pipeline --clear --verbose

# 2. Verify system health
./verify.js health --verbose

# 3. Test search functionality
./search.js test --verbose

# 4. Validate all tools
./tools.js validate --verbose
```

### Troubleshooting Vector Issues
```bash
# Check vector synchronization
./verify.js relationships --deep

# Clear and reload with vectors
./manager.js pipeline --clear --verbose

# Test semantic search
./search.js semantic --query "test query"
```

### Module-Specific Operations
```bash
# Work with specific module
./manager.js load --module calculator
./tools.js list --module calculator  
./tools.js execute calculator --args '{"expression": "2 + 2"}'
```

## Important Notes

- **⚠️ Backup First**: Use `--fix` options carefully as they modify data
- **🔍 Deep Checks**: Use `--deep` for exhaustive verification (slower)
- **📊 Verbose Output**: Add `--verbose` for detailed operation logs
- **🚀 Vector Requirements**: Perspectives and vectors require Qdrant running

This consolidation reduces complexity while providing more powerful, consistent, and architecturally sound tools for managing the Legion tool registry system.