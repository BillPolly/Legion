# Tools Registry

A sophisticated registry system for managing tools and their perspectives with MongoDB storage and single LLM call optimization.

## Overview

The Tools Registry provides a complete solution for:
- 🔧 **Tool Management** - Load and organize tools from modules
- 📊 **Perspective Generation** - Generate multiple viewpoints for each tool in a single LLM call
- 🔍 **Search & Discovery** - Find tools and perspectives efficiently
- 📈 **Analytics** - Track coverage and usage statistics

## Quick Start

```bash
# Initialize and load sample data
npm install
node scripts/reset-database.js --all --confirm
node scripts/load-tools.js
node scripts/generate-perspectives.js
node scripts/check-status.js --verbose
```

## Documentation

- **[3-Collection Architecture](./docs/3-COLLECTION-ARCHITECTURE.md)** - Detailed architecture overview
- **[API Reference](./docs/API.md)** - Complete API documentation  
- **[Perspectives Guide](./docs/PERSPECTIVES-README.md)** - Quick start and usage guide

## Key Features

### 🚀 Single LLM Call Perspective Generation
Generate all perspective types (examples, semantics, relations, troubleshooting) in one efficient API call instead of separate calls.

```javascript
// Old way: 4 separate LLM calls
const examples = await generateExamples(tool);
const semantic = await generateSemantic(tool);  
const related = await generateRelated(tool);
const troubleshoot = await generateTrouble(tool);

// New way: 1 LLM call for all perspectives
const allPerspectives = await perspectives.generatePerspectivesForTool(tool);
```

### 📊 3-Collection MongoDB Architecture
Relational design with optimal performance:
- `perspective_types` - Perspective definitions
- `tools` - Tool metadata  
- `tool_perspectives` - Generated perspectives

### 🎯 Canonical CLI Scripts
Production-ready scripts for all operations:

```bash
node scripts/load-tools.js          # Load tools from modules
node scripts/generate-perspectives.js  # Generate perspectives  
node scripts/check-status.js        # System health check
node scripts/reset-database.js      # Clean database
```

## Installation

```bash
npm install
```

**Requirements:**
- Node.js 16+
- MongoDB running locally or configured via `MONGODB_URL`
- Optional: Anthropic API key for perspective generation

## Basic Usage

```javascript
import { ResourceManager } from '@legion/resource-manager';
import { Perspectives, DatabaseStorage } from '@legion/tools-registry';

// Initialize system
const resourceManager = await ResourceManager.getResourceManager();
const databaseStorage = new DatabaseStorage({ resourceManager });
await databaseStorage.initialize();

const perspectives = new Perspectives({ resourceManager });
await perspectives.initialize();

// Generate perspectives for a tool
const results = await perspectives.generatePerspectivesForTool('file_read');
console.log(`Generated ${results.length} perspectives`);

// Search perspectives
const searchResults = await perspectives.searchPerspectives('file handling');
```

## Architecture

### Core Components

- **DatabaseStorage** - MongoDB operations and connection management
- **DatabaseInitializer** - Auto-setup, seeding, and indexing  
- **Perspectives** - Main class for perspective generation and retrieval
- **PerspectiveTypeManager** - Manage perspective type definitions
- **ModuleLoader** - Load tools from modules
- **ModuleRegistry** - Register and organize modules

### Data Flow

```
Modules → Tools Collection → Perspective Generation → Tool Perspectives Collection
                ↓
         Perspective Types Collection (definitions)
```

## CLI Scripts

All scripts are self-documenting with `--help`:

### Load Tools
```bash
node scripts/load-tools.js --help
# Examples:
node scripts/load-tools.js --module FileModule
node scripts/load-tools.js --clear --verbose
```

### Generate Perspectives  
```bash
node scripts/generate-perspectives.js --help
# Examples:
node scripts/generate-perspectives.js --tool file_read
node scripts/generate-perspectives.js --module FileModule --force
```

