# Markdown Reporter

## Overview

The MarkdownReporter generates beautifully formatted markdown documentation from MongoDB-stored knowledge graphs. It reads both ontology schema (RDF triples) and entity instances to produce comprehensive, human-readable reports.

## Features

- **📊 Statistics Tables** - Overview of ontology and entity counts
- **🏗️  Upper-Level Ontology** - Bootstrap categories and process-state relationships
- **🎯 Domain Ontology** - Classes categorized by type (PhysicalEntity, State, Process, Task)
- **🔗 Properties & Relationships** - Datatype properties and object properties with domains/ranges
- **💾 Entity Instances** - Actual data instances organized by category
- **⚙️  Process Details** - Preconditions, postconditions, and transforms for processes
- **🔀 Relationship Instances** - Links between entities with confidence scores

## Usage

### Programmatic Usage

```javascript
import { MongoTripleStore } from './stores/MongoTripleStore.js';
import { KnowledgeGraphStore } from '../../entity-store/src/KnowledgeGraphStore.js';
import { HierarchyTraversalService } from './services/HierarchyTraversalService.js';
import { MarkdownReporter } from './reporters/MarkdownReporter.js';
import { writeFile } from 'fs/promises';

// Setup connections
const tripleStore = new MongoTripleStore({
  connectionString: 'mongodb://localhost:27017',
  database: 'knowledge-graph',
  collection: 'ontology_triples'
});
await tripleStore.connect();

const hierarchyTraversal = new HierarchyTraversalService(tripleStore);

const knowledgeGraphStore = new KnowledgeGraphStore({
  connectionString: 'mongodb://localhost:27017',
  database: 'knowledge-graph',
  collection: 'knowledge_graph',
  hierarchyTraversal
});
await knowledgeGraphStore.connect();

// Create reporter
const reporter = new MarkdownReporter(
  tripleStore,
  knowledgeGraphStore,
  hierarchyTraversal
);

// Generate report
const report = await reporter.generateReport({
  title: 'Plumbing Knowledge Graph',
  domain: 'Plumbing',
  includeBootstrap: true,
  includeInstances: true,
  includeProcessDetails: true
});

// Save to file
await writeFile('report.md', report, 'utf-8');
```

### Command-Line Usage

```bash
# Generate report with defaults
node scripts/generate-report.js

# Custom database and output
node scripts/generate-report.js \
  --database my-kg \
  --output my-report.md \
  --title "My Knowledge Graph" \
  --domain "Manufacturing"

# Include bootstrap details
node scripts/generate-report.js \
  --include-bootstrap \
  --title "Full Technical Report"

# Schema only (no instances)
node scripts/generate-report.js \
  --no-instances \
  --output schema-only.md

# Help
node scripts/generate-report.js --help
```

## Configuration Options

### `generateReport(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `"Knowledge Graph Report"` | Report title |
| `domain` | string | `"General"` | Domain name for context |
| `includeBootstrap` | boolean | `false` | Show detailed bootstrap ontology structure |
| `includeInstances` | boolean | `true` | Include entity and relationship instances |
| `includeProcessDetails` | boolean | `true` | Show process preconditions/postconditions |

## Report Structure

### 1. Header

```markdown
# Knowledge Graph Report

**Domain:** Plumbing
**Generated:** 2025-10-02T21:00:00.000Z
**Generator:** Legion Knowledge Graph System
```

### 2. Overview Statistics

Tables showing:
- Total RDF triples
- Class, property, and relationship counts
- Entity and relationship instance counts
- Breakdown by type

### 3. Upper-Level Ontology

ASCII tree diagram showing:
```
owl:Thing
├── kg:Continuant (things that persist through time)
│   ├── kg:PhysicalEntity (material objects)
│   └── kg:State (conditions, configurations)
└── kg:Occurrent (things that happen)
    ├── kg:Process (natural/industrial transformations)
    └── kg:Task (planned, goal-directed activities)
```

Process-state relationships with domains and ranges.

### 4. Domain Ontology

Classes organized by category:

#### 🔧 Physical Entities
- WaterHeater
  - URI: `kg:WaterHeater`
  - Parent: `kg:PhysicalEntity`
  - Definition: A device that heats water...
  - Description: A type of PhysicalEntity that...

#### 📊 States
- Temperature, Pressure, etc.

#### ⚙️  Processes
- HeatingProcess, CoolingProcess, etc.

#### ✅ Tasks
- Maintenance, Inspection, etc.

### 5. Properties & Relationships

#### Datatype Properties
- temperature (`kg:temperature`)
  - Domain: `kg:Water`
  - Range: `xsd:string`

#### Object Properties
- requiresPrecondition (`kg:requiresPrecondition`)
  - Domain: `kg:Process`
  - Range: `kg:State`

### 6. Entity Instances

Actual data organized by category:

