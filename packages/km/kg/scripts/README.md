# Knowledge Graph System - Demo Scripts

This directory contains interactive demo scripts that showcase the capabilities of the JavaScript Knowledge Graph System.

## Available Scripts

### 🎯 Interactive Demo Runner
```bash
npm run demo
```

Launches an interactive menu-driven demo runner that lets you:
- Run individual demos by category (Core, Relationships, Beliefs, RDF, Storage)
- Run all demos sequentially
- View detailed information about each demo
- See performance metrics and results summaries

**Features:**
- ✨ Colorized terminal output
- ⏱️ Performance timing for each demo
- 📊 Results summaries with statistics
- 🎨 Organized by difficulty level (Beginner/Intermediate/Advanced)
- 🔄 Interactive menu navigation
- ❌ Graceful error handling with stack traces (when DEBUG=1)

### 🧪 Example Test Runner
```bash
npm run test-examples
```

Runs all examples programmatically to verify they work correctly. Useful for:
- CI/CD validation
- Quick verification after code changes
- Debugging example issues

## Available Demos

### 1. **Comprehensive System Demo** ⭐ *[Advanced]*
*Complete demonstration of all KG features*
- Relationship reification with metadata
- Multi-agent belief systems
- Method execution tracking
- Tool registration with dependencies
- Goal-based planning
- Schema generation (JSON Schema, OpenAPI, LLM tools)
- Multi-format export (Turtle, JSON-LD, N-Triples, RDF/XML, Cypher, GraphML)
- Schema evolution
- Complex queries
- Full round-trip testing

**Estimated Time:** 2-3 minutes

### 2. **Full Round-Trip Example** 🔄 *[Intermediate]*
*JavaScript objects → KG → RDF → KG → JavaScript objects*
- Create JavaScript classes and objects
- Serialize to knowledge graph
- Export to multiple RDF formats (Turtle, JSON-LD, N-Triples)
- Import back from RDF
- Reconstruct JavaScript objects and classes
- Test functionality preservation

**Estimated Time:** 1-2 minutes

### 3. **Relationship Reification Demo** 🔗 *[Intermediate]*
*Advanced relationship modeling with metadata*
- Create rich relationships with properties
- Temporal information (start/end dates)
- Confidence scores and provenance
- Context and source tracking
- Export as property graph (Cypher)

**Estimated Time:** 30 seconds

### 4. **Agent Belief System Demo** 🤖 *[Advanced]*
*Multi-agent knowledge representation*
- Multiple agents with individual beliefs
- Confidence and uncertainty modeling
- Belief sources (observation, inference, communication)
- Temporal belief tracking
- Query beliefs by agent and confidence

**Estimated Time:** 30 seconds

### 5. **RDF Import/Export Demo** 📄 *[Beginner]*
*Parse and generate standard RDF formats*
- Import from Turtle format
- Parse complex RDF with comments
- Handle multiple namespaces
- Type preservation (strings, numbers, booleans)
- Export to multiple formats

**Estimated Time:** 30 seconds

### 6. **Storage Abstraction Demo** 💾 *[Intermediate]*
*Pluggable storage backends*
- Multiple storage provider configurations
- Async/sync API compatibility
- Batch operations
- Performance metrics
- Backward compatibility demonstration

**Estimated Time:** 1 minute

### 7. **Storage Configuration Demo** ⚙️ *[Beginner]*
*Storage provider configuration and validation*
- Default configurations for all storage types
- Configuration validation
- Error handling examples
- Best practices

**Estimated Time:** 30 seconds

## Demo Categories

### 🎯 **Complete**
Full-featured demonstrations showing the entire system working together.

### 🔧 **Core**
Fundamental KG operations like serialization, round-trip conversion, and basic functionality.

### 🔗 **Relationships**
Advanced relationship modeling, reification, and metadata handling.

### 🤖 **Beliefs**
Multi-agent systems, belief tracking, confidence modeling, and provenance.

### 📄 **RDF**
Standards compliance, import/export, format conversion, and interoperability.

### 💾 **Storage**
Storage abstraction, configuration, performance, and backend integration.

## Usage Examples

### Run a specific demo:
```bash
npm run demo
# Then select option 1-7 from the menu
```

### Run all demos:
```bash
npm run demo
# Then select 'a' for "Run All Demos"
```

### Test all examples programmatically:
```bash
npm run test-examples
```

### Enable debug output:
```bash
DEBUG=1 npm run demo
```

## Demo Output Features

- **🎨 Colorized Output**: Different colors for success, errors, info, and categories
- **⏱️ Performance Timing**: Precise timing for each demo execution
- **📊 Results Summary**: Statistics about objects created, relationships, exports, etc.
- **❌ Error Handling**: Graceful error handling with optional stack traces
- **🔄 Interactive Navigation**: Easy menu-driven interface
- **📋 Detailed Information**: Comprehensive demo descriptions and metadata

## Technical Details

### Dependencies
The interactive demo runner (`demo-runner.js`) requires external packages:
- `inquirer` - Interactive command line prompts
- `chalk` - Terminal string styling

The simple demo runner (`simple-demo-runner.js`) uses only built-in Node.js modules:
- `readline` - User input handling
- `perf_hooks` - Performance timing
- ANSI color codes for terminal styling

### File Structure
```
scripts/
├── README.md                 # This file
├── demo-runner.js           # Full-featured demo runner (requires deps)
├── simple-demo-runner.js    # Dependency-free demo runner
└── test-examples.js         # Automated example testing
```

### Error Handling
- Graceful degradation when examples fail
- Detailed error messages with context
- Optional stack traces (DEBUG=1)
- Continue execution after individual demo failures
- Summary statistics for batch runs

## Contributing

When adding new examples:

1. Add the example function to the appropriate file in `src/examples/`
2. Import it in both demo runners
3. Add it to the `DEMOS` array with appropriate metadata:
   - `id`: Unique identifier
   - `name`: Display name
   - `description`: Brief description
   - `category`: One of the existing categories
   - `difficulty`: Beginner/Intermediate/Advanced
   - `estimatedTime`: Expected runtime
   - `function`: The example function to execute

4. Update this README with the new demo information
5. Test with `npm run test-examples`

## Troubleshooting

### Common Issues

**"Cannot find package 'inquirer'"**
- The full demo runner requires dependencies
- Use `npm run demo` (which uses simple-demo-runner.js)
- Or install dependencies if you want the full-featured version

**Examples fail with import errors**
- Ensure you're running from the project root directory
- Check that all source files exist in `src/examples/`

**Performance issues**
- Some demos (especially Comprehensive) process large amounts of data
- This is expected behavior demonstrating system capabilities
- Use individual demos for faster testing

### Debug Mode
Enable detailed logging:
```bash
DEBUG=1 npm run demo
```

This shows:
- Full stack traces for errors
- Additional timing information
- Detailed execution flow