### Check System Status
```bash
node scripts/check-status.js --help  
# Examples:
node scripts/check-status.js
node scripts/check-status.js --verbose
```

### Reset Database
```bash
node scripts/reset-database.js --help
# Examples:
node scripts/reset-database.js --perspectives
node scripts/reset-database.js --all --confirm
```

## Testing

The package includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Unit tests
npm test __tests__/unit/

# Integration tests  
npm test __tests__/integration/

# Test with verbose output
npm test -- --verbose
```

### Mock Mode
When no LLM client is configured, the system automatically uses mock generation for testing:

```javascript
// Automatically detects missing LLM client and uses mocks
const perspectives = await perspectives.generatePerspectivesForTool('test_tool');
```

## API Reference

### Main Classes

- **[Perspectives](./docs/API.md#perspectives-class)** - Primary interface
- **[PerspectiveTypeManager](./docs/API.md#perspectivetypemanager-class)** - Type management
- **[DatabaseInitializer](./docs/API.md#databaseinitializer-class)** - Setup and seeding
- **[DatabaseStorage](./docs/API.md#databasestorage-class)** - Database operations

### Key Methods

```javascript
// Generate perspectives (single LLM call)
const perspectives = await perspectives.generatePerspectivesForTool(toolName);

// Batch generation for module
const results = await perspectives.generateForModule(moduleName);

// Search perspectives
const matches = await perspectives.searchPerspectives(query);

// Get statistics
const stats = await perspectives.getStatistics();
```

## Configuration

### Environment Variables

```bash
# Required
MONGODB_URL=mongodb://localhost:27017

# Optional - for perspective generation
ANTHROPIC_API_KEY=your_key_here

# Optional - database name (default: legion_tools)
TOOLS_DB_NAME=legion_tools
```

### ResourceManager Integration

All configuration is handled through the ResourceManager singleton:

```javascript
// ResourceManager automatically loads from .env
const resourceManager = await ResourceManager.getResourceManager();
const dbUrl = resourceManager.get('env.MONGODB_URL');
```

## Performance

### Benchmarks
- **Perspective Generation**: ~2-3 seconds for all 4 types (single LLM call)
- **Tool Loading**: ~50 tools/second
- **Search Queries**: <50ms with indexes
- **Statistics**: <100ms with aggregation pipeline

### Optimization Features
- Single LLM call generation (75% cost reduction)
- MongoDB bulk operations for batch saves
- Automatic indexing for fast queries
- Connection pooling and reuse

## Migration

### From Old JSON-Based System

```bash
# 1. Reset database
node scripts/reset-database.js --all --confirm

# 2. Load tools 
node scripts/load-tools.js

# 3. Generate perspectives
node scripts/generate-perspectives.js

# 4. Verify migration
node scripts/check-status.js --verbose
```

## Troubleshooting

### Common Issues

**No perspectives generated:**
- Check LLM client configuration
- Try dry run: `node scripts/generate-perspectives.js --dry-run`
- Use mock mode for testing

**Slow queries:**
- Run status check: `node scripts/check-status.js`
- Verify indexes are created
- Check MongoDB performance

**Module loading errors:**
- Ensure modules follow standard interface
- Check module paths and exports
- Use verbose flag: `--verbose`

### Debugging

```bash
# Check system health
node scripts/check-status.js --verbose

# Test specific operations
node scripts/generate-perspectives.js --tool file_read --verbose

# Reset if corrupted
node scripts/reset-database.js --all --confirm
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Ensure all tests pass
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

### Development Workflow

```bash
# Setup development environment
npm install
node scripts/reset-database.js --all --confirm

# Make changes and test
npm test

# Test specific component
npm test __tests__/unit/Perspectives.test.js

# Integration test
npm test __tests__/integration/
```

## License

Part of the Legion framework - see main LICENSE file.

## Support

- **Documentation**: See `/docs` directory
- **Issues**: Open issue on GitHub
- **Status Check**: `node scripts/check-status.js`
- **Verbose Logs**: Add `--verbose` to any script