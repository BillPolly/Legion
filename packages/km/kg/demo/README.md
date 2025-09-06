# Knowledge Graph System Demos

This directory contains comprehensive demonstrations of the Knowledge Graph system's capabilities. Each demo script showcases different aspects of the system and can be run independently.

## Available Demos

### 1. Basic Knowledge Graph Demo (`basic-kg-demo.js`)

**Purpose**: Demonstrates the core functionality of the Knowledge Graph system.

**Features Showcased**:
- Object serialization to knowledge graph triples
- Class definition serialization with methods and metadata
- Basic querying and data retrieval
- Object reconstruction from knowledge graph data
- Knowledge graph statistics and analysis
- Relationship discovery and exploration

**Run Command**:
```bash
node demo/basic-kg-demo.js
```

**What You'll See**:
- JavaScript objects being converted to RDF triples
- Class definitions stored as knowledge graph entities
- Queries finding people, companies, and relationships
- Objects reconstructed with working methods
- Statistical analysis of the knowledge graph content

### 2. Query System Demo (`query-system-demo.js`)

**Purpose**: Showcases the advanced query capabilities of the system.

**Features Showcased**:
- Pattern-based querying with variables and constraints
- Graph traversal with fixed and variable-length paths
- Logical query composition (AND, OR, NOT operations)
- Aggregation operations (COUNT, SUM, AVG, etc.)
- Complex multi-step query workflows
- Query performance tracking and statistics

**Run Command**:
```bash
node demo/query-system-demo.js
```

**What You'll See**:
- SPARQL-like pattern queries finding entities by type and properties
- Path traversal queries discovering connections between entities
- Logical combinations of queries for complex filtering
- Aggregation queries computing statistics across the knowledge graph
- Performance metrics and execution history

### 3. Storage System Demo (`storage-demo.js`)

**Purpose**: Demonstrates the different storage backends and their capabilities.

**Features Showcased**:
- In-memory storage for fast development and testing
- File-based persistent storage with JSON format
- Storage configuration and provider selection
- Batch operations for improved performance
- Storage metadata and statistical analysis
- Error handling and graceful degradation

**Run Command**:
```bash
node demo/storage-demo.js
```

**What You'll See**:
- Performance comparison between storage backends
- Data persistence across application restarts
- Configurable storage providers
- Batch vs individual operation performance
- Storage statistics and metadata
- Robust error handling examples

## Running All Demos

To run all demos in sequence:

```bash
# Run each demo individually
node demo/basic-kg-demo.js
node demo/query-system-demo.js
node demo/storage-demo.js
```

Or use the demo runner script:

```bash
node scripts/demo-runner.js
```

## Demo Data

The demos use sample data including:
- **People**: John Smith, Jane Doe, Bob Johnson with ages, cities, and relationships
- **Companies**: Acme Corp, Globex Inc with industries and employee relationships
- **Projects**: AI Platform, Mobile App with budgets, status, and worker assignments
- **Relationships**: knows, worksAt, worksOn connections between entities

## Expected Output

Each demo provides detailed console output showing:
- ✅ Success indicators for completed operations
- 📊 Statistics and metrics
- 🔍 Query results and data discoveries
- ⚠️ Error handling demonstrations
- 🎉 Summary of demonstrated capabilities

## System Requirements

- Node.js 16+ with ES modules support
- Write permissions for temporary demo files (storage demo)
- Approximately 50MB RAM for in-memory operations

## Troubleshooting

### Common Issues

1. **Module Import Errors**
   - Ensure you're running from the project root directory
   - Check that all dependencies are installed: `npm install`

2. **File Permission Errors** (Storage Demo)
   - Ensure write permissions in the demo directory
   - The storage demo creates temporary files that are cleaned up automatically

3. **Memory Issues**
   - The demos use small datasets and should run on any modern system
   - If you encounter memory issues, check for other running processes

### Getting Help

If you encounter issues:
1. Check the console output for specific error messages
2. Ensure you're running the latest version of the code
3. Verify Node.js version compatibility (16+)
4. Check file permissions for the demo directory

## Educational Value

These demos are designed to:
- **Illustrate Core Concepts**: Show how JavaScript objects become knowledge graph entities
- **Demonstrate Practical Usage**: Provide real-world examples of querying and data manipulation
- **Showcase Performance**: Compare different approaches and storage backends
- **Teach Best Practices**: Show proper error handling and system design patterns

## Next Steps

After running the demos, you might want to:
1. Explore the source code in the `src/` directory
2. Run the test suite: `npm test`
3. Try modifying the demo data to see how the system responds
4. Experiment with your own classes and objects
5. Build your own application using the knowledge graph system

## Demo Architecture

```
demo/
├── basic-kg-demo.js      # Core functionality demonstration
├── query-system-demo.js  # Advanced querying capabilities
├── storage-demo.js       # Storage backend comparison
├── README.md            # This documentation
└── demo-data/           # Temporary files (auto-created/cleaned)
```

Each demo is self-contained and can be run independently, making it easy to focus on specific aspects of the system that interest you most.