#### Physical Entity Instances
- Water Heater WH-101
  - Type: `kg:WaterHeater`
  - ID: `68dee99de526ab3b0394b3ed`
  - Attributes: {"capacity":50,"unit":"gallons"}
  - Confidence: 95%

#### Process Instances

With preconditions, postconditions, and transforms:

- Water Heating Process
  - **Preconditions:**
    - Inlet 50°F ({"value":50,"unit":"F"})
  - **Postconditions:**
    - Outlet 140°F ({"value":140,"unit":"F"})
  - **Transforms:**
    - Water Heater WH-101

#### Relationship Instances
- requires precondition
  - From: Water Heating (`kg:HeatingProcess`)
  - To: Inlet 50°F (`kg:InletTemperature`)
  - Confidence: 90%

## Use Cases

### 1. Documentation Generation

Generate human-readable documentation for knowledge graphs:

```javascript
const report = await reporter.generateReport({
  title: 'Plumbing System Knowledge Graph',
  domain: 'Plumbing',
  includeBootstrap: true,
  includeInstances: true,
  includeProcessDetails: true
});

await writeFile('docs/knowledge-graph.md', report);
```

### 2. Schema-Only Reports

Document ontology structure without instances:

```javascript
const schemaReport = await reporter.generateReport({
  title: 'Ontology Schema',
  includeBootstrap: false,
  includeInstances: false
});
```

### 3. Quick Summaries

Get statistics without full report:

```javascript
const summary = await reporter.generateSummary();
console.log(summary);
// ## Summary
// - **Ontology Classes:** 8
// - **Entity Instances:** 4
// - **Total RDF Triples:** 121
```

### 4. CI/CD Documentation

Auto-generate documentation in CI pipelines:

```bash
#!/bin/bash
# Generate report after ontology build
node scripts/generate-report.js \
  --mongo-uri $MONGO_URI \
  --database production-kg \
  --output docs/knowledge-graph-report.md \
  --title "Production Knowledge Graph" \
  --include-bootstrap
```

### 5. Knowledge Graph Snapshots

Create timestamped snapshots:

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
node scripts/generate-report.js \
  --output "snapshots/kg-report-$TIMESTAMP.md" \
  --title "Knowledge Graph Snapshot $TIMESTAMP"
```

## Example Output

See the complete example report at:
`__tests__/tmp/plumbing-report.md`

Key sections included:
- ✅ 8 ontology classes
- ✅ 7 relationships
- ✅ 4 entity instances
- ✅ 3 relationship instances
- ✅ Process preconditions/postconditions
- ✅ Upper-level ontology structure
- ✅ Domain-specific categorization

## Testing

Run the integration tests to see reports in action:

```bash
NODE_OPTIONS='--experimental-vm-modules' \
  npx jest __tests__/integration/MarkdownReporter.test.js \
  --runInBand --no-coverage
```

Tests demonstrate:
1. Comprehensive report generation
2. Summary statistics
3. Minimal reports (schema only)
4. Bootstrap details inclusion
5. Process detail tracking

## Architecture

### Dependencies

**Required:**
- MongoTripleStore - For RDF ontology schema
- KnowledgeGraphStore - For entity instances
- HierarchyTraversalService - For category inference

**Data Sources:**
1. `ontology_triples` collection - RDF triples
2. `knowledge_graph` collection - Entity/relationship instances

### Report Generation Flow

```
1. Query Statistics
   ├─ Triple store stats
   └─ Knowledge graph stats

2. Fetch Ontology
   ├─ Bootstrap classes
   ├─ Domain classes
   ├─ Properties
   └─ Relationships

3. Categorize Classes
   ├─ Physical Entities
   ├─ States
   ├─ Processes
   └─ Tasks

4. Fetch Instances
   ├─ Entities by category
   ├─ Relationships
   └─ Process details

5. Format Markdown
   ├─ Generate sections
   ├─ Apply formatting
   └─ Output report
```

## Performance

- **Small graphs (<100 triples)**: ~100ms
- **Medium graphs (<1000 triples)**: ~500ms
- **Large graphs (>1000 triples)**: ~2s

Optimization tips:
- Use `includeInstances: false` for schema-only reports
- Use `includeProcessDetails: false` to skip process queries
- Run during off-peak hours for large databases

## Future Enhancements

Potential improvements:
1. **Export Formats** - HTML, PDF, JSON
2. **Filtering** - Select specific classes/relationships
3. **Visualizations** - Generate diagrams (Mermaid, PlantUML)
4. **Diffs** - Compare two knowledge graph snapshots
5. **Validation Reports** - Schema compliance checks
6. **Interactive HTML** - Collapsible sections, search

## Summary

The MarkdownReporter provides:
- ✅ Beautiful, human-readable documentation
- ✅ Comprehensive coverage of schema and instances
- ✅ Flexible configuration options
- ✅ Command-line and programmatic interfaces
- ✅ Fast report generation
- ✅ Process modeling support
- ✅ Full test coverage

Perfect for documentation, CI/CD, snapshots, and knowledge graph exploration!
